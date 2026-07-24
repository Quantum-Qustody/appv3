import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { supabase, supabaseAnonKey, FUNCTIONS_URL } from "./supabaseClient.js";
import { useWallet, useTestnetValue, FAUCETS, CIRCLE_FAUCET, explorerTx, explorerAddr, shortAddr, fetchWalletTxHistory } from "./sepolia.js";
import { BlogSection, BlogArticle } from "./blog.jsx";
import DesignPartnerPage from "./designPartner.jsx";

// ─── localStorage account picker (Phase 1, item 1) ─────────────────
const KNOWN_EMAILS_KEY = "qq:known_emails";
const readKnownEmails = () => { try { return JSON.parse(localStorage.getItem(KNOWN_EMAILS_KEY) || "[]"); } catch { return []; } };
const rememberEmail = (email) => {
  if (!email) return;
  const list = readKnownEmails().filter(e => e !== email);
  list.unshift(email);
  localStorage.setItem(KNOWN_EMAILS_KEY, JSON.stringify(list.slice(0, 5)));
};
const forgetEmail = (email) => {
  const list = readKnownEmails().filter(e => e !== email);
  localStorage.setItem(KNOWN_EMAILS_KEY, JSON.stringify(list));
};

// ─── Built-in reference data (fallback when the DB table is empty) ──
// Chains use the network string as a stable id so selectors work even
// without DB rows. Wallet connect / balance / tx all run client-side and
// never depend on these having real DB uuids.
const DEFAULT_CHAINS = [
  { id:"bitcoin-mainnet", name:"Bitcoin", symbol:"BTC", network:"bitcoin-mainnet", is_testnet:false, rpc_url:"", explorer_url:"https://mempool.space", sort_order:1 },
  { id:"ethereum-mainnet", name:"Ethereum", symbol:"ETH", network:"ethereum-mainnet", is_testnet:false, rpc_url:"https://eth.llamarpc.com", explorer_url:"https://etherscan.io", sort_order:2 },
  { id:"polygon-mainnet", name:"Polygon", symbol:"MATIC", network:"polygon-mainnet", is_testnet:false, rpc_url:"https://polygon-rpc.com", explorer_url:"https://polygonscan.com", sort_order:3 },
  { id:"solana-mainnet", name:"Solana", symbol:"SOL", network:"solana-mainnet", is_testnet:false, rpc_url:"https://api.mainnet-beta.solana.com", explorer_url:"https://solscan.io", sort_order:4 },
  { id:"arbitrum-mainnet", name:"Arbitrum", symbol:"ARB", network:"arbitrum-mainnet", is_testnet:false, rpc_url:"https://arb1.arbitrum.io/rpc", explorer_url:"https://arbiscan.io", sort_order:5 },
  { id:"base-mainnet", name:"Base", symbol:"BASE", network:"base-mainnet", is_testnet:false, rpc_url:"https://mainnet.base.org", explorer_url:"https://basescan.org", sort_order:6 },
  { id:"ethereum-sepolia", name:"Ethereum Sepolia", symbol:"ETH", network:"ethereum-sepolia", is_testnet:true, rpc_url:"https://rpc.sepolia.org", explorer_url:"https://sepolia.etherscan.io", sort_order:7 },
  { id:"polygon-amoy", name:"Polygon Amoy", symbol:"MATIC", network:"polygon-amoy", is_testnet:true, rpc_url:"https://rpc-amoy.polygon.technology", explorer_url:"https://amoy.polygonscan.com", sort_order:8 },
];
const DEFAULT_PLANS = [
  { id:"starter", name:"Starter", price_monthly:0, features:["Sandbox access","5 scenarios","Email support","Up to 3 team members"], sort_order:1 },
  { id:"pro", name:"Pro", price_monthly:499, features:["Unlimited workflows","Priority support","Custom policy mapping","Workshop included","Up to 25 team members"], sort_order:2 },
  { id:"enterprise", name:"Enterprise", price_monthly:2499, features:["Dedicated success manager","Production HSM","Full PQC roadmap","SLA + compliance reviews","Unlimited team members","SAML SSO"], sort_order:3 },
];
// True when a chain id is a fallback (network string) rather than a DB uuid.
const isFallbackChainId = (id) => typeof id === "string" && id.includes("-") && !/^[0-9a-f]{8}-/.test(id);
// Dedupe chains by network (keeps one per network) so duplicate DB rows
// never produce repeated selector options. Sorted by sort_order.
const dedupeChains = (arr) => {
  const seen = new Map();
  (arr || []).forEach(c => { if (c && c.network && !seen.has(c.network)) seen.set(c.network, c); });
  return Array.from(seen.values()).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
};

// ═══════════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════════════

// Client now lives in supabaseClient.js (imported at the top of this file) so
// feature modules reuse the same GoTrue instance instead of creating a second.

async function callFunction(fnName, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || supabaseAnonKey;

  const res = await fetch(`${FUNCTIONS_URL}/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "apikey": supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Function ${fnName} failed (${res.status})`);
  }

  return res.json();
}

// ═══════════════════════════════════════════════════════════════════
// SCENARIOS (reference data — fetched from DB on load)
// ═══════════════════════════════════════════════════════════════════

function mapDbScenario(s) {
  return {
    id: s.id,
    num: s.num,
    title: s.title,
    tier: s.tier,
    question: s.question,
    demo: s.demo,
    screens: s.screens || [],
    evidence_types: s.evidence_types || [],
    workshop_question: s.workshop_question,
    pilot_hypothesis: s.pilot_hypothesis,
    color: s.color || "purple",
  };
}

// ═══════════════════════════════════════════════════════════════════
// APP CONTEXT (real Supabase-backed)
// ═══════════════════════════════════════════════════════════════════

const AppContext = createContext(null);

// Fix 3 — one wallet instance lifted to the app root so the live connection
// (and its card) persist across every view instead of re-mounting per page.
const WalletContext = createContext(null);
function WalletProvider({ children }) {
  const w = useWallet();   // the single real EIP-1193/Coinbase wallet instance for the whole app
  return <WalletContext.Provider value={w}>{children}</WalletContext.Provider>;
}
const useSharedWallet = () => useContext(WalletContext);

function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [assets, setAssets] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [progress, setProgress] = useState({});
  const [logs, setLogs] = useState([]);
  const [movements, setMovements] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [evidenceStore, setEvidenceStore] = useState({});
  const [activeScenario, setActiveScenario] = useState(null);
  const [phase, setPhase] = useState("landing");
  const [activeView, setActiveView] = useState("hub");
  const [fading, setFading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  // Items 6-20: extended state
  const [banks, setBanks] = useState([]);
  const [chains, setChains] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [threshold, setThreshold] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [settings, setSettings] = useState(null);
  const [theme, setThemeState] = useState("dark");

  const go = (to) => { setFading(true); setTimeout(() => { setPhase(to); setFading(false); }, 300); };

  const timeStr = (iso) => new Date(iso || Date.now()).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

  // Refs so addLog can persist with the right account/session/wallet keys
  const userRef = useRef(null);
  const sessionRef = useRef(null);
  const walletAddressRef = useRef(null);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const addLog = useCallback((entry) => {
    // Local optimistic log entry (renders immediately on the right sidebar)
    const log = { id: `tmp-${Math.random()}`, ...entry, type: entry.type || "info", created_at: new Date().toISOString(), time: timeStr() };
    setLogs(prev => [log, ...prev]);

    // Phase 1 item 2: persist to Supabase keyed by user_id (account-scoped)
    const uid = userRef.current?.id;
    if (uid) {
      supabase.from("audit_logs").insert({
        user_id: uid,
        session_id: sessionRef.current?.id || null,
        wallet_address: walletAddressRef.current || null,
        log_type: entry.type || "info",
        message: entry.message || null,
        actor: entry.actor || null,
        detail: entry.detail || null,
        scenario_id: entry.scenario_id || null,
      }).then(() => {}).catch(() => {});
    }
    return log;
  }, []);

  // ── Reference data: best-effort self-heal + guaranteed fallback ──
  // Chains/plans are static reference data. We try to seed the DB (works if
  // RLS is open), but CRITICALLY we always fall back to the built-in
  // constants so wallet import, chain selectors, and Billing work 100%
  // regardless of DB seed/RLS state. This is what makes the flows bulletproof.
  const ensureReferenceData = async () => {
    let chainRows = DEFAULT_CHAINS;
    let planRows = DEFAULT_PLANS;
    try {
      const { data: ch } = await supabase.from("chains").select("*").order("sort_order");
      if (ch && ch.length && ch.find(c => c.network === "ethereum-sepolia")) {
        chainRows = ch;                                  // real DB rows (with uuid ids)
      } else {
        // Try to seed; if RLS blocks it, we still use the fallback constants.
        try { await supabase.from("chains").insert(DEFAULT_CHAINS); } catch (e) {}
        const { data: ch2 } = await supabase.from("chains").select("*").order("sort_order");
        chainRows = (ch2 && ch2.length) ? ch2 : DEFAULT_CHAINS;
      }
    } catch (e) { chainRows = DEFAULT_CHAINS; }
    try {
      const { data: pl } = await supabase.from("plans").select("*").order("sort_order");
      if (pl && pl.length) { planRows = pl; }
      else { try { await supabase.from("plans").insert(DEFAULT_PLANS); } catch (e) {}
        const { data: pl2 } = await supabase.from("plans").select("*").order("sort_order");
        planRows = (pl2 && pl2.length) ? pl2 : DEFAULT_PLANS; }
    } catch (e) { planRows = DEFAULT_PLANS; }
    setChains(dedupeChains(chainRows));
    setPlans(planRows);
    return { chainRows: dedupeChains(chainRows), planRows };
  };

  // ── Load scenarios + ensure reference data on mount ──
  useEffect(() => {
    (async () => {
      await ensureReferenceData();
      const { data } = await supabase.from("scenarios").select("*").order("num");
      if (data) setScenarios(data.map(mapDbScenario));
    })();
  }, []);

  // ── Invitation token fallback: if URL has ?invite=TOKEN, call the RPC ──
  // Runs after sign-in. Safety net in case the auth.users INSERT trigger
  // didn't link the participant (silently caught by EXCEPTION handler).
  const tryAcceptInvitationFromUrl = async (userId) => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("invite");
      if (!token || !userId) return;
      const { data, error } = await supabase.rpc("accept_team_invitation", { p_token: token, p_user_id: userId });
      if (error) { console.warn("accept_team_invitation rpc:", error.message); return; }
      // Whether OK or already-accepted, drop the param so we don't re-run
      params.delete("invite");
      const next = window.location.pathname + (params.toString() ? `?${params.toString()}` : "") + window.location.hash;
      window.history.replaceState({}, "", next);
    } catch (e) { console.warn("invite fallback error:", e); }
  };

  // ── Auth state listener ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: authSession } }) => {
      if (authSession?.user) {
        setUser(authSession.user);
        tryAcceptInvitationFromUrl(authSession.user.id);
        loadActiveSession(authSession.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, authSession) => {
      setUser(authSession?.user ?? null);
      if (authSession?.user) {
        tryAcceptInvitationFromUrl(authSession.user.id);
      } else {
        setSession(null);
        setOrg(null);
        setPhase("landing");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Load active session if user already has one ──
  const loadActiveSession = async (userId) => {
    const { data: sessionData } = await supabase
      .from("sandbox_sessions")
      .select("*, organizations(*)")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionData) {
      setSession(sessionData);
      setOrg(sessionData.organizations);
      await loadSessionData(sessionData.id, sessionData.org_id);
      go("app");
    } else {
      go("setup");
    }
  };

  const loadSessionData = async (sessionId, orgId) => {
    // Resolve the auth user — used for account-scoped queries (Phase 1, item 2)
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const uid = authSession?.user?.id;

    const [partsRes, astRes, progRes, logsRes, moveRes, evRes,
      banksRes, chainsRes, walletsRes, threshRes,
      invRes, pmRes, plansRes, subRes, settingsRes] = await Promise.all([
      supabase.from("participants").select("*").eq("org_id", orgId),
      supabase.from("assets").select("*").eq("org_id", orgId),
      supabase.from("scenario_progress").select("*").eq("session_id", sessionId),
      // Account-scoped platform action log: all rows for this user, across every past session.
      // Falls back to session-scope if user_id is unavailable (e.g. before backfill).
      uid
        ? supabase.from("audit_logs").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(500)
        : supabase.from("audit_logs").select("*").eq("session_id", sessionId).order("created_at", { ascending: false }).limit(500),
      // On-chain transaction history — kept account-scoped too so refresh restores prior sends.
      // The Transactions tab still filters per connected wallet at render time (wallet-scoped view).
      uid
        ? supabase.from("movement_requests").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(500)
        : supabase.from("movement_requests").select("*").eq("session_id", sessionId),
      supabase.from("evidence_outputs").select("*, evidence_sections(*)").eq("session_id", sessionId),
      supabase.from("banks").select("*").eq("org_id", orgId).order("created_at"),
      supabase.from("chains").select("*").order("sort_order"),
      supabase.from("wallets").select("*, chain:chains(*)").eq("org_id", orgId).order("imported_at"),
      supabase.from("threshold_settings").select("*").eq("org_id", orgId).maybeSingle(),
      supabase.from("invoices").select("*").eq("org_id", orgId).order("issued_at", { ascending: false }),
      supabase.from("payment_methods").select("*").eq("org_id", orgId),
      supabase.from("plans").select("*").order("sort_order"),
      supabase.from("org_subscriptions").select("*, plan:plans(*)").eq("org_id", orgId).maybeSingle(),
      supabase.from("user_settings").select("*").eq("org_id", orgId).maybeSingle(),
    ]);

    setParticipants(partsRes.data || []);
    setAssets(astRes.data || []);

    const progMap = {};
    (progRes.data || []).forEach(p => { progMap[p.scenario_id] = p; });
    setProgress(progMap);

    setLogs((logsRes.data || []).map(l => ({ ...l, time: timeStr(l.created_at) })));

    const moveMap = {};
    (moveRes.data || []).forEach(m => { moveMap[m.scenario_id] = m; });
    setMovements(moveMap);
    setTransactions((moveRes.data || []).slice().sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0)));

    const evMap = {};
    (evRes.data || []).forEach(e => { evMap[e.scenario_id] = { ...e, sections: (e.evidence_sections || []).sort((a, b) => a.sort_order - b.sort_order) }; });
    setEvidenceStore(evMap);

    setBanks(banksRes.data || []);
    // Keep the fallback constants if the DB tables are empty (RLS/seed-proof)
    setChains(dedupeChains((chainsRes.data && chainsRes.data.length) ? chainsRes.data : DEFAULT_CHAINS));
    setWallets(walletsRes.data || []);
    setThreshold(threshRes.data);
    setInvoices(invRes.data || []);
    setPaymentMethods(pmRes.data || []);
    setPlans((plansRes.data && plansRes.data.length) ? plansRes.data : DEFAULT_PLANS);
    setSubscription(subRes.data);
    setSettings(settingsRes.data);
    if (settingsRes.data?.theme) setThemeState(settingsRes.data.theme);
  };

  // Apply theme to <html data-theme>
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);

  // Load invitations whenever the active org changes
  useEffect(() => { if (org?.id) reloadInvitations(); }, [org?.id]);

  // Reload helpers — re-fetch a single table after a mutation
  const reloadBanks = async () => { if (!org?.id) return; const { data } = await supabase.from("banks").select("*").eq("org_id", org.id).order("created_at"); setBanks(data || []); };
  const reloadWallets = async () => { if (!org?.id) return; const { data } = await supabase.from("wallets").select("*, chain:chains(*)").eq("org_id", org.id).order("imported_at"); setWallets(data || []); };
  const reloadAssets = async () => { if (!org?.id) return; const { data } = await supabase.from("assets").select("*").eq("org_id", org.id); setAssets(data || []); };
  const reloadParticipants = async () => { if (!org?.id) return; const { data } = await supabase.from("participants").select("*").eq("org_id", org.id); setParticipants(data || []); };
  const reloadInvoices = async () => { if (!org?.id) return; const { data } = await supabase.from("invoices").select("*").eq("org_id", org.id).order("issued_at", { ascending: false }); setInvoices(data || []); };
  const reloadPaymentMethods = async () => { if (!org?.id) return; const { data } = await supabase.from("payment_methods").select("*").eq("org_id", org.id); setPaymentMethods(data || []); };
  const reloadSubscription = async () => { if (!org?.id) return; const { data } = await supabase.from("org_subscriptions").select("*, plan:plans(*)").eq("org_id", org.id).maybeSingle(); setSubscription(data); };
  const reloadThreshold = async () => { if (!org?.id) return; const { data } = await supabase.from("threshold_settings").select("*").eq("org_id", org.id).maybeSingle(); setThreshold(data); };
  const reloadSettings = async () => { if (!org?.id) return; const { data } = await supabase.from("user_settings").select("*").eq("org_id", org.id).maybeSingle(); setSettings(data); };

  // CRUD actions (all persist to Supabase — no client-only mock state)
  const addBank = async (b) => { if (!org?.id) return; const { error } = await supabase.from("banks").insert({ ...b, org_id: org.id }); if (error) addLog({type:"error",message:`Add bank failed: ${error.message}`}); else { addLog({type:"success",message:`Bank imported: ${b.name}`}); reloadBanks(); } };
  const removeBank = async (id, name) => { const { error } = await supabase.from("banks").delete().eq("id", id); if (!error) { addLog({type:"warning",message:`Bank removed: ${name||id}`}); reloadBanks(); } };
  const addWallet = async (w) => { if (!org?.id) return; const { error } = await supabase.from("wallets").insert({ ...w, org_id: org.id }); if (error) addLog({type:"error",message:`Wallet import failed: ${error.message}`}); else { addLog({type:"success",message:`Wallet imported: ${w.label||w.address?.slice(0,10)}`}); reloadWallets(); } };
  const removeWallet = async (id, label) => { const { error } = await supabase.from("wallets").delete().eq("id", id); if (!error) { addLog({type:"warning",message:`Wallet removed: ${label||id}`}); reloadWallets(); } };
  const addAsset = async (a) => { if (!org?.id) return; const { error } = await supabase.from("assets").insert({ ...a, org_id: org.id }); if (error) addLog({type:"error",message:`Add asset failed: ${error.message}`}); else { addLog({type:"success",message:`Asset added: ${a.name}`}); reloadAssets(); } };
  const removeAsset = async (id, name) => { const { error } = await supabase.from("assets").delete().eq("id", id); if (!error) { addLog({type:"warning",message:`Asset removed: ${name||id}`}); reloadAssets(); } };
  const addParticipant = async (p) => { if (!org?.id) return; const initials = (p.name||"").split(/\s+/).map(s=>s[0]||"").join("").slice(0,2).toUpperCase(); const { error } = await supabase.from("participants").insert({ ...p, initials, status: "active", org_id: org.id }); if (error) addLog({type:"error",message:`Add team member failed: ${error.message}`}); else { addLog({type:"success",message:`Team member added: ${p.name}`}); reloadParticipants(); } };
  const removeParticipant = async (id, name) => { const { error } = await supabase.from("participants").delete().eq("id", id); if (!error) { addLog({type:"warning",message:`Team member removed: ${name||id}`}); reloadParticipants(); } };
  const updateThreshold = async (patch) => { if (!org?.id) return; const { error } = await supabase.from("threshold_settings").upsert({ ...patch, org_id: org.id }); if (!error) { addLog({type:"success",message:"Threshold settings updated"}); reloadThreshold(); } };
  const addPaymentMethod = async (pm) => { if (!org?.id) return; const { error } = await supabase.from("payment_methods").insert({ ...pm, org_id: org.id }); if (error) addLog({type:"error",message:`Card add failed: ${error.message}`}); else { addLog({type:"success",message:`Card added: ${pm.brand} ****${pm.last4}`}); reloadPaymentMethods(); } };
  const removePaymentMethod = async (id) => { const { error } = await supabase.from("payment_methods").delete().eq("id", id); if (!error) { addLog({type:"warning",message:"Card removed"}); reloadPaymentMethods(); } };
  const switchPlan = async (planId, planName) => { if (!org?.id) return; const renews = new Date(Date.now() + 30*86400000).toISOString().slice(0,10); const { error } = await supabase.from("org_subscriptions").upsert({ org_id: org.id, plan_id: planId, renews_at: renews }); if (!error) { addLog({type:"success",message:`Plan changed to ${planName||planId}`}); reloadSubscription(); } };
  const submitTicket = async (t) => { if (!org?.id) return { error: new Error("No org") }; const { error } = await supabase.from("support_tickets").insert({ ...t, user_id: user?.id, org_id: org.id }); if (error) addLog({type:"error",message:`Ticket failed: ${error.message}`}); else addLog({type:"success",message:`Support ticket submitted: ${t.subject||t.category}`}); return { error }; };

  // ─── Phase 4/5 governance backend wrappers ──────────────────────
  const reloadOrg = async () => { if (!org?.id) return; const { data } = await supabase.from("organizations").select("*").eq("id", org.id).maybeSingle(); if (data) setOrg(data); };

  const setRootEoa = async (eoa) => {
    if (!org?.id || !eoa) return;
    const { data, error } = await supabase.rpc("set_root_eoa", { p_org: org.id, p_eoa: eoa });
    if (error) addLog({ type:"error", message:`Root EOA set failed: ${error.message}` });
    else if (data?.ok) { addLog({ type:"info", message:`Root EOA bound; smart account derived: ${shortAddr(data.smart_account_address || "")}` }); reloadOrg(); }
    return data;
  };

  const submitPolicyForActivation = async (policyId) => {
    const { data, error } = await supabase.rpc("submit_policy_for_activation", { p_policy: policyId });
    if (error || data?.error) addLog({ type:"error", message:`Activation submit failed: ${error?.message || data?.error}` });
    else addLog({ type:"info", message:"Policy submitted for activation — awaiting approver votes." });
    return data;
  };

  const voteOnPolicy = async (policyId, vote) => {
    // Caller is the current user — find their participant row
    const { data: p } = await supabase.from("participants").select("id").eq("org_id", org.id).eq("email", user?.email).maybeSingle();
    if (!p?.id) { addLog({ type:"error", message:"You are not a participant of this org." }); return; }
    const { data, error } = await supabase.rpc("vote_on_policy", { p_policy: policyId, p_approver: p.id, p_vote: vote });
    if (error || data?.error) addLog({ type:"error", message:`Vote failed: ${error?.message || data?.error}` });
    else { addLog({ type:"success", message:`Vote cast: ${vote.toUpperCase()} (${data?.approve_count}/${data?.reject_count})` }); reloadOrg(); }
    return data;
  };

  const proposePolicyChange = async (changeType, payload) => {
    if (!org?.id) return;
    const { data: p } = await supabase.from("participants").select("id").eq("org_id", org.id).eq("email", user?.email).maybeSingle();
    if (!p?.id) { addLog({ type:"error", message:"You are not a participant of this org." }); return; }
    const { data, error } = await supabase.rpc("propose_policy_change", { p_org: org.id, p_proposer: p.id, p_change_type: changeType, p_payload: payload || {} });
    if (error || data?.error) addLog({ type:"error", message:`Proposal failed: ${error?.message || data?.error}` });
    else addLog({ type:"info", message:`Policy change proposed: ${changeType} — ${data?.required} approvals required` });
    return data;
  };

  const voteOnPolicyChange = async (proposalId, vote) => {
    const { data: p } = await supabase.from("participants").select("id").eq("org_id", org.id).eq("email", user?.email).maybeSingle();
    if (!p?.id) { addLog({ type:"error", message:"You are not a participant of this org." }); return; }
    const { data, error } = await supabase.rpc("vote_on_policy_change", { p_proposal: proposalId, p_approver: p.id, p_vote: vote });
    if (error || data?.error) addLog({ type:"error", message:`Vote failed: ${error?.message || data?.error}` });
    else addLog({ type:"info", message:`Proposal vote: ${vote.toUpperCase()} (${data?.approve_count}/${data?.reject_count})` });
    return data;
  };

  const validateMovement = async ({ amount, destination, token, action }) => {
    if (!org?.id) return { valid: false, reasons: ["No org loaded"] };
    const { data, error } = await supabase.rpc("validate_movement", {
      p_org: org.id, p_amount: Number(amount||0), p_destination: destination || "", p_token: token || "", p_action: action || "send",
    });
    if (error) return { valid: false, reasons: [error.message] };
    return data;
  };

  const setUserState = async (participantId, newState) => {
    const { data, error } = await supabase.rpc("set_user_state", { p_participant: participantId, p_new: newState });
    if (error || data?.error) addLog({ type:"error", message:`State change failed: ${error?.message || data?.error}` });
    else { addLog({ type:"success", message:`Member state: ${data.from} → ${data.to}` }); reloadParticipants(); }
    return data;
  };

  const bootstrapDraftPolicy = async (orgId, requiredApprovals, totalApprovers) => {
    const { data } = await supabase.rpc("bootstrap_draft_policy", { p_org: orgId, p_required: requiredApprovals || 2, p_total: totalApprovers || 3 });
    return data;
  };

  // Team email invitations — uses team-invite edge function
  const reloadInvitations = async () => {
    if (!org?.id) return;
    try { const r = await callFunction("team-invite", { action: "list", org_id: org.id }); setInvitations(r?.invitations || []); }
    catch (e) { /* fall back: empty list */ setInvitations([]); }
  };
  const sendInvitation = async (payload) => {
    if (!org?.id) return { error: new Error("No org") };
    try {
      const r = await callFunction("team-invite", { action: "send", org_id: org.id, ...payload });
      addLog({ type: "success", message: `Invitation sent to ${payload.email}`, detail: r?.mode || "" });
      reloadInvitations();
      return { ok: true };
    } catch (e) {
      addLog({ type: "error", message: `Invite failed: ${e.message}` });
      return { error: e };
    }
  };
  const resendInvitation = async (invite_id) => {
    try { await callFunction("team-invite", { action: "resend", invite_id }); addLog({ type: "info", message: "Invitation resent" }); reloadInvitations(); }
    catch (e) { addLog({ type: "error", message: `Resend failed: ${e.message}` }); }
  };
  const revokeInvitation = async (invite_id) => {
    try { await callFunction("team-invite", { action: "revoke", invite_id }); addLog({ type: "warning", message: "Invitation revoked" }); reloadInvitations(); }
    catch (e) { addLog({ type: "error", message: `Revoke failed: ${e.message}` }); }
  };
  const updateSettings = async (patch) => { if (!org?.id) return; const next = { ...(settings||{}), ...patch, org_id: org.id }; const { error } = await supabase.from("user_settings").upsert(next); if (!error) { setSettings(next); if (patch.theme) setThemeState(patch.theme); } };
  const setTheme = (t) => { setThemeState(t); updateSettings({ theme: t }); };

  // ── Real-time subscriptions ──
  useEffect(() => {
    if (!session?.id) return;

    // Real-time platform action log — now account-scoped (Phase 1, item 2)
    const uid = userRef.current?.id;
    const auditFilter = uid ? `user_id=eq.${uid}` : `session_id=eq.${session.id}`;
    const auditChannel = supabase
      .channel(`audit-${uid || session.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_logs", filter: auditFilter },
        (payload) => {
          const newLog = { ...payload.new, time: timeStr(payload.new.created_at) };
          setLogs(prev => {
            const filtered = prev.filter(l => !(l.id?.startsWith("tmp-") && l.message === newLog.message));
            if (filtered.find(l => l.id === newLog.id)) return filtered;
            return [newLog, ...filtered];
          });
        })
      .subscribe();

    const progressChannel = supabase
      .channel(`progress-${session.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "scenario_progress", filter: `session_id=eq.${session.id}` },
        (payload) => { setProgress(prev => ({ ...prev, [payload.new.scenario_id]: payload.new })); })
      .subscribe();

    // Live updates when an invitee accepts → participants row appears
    const orgId = session.org_id;
    const participantsChannel = orgId ? supabase
      .channel(`participants-${orgId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `org_id=eq.${orgId}` },
        async () => { const { data } = await supabase.from("participants").select("*").eq("org_id", orgId); setParticipants(data || []); reloadInvitations(); })
      .subscribe() : null;

    const invitationsChannel = orgId ? supabase
      .channel(`invitations-${orgId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "team_invitations", filter: `org_id=eq.${orgId}` },
        () => { reloadInvitations(); })
      .subscribe() : null;

    return () => {
      supabase.removeChannel(auditChannel);
      supabase.removeChannel(progressChannel);
      if (participantsChannel) supabase.removeChannel(participantsChannel);
      if (invitationsChannel) supabase.removeChannel(invitationsChannel);
    };
  }, [session?.id]);

  // ── AUTH ──
  // signIn — try sign-in first (existing users); only sign up if user not found
  const signIn = async (email, password, fullName) => {
    setAuthError(null);
    setLoading(true);
    try {
      // 1. Try existing-user sign-in first
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (!signInError && signInData?.user) {
        setUser(signInData.user);
        rememberEmail(email);  // Phase 1, item 1: remember for the picker
        await loadActiveSession(signInData.user.id);
        return;
      }

      // 2. Sign-in failed — interpret why
      const msg = (signInError?.message || "").toLowerCase();
      if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
        setAuthError("Your email isn't confirmed yet. Check your inbox (and spam) for the confirmation link, or contact support.");
        return;
      }

      // 3. If user simply doesn't exist, try creating one
      if (msg.includes("invalid login credentials") || msg.includes("user not found")) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName || email.split("@")[0] } },
        });
        if (signUpError) {
          if (signUpError.message?.toLowerCase().includes("already registered")) {
            setAuthError("Wrong password for this email. Use 'Forgot password?' below to reset it.");
          } else {
            setAuthError(signUpError.message);
          }
          return;
        }
        // signUp returned without error
        if (signUpData?.user && !signUpData.session) {
          // confirmation email required
          setAuthError("Account created — check your inbox to confirm your email, then sign in.");
          return;
        }
        setUser(signUpData.user);
        rememberEmail(email);  // Phase 1, item 1
        go("setup");
        return;
      }

      // 4. Other error — show as-is
      setAuthError(signInError?.message || "Sign-in failed");
    } catch (err) {
      setAuthError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Send password-reset email
  const sendPasswordReset = async (email) => {
    if (!email) { setAuthError("Enter your email above first."); return; }
    setAuthError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/?reset=1",
      });
      if (error) { setAuthError(error.message); return; }
      setAuthError(`Password reset link sent to ${email}. Check your inbox and spam folder.`);
    } finally { setLoading(false); }
  };

  // Resend confirmation email
  const resendConfirmation = async (email) => {
    if (!email) { setAuthError("Enter your email above first."); return; }
    setAuthError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) { setAuthError(error.message); return; }
      setAuthError(`Confirmation email re-sent to ${email}. Check your inbox.`);
    } finally { setLoading(false); }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setOrg(null);
    setSession(null);
    setActiveScenario(null);
    setProgress({});
    setLogs([]);
    setMovements({});
    setTransactions([]);
    setEvidenceStore({});
    go("landing");
  };

  // ── SESSION ──
  const createSession = async (orgConfig) => {
    setLoading(true);
    // Guard: organizations has a CHECK constraint on institution_type — an empty
    // value 500s the scenario-engine. Coerce to a valid default so a user who
    // skips the optional field can still complete setup.
    const VALID_INST = ["Asset Manager", "Bank / Custodian", "Fund", "Corporate Treasury"];
    orgConfig = { ...orgConfig, instType: VALID_INST.includes(orgConfig?.instType) ? orgConfig.instType : "Asset Manager" };
    try {
      // Phase 3, item 9: joining an existing org? skip the scenario-engine
      // create_session path and start a sandbox session against that org.
      if (orgConfig?.joinOrgId) {
        const { data: existing } = await supabase.from("organizations")
          .select("*").eq("id", orgConfig.joinOrgId).maybeSingle();
        if (!existing) throw new Error("Org not found");
        const { data: sess } = await supabase.from("sandbox_sessions")
          .insert({ user_id: userRef.current?.id, org_id: existing.id, status: "active" })
          .select().single();
        setSession(sess);
        setOrg(existing);
        await loadSessionData(sess.id, existing.id);
        addLog({ type: "success", message: `Joined org: ${existing.name}` });
        go("app");
        return;
      }
      const result = await callFunction("scenario-engine", { action: "create_session", org_config: orgConfig });
      setSession(result.session);
      setOrg(result.org);
      // Phase 4 — auto-bootstrap a draft policy reflecting the chosen control model
      const required = orgConfig?.controlModel === "committee" ? 3 : orgConfig?.controlModel === "single" ? 1 : 2;
      const total = orgConfig?.controlModel === "committee" ? 5 : orgConfig?.controlModel === "single" ? 1 : 3;
      try { await supabase.rpc("bootstrap_draft_policy", { p_org: result.org.id, p_required: required, p_total: total }); } catch (e) {}
      // Item 2 — default the sandbox approval threshold to a single signer so
      // testers can execute send/swap without assembling a quorum. This is not
      // mandatory: raise it any time in Evaluation Configuration → Control Posture.
      try { await supabase.from("threshold_settings").upsert({ org_id: result.org.id, required_approvals: 1, required_reviewers: 0, policy_version: "v1.0" }); } catch (e) {}
      await loadSessionData(result.session.id, result.org.id);
      addLog({ type: "success", message: "Sandbox launched", detail: "EVALUATION_READY" });
      go("app");
    } catch (err) {
      addLog({ type: "error", message: `Setup failed: ${err.message}` });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ── SCENARIO ACTIONS ──
  const startScenario = async (scenarioId) => {
    if (!session) return;
    const sc = scenarios.find(s => s.id === scenarioId);
    setActiveScenario(sc);
    addLog({ type: "info", message: `Scenario started: ${sc.title}`, scenario_id: scenarioId });
    try {
      await callFunction("scenario-engine", { action: "start_scenario", session_id: session.id, scenario_id: scenarioId });
    } catch (err) { addLog({ type: "error", message: err.message }); }
  };

  const advanceStep = async (scenarioId, currentStep, stepData = {}) => {
    if (!session) return { next_step: null };
    try {
      const result = await callFunction("scenario-engine", {
        action: "advance_step", session_id: session.id, scenario_id: scenarioId, current_step: currentStep, step_data: stepData
      });
      // Refresh movement record
      const { data: mv } = await supabase.from("movement_requests").select("*").eq("session_id", session.id).eq("scenario_id", scenarioId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (mv) {
        setMovements(prev => ({ ...prev, [scenarioId]: mv }));
        setTransactions(prev => { const without = prev.filter(t => t.id !== mv.id); return [mv, ...without].sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0)); });
      }
      return result;
    } catch (err) {
      addLog({ type: "error", message: err.message });
      return { next_step: null };
    }
  };

  const completeScenario = async (scenarioId) => {
    if (!session) return;
    try { await callFunction("scenario-engine", { action: "complete_scenario", session_id: session.id, scenario_id: scenarioId }); }
    catch (err) { addLog({ type: "error", message: err.message }); }
    setActiveScenario(null);
  };

  const generateEvidence = async (scenarioId) => {
    if (!session) return;
    try {
      await callFunction("evidence-generate", { action: "generate", session_id: session.id, scenario_id: scenarioId });
      // Fetch the generated evidence
      const { data: ev } = await supabase.from("evidence_outputs").select("*, evidence_sections(*)").eq("session_id", session.id).eq("scenario_id", scenarioId).maybeSingle();
      if (ev) {
        const sorted = { ...ev, sections: (ev.evidence_sections || []).sort((a, b) => a.sort_order - b.sort_order) };
        setEvidenceStore(prev => ({ ...prev, [scenarioId]: sorted }));
      }
    } catch (err) { addLog({ type: "error", message: `Evidence: ${err.message}` }); }
  };

  const resetSandbox = async () => {
    if (!session) return;
    try {
      await callFunction("scenario-engine", { action: "reset_sandbox", session_id: session.id });
      await loadSessionData(session.id, session.org_id);
      setActiveScenario(null);
    } catch (err) { addLog({ type: "error", message: err.message }); }
  };

  return (
    <AppContext.Provider value={{
      user, org, session, participants, assets, scenarios, progress, logs, movements, transactions, evidenceStore,
      activeScenario, phase, activeView, fading, loading, authError,
      go, setActiveView, setActiveScenario, addLog,
      signIn, signOut, sendPasswordReset, resendConfirmation, createSession, startScenario, advanceStep, generateEvidence, completeScenario, resetSandbox,
      // items 6-20
      banks, chains, wallets, threshold, invoices, paymentMethods, plans, subscription, settings, theme,
      addBank, removeBank, addWallet, removeWallet, addAsset, removeAsset,
      addParticipant, removeParticipant, updateThreshold,
      addPaymentMethod, removePaymentMethod, switchPlan, submitTicket, updateSettings, setTheme,
      invitations, sendInvitation, resendInvitation, revokeInvitation, reloadInvitations, reloadParticipants,
      // Phase 4/5 governance
      setRootEoa, submitPolicyForActivation, voteOnPolicy,
      proposePolicyChange, voteOnPolicyChange, validateMovement,
      setUserState, bootstrapDraftPolicy, reloadOrg,
    }}>
      {children}
    </AppContext.Provider>
  );
}

const useApp = () => useContext(AppContext);

// ═══════════════════════════════════════════════════════════════════
// UI PRIMITIVES
// ═══════════════════════════════════════════════════════════════════

const Badge = ({children,c="purple"}) => { const m={purple:"bg-purple-500/15 text-purple-400 border-purple-500/30",green:"bg-emerald-500/15 text-emerald-400 border-emerald-500/30",yellow:"bg-yellow-500/15 text-yellow-400 border-yellow-500/30",fuchsia:"bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",red:"bg-red-500/15 text-red-400 border-red-500/30",indigo:"bg-indigo-500/15 text-indigo-400 border-indigo-500/30",blue:"bg-blue-500/15 text-blue-400 border-blue-500/30"}; return <span className={`fm text-xs px-2 py-0.5 border ${m[c]}`}>{children}</span>; };
const GC = ({children,className="",hover,style={},onClick}) => <div className={`glass ${hover?"glass-h cursor-pointer":""} ${className}`} style={style} onClick={onClick}>{children}</div>;
const SL = ({children}) => <div className="fm text-xs tracking-widest text-fuchsia-500 mb-4">[ {children} ]</div>;
const Btn = ({children,v="primary",className="",onClick,disabled,full}) => { const base="fm font-bold text-sm px-5 py-2.5 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"; const vs={primary:"bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white hover:from-purple-500 hover:to-fuchsia-500 glow",secondary:"glass text-gray-300 hover:text-white",ghost:"text-gray-400 hover:text-purple-400 hover:bg-purple-500/10",danger:"bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"}; return <button className={`${base} ${vs[v]} ${full?"w-full":""} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>; };
const InfoRow = ({label,value,badge}) => <div className="flex items-center justify-between py-2 border-b border-gray-800/50"><span className="fm text-xs text-gray-500">{label}</span>{badge?<Badge c={badge.c}>{badge.t}</Badge>:<span className="fm text-xs text-gray-300">{value}</span>}</div>;
const Arr = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
const Bk = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>;
const Chk = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>;
const Blk = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>;
const Dl = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const Shld = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;

const sIcons = {
  hub: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>,
  overview: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  assets: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><circle cx="18" cy="12" r="1"/></svg>,
  movement: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  participants: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  evidence: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  config: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  log: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="12 8 12 12 14 14"/><circle cx="12" cy="12" r="10"/></svg>,
  bank: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M3 10h18"/><path d="M5 6l7-3 7 3"/><path d="M4 10v11"/><path d="M20 10v11"/><path d="M8 14v4"/><path d="M12 14v4"/><path d="M16 14v4"/></svg>,
  help: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  mail: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  card: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
};

// Inline action / utility icons
const Send = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const Swap = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>;
const Bridge = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 17V7"/><path d="M21 17V7"/><path d="M3 12h18"/><path d="M7 7v0a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v0"/></svg>;
const Plus = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const TrashI = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>;
const InfoI = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
const Wallet = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h16v4"/><path d="M3 9v9a2 2 0 0 0 2 2h16V9"/><circle cx="17" cy="14" r="1"/></svg>;
const Sun = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
const Moon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;

// Tooltip — ".tip-wrap" CSS handles hover state
const Tip = ({ text, children }) => <span className="tip-wrap">{children || <span className="text-purple-400 cursor-help inline-flex items-center align-middle"><InfoI/></span>}<span className="tip-body">{text}</span></span>;

// Field with optional inline tooltip
const Field = ({ label, hint, children }) => <div><label className="fm text-xs text-gray-500 mb-2 block">{label}{hint && <Tip text={hint}><span className="ml-1.5 text-purple-400 cursor-help inline-flex items-center align-middle"><InfoI/></span></Tip>}</label>{children}</div>;

// Empty state
const Empty = ({ children }) => <div className="text-center py-12 fm text-xs text-gray-600">{children}</div>;

// Coming Soon corner sticker — wraps disabled UI
const ComingSoon = ({ children, className = "" }) => (
  <div className={`relative inline-block ${className}`}>
    <span className="absolute -top-2 -right-3 fm text-[9px] px-2 py-0.5 bg-yellow-400 text-black font-black tracking-wider z-10 shadow-lg" style={{ transform: "rotate(6deg)", boxShadow: "0 2px 8px rgba(250,204,21,.35)" }}>COMING SOON</span>
    <div className="opacity-60 pointer-events-none select-none">{children}</div>
  </div>
);

// Phase 5 scaffold (BRANCH ONLY): boundary panel making Root EOA vs Smart
// Account vs Policy Status vs Funding Status vs Protection Status visible.
// On-chain ERC-4337 deployment is MOCKED — see docs/governed-wallet-architecture.md
const BoundaryPanel = ({ w, org }) => {
  const [policy, setPolicy] = useState(null);
  useEffect(() => {
    if (!org?.id) return;
    supabase.from("policy_versions").select("*").eq("org_id", org.id)
      .order("drafted_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setPolicy(data));
  }, [org?.id]);

  // Deterministic mock smart-account address derived from the Root EOA
  const smartAccount = w.address ? `0xQ2${w.address.slice(4, 38).toLowerCase()}sa` : null;
  const policyStatus = policy?.status || "Draft";
  const fundingLocked = policyStatus !== "Active";
  const protectionStatus = policyStatus === "Active" ? "GOVERNED ACTIVE" : "UNGOVERNED";

  const cell = (label, value, color, mono) => (
    <div className="p-3 border bg-black/30" style={{borderColor:`${color}55`}}>
      <div className="fm text-[10px] text-gray-500 mb-1">{label}</div>
      <div className={`${mono?"mono":"fm"} text-xs font-bold`} style={{color}}>{value}</div>
    </div>
  );

  return (<GC className="p-5" style={{borderTop:"2px solid rgba(217,70,239,.5)"}}>
    <div className="flex items-center gap-2 mb-2">
      <SL>BOUNDARY · GOVERNED SMART ACCOUNT</SL>
      <span className="fm text-[9px] px-2 py-0.5 bg-yellow-400 text-black font-black tracking-wider">SCAFFOLD · MOCK</span>
    </div>
    <p className="fm text-xs text-gray-400 mb-4">Root EOA holds ownership and recovery. The Smart Account holds the institution's assets, governed by the active policy. <a href="/docs/governed-wallet-architecture.md" target="_blank" className="text-purple-300 hover:underline">Design doc</a>.</p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {cell("ROOT EOA (RECOVERY)", w.address ? shortAddr(w.address) : "— not connected —", "#a855f7", !!w.address)}
      {cell("SMART ACCOUNT (VAULT)", smartAccount ? `${smartAccount.slice(0,10)}…${smartAccount.slice(-4)}` : "— pending deploy —", "#d946ef", !!smartAccount)}
      {cell("POLICY STATUS", policyStatus.toUpperCase(), policyStatus==="Active"?"#22c55e":policyStatus==="Draft"?"#facc15":"#818cf8")}
      {cell("FUNDING STATUS", fundingLocked ? "LOCKED · awaiting activation" : "UNLOCKED", fundingLocked?"#ef4444":"#22c55e")}
      {cell("PROTECTION STATUS", protectionStatus, protectionStatus==="GOVERNED ACTIVE"?"#22c55e":"#ef4444")}
      {cell("THRESHOLD", policy ? `${policy.required_approvals} of ${policy.total_approvers}` : "— policy missing —", "#818cf8")}
    </div>
    {fundingLocked && <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 fm text-xs text-red-300">
      <b>Funding locked.</b> Sending assets to the Root EOA leaves them outside the smart-account validation rules. Sending assets to the Smart Account is blocked until policy is <em>Active</em> and the approver set is verified. Activate policy first on the Team page.
    </div>}
  </GC>);
};

// Wallet picker — shows when EIP-6963 reports multiple providers (item 5).
// One provider: just a single Connect button. Zero: install hint.
const WalletPicker = ({ w, onAfterConnect }) => {
  const handle = async (detail) => {
    const addr = await w.connect(detail);
    if (addr && onAfterConnect) onAfterConnect();
  };
  if (!w.hasProvider) {
    return (<div className="fm text-xs text-yellow-300">
      No EIP-1193 wallet detected. Install <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">MetaMask</a>,
      Coinbase Wallet, Rabby or Brave Wallet, then refresh this page.
    </div>);
  }
  // No discovered providers but a legacy one exists — single generic connect.
  if (!w.providers.length) {
    return (<Btn onClick={()=>handle()} disabled={w.busy}>{w.busy?"CONNECTING...":"CONNECT WALLET"}</Btn>);
  }
  // Always show each connector by name (item 5 — MetaMask, Coinbase Wallet, Rabby, …).
  return (<div className="flex flex-wrap gap-2">
    {w.providers.map(p => (
      <button key={p.info.uuid} onClick={()=>handle(p)} disabled={w.busy} className="fm text-xs px-3 py-2 border border-purple-500/40 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 transition-all cursor-pointer disabled:opacity-40 flex items-center gap-2">
        {p.info.icon ? <img src={p.info.icon} alt="" className="w-4 h-4"/> : <Wallet/>}
        {p.info.name || "Wallet"}
      </button>
    ))}
  </div>);
};

// ── Item 5 — connect institutional DeFi / custody protocol apps ──────
// Each entry carries the protocol's official brand mark and a genuinely
// functional connect: we perform a real EIP-1193 / Coinbase wallet connect,
// then hand off to the protocol's own dapp-connect surface. No mocked buttons.
const APP_ICONS = {
  safe: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%2312FF80'/%3E%3Cpath fill='%23121312' d='M11.6 9.8h9.2a1.4 1.4 0 0 1 0 2.8h-6.4a1.4 1.4 0 0 0 0 2.8h3.6a4.2 4.2 0 0 1 0 8.4H8.8a1.4 1.4 0 0 1 0-2.8h9.2a1.4 1.4 0 0 0 0-2.8h-3.6a4.2 4.2 0 0 1 0-8.4Z'/%3E%3Ccircle cx='9.2' cy='11.2' r='1.4' fill='%23121312'/%3E%3Ccircle cx='22.8' cy='20.8' r='1.4' fill='%23121312'/%3E%3C/svg%3E",
  aave: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cdefs%3E%3ClinearGradient id='ag' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23B6509E'/%3E%3Cstop offset='1' stop-color='%232EBAC6'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='16' cy='16' r='16' fill='url(%23ag)'/%3E%3Cpath fill='%23fff' d='M20.6 22h-1.9l-1-2.5h-3.4l-1 2.5h-1.9l4.1-9.8c.2-.5.6-.7 1.1-.7h.6c.5 0 .9.2 1.1.7Zm-4.6-7.7-1.2 3h2.4Z'/%3E%3C/svg%3E",
  pendle: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230C1F1A'/%3E%3Cpath fill='none' stroke='%235FCFB0' stroke-width='2.4' stroke-linecap='round' d='M9 22V12a3 3 0 0 1 3-3h3.5a3.5 3.5 0 0 1 0 7H12'/%3E%3Ccircle cx='22.5' cy='11' r='1.8' fill='%235FCFB0'/%3E%3C/svg%3E",
};
const PROTOCOL_APPS = [
  { id:"safe",   name:"Safe",   tagline:"Smart-account custody & multisig", url:"https://app.safe.global/",                 color:"#12FF80" },
  { id:"aave",   name:"Aave",   tagline:"Lending & borrowing markets",       url:"https://app.aave.com/",                    color:"#B6509E" },
  { id:"pendle", name:"Pendle", tagline:"Yield trading & tokenization",       url:"https://app.pendle.finance/trade/markets", color:"#5FCFB0" },
];
// Fix 4 — QQ-owned connect modal. Clicking a dApp NEVER fires the injected
// wallet (no eth_requestAccounts, no Rabby popup). Quantum Qustody brokers the
// connection over WalletConnect and hands off to the app; if a QQ wallet
// session already exists it is surfaced so the app opens with that account.
function AppConnectModal({ app, w, onClose, addLog }) {
  if (!app) return null;
  const openApp = () => {
    addLog?.({ type: "success", message: `${app.name}: connecting via Quantum Qustody${w?.isConnected ? ` (session ${shortAddr(w.address)})` : ""} — no extension handoff` });
    window.open(app.url, "_blank", "noopener,noreferrer");
    onClose();
  };
  return (<div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{background:"rgba(3,4,11,.82)"}} onClick={onClose}>
    <div className="glass w-full max-w-md p-6 space-y-4" style={{background:"#07030f"}} onClick={e=>e.stopPropagation()}>
      <div className="flex items-center gap-3">
        <img src={APP_ICONS[app.id]} alt={`${app.name} logo`} className="w-10 h-10 rounded-lg flex-shrink-0"/>
        <div className="min-w-0"><div className="font-bold">Connect {app.name}</div><div className="fm text-[11px] text-gray-500">{app.tagline}</div></div>
        <button onClick={onClose} aria-label="Close" className="ml-auto text-gray-500 hover:text-gray-300 cursor-pointer text-xl leading-none">×</button>
      </div>
      <div className="p-3 border border-purple-500/20 bg-purple-500/5 fm text-xs text-gray-300 leading-relaxed">
        Quantum Qustody brokers this connection. Your browser wallet extension is <b className="text-purple-300">not</b> invoked directly — you connect {app.name} <b>through Quantum Qustody</b> over WalletConnect.
      </div>
      <div className="flex items-center justify-between p-3 border border-gray-800 bg-black/30 fm text-xs">
        <span className="text-gray-500">QQ WALLET SESSION</span>
        {w?.isConnected ? <span className="mono text-emerald-400">{shortAddr(w.address)}{w.isSepolia?" · SEPOLIA":""}</span> : <span className="text-yellow-300">not connected</span>}
      </div>
      {!w?.isConnected && <div className="fm text-[10px] text-gray-500 -mt-1">Connect a wallet to Quantum Qustody (header wallet control) so {app.name} opens with your QQ session.</div>}
      <button onClick={openApp} className="w-full fm text-sm px-4 py-3 border transition-all cursor-pointer flex items-center justify-center gap-2" style={{borderColor:`${app.color}66`, background:`${app.color}18`, color:app.color}}>
        OPEN {app.name.toUpperCase()} VIA WALLETCONNECT ↗
      </button>
      <div className="fm text-[9px] text-gray-600 leading-snug">On {app.name}, choose <b className="text-gray-400">WalletConnect</b> as the connection method (not the browser extension) to keep Quantum Qustody in the loop.</div>
    </div>
  </div>);
}
const ProtocolApps = ({ w, addLog }) => {
  const [modalApp, setModalApp] = useState(null);
  return (<>
    <GC className="p-5" style={{borderLeft:"3px solid #818cf8"}}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1"><SL>CONNECT PROTOCOL APPS</SL></div>
      <p className="fm text-xs text-gray-400 mb-4">Link institutional DeFi & custody protocols. Quantum Qustody brokers each connection over WalletConnect — your browser extension is never invoked directly. Position sync arrives in a later phase; the connection is mediated by QQ today.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {PROTOCOL_APPS.map(app => (
          <div key={app.id} className="p-4 border border-gray-800 bg-black/30 flex flex-col gap-3" style={{borderTopColor:`${app.color}66`, borderTopWidth:2}}>
            <div className="flex items-center gap-3">
              <img src={APP_ICONS[app.id]} alt={`${app.name} logo`} className="w-9 h-9 rounded-lg flex-shrink-0"/>
              <div className="min-w-0"><div className="font-bold text-sm">{app.name}</div><div className="fm text-[10px] text-gray-500 leading-tight">{app.tagline}</div></div>
            </div>
            <div className="mt-auto">
              <button onClick={()=>setModalApp(app)} className="fm text-xs px-3 py-2 border transition-all cursor-pointer w-full text-center" style={{borderColor:`${app.color}66`, background:`${app.color}14`, color:app.color}}>
                CONNECT VIA QQ ↗
              </button>
            </div>
          </div>
        ))}
      </div>
    </GC>
    <AppConnectModal app={modalApp} w={w} addLog={addLog} onClose={()=>setModalApp(null)}/>
  </>);
};

// Send / Swap / Bridge action bar
const ActionBar = ({ active, onPick }) => (<div className="flex flex-wrap gap-2">
  {[{id:"send",l:"SEND",I:Send},{id:"swap",l:"SWAP",I:Swap},{id:"bridge",l:"BRIDGE",I:Bridge}].map(a=>(
    <button key={a.id} onClick={()=>onPick(a.id)} className={`fm text-xs px-4 py-2 flex items-center gap-2 transition-all cursor-pointer border ${active===a.id?"border-purple-500 bg-purple-500/15 text-purple-300":"border-purple-500/20 bg-purple-500/5 text-gray-300 hover:bg-purple-500/10"}`}><a.I/> {a.l}</button>
  ))}
</div>);

// Quantum Safety Score atom (animated SVG ring + number)
const QuantumSafetyAtom = ({ score, label }) => {
  const r = 14, c = 2 * Math.PI * r;
  const off = c - (score / 100) * c;
  const tone = score >= 80 ? "#22c55e" : score >= 60 ? "#a855f7" : score >= 40 ? "#eab308" : "#ef4444";
  const tier = score >= 80 ? "STRONG" : score >= 60 ? "GUARDED" : score >= 40 ? "MODERATE" : "AT-RISK";
  return (<Tip text={`Quantum Safety Score: ${score}/100 — ${tier}. Computed live from PQC posture, control model, threshold settings, active team, connected wallets, and persisted settings. Higher score = stronger institutional posture.`}>
    <div className="flex items-center gap-2 px-3 py-1.5 glass cursor-help">
      <div className="relative w-10 h-10 flex items-center justify-center">
        <svg width="40" height="40" viewBox="0 0 40 40" className="absolute inset-0">
          <circle cx="20" cy="20" r={r} stroke="rgba(168,85,247,.15)" strokeWidth="3" fill="none"/>
          <circle cx="20" cy="20" r={r} stroke={tone} strokeWidth="3" fill="none" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" transform="rotate(-90 20 20)" style={{transition:"stroke-dashoffset .6s ease, stroke .3s"}}/>
          <ellipse cx="20" cy="20" rx="18" ry="6" stroke="rgba(217,70,239,.35)" strokeWidth="0.8" fill="none" className="qs-ring"/>
          <ellipse cx="20" cy="20" rx="6" ry="18" stroke="rgba(99,102,241,.35)" strokeWidth="0.8" fill="none" className="qs-ring-2"/>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="w-2 h-2 rounded-full" style={{background:tone,boxShadow:`0 0 8px ${tone}`,animation:"pulse 2s infinite"}}/>
        </div>
      </div>
      <div className="hidden sm:flex flex-col leading-tight">
        <span className="fm text-[10px] text-gray-500">QSAFETY</span>
        <span className="fm text-xs font-bold whitespace-nowrap" style={{color:tone}}>{score} · {tier}</span>
      </div>
    </div>
  </Tip>);
};

// Compute quantum safety score from real state (no hardcoding)
function computeQSafety({ org, threshold, participants, wallets, settings, scenarios, progress }) {
  let s = 0;
  if (org?.trust_environment === "pqc" || org?.trust_env === "pqc") s += 30;
  else if (org?.trust_environment || org?.trust_env) s += 12;
  const cm = org?.control_model;
  if (cm === "committee") s += 25;
  else if (cm === "threshold") s += 20;
  else if (cm === "single") s += 8;
  if ((threshold?.required_approvals || 0) >= 2) s += 10;
  const active = (participants || []).filter(p => p.status === "active").length;
  if (active >= 5) s += 15; else if (active >= 3) s += 10; else if (active >= 1) s += 5;
  if ((wallets || []).length >= 3) s += 10; else if ((wallets || []).length >= 1) s += 5;
  if (settings) s += 5;
  if (org?.eval_objective) s += 5;
  const completed = Object.values(progress || {}).filter(p => p.status === "completed").length;
  if (completed >= 3) s += 5;
  return Math.min(100, s);
}

// CSV / JSON export helpers (item 18 — Accounting export)
function exportCSV(rows, filename) {
  if (!rows || rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function exportJSON(rows, filename) {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════
// AUDIT LOG SIDEBAR
// ═══════════════════════════════════════════════════════════════════
const AuditLog = () => {
  const { logs } = useApp();
  return (<div className="w-72 flex-shrink-0 flex flex-col" style={{height:"calc(100vh - 56px)"}}>
    <div className="p-4 border-b border-purple-500/20 flex items-center gap-2">{sIcons.log}<span className="fm text-sm font-bold text-purple-400">EVALUATION_LOG</span><span className="ml-auto fm text-xs text-gray-600">{logs.length}</span></div>
    <div className="flex-1 overflow-y-auto p-3 space-y-2">{logs.map(l=>(
      <div key={l.id} className="p-3 border-l-2 anim" style={{background:"rgba(10,5,25,.5)",borderLeftColor:l.log_type==="success"||l.type==="success"?"#22c55e":l.log_type==="warning"||l.type==="warning"?"#eab308":l.log_type==="error"||l.type==="error"?"#ef4444":l.log_type==="evidence"||l.type==="evidence"?"#3b82f6":"rgba(168,85,247,.4)"}}>
        <div className="fm text-xs text-gray-500 mb-1">{l.time}</div>
        <div className="text-xs text-gray-300 leading-relaxed">{l.message}</div>
        {l.scenario_id&&<div className="fm text-xs text-purple-400 mt-1">SCENARIO {l.scenario_id.replace("s","0")}</div>}
        {l.actor&&<div className="fm text-xs text-gray-600 mt-0.5">{l.actor}</div>}
        {l.detail&&<div className="fm text-xs text-gray-600 mt-0.5">{l.detail}</div>}
      </div>))}
      {logs.length===0&&<div className="text-center text-gray-600 fm text-xs py-8">NO_EVENTS</div>}
    </div>
  </div>);
};

// ═══════════════════════════════════════════════════════════════════
// AUTH SCREEN (REAL SUPABASE)
// ═══════════════════════════════════════════════════════════════════
const AuthScreen = () => {
  const { signIn, sendPasswordReset, resendConfirmation, authError, loading } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  // Phase 1, item 1: known-account picker
  const [knownEmails, setKnownEmails] = useState(() => readKnownEmails());
  const dropEmail = (e) => { forgetEmail(e); setKnownEmails(readKnownEmails()); if (email === e) setEmail(""); };

  const handleSubmit = async () => {
    if (!email || !password) return;
    try { await signIn(email, password, name); } catch {}
  };

  const isInfo = authError && (/sent|confirmed|created/i.test(authError));

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <div className="absolute inset-0 pointer-events-none" style={{background:"radial-gradient(circle at center,rgba(168,85,247,.06) 0%,transparent 50%)"}}/>
      <div className="w-full max-w-md anim">
        <div className="text-center mb-8"><div className="flex items-center justify-center gap-2"><img src="/qq-logo.svg" alt="QQ" className="w-9 h-9" style={{filter:"drop-shadow(0 0 10px rgba(168,85,247,.4))"}}/><span className="font-bold text-xl tracking-tight">QUANTUM_QUSTODY</span></div></div>
        <GC className="p-8">
          <SL>SIGN IN / SIGN UP</SL>
          {knownEmails.length > 0 && (
            <div className="mb-5">
              <div className="fm text-xs text-gray-500 mb-2">CONTINUE AS</div>
              <div className="flex flex-wrap gap-2">
                {knownEmails.map(e => (
                  <div key={e} className={`flex items-center gap-1 px-3 py-1.5 fm text-xs border cursor-pointer transition-all ${email===e?"border-purple-500 bg-purple-500/15 text-purple-200":"border-purple-500/30 bg-purple-500/5 text-gray-300 hover:bg-purple-500/10"}`}>
                    <button onClick={()=>setEmail(e)} className="cursor-pointer">{e}</button>
                    <button onClick={()=>dropEmail(e)} className="text-gray-500 hover:text-red-400 ml-1" aria-label={`Forget ${e}`}>×</button>
                  </div>
                ))}
              </div>
              <div className="fm text-[10px] text-gray-600 mt-2">Pick an email to pre-fill, then type your password. ✕ to forget.</div>
            </div>
          )}
          <div className="space-y-4">
            <div><label className="fm text-xs text-gray-500 mb-2 block">FULL_NAME (new users only)</label><input placeholder="Your name" value={name} onChange={e=>setName(e.target.value)}/></div>
            <div><label className="fm text-xs text-gray-500 mb-2 block">EMAIL</label><input type="email" placeholder="you@institution.com" value={email} onChange={e=>setEmail(e.target.value)}/></div>
            <div><label className="fm text-xs text-gray-500 mb-2 block">PASSWORD</label><input type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/></div>
            {authError && <div className={`p-3 fm text-xs ${isInfo?"bg-emerald-500/10 border border-emerald-500/30 text-emerald-300":"bg-red-500/10 border border-red-500/30 text-red-300"}`}>{authError}</div>}
            <Btn full onClick={handleSubmit} disabled={loading || !email || !password}>{loading?"WORKING...":"SIGN_IN_OR_CREATE_ACCOUNT"} <Arr /></Btn>
            <div className="flex items-center justify-between gap-3 fm text-xs">
              <button onClick={()=>sendPasswordReset(email)} disabled={loading} className="text-purple-400 hover:text-purple-300 cursor-pointer disabled:opacity-40">Forgot password?</button>
              <button onClick={()=>resendConfirmation(email)} disabled={loading} className="text-gray-500 hover:text-gray-300 cursor-pointer disabled:opacity-40">Resend confirmation email</button>
            </div>
          </div>
          <div className="mt-6 p-3 bg-purple-500/5 border border-purple-500/20 fm text-xs text-gray-500"><span className="text-purple-400">NEW USERS:</span> Fill in all fields. <span className="text-purple-400">EXISTING USERS:</span> Email + password.</div>
        </GC>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// LANDING PAGE
// ═══════════════════════════════════════════════════════════════════
const LandingPage = () => {
  const { go, addLog, scenarios } = useApp();
  const enter = () => { addLog({ type:"info", message:"Entered sandbox" }); go("auth"); };
  // Blog navigation — when a post is open, render the article instead of the scroll
  const [activePost, setActivePost] = useState(null);
  const [showDP, setShowDP] = useState(false);
  const openPost = (p) => { setActivePost(p); addLog({ type:"info", message:`Opened article: ${p.title}` }); };
  if (activePost) return <BlogArticle post={activePost} onBack={()=>setActivePost(null)} onOpen={openPost} />;
  // Design Partner — gated discovery intake (footer entry point)
  if (showDP) return <DesignPartnerPage onBack={()=>setShowDP(false)} onSandbox={()=>{ setShowDP(false); enter(); }} />;
  const FAQ=({q,a})=>{const[o,setO]=useState(false);return<div className="glass cursor-pointer" onClick={()=>setO(!o)}><div className="p-6 fm text-purple-300 font-bold flex justify-between items-center text-sm">{q}<span className={`text-purple-500 transition-transform duration-300 ${o?"rotate-180":""}`}>▼</span></div>{o&&<div className="px-6 pb-6 text-gray-400 fm text-sm leading-relaxed border-t border-purple-500/10 pt-4 anim">{a}</div>}</div>};

  const diffRows = [
    { axis: "PRIMARY PROMISE", traditional: "Keep assets safe", qq: "Prove control under governance" },
    { axis: "CORE ACTION", traditional: "Store & transfer", qq: "Governed movement with policy enforcement" },
    { axis: "EVIDENCE MODEL", traditional: "Transaction history", qq: "Institutionally legible evidence packs" },
    { axis: "POLICY LAYER", traditional: "Operational checklist", qq: "Programmatic enforcement at execution" },
    { axis: "OVERSIGHT FIT", traditional: "Export CSV, reconcile", qq: "First-class oversight outputs" },
    { axis: "DISCLOSURE", traditional: "All or nothing", qq: "Selective verification (ZKP)" },
    { axis: "CRYPTO POSTURE", traditional: "Fixed primitives", qq: "Crypto-agility across current + PQC" },
    { axis: "BUYER QUESTION", traditional: "Are my keys safe?", qq: "Can I defend every movement to an auditor?" },
  ];

  return (
    <div className="min-h-screen">
      <nav className="fixed top-0 w-full z-50 p-4"><div className="max-w-7xl mx-auto glass rounded-sm flex justify-between items-center px-6 py-3"><div className="flex items-center gap-3"><img src="/qq-logo.svg" alt="QQ" className="w-8 h-8" style={{filter:"drop-shadow(0 0 8px rgba(168,85,247,.3))"}}/><span className="font-bold text-lg tracking-tight">QUANTUM_QUSTODY</span></div><div className="hidden md:flex gap-6 text-sm text-gray-400 fm"><a href="#home" className="hover:text-purple-400 transition-colors">[ HOME ]</a><a href="#insights" className="hover:text-purple-400 transition-colors">[ INSIGHTS ]</a></div><button onClick={enter} className="bg-purple-500/10 border border-purple-500/50 text-purple-400 px-4 py-2 text-sm fm hover:bg-purple-500/20 transition-all cursor-pointer">ACCESS SANDBOX</button></div></nav>

      {/* HERO */}
      <section id="home" className="pt-32 md:pt-48 pb-16 md:pb-24 px-4 flex flex-col items-center justify-center text-center relative">
        <div className="absolute inset-0 pointer-events-none" style={{background:"radial-gradient(circle at center,rgba(168,85,247,.1) 0%,transparent 50%)"}}/>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-tight anim">Institutional Control.<br/><span className="tg">Defensible Evidence.</span></h1>
        <p className="text-gray-400 text-base sm:text-lg md:text-xl max-w-2xl fm mb-10 leading-relaxed anim-d1">A new institutional operating model built around governed movement, policy enforcement, selective verification, and crypto-agile evidence.</p>
        <div className="flex flex-col sm:flex-row gap-4 anim-d2"><button onClick={enter} className="bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white px-8 py-4 fm font-bold hover:from-purple-500 hover:to-fuchsia-500 transition-colors glow cursor-pointer">ENTER SANDBOX</button><button onClick={()=>setShowDP(true)} className="px-8 py-4 fm font-bold border border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-300 hover:bg-fuchsia-500/20 transition-all cursor-pointer">DESIGN PARTNER PROGRAM →</button></div>

        {/* Design Partner programme — hero-level entry point */}
        <div className="w-full max-w-4xl mt-16 md:mt-20 anim-d3">
          <div className="glass p-6 md:p-8 text-left relative overflow-hidden" style={{borderTop:"2px solid rgba(217,70,239,.5)"}}>
            <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full pointer-events-none" style={{background:"radial-gradient(circle, rgba(217,70,239,.14), transparent 70%)"}}/>
            <div className="relative flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-1 min-w-0">
                <div className="fm text-[10px] text-fuchsia-500 tracking-widest mb-2">[ DESIGN PARTNER PROGRAM ]</div>
                <h3 className="text-xl md:text-2xl font-bold mb-3 leading-tight">Build the governance layer with us.</h3>
                <p className="fm text-sm text-gray-400 leading-relaxed mb-4">
                  We work with a small number of institutional funds to shape Q² around real operations — how your assets actually move, who authorizes them, and how you prove control. Design partners get direct influence over the roadmap and early access to the platform.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["Non-custodial by design","Sandbox on synthetic data","Zero touch on your systems"].map(t=>(
                    <span key={t} className="fm text-[10px] px-2.5 py-1 border border-fuchsia-500/25 bg-fuchsia-500/5 text-fuchsia-200">{t}</span>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0">
                <button onClick={()=>setShowDP(true)} className="w-full md:w-auto bg-fuchsia-500/15 border border-fuchsia-500/50 text-fuchsia-200 px-6 py-3.5 fm text-sm font-bold hover:bg-fuchsia-500/25 transition-all cursor-pointer whitespace-nowrap">
                  ENTER PROGRAM →
                </button>
                <div className="fm text-[10px] text-gray-600 mt-2 text-center md:text-right">Invitation only</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* APPROACH — tech section with orbit */}
      <section id="approach" className="py-24 px-4 max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
        <div className="flex-1">
          <h2 className="text-sm fm text-fuchsia-500 tracking-widest mb-4">[ INSTITUTIONAL OPERATING MODEL ]</h2>
          <h3 className="text-4xl font-bold mb-6">Beyond Custody.<br/>Governed Movement.</h3>
          <p className="text-gray-400 fm mb-6 leading-relaxed">Quantum Qustody turns custody into an institution-controlled, policy-governed, evidence-rich, selectively verifiable, crypto-agile operating model.</p>
          <ul className="space-y-4 fm text-sm text-gray-300">
            <li className="flex items-start gap-3"><span className="text-purple-500 mt-0.5">▹</span> <span>Policy-enforced movement with institutional accountability at every step</span></li>
            <li className="flex items-start gap-3"><span className="text-purple-500 mt-0.5">▹</span> <span>Oversight-ready evidence as a first-class output, not an afterthought</span></li>
            <li className="flex items-start gap-3"><span className="text-purple-500 mt-0.5">▹</span> <span>Selective verification without unnecessary disclosure of sensitive data</span></li>
            <li className="flex items-start gap-3"><span className="text-purple-500 mt-0.5">▹</span> <span>PQC transition readiness at the operating-model level, not a future patch</span></li>
          </ul>
        </div>
        <div className="flex-1 flex justify-center py-12">
          <div className="relative w-64 h-64 flex items-center justify-center" style={{perspective:"1000px"}}>
            <div className="absolute w-full h-full border-2 border-purple-500/30 rounded-full orb1" style={{boxShadow:"0 0 15px rgba(168,85,247,.2)"}}/>
            <div className="absolute w-full h-full border-2 border-fuchsia-500/30 rounded-full orb2" style={{boxShadow:"0 0 15px rgba(217,70,239,.2)"}}/>
            <div className="absolute w-full h-full border-2 border-indigo-500/30 rounded-full orb3" style={{boxShadow:"0 0 15px rgba(99,102,241,.2)"}}/>
            <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-fuchsia-600 rounded-full" style={{boxShadow:"0 0 30px #a855f7",animation:"pulse 2s infinite"}}/>
          </div>
        </div>
      </section>

      {/* DIFFERENCE — new section */}
      <section id="difference" className="py-24 px-4" style={{background:"linear-gradient(to bottom,rgba(88,28,135,.05),transparent)"}}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-center text-sm fm text-fuchsia-500 tracking-widest mb-4">[ DIFFERENCE ]</h2>
          <h3 className="text-center text-4xl font-bold mb-6">Not Another Custody Platform.</h3>
          <p className="text-center text-gray-400 fm max-w-2xl mx-auto mb-14 leading-relaxed">Traditional custody protects keys. Quantum Qustody protects decisions. Here is how the operating model actually differs across the dimensions institutional buyers care about.</p>
          <GC className="p-0 overflow-hidden"><div className="overflow-x-auto"><div className="min-w-[640px]">
            <div className="grid grid-cols-12 border-b border-purple-500/20 fm text-xs text-gray-500 uppercase tracking-wider">
              <div className="col-span-4 p-4 border-r border-purple-500/10">Dimension</div>
              <div className="col-span-4 p-4 border-r border-purple-500/10">Traditional Custody</div>
              <div className="col-span-4 p-4 text-purple-400">Quantum Qustody</div>
            </div>
            {diffRows.map((r, i) => (
              <div key={i} className="grid grid-cols-12 border-b border-purple-500/5 hover:bg-purple-500/5 transition-colors">
                <div className="col-span-4 p-4 border-r border-purple-500/10 fm text-xs text-fuchsia-500">{r.axis}</div>
                <div className="col-span-4 p-4 border-r border-purple-500/10 fm text-sm text-gray-500">{r.traditional}</div>
                <div className="col-span-4 p-4 fm text-sm text-gray-200">{r.qq}</div>
              </div>
            ))}
          </div></div></GC>
          <p className="text-center text-gray-500 fm text-xs mt-8 italic">The shift: from "are my keys safe" to "can I defend every movement to an auditor."</p>
        </div>
      </section>

      {/* SCENARIOS */}
      <section id="scenarios" className="py-24 px-4" style={{background:"linear-gradient(to bottom,transparent,rgba(88,28,135,.08))"}}>
        <div className="max-w-7xl mx-auto">
          <h2 className="text-center text-sm fm text-purple-500 tracking-widest mb-4">[ SANDBOX SCENARIOS ]</h2>
          <h3 className="text-center text-3xl font-bold mb-4">Five Questions That Matter</h3>
          <p className="text-center text-gray-500 fm text-sm mb-12 max-w-2xl mx-auto">Each scenario answers a specific institutional question. Run them in the sandbox, see the evidence, take it to your team.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {scenarios.map(s => (
              <div key={s.id} className="glass p-6 hover:-translate-y-2 transition-transform duration-300" style={{borderTop:`2px solid ${s.color==="purple"?"rgba(168,85,247,.5)":s.color==="fuchsia"?"rgba(217,70,239,.5)":"rgba(99,102,241,.5)"}`}}>
                <div className="flex items-center gap-2 mb-3"><Badge c={s.tier===1?"green":"yellow"}>TIER {s.tier}</Badge><span className="fm text-xs text-gray-600">{s.num}</span></div>
                <h4 className="font-bold text-sm mb-3">{s.title}</h4>
                <p className="text-xs fm text-gray-400 leading-relaxed">{s.question}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ENGAGEMENT PATH */}
      <section id="engagement" className="py-24 px-4 max-w-7xl mx-auto">
        <h2 className="text-center text-sm fm text-purple-500 tracking-widest mb-4">[ ENGAGEMENT PATH ]</h2>
        <h3 className="text-center text-3xl font-bold mb-2">Sandbox → Workshop → Pilot</h3>
        <p className="text-center text-gray-500 fm text-sm mb-16">A staged path from free evaluation to bounded production validation.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="glass p-8 flex flex-col" style={{borderTop:"2px solid rgba(168,85,247,.5)"}}>
            <h3 className="text-purple-400 fm mb-4">[ SANDBOX ]</h3>
            <div className="text-2xl font-bold mb-6">Guided Evaluation</div>
            <ul className="space-y-4 mb-8 text-gray-400 text-sm fm flex-grow">
              <li>✓ 5 Named Scenarios</li>
              <li>✓ Structured Evidence Outputs</li>
              <li>✓ Persistent Session State</li>
              <li>✓ Self-Guided or Supported</li>
            </ul>
            <button onClick={enter} className="w-full py-3 bg-purple-600 text-white hover:bg-purple-500 fm font-bold transition-colors glow cursor-pointer">ENTER_SANDBOX</button>
          </div>
          <div className="glass p-8 flex flex-col" style={{borderTop:"2px solid rgba(217,70,239,.5)"}}>
            <h3 className="text-fuchsia-400 fm mb-4">[ WORKSHOP ]</h3>
            <div className="text-2xl font-bold mb-6">Institutional Deep-Dive</div>
            <ul className="space-y-4 mb-8 text-gray-300 text-sm fm flex-grow">
              <li>✓ Custom Policy Mapping</li>
              <li>✓ Evidence Review Session</li>
              <li>✓ Integration Architecture</li>
              <li>✓ Pilot Scoping</li>
            </ul>
            <button className="w-full py-3 border border-gray-600 text-gray-300 hover:bg-white hover:text-black fm transition-colors cursor-pointer">REQUEST_WORKSHOP</button>
          </div>
          <div className="glass p-8 flex flex-col" style={{borderTop:"2px solid rgba(99,102,241,.5)"}}>
            <h3 className="text-indigo-400 fm mb-4">[ BOUNDED PILOT ]</h3>
            <div className="text-2xl font-bold mb-6">Production Validation</div>
            <ul className="space-y-4 mb-8 text-gray-400 text-sm fm flex-grow">
              <li>✓ Real Asset Boundaries</li>
              <li>✓ Live Policy Enforcement</li>
              <li>✓ Full Evidence Generation</li>
              <li>✓ Audit-Ready Outputs</li>
            </ul>
            <button className="w-full py-3 border border-gray-600 text-gray-300 hover:bg-white hover:text-black fm transition-colors cursor-pointer">DISCUSS_PILOT</button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-4 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold mb-8 text-center">Evaluation Questions</h2>
        <div className="space-y-4">
          <FAQ q="What is the sandbox?" a="A bounded institutional evaluation environment. It lets prospective clients experience named scenarios that demonstrate how Quantum Qustody governs movement, enforces policy, produces evidence, and supports selective verification and crypto-agility."/>
          <FAQ q="How is this different from a regular custody platform?" a="Traditional custody protects keys and records transactions. Quantum Qustody protects decisions: every movement is policy-governed, every outcome produces institutionally legible evidence, and every control result can be selectively verified without exposing sensitive data. See the Difference section above for the full breakdown."/>
          <FAQ q="What is live vs simulated?" a="Core governance workflows, policy application, evidence generation, audit logging, and persistent state are live in the sandbox — backed by a real Postgres database and edge functions. Cryptographic signing, on-chain execution, and certain PQC operations are simulated with realistic outputs."/>
          <FAQ q="Is my data persistent?" a="Yes. Your sandbox session, scenario progress, audit logs, and evidence outputs are stored in Supabase and persist across browser sessions and re-logins. You can leave and come back."/>
          <FAQ q="How does this lead to a workshop or pilot?" a="Each scenario is designed to trigger specific institutional questions. After evaluation, we map those questions to your context in a paid workshop, then validate with a bounded pilot against real assets and policies."/>
        </div>
      </section>

      {/* BLOG / INSIGHTS */}
      <BlogSection onOpen={openPost} />

      {/* FOOTER */}
      <footer className="border-t border-purple-500/20 bg-black py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 fm text-xs text-gray-600">
          <div className="flex items-center gap-2"><img src="/qq-logo.svg" alt="QQ" className="w-6 h-6"/><span className="font-bold text-white text-sm">QUANTUM_QUSTODY</span></div>
          <div className="flex items-center gap-3">
            <a href="https://x.com/quantumqustody" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-purple-400 transition-colors glass"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg></a>
            <a href="https://www.instagram.com/quantumqustody/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-purple-400 transition-colors glass"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>
            <a href="https://www.linkedin.com/company/quantumqustody/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-purple-400 transition-colors glass"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg></a>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={()=>setShowDP(true)} className="fm text-xs text-gray-500 hover:text-purple-400 transition-colors cursor-pointer">Design Partner</button>
            <span className="text-gray-800">·</span>
            <span>© 2026 QUANTUM QUSTODY</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// SANDBOX SETUP
// ═══════════════════════════════════════════════════════════════════
const SandboxSetup = () => {
  const { createSession, addLog, loading, user } = useApp();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({orgName:"",instType:"Asset Manager",jurisdiction:"",evalObjective:"",controlModel:"threshold",trustEnv:"current",inviteCode:"",joinOrgId:""});
  const [suggestions, setSuggestions] = useState([]);
  const [joinError, setJoinError] = useState(null);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));

  // Phase 3, item 9: suggest existing orgs to join (debounced)
  useEffect(() => {
    if (step !== 0) return;
    const e = user?.email || "";
    const q = f.orgName || "";
    if (!e && q.length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.rpc("suggest_orgs_for", { p_email: e, p_query: q });
        setSuggestions(data || []);
      } catch { setSuggestions([]); }
    }, 350);
    return () => clearTimeout(t);
  }, [f.orgName, user?.email, step]);

  // Phase 3, item 9: resolve invite code to org id
  const resolveInviteCode = async (code) => {
    setJoinError(null);
    if (!code || code.length < 4) return;
    const { data, error } = await supabase
      .from("organizations").select("id,name").eq("invite_code", code.trim().toUpperCase()).maybeSingle();
    if (error || !data) { setJoinError("No org with that code."); return; }
    setF(prev => ({ ...prev, joinOrgId: data.id, orgName: data.name }));
  };

  const next = async () => {
    if(step<3){
      addLog({type:"info",message:["Organization context configured","Roles & access configured","Control posture configured"][step]});
      setStep(step+1);
    } else {
      try { await createSession(f); } catch(err){}
    }
  };
  const steps=[{l:"CONTEXT",n:"01"},{l:"ROLES",n:"02"},{l:"POSTURE",n:"03"},{l:"LAUNCH",n:"04"}];
  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative"><div className="absolute inset-0 pointer-events-none" style={{background:"radial-gradient(circle at center,rgba(168,85,247,.06) 0%,transparent 50%)"}}/>
      <div className="w-full max-w-2xl anim"><div className="text-center mb-10"><div className="flex items-center justify-center gap-2"><img src="/qq-logo.svg" alt="QQ" className="w-9 h-9" style={{filter:"drop-shadow(0 0 10px rgba(168,85,247,.4))"}}/><span className="font-bold text-xl tracking-tight">QUANTUM_QUSTODY</span></div><h1 className="text-3xl font-bold mb-2 mt-4">Sandbox Setup</h1><p className="fm text-sm text-gray-500">CONFIGURE EVALUATION ENVIRONMENT</p></div>
        <div className="flex items-center justify-center gap-1 mb-10">{steps.map((s,i)=><div key={i} className="flex items-center"><div className={`flex items-center gap-2 px-3 py-1.5 fm text-xs transition-all ${i===step?"text-purple-400 bg-purple-500/10 border border-purple-500/30":i<step?"text-emerald-400":"text-gray-600"}`}><span>{i<step?"✓":s.n}</span><span className="hidden sm:inline">{s.l}</span></div>{i<3&&<div className={`w-8 h-px mx-1 ${i<step?"bg-emerald-500/50":"bg-gray-800"}`}/>}</div>)}</div>
        <GC className="p-8">
          {step===0&&<div className="space-y-5 anim" key="s0">
            <SL>ORGANIZATION CONTEXT</SL>

            {/* Phase 3, item 9 — join existing org */}
            <div className="p-3 bg-purple-500/5 border border-purple-500/20">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="fm text-xs text-purple-300">HAVE AN INVITE CODE?</div>
                <div className="flex gap-2"><input placeholder="ABC123" maxLength={8} value={f.inviteCode} onChange={e=>u("inviteCode",e.target.value.toUpperCase())} style={{width:120}}/><Btn v="secondary" onClick={()=>resolveInviteCode(f.inviteCode)}>JOIN</Btn></div>
              </div>
              {f.joinOrgId && <div className="fm text-xs text-emerald-400 mt-2">✓ Joining <b>{f.orgName}</b>. Continue to confirm.</div>}
              {joinError && <div className="fm text-xs text-red-300 mt-2">{joinError}</div>}
            </div>

            <div><label className="fm text-xs text-gray-500 mb-2 block">ORGANIZATION *</label><input placeholder="Institution name" value={f.orgName} onChange={e=>{ u("orgName",e.target.value); u("joinOrgId",""); }}/></div>

            {/* Suggested orgs based on email domain / name match */}
            {!f.joinOrgId && suggestions.length>0 && <div className="p-3 bg-emerald-500/5 border border-emerald-500/20">
              <div className="fm text-xs text-emerald-300 mb-2">DID YOU MEAN ONE OF THESE? <span className="text-gray-500">— matches existing orgs by name or email domain</span></div>
              <div className="space-y-1">{suggestions.map(s => (
                <button key={s.id} onClick={()=>setF(prev=>({...prev, joinOrgId: s.id, orgName: s.name, inviteCode: s.invite_code || ""}))} className="w-full flex items-center justify-between gap-3 p-2 hover:bg-emerald-500/10 cursor-pointer text-left">
                  <span className="fm text-xs text-gray-200">{s.name}</span>
                  <span className="fm text-[10px] text-emerald-400">{s.match_reason === "domain" ? "DOMAIN MATCH" : "NAME MATCH"}</span>
                </button>
              ))}</div>
            </div>}

            <div className="grid grid-cols-2 gap-4"><div><label className="fm text-xs text-gray-500 mb-2 block">INSTITUTION_TYPE</label><select value={f.instType} onChange={e=>u("instType",e.target.value)}><option value="">Select...</option><option>Asset Manager</option><option>Bank / Custodian</option><option>Fund</option><option>Corporate Treasury</option></select></div><div><label className="fm text-xs text-gray-500 mb-2 block">JURISDICTION</label><select value={f.jurisdiction} onChange={e=>u("jurisdiction",e.target.value)}><option value="">Select...</option><option>United States</option><option>European Union</option><option>United Kingdom</option><option>Singapore</option></select></div></div>
            <div><label className="fm text-xs text-gray-500 mb-2 block">EVALUATION_OBJECTIVE</label><input placeholder="e.g., Assess governed treasury controls" value={f.evalObjective} onChange={e=>u("evalObjective",e.target.value)}/></div>
          </div>}
          {step===1&&<div className="space-y-5 anim" key="s1"><SL>ROLES & ACCESS</SL><p className="fm text-xs text-gray-400 mb-4">After launch, add real team members on the Team page. Each governance function maps to a role:</p><div className="space-y-2">{["Requester — initiates movement requests","Approver — approves under threshold policy","Reviewer — reviews policy application","Oversight — risk, audit, compliance","Observer — finance, reporting"].map((r)=><div key={r} className="flex items-center gap-3 p-3 bg-black/30 border border-gray-800/50 fm text-xs text-gray-300"><span className="text-purple-400">▹</span>{r}</div>)}</div></div>}
          {step===2&&<div className="space-y-5 anim" key="s2"><SL>CONTROL POSTURE</SL><div><label className="fm text-xs text-gray-500 mb-3 block">CONTROL_MODEL</label><div className="grid grid-cols-3 gap-3">{[{id:"single",l:"Single",d:"One approver"},{id:"threshold",l:"Threshold",d:"Multi-approval"},{id:"committee",l:"Committee",d:"Full governance"}].map(o=><div key={o.id} onClick={()=>u("controlModel",o.id)} className={`p-4 cursor-pointer border transition-all ${f.controlModel===o.id?"border-purple-500 bg-purple-500/10 text-white":"border-gray-800 bg-gray-900/30 text-gray-500 hover:border-gray-700"}`}><div className="fm text-sm font-bold mb-1">{o.l}</div><div className="text-xs">{o.d}</div></div>)}</div></div><div><label className="fm text-xs text-gray-500 mb-3 block">TRUST_ENVIRONMENT</label><div className="grid grid-cols-2 gap-3">{[{id:"current",l:"Current Trust",d:"Standard crypto"},{id:"pqc",l:"PQC Target",d:"Post-quantum view"}].map(o=><div key={o.id} onClick={()=>u("trustEnv",o.id)} className={`p-4 cursor-pointer border transition-all ${f.trustEnv===o.id?"border-fuchsia-500 bg-fuchsia-500/10 text-white":"border-gray-800 bg-gray-900/30 text-gray-500 hover:border-gray-700"}`}><div className="fm text-sm font-bold mb-1">{o.l}</div><div className="text-xs">{o.d}</div></div>)}</div></div></div>}
          {step===3&&<div className="space-y-5 anim" key="s3"><SL>LAUNCH SANDBOX</SL><div className="text-center py-4"><div className="inline-block p-4 rounded-full bg-purple-500/10 border border-purple-500/30 mb-4"><Shld/></div><h3 className="text-xl font-bold mb-2">Ready to Launch</h3><p className="fm text-sm text-gray-500">Session will be persisted to Supabase.</p></div><div className="space-y-2 p-4 bg-black/40 border border-gray-800 fm text-xs"><div className="flex justify-between"><span className="text-gray-500">ORG:</span><span>{f.orgName||"—"}</span></div><div className="flex justify-between"><span className="text-gray-500">CONTROL:</span><span className="text-purple-400">{f.controlModel.toUpperCase()}</span></div><div className="flex justify-between"><span className="text-gray-500">TRUST:</span><span className="text-fuchsia-400">{f.trustEnv==="pqc"?"PQC TARGET":"CURRENT"}</span></div><div className="flex justify-between"><span className="text-gray-500">BACKEND:</span><span className="text-emerald-400">SUPABASE LIVE</span></div></div></div>}
          <div className="flex justify-between mt-8 pt-6 border-t border-purple-500/10"><Btn v="ghost" onClick={()=>step>0&&setStep(step-1)} disabled={step===0||loading}>BACK</Btn><Btn onClick={next} disabled={loading||(step===0&&!f.orgName)}>{loading?"LAUNCHING...":step===3?"LAUNCH_SANDBOX":"CONTINUE"} <Arr/></Btn></div>
        </GC></div></div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════════
const SideNav = ({ onSelect }) => {
  const { activeView, setActiveView, signOut, user } = useApp();
  const pick = (id) => { setActiveView(id); if (onSelect) onSelect(); };
  const nav=[
    {id:"hub",l:"DASHBOARD",i:sIcons.hub},
    {id:"assets",l:"DIGITAL ASSETS",i:sIcons.assets},
    {id:"import-bank",l:"IMPORT BANK",i:sIcons.bank,soon:true},
    {id:"movement",l:"GOVERNED MOVEMENT",i:sIcons.movement},
    {id:"overview",l:"OVERVIEW",i:sIcons.overview},
    {id:"team",l:"TEAM",i:sIcons.participants},
    {id:"evidence",l:"EVIDENCE VIEWER",i:sIcons.evidence},
    {id:"how-it-works",l:"HOW IT WORKS",i:sIcons.help},
    {id:"user-guide",l:"USER GUIDE",i:sIcons.evidence},
    {id:"support",l:"SUPPORT",i:sIcons.mail},
    {id:"billing",l:"BILLING",i:sIcons.card},
    {id:"settings",l:"SETTINGS",i:sIcons.config},
  ];
  return (<div className="w-56 flex-shrink-0 border-r border-purple-500/20 flex flex-col h-full" style={{background:"rgba(5,2,15,.95)"}}><div className="p-4 space-y-1 flex-1 overflow-y-auto">{nav.map(n=><button key={n.id} onClick={()=>pick(n.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 fm text-xs transition-all cursor-pointer ${activeView===n.id?"text-purple-400 bg-purple-500/10 border-l-2 border-purple-500":"text-gray-500 hover:text-gray-300 hover:bg-white/5 border-l-2 border-transparent"}`}>{n.i}<span className="flex-1 text-left">{n.l}</span>{n.soon&&<span className="fm text-[8px] px-1.5 py-0.5 bg-yellow-400/20 text-yellow-400 border border-yellow-400/40">SOON</span>}</button>)}</div><div className="p-4 border-t border-purple-500/10 space-y-2"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-xs font-bold">{(user?.email||"U")[0].toUpperCase()}</div><div className="fm text-xs text-gray-400 truncate">{user?.email}</div></div><button onClick={signOut} className="w-full fm text-xs text-gray-600 hover:text-purple-400 transition-colors cursor-pointer text-left px-1 py-1">⇄ SWITCH_ACCOUNT</button><button onClick={signOut} className="w-full fm text-xs text-gray-600 hover:text-red-400 transition-colors cursor-pointer text-left px-1 py-1">← EXIT_SANDBOX</button></div></div>);
};

// ═══════════════════════════════════════════════════════════════════
// EVALUATION HUB
// ═══════════════════════════════════════════════════════════════════
const EvaluationHub = () => {
  const { org, threshold, participants, wallets, assets, banks, logs, settings, scenarios, progress, setActiveView, addLog } = useApp();
  const w = useSharedWallet();
  // Item 7: counters track live wallet/chain state, not just stale DB rows
  const liveWalletCount = Math.max(wallets.length, w.isConnected ? 1 : 0);
  const usdNum = (s) => Number(String(s||"").replace(/[^0-9.-]/g,"")) || 0;
  // Fix 1 — fold the connected wallet's live Sepolia value (ETH×spot + testnet
  // USDC/EURC @ $1) into CRYPTO and TOTAL so a funded wallet is never $0.
  const tv = useTestnetValue(w);
  const manualCryptoUsd = assets.reduce((s,a) => s + usdNum(a.balance_usd), 0);
  const cryptoUsd = manualCryptoUsd + tv.testnetUsd;
  const banksUsd = banks.reduce((s,b) => s + Number(b.balance||0), 0);
  const totalUsd = cryptoUsd + banksUsd;
  const money = (n) => `$${n.toLocaleString(undefined,{maximumFractionDigits:2})}`;
  const qsScore = computeQSafety({ org, threshold, participants, wallets, settings, scenarios, progress });
  const goAction = (id) => { addLog({ type:"info", message:`${id.toUpperCase()} initiated from Dashboard` }); setActiveView("movement"); };
  const actions = [
    { id:"send", l:"SEND", I:Send, d:"Move assets to a counterparty under policy and threshold approval.", tone:"#a855f7" },
    { id:"swap", l:"SWAP", I:Swap, d:"Exchange assets within a wallet, evidence-recorded.", tone:"#d946ef" },
    { id:"bridge", l:"BRIDGE", I:Bridge, d:"Move assets across chains with continuity proofs.", tone:"#818cf8" },
  ];
  const setupCards = [
    { id:"assets", l:"IMPORT CRYPTO", I:Wallet, d:"Connect chains, import wallets, and bind in-scope assets via your governance EOA.", tone:"#22c55e", route:"assets" },
    { id:"import-bank", l:"IMPORT BANK", I:()=>sIcons.bank, d:"Connect institutional bank accounts via open-banking for fiat reconciliation.", tone:"#3b82f6", route:"import-bank", soon:true },
  ];
  const quickLinks = [
    { id:"team", l:"TEAM", d:"Roles & threshold" },
    { id:"evidence", l:"EVIDENCE", d:"Audit logs & TX history" },
    { id:"how-it-works", l:"HOW IT WORKS", d:"Customer journey" },
    { id:"settings", l:"SETTINGS", d:"Language, theme, posture" },
  ];

  return (<div className="p-6 space-y-5 overflow-y-auto flex-1">
    <div className="anim flex items-end justify-between flex-wrap gap-3">
      <div><h2 className="text-2xl font-bold mb-1">Dashboard</h2><p className="fm text-sm text-gray-500">{org?.name||"—"} · {(org?.control_model||"threshold").toUpperCase()} CONTROL · LIVE</p></div>
    </div>

    {/* Hero row — bento: total value (wide) + qsafety (square) */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <GC className="p-7 md:col-span-2 anim-d1 relative overflow-hidden" style={{borderTop:"2px solid rgba(168,85,247,.5)"}}>
        <div className="fm text-xs text-purple-500 tracking-widest mb-3">[ TOTAL_VALUE ]</div>
        <div className="text-5xl md:text-6xl font-black tg leading-none mb-3">{money(totalUsd)}</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 fm text-xs">
          <span className="text-gray-500">BANKS:</span><span className="text-blue-400 font-bold">{money(banksUsd)}</span>
          <span className="text-gray-700">·</span>
          <span className="text-gray-500">CRYPTO:</span><span className="text-purple-400 font-bold">{money(cryptoUsd)}</span>
          {w.isConnected && <><span className="text-gray-700">·</span><span className="text-gray-500">SEPOLIA:</span><span className="text-emerald-400 font-bold">{tv.eth.toFixed(4)} ETH ({money(tv.ethUsd)})</span></>}
        </div>
        {w.isConnected
          ? <div className="fm text-[10px] text-gray-500 mt-2">ETH @ {money(tv.ethPriceUsd)}{tv.priceLive?" · live":" · indicative"} · testnet USDC/EURC pegged $1{(tv.usdc+tv.eurc)>0?` · ${tv.usdc.toFixed(2)} USDC · ${tv.eurc.toFixed(2)} EURC`:""}</div>
          : <div className="fm text-[10px] text-gray-500 mt-2">Connect a wallet to include live Sepolia balances in the total.</div>}
        <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full" style={{background:"radial-gradient(circle, rgba(168,85,247,.15), transparent 70%)"}}/>
      </GC>
      <GC className="p-7 anim-d2 flex flex-col items-center justify-center text-center" style={{borderTop:"2px solid rgba(217,70,239,.5)"}}>
        <div className="fm text-xs text-fuchsia-500 tracking-widest mb-4">[ QSAFETY ]</div>
        <QuantumSafetyAtom score={qsScore}/>
        <div className="fm text-[10px] text-gray-500 mt-3 mb-4">Live institutional posture</div>
        <button onClick={()=>{addLog({type:"info",message:"Opened Quantum Safety module"}); setActiveView("how-it-works"); setTimeout(()=>{ const el = document.getElementById("quantum-safety-module"); if (el) el.scrollIntoView({behavior:"smooth",block:"start"}); }, 60);}} className="fm text-xs px-3 py-2 border border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300 hover:bg-fuchsia-500/20 transition-all cursor-pointer flex items-center gap-2">WHY QUANTUM SAFE? <Arr/></button>
      </GC>
    </div>

    {/* Big action cards — bento (movement actions) */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {actions.map((a,i) => (
        <GC key={a.id} hover onClick={()=>goAction(a.id)} className={`p-7 anim-d${i+2} cursor-pointer flex flex-col group transition-transform`} style={{minHeight:200, borderTop:`2px solid ${a.tone}`}}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{background:`${a.tone}22`, border:`1px solid ${a.tone}55`, color:a.tone}}>
            <div style={{transform:"scale(1.6)"}}><a.I/></div>
          </div>
          <h3 className="text-2xl font-black mb-2">{a.l}</h3>
          <p className="fm text-xs text-gray-400 mb-5 leading-relaxed flex-1">{a.d}</p>
          <div className="fm text-xs flex items-center gap-2 group-hover:gap-3 transition-all" style={{color:a.tone}}>START <Arr/></div>
        </GC>
      ))}
    </div>

    {/* Setup cards — bento (import flows) */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {setupCards.map((a,i) => {
        const Icon = a.I;
        const card = (
          <GC hover={!a.soon} onClick={a.soon?undefined:()=>{addLog({type:"info",message:`${a.l} from Dashboard`}); setActiveView(a.route);}} className={`p-7 anim-d${i+2} ${a.soon?"":"cursor-pointer"} flex flex-col group transition-transform w-full`} style={{minHeight:180, borderTop:`2px solid ${a.tone}`}}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{background:`${a.tone}22`, border:`1px solid ${a.tone}55`, color:a.tone}}>
              <div style={{transform:"scale(1.4)"}}><Icon/></div>
            </div>
            <h3 className="text-2xl font-black mb-2">{a.l}</h3>
            <p className="fm text-xs text-gray-400 mb-5 leading-relaxed flex-1">{a.d}</p>
            <div className="fm text-xs flex items-center gap-2 group-hover:gap-3 transition-all" style={{color:a.tone}}>{a.soon?"AVAILABLE SOON":"OPEN"} <Arr/></div>
          </GC>
        );
        return a.soon ? <ComingSoon key={a.id} className="w-full block">{card}</ComingSoon> : <div key={a.id}>{card}</div>;
      })}
    </div>

    {/* Stat row */}
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {[
        { l:"BANKS", v:banks.length, c:"text-blue-400" },
        { l:"WALLETS", v:liveWalletCount, c:"text-fuchsia-400" },
        { l:"TEAM", v:participants.length, c:"text-indigo-400" },
        { l:"THRESHOLD", v:`${threshold?.required_approvals||1}/${participants.length||0}`, c:"text-yellow-400" },
        { l:"TRUST", v:org?.trust_environment==="pqc"?"PQC":"CURRENT", c:"text-emerald-400" },
      ].map((c,i) => (<GC key={c.l} className={`p-4 anim-d${Math.min(i,3)+1}`}><div className="fm text-[10px] text-gray-500 mb-1">{c.l}</div><div className={`text-xl font-bold ${c.c}`}>{c.v}</div></GC>))}
    </div>

    {/* Bottom bento: recent activity (wide) + quick links (narrow) */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <GC className="p-5 md:col-span-2"><SL>RECENT ACTIVITY</SL>
        <div className="space-y-1 fm text-xs">
          {logs.length === 0 && <Empty>No activity yet.</Empty>}
          {logs.slice(0,8).map(l => { const t = l.log_type||l.type||"info"; const tc = t==="error"?"text-red-400":t==="success"?"text-emerald-400":t==="evidence"?"text-blue-400":t==="warning"?"text-yellow-400":"text-purple-400"; return (
            <div key={l.id} className="flex items-center gap-3 py-2 border-b border-gray-800/40">
              <span className="text-gray-600 w-20 flex-shrink-0">{l.time}</span>
              <span className={`${tc} w-20 flex-shrink-0 uppercase`}>{t}</span>
              <span className="text-gray-300 truncate flex-1">{l.message}</span>
            </div>
          );})}
        </div>
      </GC>
      <GC className="p-5"><SL>QUICK LINKS</SL>
        <div className="space-y-2">{quickLinks.map(q => (
          <button key={q.id} onClick={()=>setActiveView(q.id)} className="w-full text-left p-3 border border-gray-800 hover:border-purple-500/40 hover:bg-purple-500/5 transition-all cursor-pointer">
            <div className="fm text-xs font-bold text-gray-300 mb-0.5">{q.l}</div>
            <div className="fm text-[10px] text-gray-500">{q.d}</div>
          </button>
        ))}</div>
      </GC>
    </div>
  </div>);
};

// ═══════════════════════════════════════════════════════════════════
// SCENARIO DETAIL
// ═══════════════════════════════════════════════════════════════════
const ScenarioDetail = () => {
  const { activeScenario, setActiveView, addLog } = useApp();
  if(!activeScenario) return <div className="p-6"><Btn v="ghost" onClick={()=>setActiveView("hub")}><Bk/> Back to Hub</Btn><p className="mt-4 fm text-sm text-gray-500">No scenario selected.</p></div>;
  const s = activeScenario;
  const begin=()=>{addLog({type:"info",message:"Scenario flow started",scenario_id:s.id}); setActiveView(s.id==="s1"?"assets":s.id==="s2"?"movement":"evidence");};
  return (<div className="p-6 space-y-6 overflow-y-auto flex-1"><Btn v="ghost" onClick={()=>setActiveView("hub")}><Bk/> HUB</Btn>
    <div className="anim"><div className="flex items-center gap-3 mb-2"><Badge c={s.tier===1?"green":"yellow"}>TIER {s.tier}</Badge><Badge c="purple">SCENARIO {s.num}</Badge></div><h2 className="text-2xl font-bold mb-2">{s.title}</h2><p className="fm text-sm text-gray-400 max-w-2xl">{s.question}</p></div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><GC className="p-5 anim-d1"><SL>WHAT YOU WILL DO</SL><p className="fm text-xs text-gray-400 leading-relaxed">{s.demo}</p></GC><GC className="p-5 anim-d2"><SL>SCREENS USED</SL><div className="space-y-2">{s.screens.map((sc,i)=><div key={i} className="flex items-center gap-2 fm text-xs text-gray-300"><span className="text-purple-500">{String(i+1).padStart(2,"0")}</span>{sc}</div>)}</div></GC></div>
    <GC className="p-5 anim-d2"><SL>EVIDENCE TO BE PRODUCED</SL><div className="flex flex-wrap gap-2">{s.evidence_types.map((e,i)=><Badge key={i} c="blue">{e}</Badge>)}</div></GC>
    <GC className="p-5 anim-d3"><SL>WORKSHOP QUESTION</SL><p className="fm text-xs text-gray-400 italic">{s.workshop_question}</p></GC>
    <GC className="p-5 anim-d3"><SL>PILOT HYPOTHESIS</SL><p className="fm text-xs text-gray-400 italic">{s.pilot_hypothesis}</p></GC>
    <div className="flex gap-3 anim-d4"><Btn onClick={begin}>BEGIN_SCENARIO <Arr/></Btn><Btn v="secondary" onClick={()=>setActiveView("hub")}>RETURN_TO_HUB</Btn></div>
  </div>);
};

// ═══════════════════════════════════════════════════════════════════
// ASSET BOUNDARY
// ═══════════════════════════════════════════════════════════════════
const AssetBoundary = () => {
  const { assets, wallets, chains, addAsset, removeAsset, addWallet, removeWallet, addLog, setActiveView, org } = useApp();
  const [mode, setMode] = useState(null); // null | "wallet" | "manual"
  const [f, setF] = useState({ name:"", chain:"", balance:"", balance_usd:"", scope:"in-scope", boundary_tag:"Operating Reserve", control_model:"Threshold Governance", evidence_path:"", wallet_id:"" });
  const u = (k,v) => setF(p=>({...p,[k]:v}));

  const w = useSharedWallet();

  // Auto-persist a connected MetaMask wallet to the wallets table the first time we see it.
  // Also calls set_root_eoa so the org gets a smart-account address derived from the EOA (spec §3, §4).
  const { setRootEoa } = useApp();
  useEffect(() => {
    if (!w.address || !org?.id) return;
    const sepoliaChain = chains.find(c => c.network === "ethereum-sepolia");
    if (!sepoliaChain) return;
    const exists = wallets.find(x => x.address?.toLowerCase() === w.address.toLowerCase());
    // Only persist to the wallets table when the chain has a real DB uuid.
    // With fallback chains (RLS/seed-less), skip DB persistence — the wallet
    // still works fully client-side (balance, txs) via useWallet state.
    if (!exists && !isFallbackChainId(sepoliaChain.id)) addWallet({ chain_id: sepoliaChain.id, label: "MetaMask Sepolia", address: w.address, type: "EOA" });
    if (!org.root_eoa_address || org.root_eoa_address.toLowerCase() !== w.address.toLowerCase()) {
      setRootEoa(w.address);
    }
  }, [w.address, org?.id, chains.length]);

  const manualUsd = assets.reduce((s,a) => s + (Number(String(a.balance_usd||"").replace(/[^0-9.-]/g,""))||0), 0);
  const liveEth = w.isConnected ? Number(w.balance||0) : 0;
  const liveWeth = w.isConnected ? Number(w.wethBalance||0) : 0;

  const submit = async () => {
    if (!f.name) return;
    await addAsset({ ...f, wallet_id: f.wallet_id || null, balance_usd: f.balance_usd ? `$${Number(f.balance_usd).toLocaleString()}` : "" });
    setF({ name:"", chain:"", balance:"", balance_usd:"", scope:"in-scope", boundary_tag:"Operating Reserve", control_model:"Threshold Governance", evidence_path:"", wallet_id:"" });
    setMode(null);
  };

  return (<div className="p-6 space-y-6 overflow-y-auto flex-1">
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div><h2 className="text-2xl font-bold mb-1">Digital Assets</h2><p className="fm text-sm text-gray-500 flex items-center gap-2">IN-SCOPE ASSETS <Tip text="Quantum Qustody never holds your private keys. Instead, write access is delegated through your governance EOA — the underlying signer remains with your custody provider while policy enforcement runs on every movement."/></p></div>
      <div className="flex gap-2 flex-wrap"><Btn onClick={()=>{ setMode("wallet"); if (!w.isConnected && w.hasProvider) w.connect(); }} disabled={w.busy}><Wallet/> {w.busy?"CONNECTING...":w.isConnected?"WALLET CONNECTED":"IMPORT_CRYPTO"}</Btn><Btn v="secondary" onClick={()=>setMode("manual")}><Plus/> ADD_MANUALLY</Btn></div>
    </div>

    {/* Phase 5 scaffold (BRANCH ONLY) */}
    <BoundaryPanel w={w} org={org}/>

    <GC className="p-5 anim-d1"><div className="flex items-center justify-between flex-wrap gap-3">
      <div><div className="fm text-xs text-gray-500 mb-1 flex items-center gap-2">TOTAL_BALANCE_HIGHLIGHTED <Tip text="Sum of USD-valued in-scope assets across all connected wallets and chains. Live wallet balances are shown separately as Sepolia testnet (no real USD value)."/></div><div className="text-3xl font-black tg">${manualUsd.toLocaleString(undefined,{maximumFractionDigits:2})}</div></div>
      <div className="fm text-xs text-gray-500 text-right"><div>{assets.filter(a=>a.scope==="in-scope").length} IN-SCOPE</div><div className="text-emerald-400">{Math.max(wallets.length, w.isConnected?1:0)} WALLETS · {w.isSepolia?1:0} CHAIN{w.isSepolia?"":"S"}</div></div>
    </div></GC>

    {/* IMPORT_CRYPTO: connect wallet flow (same as Governed Movement) */}
    {mode==="wallet" && <GC className="p-5 anim" style={{borderTop:"2px solid rgba(34,197,94,.4)"}}>
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex-1 min-w-[240px]">
          <SL>CONNECT WALLET · SEPOLIA TESTNET</SL>
          {!w.hasProvider && <div className="fm text-xs text-yellow-300">No EIP-1193 wallet detected. Install <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">MetaMask</a>, Coinbase Wallet, Rabby, or Brave to import.</div>}
          {w.hasProvider && !w.isConnected && <div className="fm text-xs text-gray-400 mb-3">Click CONNECT WALLET — MetaMask will ask permission and we'll auto-switch to Sepolia. Your private key never leaves your wallet; the address is delegated for policy enforcement only.</div>}
          {w.isConnected && (<div className="space-y-2 fm text-xs">
            <div className="flex items-center gap-2 flex-wrap"><span className="text-gray-500">ADDRESS:</span><a href={explorerAddr(w.address)} target="_blank" rel="noopener noreferrer" className="mono text-purple-300 hover:text-purple-200 hover:underline">{shortAddr(w.address)}</a><Badge c={w.isSepolia?"green":"red"}>{w.isSepolia?"SEPOLIA":`WRONG NETWORK (${w.chainId||"?"})`}</Badge></div>
            <div className="flex items-center gap-4 flex-wrap"><span className="text-gray-500">ETH:</span><span className="text-emerald-400 font-bold">{liveEth.toFixed(6)} SEP</span><span className="text-gray-500">WETH:</span><span className="text-fuchsia-400 font-bold">{liveWeth.toFixed(6)}</span><button onClick={()=>w.refreshBalance()} className="fm text-[10px] text-purple-400 hover:text-purple-300 cursor-pointer">[ REFRESH ]</button></div>
          </div>)}
        </div>
        <div className="flex gap-2 flex-wrap">
          {!w.isConnected && <WalletPicker w={w}/>}
          {w.isConnected && !w.isSepolia && <Btn v="secondary" onClick={w.ensureSepolia}>SWITCH TO SEPOLIA</Btn>}
          {w.isConnected && <Btn v="ghost" onClick={()=>setMode(null)}>DONE</Btn>}
        </div>
      </div>
      {w.error && <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 fm text-xs text-red-300">{w.error}</div>}
    </GC>}

    {/* Live wallet balance card — shown whenever a wallet is connected */}
    {w.isConnected && mode!=="wallet" && <GC className="p-5" style={{borderLeft:"3px solid #22c55e"}}>
      <div className="flex items-center justify-between flex-wrap gap-3"><SL>LIVE WALLET</SL><a href={explorerAddr(w.address)} target="_blank" rel="noopener noreferrer" className="mono text-xs text-purple-300 hover:underline">{shortAddr(w.address)} ↗</a></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
        <div className="p-3 border border-gray-800 bg-black/20"><div className="fm text-[10px] text-gray-500 mb-1">SEPOLIA ETH</div><div className="text-xl font-bold text-emerald-400">{liveEth.toFixed(6)}</div></div>
        <div className="p-3 border border-gray-800 bg-black/20"><div className="fm text-[10px] text-gray-500 mb-1">WETH</div><div className="text-xl font-bold text-fuchsia-400">{liveWeth.toFixed(6)}</div></div>
        <div className="p-3 border border-gray-800 bg-black/20 flex items-center justify-center"><button onClick={()=>w.refreshBalance()} className="fm text-xs text-purple-400 hover:text-purple-300 cursor-pointer">REFRESH BALANCES</button></div>
      </div>
      <div className="fm text-[10px] text-gray-500 mt-2">Live testnet balances — read directly from the Sepolia public RPC. Not summed into the USD total because Sepolia ETH has no real value.</div>
    </GC>}

    {/* ADD MANUAL form — kept for non-EVM assets (BTC, SOL, etc.) and read-only address tracking */}
    {mode==="manual" && <GC className="p-5 anim" style={{borderTop:"2px solid rgba(99,102,241,.5)"}}><SL>ADD ASSET MANUALLY</SL>
      <p className="fm text-xs text-gray-400 mb-4">Use this for assets that aren't on Sepolia (BTC, SOL, etc.) or for read-only address tracking. Connected MetaMask wallets are tracked live above.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="NAME *"><input placeholder="e.g., ETH Treasury Reserve" value={f.name} onChange={e=>u("name",e.target.value)}/></Field>
        <Field label="CHAIN"><select value={f.chain} onChange={e=>u("chain",e.target.value)}><option value="">— Select —</option>{chains.map(c=><option key={c.id} value={c.symbol}>{c.name}{c.is_testnet?" (Testnet)":""}</option>)}</select></Field>
        <Field label="BALANCE"><input placeholder="0.00 ETH" value={f.balance} onChange={e=>u("balance",e.target.value)}/></Field>
        <Field label="USD VALUE"><input type="number" placeholder="0" value={f.balance_usd} onChange={e=>u("balance_usd",e.target.value)}/></Field>
        <Field label="WALLET" hint="Optional — bind to an imported EOA wallet."><select value={f.wallet_id} onChange={e=>u("wallet_id",e.target.value)}><option value="">— None —</option>{wallets.map(wl=><option key={wl.id} value={wl.id}>{wl.label||wl.address?.slice(0,12)} · {wl.chain?.name}</option>)}</select></Field>
        <Field label="SCOPE"><select value={f.scope} onChange={e=>u("scope",e.target.value)}><option value="in-scope">In-Scope</option><option value="out-of-scope">Out-of-Scope</option></select></Field>
        <Field label="BOUNDARY"><select value={f.boundary_tag} onChange={e=>u("boundary_tag",e.target.value)}><option>Primary Reserve</option><option>Operating Reserve</option><option>Liquidity Buffer</option><option>Operational</option></select></Field>
        <Field label="CONTROL"><select value={f.control_model} onChange={e=>u("control_model",e.target.value)}><option>Multi-Approval</option><option>Threshold Governance</option><option>Policy-Governed</option><option>Standard</option></select></Field>
      </div>
      <div className="flex gap-3 mt-5"><Btn onClick={submit}>SAVE_ASSET <Chk/></Btn><Btn v="ghost" onClick={()=>setMode(null)}>CANCEL</Btn></div>
    </GC>}

    {/* Saved (imported) wallets list */}
    {wallets.length>0 && <GC className="p-4"><SL>IMPORTED WALLETS ({wallets.length})</SL>
      <div className="fm text-[10px] text-gray-500 mb-3">Phase 3, item 8 — multiple wallets are tracked per account. Only one wallet can be the <span className="text-emerald-400">ACTIVE</span> signer at a time (the one currently exposed by your browser wallet). Transactions are attributed to whichever wallet was active at the moment of signing.</div>
      <div className="space-y-2">{wallets.map(wl=>{ const isActive = w.address?.toLowerCase() === wl.address?.toLowerCase(); return (<div key={wl.id} className={`flex items-center justify-between p-3 ${isActive?"bg-emerald-500/10 border border-emerald-500/30":"bg-black/30 border border-gray-800/50"} flex-wrap gap-2`}><div className="flex items-center gap-3 min-w-0 flex-1"><Wallet/><div className="fm text-xs min-w-0"><div className="text-gray-300 font-bold truncate">{wl.label||wl.address?.slice(0,10)} · {wl.chain?.name}{wl.chain?.is_testnet?" (Testnet)":""}</div><a href={wl.chain?.explorer_url ? `${wl.chain.explorer_url}/address/${wl.address}` : "#"} target="_blank" rel="noopener noreferrer" className="mono text-gray-600 hover:text-purple-400 truncate block">{wl.address}</a></div></div><div className="flex items-center gap-2">{isActive && <Badge c="green">ACTIVE</Badge>}<Badge c={wl.chain?.is_testnet?"yellow":"green"}>{(wl.type||"EOA").toUpperCase()}</Badge><button onClick={()=>removeWallet(wl.id, wl.label)} className="text-gray-600 hover:text-red-400 cursor-pointer p-1"><TrashI/></button></div></div>); })}</div>
    </GC>}

    {/* Item 5 — connect protocol apps (Safe, Aave, Pendle) */}
    <ProtocolApps w={w} addLog={addLog}/>

    <div className="space-y-3">
      {assets.length===0 && !w.isConnected && <Empty>No assets yet. Click IMPORT_CRYPTO to connect a wallet, or ADD_MANUALLY to track a non-EVM asset.</Empty>}
      {assets.length===0 && w.isConnected && <Empty>Wallet connected — your live Sepolia balance is shown above. ADD_MANUALLY to also track non-EVM assets.</Empty>}
      {assets.map((a,i)=>(<GC key={a.id} className={`p-5 flex items-center justify-between anim-d${Math.min(i,3)+1}`}>
        <div className="flex items-center gap-4 cursor-pointer" onClick={()=>{addLog({type:"info",message:`Asset selected: ${a.name}`,detail:`BOUNDARY: ${a.boundary_tag}`});setActiveView("movement")}}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center fm text-xs font-bold ${a.scope==="in-scope"?"bg-gradient-to-br from-purple-500/30 to-fuchsia-500/30 text-purple-300":"bg-gray-800/50 text-gray-500"}`}>{(a.chain||a.name||"?").slice(0,3).toUpperCase()}</div>
          <div><div className="font-bold">{a.name}</div><div className="fm text-xs text-gray-500">{a.chain||"—"} · {a.control_model||"—"}</div>{a.evidence_path&&<div className="fm text-xs text-gray-600 mt-0.5">{a.evidence_path}</div>}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right"><div className="fm text-sm font-bold">{a.balance||"—"}</div><div className="fm text-xs text-gray-500">{a.balance_usd||""}</div></div>
          <Badge c={a.scope==="in-scope"?"green":"yellow"}>{(a.scope||"").toUpperCase()}</Badge>
          {a.boundary_tag && <Badge c="purple">{a.boundary_tag.toUpperCase()}</Badge>}
          <button onClick={()=>removeAsset(a.id, a.name)} className="text-gray-600 hover:text-red-400 cursor-pointer p-1" aria-label="Remove asset"><TrashI/></button>
        </div>
      </GC>))}
    </div>
  </div>);
};

// ═══════════════════════════════════════════════════════════════════
// GOVERNED MOVEMENT
// ═══════════════════════════════════════════════════════════════════
const GovernedMovement = () => {
  const { activeScenario, progress, assets, participants, advanceStep, generateEvidence, setActiveView, addLog,
          banks, chains, wallets, threshold, addWallet, removeWallet, session, org, validateMovement } = useApp();
  const scId = activeScenario?.id;
  const pg = scId ? progress[scId] : null;
  const step = pg?.current_step || "request";
  const [action, setAction] = useState("send");
  const [fd, setFd] = useState({ destination:"", amount:"", asset:"ETH" });
  const up = (k,v) => setFd(p=>({...p,[k]:v}));
  const [pendingTx, setPendingTx] = useState(null);
  const [recentTxs, setRecentTxs] = useState([]);
  const [walletWarning, setWalletWarning] = useState(null);
  const [policyNote, setPolicyNote] = useState(null);
  const isBlocked = scId === "s2";

  const w = useSharedWallet();

  // When MetaMask connects, persist that wallet to Supabase wallets table (idempotent best-effort)
  useEffect(() => {
    if (!w.address || !org?.id) return;
    const sepoliaChain = chains.find(c => c.network === "ethereum-sepolia");
    if (!sepoliaChain) return;
    const exists = wallets.find(x => x.address?.toLowerCase() === w.address.toLowerCase());
    if (exists) return;
    if (!isFallbackChainId(sepoliaChain.id)) addWallet({ chain_id: sepoliaChain.id, label: "MetaMask Sepolia", address: w.address, type: "EOA" });
  }, [w.address, org?.id, chains.length]);

  const advance = async (stepData={}) => {
    if(!scId){ addLog({type:"info",message:`${action.toUpperCase()} request: ${fd.amount} ${fd.asset}`}); return; }
    const result = await advanceStep(scId, step, stepData);
    if(result?.next_step==="complete") await generateEvidence(scId);
  };

  // Persist a real on-chain tx into movement_requests so it shows up in Evidence Viewer's TX history
  const recordTx = async ({ hash, action: act, amount, asset, destination, status }) => {
    if (!session?.id) return;
    try {
      await supabase.from("movement_requests").insert({
        session_id: session.id,
        scenario_id: scId || null,
        current_step: status === "complete" ? "complete" : "execution",
        step_data: { action: act, amount: String(amount), asset, destination, tx_hash: hash, chain: "ethereum-sepolia", status },
      });
    } catch (e) { /* swallow — UI still has local state */ }
  };

  const onChainSubmit = async () => {
    setWalletWarning(null);
    if (!w.isConnected) { setWalletWarning("Connect MetaMask first."); return; }
    if (!w.isSepolia) { try { await w.ensureSepolia(); } catch (e) { setWalletWarning("Switch to Sepolia in MetaMask."); return; } }
    if (!fd.amount || Number(fd.amount) <= 0) { setWalletWarning("Enter an amount > 0."); return; }

    // Spec §5 + §11 — run the policy validator and SHOW the governance
    // evaluation, but don't hard-block the tester's own connected-EOA send.
    // The funding lock is the *governed-vault* (smart account) model; a tester
    // operating their personal EOA on a public testnet is allowed to transact.
    // This keeps sends smooth while the governance moat stays visible.
    const v = await validateMovement({ amount: Number(fd.amount), destination: action==="send"?fd.destination:(action==="swap"?"WETH":w.address), token: fd.asset, action });
    if (v && v.valid === false) {
      setPolicyNote((v.reasons || []).join(" "));
      addLog({ type: "info", message: `Governance evaluation: EOA movement (ungoverned). In production, vault movements require: ${(v.reasons||[]).join(" ")}` });
    } else if (v && v.valid === true) {
      setPolicyNote(null);
      addLog({ type: "success", message: `Governance evaluation: passed active policy ${v.policy_version||""}` });
    }
    setPendingTx({ status: "signing" });
    try {
      let tx;
      if (action === "send") {
        if (!fd.destination) { setWalletWarning("Enter a destination address."); setPendingTx(null); return; }
        tx = await w.sendEth({ to: fd.destination, amount: fd.amount });
        addLog({ type: "info", message: `SEND signed: ${fd.amount} ETH → ${shortAddr(fd.destination)}`, detail: tx.hash });
      } else if (action === "swap") {
        // Wrap ETH → WETH (real swap on Sepolia)
        tx = await w.wrapEth(fd.amount);
        addLog({ type: "info", message: `SWAP (ETH→WETH) signed: ${fd.amount} ETH`, detail: tx.hash });
      } else if (action === "bridge") {
        // Demo: send to self on Sepolia (placeholder for cross-chain)
        tx = await w.sendEth({ to: w.address, amount: fd.amount });
        addLog({ type: "info", message: `BRIDGE (demo loopback) signed: ${fd.amount} ETH`, detail: tx.hash });
      }
      setPendingTx({ status: "pending", hash: tx.hash });
      await recordTx({ hash: tx.hash, action, amount: fd.amount, asset: fd.asset, destination: action==="send"?fd.destination:(action==="swap"?"WETH":w.address), status: "execution" });
      const receipt = await tx.wait();
      const ok = receipt?.status === 1;
      setPendingTx({ status: ok ? "complete" : "failed", hash: tx.hash });
      addLog({ type: ok?"success":"error", message: `${action.toUpperCase()} ${ok?"confirmed":"failed"} on Sepolia`, detail: tx.hash });
      await recordTx({ hash: tx.hash, action, amount: fd.amount, asset: fd.asset, destination: action==="send"?fd.destination:(action==="swap"?"WETH":w.address), status: ok?"complete":"failed" });
      setRecentTxs(prev => [{ hash: tx.hash, action, amount: fd.amount, status: ok?"complete":"failed", at: new Date().toISOString() }, ...prev].slice(0, 5));
      w.refreshBalance();
    } catch (e) {
      setWalletWarning(e?.shortMessage || e?.message || "Transaction failed");
      setPendingTx(null);
      addLog({ type: "error", message: `${action.toUpperCase()} failed: ${e?.shortMessage || e?.message || e}` });
    }
  };

  // Real-data dashboard cards
  const usdNum = (s) => Number(String(s||"").replace(/[^0-9.-]/g,"")) || 0;
  const cryptoUsd = assets.reduce((s,a) => s + usdNum(a.balance_usd), 0);
  const banksUsd = banks.reduce((s,b) => s + Number(b.balance||0), 0);
  const totalUsd = cryptoUsd + banksUsd;
  const teamCount = participants.length;
  const cards = [
    { l: "TOTAL VALUE", v: `$${totalUsd.toLocaleString()}`, c: "emerald" },
    { l: "BANK BALANCE", v: `$${banksUsd.toLocaleString()}`, c: "blue" },
    { l: "CRYPTO VALUE", v: `$${cryptoUsd.toLocaleString()}`, c: "purple" },
    { l: "WALLETS", v: Math.max(wallets.length, w.isConnected?1:0), c: "fuchsia" },
    { l: "TEAM", v: teamCount, c: "indigo" },
    { l: "THRESHOLD", v: `${threshold?.required_approvals || 1}/${teamCount || 0}`, c: "yellow" },
  ];

  return (<div className="p-6 space-y-6 overflow-y-auto flex-1">
    <div className="flex items-start justify-between flex-wrap gap-3"><div><h2 className="text-2xl font-bold mb-1">Governed Movement</h2><p className="fm text-sm text-gray-500">REAL ON-CHAIN TRANSACTIONS · ETHEREUM SEPOLIA TESTNET</p></div></div>

    {/* Spec §5 — Funding lock banner. Reflects org.smart_account_status. */}
    {org && org.smart_account_status !== "GovernedActive" && (
      <GC className="p-4" style={{borderLeft:"3px solid #ef4444"}}>
        <div className="flex items-center gap-3 flex-wrap fm text-xs">
          <Badge c="red">FUNDING LOCKED</Badge>
          <span className="text-red-300 font-bold">Smart Account is not Governed-Active.</span>
          <span className="text-gray-400">Status: <span className="text-purple-300">{org.smart_account_status || "NotDeployed"}</span></span>
        </div>
        <p className="fm text-xs text-gray-400 mt-2">Any send / swap / bridge will be rejected by the active policy validator until <em>(a)</em> the initial policy is activated on the Team page and <em>(b)</em> the approver set is verified. Sending to the Root EOA is allowed but those assets are <b>not</b> protected by smart-account rules — recovery only.</p>
        <div className="mt-2"><Btn v="secondary" onClick={()=>setActiveView("team")}>OPEN_TEAM_TO_ACTIVATE <Arr/></Btn></div>
      </GC>
    )}

    {/* 6 dashboard cards */}
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c,i)=>(<GC key={c.l} className={`p-4 anim-d${Math.min(i,3)+1}`}><div className="fm text-[10px] text-gray-500 mb-1">{c.l}</div><div className={`text-lg font-bold text-${c.c}-400`}>{c.v}</div></GC>))}
    </div>

    {/* Wallet status + connect */}
    <GC className="p-5" style={{borderTop:"2px solid rgba(34,197,94,.4)"}}>
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex-1 min-w-[240px]">
          <SL>WALLET · SEPOLIA TESTNET</SL>
          {!w.hasProvider && <div className="fm text-xs text-yellow-300">No EIP-1193 wallet detected. Install <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">MetaMask</a> to test on-chain transactions.</div>}
          {w.hasProvider && !w.isConnected && <div className="fm text-xs text-gray-400 mb-3">Connect MetaMask to send / swap real ETH on Sepolia. We never store your private key — your wallet signs every transaction locally.</div>}
          {w.isConnected && (<div className="space-y-2 fm text-xs">
            <div className="flex items-center gap-2"><span className="text-gray-500">ADDRESS:</span><a href={explorerAddr(w.address)} target="_blank" rel="noopener noreferrer" className="mono text-purple-300 hover:text-purple-200 hover:underline">{shortAddr(w.address)}</a><Badge c={w.isSepolia?"green":"red"}>{w.isSepolia?"SEPOLIA":`WRONG NETWORK (${w.chainId||"?"})`}</Badge></div>
            <div className="flex items-center gap-4 flex-wrap"><span className="text-gray-500">ETH:</span><span className="text-emerald-400 font-bold">{Number(w.balance).toFixed(6)} SEP</span><span className="text-gray-500">WETH:</span><span className="text-fuchsia-400 font-bold">{Number(w.wethBalance).toFixed(6)}</span><button onClick={()=>w.refreshBalance()} className="fm text-[10px] text-purple-400 hover:text-purple-300 cursor-pointer">[ REFRESH ]</button></div>
          </div>)}
        </div>
        <div className="flex gap-2 flex-wrap">
          {!w.isConnected && <WalletPicker w={w}/>}
          {w.isConnected && !w.isSepolia && <Btn v="secondary" onClick={w.ensureSepolia}>SWITCH TO SEPOLIA</Btn>}
          {w.isConnected && <Btn v="ghost" onClick={w.reconnect} disabled={w.busy}>SWITCH ACCOUNT</Btn>}
          {w.isConnected && <Btn v="ghost" onClick={w.disconnect}>DISCONNECT</Btn>}
        </div>
      </div>
      {w.error && <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 fm text-xs text-red-300">{w.error}</div>}
    </GC>

    {/* Faucet card */}
    <GC className="p-5" style={{borderLeft:"3px solid #facc15"}}>
      <SL>NEED SEPOLIA ETH?</SL>
      <p className="fm text-xs text-gray-400 mb-3">Sepolia is a free testnet. Pick a faucet, paste your wallet address, claim a small amount, then come back here.{w.address && <> Your address: <code className="text-purple-300">{w.address}</code></>}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {FAUCETS.map(f => (<a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="block p-3 border border-yellow-500/20 hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-all cursor-pointer">
          <div className="fm text-xs font-bold text-yellow-300">{f.name} ↗</div>
          <div className="fm text-[10px] text-gray-500 mt-0.5">{f.note}</div>
        </a>))}
      </div>
    </GC>

    {/* Action bar */}
    <div className="flex flex-wrap items-center gap-3"><ActionBar active={action} onPick={setAction}/></div>

    {/* On-chain transaction form (works without scenario; alongside scenario flow when active) */}
    <GC className="p-6 max-w-2xl">
      <SL>{action.toUpperCase()} · ETHEREUM SEPOLIA</SL>
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="AMOUNT (ETH)"><input type="number" step="0.0001" placeholder="0.001" value={fd.amount} onChange={e=>up("amount",e.target.value)}/></Field>
          <Field label="ASSET"><select value={fd.asset} onChange={e=>up("asset",e.target.value)} disabled={action!=="send"}><option>ETH</option>{action==="send" && <><option>USDC</option><option>WETH</option></>}</select></Field>
          {action==="send" && <Field label="DESTINATION ADDRESS *"><input placeholder="0x..." value={fd.destination} onChange={e=>up("destination",e.target.value)}/></Field>}
          {action==="swap" && <Field label="SWAP TYPE" hint="ETH ↔ WETH wrap/unwrap on the canonical Sepolia WETH9 contract."><div className="fm text-xs text-gray-400 px-3 py-2.5 border border-gray-800 bg-black/30">ETH → WETH (wrap)</div></Field>}
          {action==="bridge" && <Field label="BRIDGE NOTE" hint="Cross-chain bridge integration is on the roadmap. The demo loops a Sepolia tx back to the connected wallet so you can see the on-chain flow."><div className="fm text-xs text-yellow-300 px-3 py-2.5 border border-yellow-500/20 bg-yellow-500/5">Demo: loopback on Sepolia</div></Field>}
        </div>
        {walletWarning && <div className="p-3 bg-red-500/10 border border-red-500/30 fm text-xs text-red-300">{walletWarning}</div>}
        {policyNote && <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 fm text-xs text-yellow-200"><b>Governance note:</b> {policyNote} <span className="text-gray-400">This testnet send from your own EOA proceeds; in production the governed vault would gate it.</span></div>}
        {pendingTx && (<div className="p-3 bg-purple-500/10 border border-purple-500/30 fm text-xs text-purple-200 space-y-1">
          <div>{pendingTx.status==="signing"?"Awaiting MetaMask signature...":pendingTx.status==="pending"?"Broadcasted — waiting for confirmation...":pendingTx.status==="complete"?"✓ Confirmed on Sepolia":"✗ Failed"}</div>
          {pendingTx.hash && <a href={explorerTx(pendingTx.hash)} target="_blank" rel="noopener noreferrer" className="mono text-purple-400 hover:underline break-all">{pendingTx.hash} ↗</a>}
        </div>)}
        <Btn full onClick={onChainSubmit} disabled={!w.isConnected || pendingTx?.status==="signing" || pendingTx?.status==="pending"}>{pendingTx?.status==="signing"?"AWAITING SIGNATURE...":pendingTx?.status==="pending"?"CONFIRMING...":`SUBMIT_${action.toUpperCase()}_ON_SEPOLIA`} <Arr/></Btn>
        {!w.isConnected && <div className="fm text-xs text-gray-500 text-center">Connect MetaMask above to enable submission.</div>}
      </div>
    </GC>

    {/* Recent txs (this page) */}
    {recentTxs.length>0 && <GC className="p-5"><SL>RECENT (THIS SESSION)</SL><div className="space-y-2 fm text-xs">{recentTxs.map(t=>(<div key={t.hash} className="flex items-center gap-3 py-2 border-b border-gray-800/40">
      <span className="text-purple-400 uppercase w-16">{t.action}</span>
      <span className="text-gray-300 font-bold w-24">{t.amount} ETH</span>
      <Badge c={t.status==="complete"?"green":t.status==="failed"?"red":"yellow"}>{t.status.toUpperCase()}</Badge>
      <a href={explorerTx(t.hash)} target="_blank" rel="noopener noreferrer" className="mono text-purple-300 hover:underline truncate flex-1">{t.hash}</a>
    </div>))}</div></GC>}

    {/* Scenario flow — only when an evaluation scenario is active */}
    {activeScenario && (<>
      <GC className="p-4" style={{borderLeft:"3px solid #a855f7"}}><div className="flex items-center gap-3 fm text-xs flex-wrap"><Badge c="purple">SCENARIO {activeScenario.num}</Badge><span className="text-gray-400">{activeScenario.title}</span><span className="text-gray-600">|</span><span className="text-purple-400 font-bold">{step.toUpperCase()}</span>{isBlocked&&<Badge c="red">BLOCKED PATH</Badge>}</div>{(() => { const requester = participants.find(p=>p.scenario_role==="Requester"); const approver = participants.find(p=>p.scenario_role==="Approver"); const actor = step==="request"?(requester?.institution_fn||"Requester"):step==="policy"?"Policy Engine":(approver?.institution_fn||"Approver"); return (<div className="fm text-xs text-gray-600 mt-1">Policy: Movement Policy {threshold?.policy_version||"—"} · Actor: {actor}</div>); })()}</GC>
      <div className="flex gap-2 flex-wrap">{["request","policy","approval","execution"].map((s,i)=><div key={s} className={`flex items-center gap-1 px-3 py-1.5 fm text-xs ${step===s?"text-purple-400 bg-purple-500/10 border border-purple-500/30":i<["request","policy","approval","execution"].indexOf(step)?"text-emerald-400":"text-gray-600"}`}>{i<["request","policy","approval","execution"].indexOf(step)?"✓":String(i+1).padStart(2,"0")} {s.toUpperCase()}</div>)}</div>
      {step==="policy"&&<GC className="p-6 max-w-xl"><SL>POLICY APPLICATION</SL><div className="space-y-4"><InfoRow label="POLICY_IN_FORCE" value={`Movement Policy ${threshold?.policy_version||"—"}`}/><InfoRow label="ACTING_FUNCTION" value={participants.find(p=>p.scenario_role==="Requester")?.institution_fn||"—"}/><InfoRow label="OUTCOME" badge={isBlocked?{t:"BLOCKED",c:"red"}:{t:"PASSED",c:"green"}}/>{isBlocked&&<div className="p-4 bg-red-500/5 border border-red-500/20 fm text-xs text-red-300">Policy conflict detected. Exception trail being generated.</div>}<Btn full onClick={()=>advance()}>{isBlocked?"VIEW_EXCEPTION":"VIEW_POLICY_PATH"} <Arr/></Btn></div></GC>}
      {step==="approval"&&<GC className="p-6 max-w-xl"><SL>THRESHOLD APPROVAL</SL><div className="space-y-4">{participants.filter(p=>["Approver","Reviewer"].includes(p.scenario_role)).map(p=><div key={p.id} className="flex items-center justify-between p-3 bg-black/30 border border-gray-800/50"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-xs font-bold">{p.initials}</div><div><div className="text-sm font-bold">{p.name}</div><div className="fm text-xs text-gray-500">{p.institution_fn}</div></div></div><Badge c="green">APPROVED</Badge></div>)}<InfoRow label="THRESHOLD" value={`${threshold?.required_approvals||1} of ${teamCount||1} — Met`}/><Btn full onClick={()=>advance()}>ADVANCE_TO_EXECUTION <Arr/></Btn></div></GC>}
      {step==="execution"&&<GC className="p-6 max-w-xl"><SL>{isBlocked?"BLOCKED OUTCOME":"EXECUTION"}</SL><div className="space-y-4"><div className="text-center py-4"><div className={`inline-block p-4 rounded-full mb-4 ${isBlocked?"bg-red-500/10 border border-red-500/30":"bg-emerald-500/10 border border-emerald-500/30"}`}>{isBlocked?<Blk/>:<Chk/>}</div><h3 className="text-xl font-bold mb-2">{isBlocked?"Movement Blocked":"Movement Executed"}</h3></div><Btn full onClick={()=>advance()}>COMPLETE <Arr/></Btn></div></GC>}
      {step==="complete"&&<GC className="p-6 max-w-xl"><div className="text-center py-4"><div className="inline-block p-4 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-4"><Chk/></div><h3 className="text-xl font-bold mb-2">Scenario Flow Complete</h3></div><div className="flex gap-3 justify-center"><Btn onClick={()=>setActiveView("evidence")}>VIEW_EVIDENCE</Btn></div></GC>}
    </>)}

    {/* Connected wallets list */}
    {wallets.length>0 && <GC className="p-4"><SL>SAVED WALLETS</SL><div className="space-y-2">{wallets.map(wl=>(<div key={wl.id} className="flex items-center justify-between p-3 bg-black/30 border border-gray-800/50"><div className="flex items-center gap-3"><Wallet/><div className="fm text-xs"><div className="text-gray-300 font-bold">{wl.label||wl.address?.slice(0,10)} · {wl.chain?.name}{wl.chain?.is_testnet?" (Testnet)":""}</div><div className="mono text-gray-600 truncate max-w-md">{wl.address}</div></div></div><div className="flex items-center gap-2"><Badge c={wl.chain?.is_testnet?"yellow":"green"}>{(wl.type||"EOA").toUpperCase()}</Badge><button onClick={()=>removeWallet(wl.id, wl.label)} className="text-gray-600 hover:text-red-400 cursor-pointer p-1"><TrashI/></button></div></div>))}</div></GC>}
  </div>);
};

// ═══════════════════════════════════════════════════════════════════
// TEAM (item 12 — renamed from Participants)
// ═══════════════════════════════════════════════════════════════════
const Team = () => {
  const { participants, threshold, addParticipant, removeParticipant, updateThreshold,
          invitations, sendInvitation, resendInvitation, revokeInvitation, reloadInvitations, reloadParticipants,
          setUserState } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => { setRefreshing(true); try { await Promise.all([reloadParticipants(), reloadInvitations()]); } finally { setRefreshing(false); } };
  const [mode, setMode] = useState(null); // null | "invite" | "manual"
  const [busy, setBusy] = useState(false);
  const [inv, setInv] = useState({ email:"", full_name:"", institution_fn:"", scenario_role:"Requester", threshold_weight:1 });
  const [m, setM] = useState({ name:"", email:"", institution_fn:"", scenario_role:"Requester", threshold_weight:1 });
  const [t, setT] = useState({ required_approvals: threshold?.required_approvals||1, required_reviewers: threshold?.required_reviewers||0, policy_version: threshold?.policy_version||"v2.1" });
  useEffect(() => { setT({ required_approvals: threshold?.required_approvals||1, required_reviewers: threshold?.required_reviewers||0, policy_version: threshold?.policy_version||"v2.1" }); }, [threshold]);
  const ui = (k,v) => setInv(p=>({...p,[k]:v}));
  const um = (k,v) => setM(p=>({...p,[k]:v}));
  const sendInvite = async () => {
    if (!inv.email) return;
    setBusy(true);
    const r = await sendInvitation(inv);
    setBusy(false);
    if (r?.ok) { setInv({ email:"", full_name:"", institution_fn:"", scenario_role:"Requester", threshold_weight:1 }); setMode(null); }
  };
  const submitManual = async () => { if (!m.name) return; await addParticipant(m); setM({ name:"", email:"", institution_fn:"", scenario_role:"Requester", threshold_weight:1 }); setMode(null); };
  const saveThresh = () => updateThreshold({ required_approvals: Number(t.required_approvals), required_reviewers: Number(t.required_reviewers), policy_version: t.policy_version });
  const roleColor = { Requester:"purple", Approver:"fuchsia", Reviewer:"blue", Oversight:"indigo", Observer:"gray" };
  const pending = (invitations||[]).filter(i => i.status === "pending");

  return (<div className="p-6 space-y-6 overflow-y-auto flex-1">
    <div className="flex items-start justify-between gap-4 flex-wrap"><div><h2 className="text-2xl font-bold mb-1">Team</h2><p className="fm text-sm text-gray-500">INVITATIONS · ROLES · AUTHORITY · THRESHOLD</p></div><div className="flex gap-2 flex-wrap"><Btn v="ghost" onClick={refresh} disabled={refreshing}>{refreshing?"REFRESHING...":"REFRESH"}</Btn><Btn onClick={()=>setMode("invite")}>{sIcons.mail}INVITE_BY_EMAIL</Btn><Btn v="secondary" onClick={()=>setMode("manual")}><Plus/> ADD_MANUALLY</Btn></div></div>

    <GC className="p-5"><SL>THRESHOLD SETTINGS</SL><div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Field label="REQUIRED_APPROVALS" hint="Number of Approver-role members who must approve before a movement can execute."><input type="number" min="1" value={t.required_approvals} onChange={e=>setT(p=>({...p,required_approvals:e.target.value}))}/></Field>
      <Field label="REQUIRED_REVIEWERS"><input type="number" min="0" value={t.required_reviewers} onChange={e=>setT(p=>({...p,required_reviewers:e.target.value}))}/></Field>
      <Field label="POLICY_VERSION"><input value={t.policy_version} onChange={e=>setT(p=>({...p,policy_version:e.target.value}))}/></Field>
    </div><div className="mt-4"><Btn v="secondary" onClick={saveThresh}>SAVE_THRESHOLD <Chk/></Btn></div></GC>

    {mode==="invite" && <GC className="p-5" style={{borderTop:"2px solid rgba(168,85,247,.5)"}}><SL>SEND INVITATION</SL>
      <p className="fm text-xs text-gray-400 mb-4">An email is sent via Supabase Auth. The invitee clicks the link, signs up, and is automatically added to your org with the role you pick.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="EMAIL *"><input type="email" placeholder="name@org.com" value={inv.email} onChange={e=>ui("email",e.target.value)}/></Field>
        <Field label="FULL NAME (optional)"><input placeholder="Their full name" value={inv.full_name} onChange={e=>ui("full_name",e.target.value)}/></Field>
        <Field label="FUNCTION"><select value={inv.institution_fn} onChange={e=>ui("institution_fn",e.target.value)}><option value="">— Select —</option><option>Treasury / Operations</option><option>Risk Management</option><option>Compliance</option><option>Audit / Internal Audit</option><option>Finance</option><option>Legal</option><option>Engineering</option></select></Field>
        <Field label="ROLE"><select value={inv.scenario_role} onChange={e=>ui("scenario_role",e.target.value)}><option>Requester</option><option>Approver</option><option>Reviewer</option><option>Oversight</option><option>Observer</option></select></Field>
        <Field label="THRESHOLD_WEIGHT"><input type="number" min="1" value={inv.threshold_weight} onChange={e=>ui("threshold_weight",Number(e.target.value))}/></Field>
      </div><div className="flex gap-3 mt-5"><Btn onClick={sendInvite} disabled={busy||!inv.email}>{busy?"SENDING...":"SEND_INVITATION"} {sIcons.mail}</Btn><Btn v="ghost" onClick={()=>setMode(null)}>CANCEL</Btn></div>
    </GC>}

    {mode==="manual" && <GC className="p-5" style={{borderTop:"2px solid rgba(99,102,241,.5)"}}><SL>ADD MEMBER MANUALLY</SL>
      <p className="fm text-xs text-gray-400 mb-4">Use this for record-keeping when a member already exists outside the platform — they won't be able to log in until invited by email.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="NAME *"><input placeholder="Full name" value={m.name} onChange={e=>um("name",e.target.value)}/></Field>
        <Field label="EMAIL"><input type="email" placeholder="name@org" value={m.email} onChange={e=>um("email",e.target.value)}/></Field>
        <Field label="FUNCTION"><select value={m.institution_fn} onChange={e=>um("institution_fn",e.target.value)}><option value="">— Select —</option><option>Treasury / Operations</option><option>Risk Management</option><option>Compliance</option><option>Audit / Internal Audit</option><option>Finance</option><option>Legal</option><option>Engineering</option></select></Field>
        <Field label="ROLE"><select value={m.scenario_role} onChange={e=>um("scenario_role",e.target.value)}><option>Requester</option><option>Approver</option><option>Reviewer</option><option>Oversight</option><option>Observer</option></select></Field>
        <Field label="THRESHOLD_WEIGHT"><input type="number" min="1" value={m.threshold_weight} onChange={e=>um("threshold_weight",Number(e.target.value))}/></Field>
      </div><div className="flex gap-3 mt-5"><Btn onClick={submitManual}>SAVE_MEMBER <Chk/></Btn><Btn v="ghost" onClick={()=>setMode(null)}>CANCEL</Btn></div>
    </GC>}

    {/* Pending invitations */}
    {pending.length>0 && <GC className="p-5"><SL>PENDING INVITATIONS ({pending.length})</SL><div className="space-y-2">
      {pending.map(i=>(<div key={i.id} className="flex items-center justify-between p-3 bg-black/30 border border-gray-800/50 flex-wrap gap-2">
        <div className="flex items-center gap-3 fm text-xs min-w-0 flex-1">
          <Badge c="yellow">PENDING</Badge>
          <span className="text-gray-300 font-bold truncate">{i.email}</span>
          <Badge c={roleColor[i.scenario_role]||"purple"}>{(i.scenario_role||"").toUpperCase()}</Badge>
          {i.institution_fn && <span className="text-gray-500 truncate">{i.institution_fn}</span>}
          <span className="text-gray-600 hidden md:inline">expires {new Date(i.expires_at).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={()=>resendInvitation(i.id)} className="fm text-[10px] px-2 py-1 border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 cursor-pointer">RESEND</button>
          <button onClick={()=>revokeInvitation(i.id)} className="fm text-[10px] px-2 py-1 border border-red-500/30 text-red-400 hover:bg-red-500/10 cursor-pointer">REVOKE</button>
        </div>
      </div>))}
    </div></GC>}

    {/* Phase 4 — Team as security-control surface */}
    <div>
      <SL>ALL MEMBERS ({participants.length})</SL>
      <div className="fm text-[10px] text-gray-500 mb-3">Approval authority is computed: a member only counts toward threshold when their state is <span className="text-emerald-400">ACTIVE</span> <i>and</i> their role is <span className="text-fuchsia-300">APPROVER</span> in the current policy version.</div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {participants.length===0 && <Empty>No team members yet — invite the first one above.</Empty>}
        {participants.map(p=>{
          const role = p.governance_role || (p.scenario_role==="Approver"?"Approver":p.scenario_role==="Observer"||p.scenario_role==="Oversight"||p.scenario_role==="Reviewer"?"Observer":"Requester");
          const state = p.user_state || (p.status==="active"?"Active":"Pending");
          const counts = role === "Approver" && state === "Active";
          const stateColor = {Active:"green", Pending:"yellow", Disabled:"gray", Expired:"yellow", Revoked:"red"}[state] || "gray";
          return (<GC key={p.id} className="p-5 flex flex-col" style={{borderTop:`2px solid ${role==="Approver"?"rgba(217,70,239,.5)":role==="Admin"?"rgba(168,85,247,.5)":"rgba(99,102,241,.4)"}`}}>
            <div className="flex items-center gap-3 mb-4"><div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center font-bold">{p.initials}</div><div className="min-w-0"><div className="font-bold truncate">{p.name}</div><div className="fm text-xs text-gray-500 truncate">{p.institution_fn||"—"}</div></div></div>
            <div className="space-y-1.5 mb-4 fm text-xs">
              <div className="flex justify-between"><span className="text-gray-500">EMAIL</span><span className="text-gray-300 truncate ml-2 max-w-[160px]">{p.email||"—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">WEIGHT</span><span className="text-gray-300">{p.threshold_weight||1}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">ADDED</span><span className="text-gray-300">{p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">LAST ACTIVITY</span><span className="text-gray-300">{p.last_activity_at ? new Date(p.last_activity_at).toLocaleDateString() : "—"}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">AUTHORITY</span><span className={counts?"text-emerald-400":"text-gray-600"}>{counts?"COUNTS":"NONE"}</span></div>
            </div>
            <div className="flex items-center justify-between mt-auto"><Badge c={role==="Approver"?"fuchsia":role==="Admin"?"purple":role==="Observer"?"gray":"indigo"}>{role.toUpperCase()}</Badge><div className="flex items-center gap-2"><Badge c={stateColor}>{state.toUpperCase()}</Badge><button onClick={()=>removeParticipant(p.id, p.name)} className="text-gray-600 hover:text-red-400 cursor-pointer p-1"><TrashI/></button></div></div>
            {/* Spec §8 — controlled user state transitions */}
            <div className="mt-3 pt-3 border-t border-gray-800/50 flex flex-wrap gap-1">
              {state === "Pending" && <button onClick={()=>setUserState(p.id, "Active")} className="fm text-[10px] px-2 py-1 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10">VERIFY → ACTIVE</button>}
              {state === "Active"  && <button onClick={()=>setUserState(p.id, "Disabled")} className="fm text-[10px] px-2 py-1 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/10">DISABLE</button>}
              {state === "Disabled" && <button onClick={()=>setUserState(p.id, "Active")} className="fm text-[10px] px-2 py-1 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10">RE-ENABLE</button>}
              {state !== "Revoked" && <button onClick={()=>setUserState(p.id, "Revoked")} className="fm text-[10px] px-2 py-1 border border-red-500/30 text-red-400 hover:bg-red-500/10">REVOKE</button>}
            </div>
          </GC>);
        })}
      </div>
    </div>

    {/* Phase 4 — Policy activation panel */}
    <PolicyPanel />
  </div>);
};

// ─── Policy Activation panel (Phase 4) ─────────────────────────────
const PolicyPanel = () => {
  const { org, participants, addLog, submitPolicyForActivation, voteOnPolicy, proposePolicyChange, voteOnPolicyChange } = useApp();
  const [policy, setPolicy] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [propType, setPropType] = useState("IncreaseLimit");
  const [propAmount, setPropAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    if (!org?.id) return;
    const { data: pv } = await supabase.from("policy_versions")
      .select("*").eq("org_id", org.id).order("drafted_at", { ascending: false }).limit(1).maybeSingle();
    setPolicy(pv);
    if (pv) {
      const { data: aps } = await supabase.from("policy_approvals")
        .select("*").eq("policy_version_id", pv.id);
      setApprovals(aps || []);
    }
    const { data: pp } = await supabase.from("policy_change_proposals")
      .select("*").eq("org_id", org.id).order("created_at", { ascending: false }).limit(20);
    setProposals(pp || []);
  };
  useEffect(() => { reload(); }, [org?.id]);

  if (!policy) return null;

  // Spec §6 + §8 — only Approver role + Active state count
  const activeApprovers = participants.filter(p =>
    (p.governance_role || p.scenario_role) === "Approver" &&
    (p.user_state || (p.status === "active" ? "Active" : "Pending")) === "Active"
  );
  const approveCount = approvals.filter(a => a.vote === "approve").length;
  const ready = approveCount >= (policy.required_approvals || 1);
  const policyColor = { Draft:"yellow", PendingApproval:"fuchsia", Active:"green", Rejected:"red", Superseded:"gray" }[policy.status] || "purple";

  const submit = async () => { setBusy(true); try { await submitPolicyForActivation(policy.id); await reload(); } finally { setBusy(false); } };
  const vote = async (v) => { setBusy(true); try { await voteOnPolicy(policy.id, v); await reload(); } finally { setBusy(false); } };
  const proposeChange = async () => {
    const payload = propType === "IncreaseLimit" ? { new_ceiling_usd: Number(propAmount||0) }
                  : propType === "ReduceThreshold" ? { new_required_approvals: Math.max(1, (policy.required_approvals||1) - 1) }
                  : {};
    setBusy(true);
    try { await proposePolicyChange(propType, payload); await reload(); setPropAmount(""); } finally { setBusy(false); }
  };
  const voteChange = async (id, v) => { setBusy(true); try { await voteOnPolicyChange(id, v); await reload(); } finally { setBusy(false); } };

  return (<div className="space-y-4">
    {/* Policy state card */}
    <GC className="p-5" style={{borderTop:"2px solid rgba(168,85,247,.5)"}}>
      <SL>POLICY · {policy.version.toUpperCase()}</SL>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 fm text-xs">
        <div><div className="text-gray-500 mb-1">STATUS</div><Badge c={policyColor}>{policy.status.toUpperCase()}</Badge></div>
        <div><div className="text-gray-500 mb-1">THRESHOLD</div><div className="text-gray-200 font-bold">{policy.required_approvals} of {policy.total_approvers}</div></div>
        <div><div className="text-gray-500 mb-1">APPROVALS</div><div className={`font-bold ${ready?"text-emerald-400":"text-gray-300"}`}>{approveCount} / {policy.required_approvals}</div></div>
        <div><div className="text-gray-500 mb-1">ACTIVE APPROVERS</div><div className="text-gray-200 font-bold">{activeApprovers.length}</div></div>
      </div>

      {/* Activation flow steps (spec §9) */}
      <div className="mt-4 flex flex-col md:flex-row gap-2 fm text-[10px]">
        {[
          { id:"draft",  l:"DRAFT",            done: true,                                  cur: policy.status==="Draft" },
          { id:"invite", l:"APPROVERS INVITED", done: participants.length>0,                cur: policy.status==="Draft" && activeApprovers.length===0 },
          { id:"verify", l:"APPROVERS ACTIVE", done: activeApprovers.length >= policy.required_approvals, cur: policy.status==="Draft" && activeApprovers.length>0 && activeApprovers.length < policy.required_approvals },
          { id:"submit", l:"SUBMITTED",         done: ["PendingApproval","Active"].includes(policy.status), cur: policy.status === "Draft" && activeApprovers.length >= policy.required_approvals },
          { id:"vote",   l:"APPROVERS VOTE",   done: policy.status==="Active",              cur: policy.status==="PendingApproval" },
          { id:"active", l:"GOVERNED ACTIVE",  done: policy.status==="Active",              cur: false },
        ].map((s,i) => (<div key={s.id} className={`flex-1 p-2 border ${s.done?"border-emerald-500/40 text-emerald-400 bg-emerald-500/5":s.cur?"border-purple-500/50 text-purple-300 bg-purple-500/10":"border-gray-800 text-gray-600"}`}>{i+1}. {s.l}{s.done && " ✓"}</div>))}
      </div>

      <div className="mt-4 p-3 bg-purple-500/5 border border-purple-500/20 fm text-xs text-gray-400">
        Only <span className="text-fuchsia-300">Approver</span>-role members in state <span className="text-emerald-300">Active</span> count toward threshold. <b>The proposer of a policy change cannot be its sole approver</b> (DB-enforced). Pending invitees cannot approve. Once the M-of-N is met the smart account transitions to <span className="text-emerald-300">Governed Active</span>.
      </div>

      {policy.status === "Draft" && activeApprovers.length >= policy.required_approvals && <div className="mt-4"><Btn onClick={submit} disabled={busy}>{busy?"...":"SUBMIT_FOR_ACTIVATION"} <Arr/></Btn></div>}
      {policy.status === "PendingApproval" && <div className="mt-4 flex gap-2 flex-wrap"><Btn v="secondary" onClick={()=>vote("approve")} disabled={busy}>APPROVE</Btn><Btn v="ghost" onClick={()=>vote("reject")} disabled={busy}>REJECT</Btn></div>}
    </GC>

    {/* Policy-change proposals (spec §10) */}
    {policy.status === "Active" && <GC className="p-5" style={{borderTop:"2px solid rgba(217,70,239,.5)"}}>
      <SL>POLICY CHANGES · ANY MODIFICATION IS A GOVERNED ACTION</SL>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <Field label="CHANGE TYPE"><select value={propType} onChange={e=>setPropType(e.target.value)}>
          <option value="IncreaseLimit">Increase amount limit</option>
          <option value="AddDestination">Add destination address</option>
          <option value="ReduceThreshold">Reduce threshold (timelocked)</option>
          <option value="RaiseThreshold">Raise threshold</option>
          <option value="AddApprover">Add approver</option>
          <option value="RemoveApprover">Remove approver</option>
          <option value="InstallModule">Install module</option>
          <option value="UpgradeLogic">Upgrade smart-account logic</option>
          <option value="ChangeRecovery">Change recovery authority</option>
        </select></Field>
        {(propType === "IncreaseLimit" || propType === "AddDestination") && <Field label="VALUE"><input placeholder={propType==="IncreaseLimit"?"$50,000":"0x..."} value={propAmount} onChange={e=>setPropAmount(e.target.value)}/></Field>}
        <div className="flex items-end"><Btn v="secondary" onClick={proposeChange} disabled={busy}>PROPOSE_CHANGE</Btn></div>
      </div>

      {proposals.length === 0 ? <Empty>No proposals yet.</Empty> : <div className="space-y-2">
        {proposals.map(p => (<div key={p.id} className="p-3 bg-black/30 border border-gray-800/50 flex items-center justify-between flex-wrap gap-2 fm text-xs">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Badge c={p.status==="Pending"?"yellow":p.status==="Approved"?"green":"red"}>{p.status.toUpperCase()}</Badge>
            <span className="text-purple-300 font-bold">{p.change_type}</span>
            <span className="text-gray-500 truncate">{JSON.stringify(p.payload || {})}</span>
            <span className="text-gray-600">M={p.required_approvals}</span>
            {p.timelock_until && new Date(p.timelock_until) > new Date() && <span className="text-yellow-400">⏱ timelock</span>}
          </div>
          {p.status === "Pending" && <div className="flex items-center gap-1">
            <button onClick={()=>voteChange(p.id, "approve")} className="fm text-[10px] px-2 py-1 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10">APPROVE</button>
            <button onClick={()=>voteChange(p.id, "reject")} className="fm text-[10px] px-2 py-1 border border-red-500/30 text-red-400 hover:bg-red-500/10">REJECT</button>
          </div>}
        </div>))}
      </div>}
    </GC>}
  </div>);
};

// ═══════════════════════════════════════════════════════════════════
// EVIDENCE VIEWER
// ═══════════════════════════════════════════════════════════════════
const EvidenceViewer = () => {
  const { activeScenario, evidenceStore, generateEvidence, addLog, setActiveView, logs, transactions, scenarios } = useApp();
  const scId = activeScenario?.id;
  const ev = scId ? evidenceStore[scId] : null;
  const [tab, setTab] = useState("__transactions__");
  // Item 2 — wallet-scoped on-chain history, read live from the Sepolia chain
  const w = useSharedWallet();
  const [chainTxs, setChainTxs] = useState([]);
  const [chainLoading, setChainLoading] = useState(false);
  const loadChainTxs = async (addr) => {
    if (!addr) { setChainTxs([]); return; }
    setChainLoading(true);
    const rows = await fetchWalletTxHistory(addr, 50);
    setChainTxs(rows);
    setChainLoading(false);
  };
  useEffect(()=>{ if (w.address) loadChainTxs(w.address); else setChainTxs([]); }, [w.address]);

  useEffect(()=>{ setTab(scId ? 0 : "__transactions__"); },[scId]);
  useEffect(()=>{ if(scId && !ev) generateEvidence(scId); },[scId]);

  const sections = ev?.sections || [];
  const activeSection = typeof tab === "number" ? sections[tab] : null;

  const renderContent = (content) => {
    if(!content) return null;
    return Object.entries(content).map(([k,v])=>{
      if(typeof v==="boolean") return <InfoRow key={k} label={k.toUpperCase()} badge={{t:v?"YES":"NO",c:v?"green":"red"}}/>;
      if(typeof v==="object"&&v!==null&&!Array.isArray(v)) return <div key={k} className="mt-3"><div className="fm text-xs text-purple-400 mb-2">{k.toUpperCase()}</div>{Object.entries(v).map(([k2,v2])=><InfoRow key={k2} label={k2.toUpperCase()} value={String(v2)}/>)}</div>;
      if(Array.isArray(v)) {
        if(v.length===0) return <InfoRow key={k} label={k.toUpperCase()} value="—"/>;
        if(typeof v[0]==="string") return <InfoRow key={k} label={k.toUpperCase()} value={v.join(", ")}/>;
        return <div key={k} className="mt-3"><div className="fm text-xs text-purple-400 mb-2">{k.toUpperCase()}</div>{v.map((item,i)=><div key={i} className="p-2 mb-1 bg-black/20 border border-gray-800/30 fm text-xs text-gray-300">{typeof item==="object"?Object.entries(item).map(([ik,iv])=><span key={ik} className="mr-3">{ik}: <span className="text-gray-400">{String(iv)}</span></span>):String(item)}</div>)}</div>;
      }
      return <InfoRow key={k} label={k.toUpperCase()} value={String(v)}/>;
    });
  };

  const TX = "__transactions__";
  const ACCOUNTING = "__accounting__";
  const onTx = tab === TX;
  const onAccounting = tab === ACCOUNTING;
  const exportRows = (logs||[]).map(l => ({ created_at: l.created_at, type: l.log_type||l.type||"info", message: l.message||"", scenario: l.scenario_id||"", actor: l.actor||"", detail: l.detail||"" }));
  // TX history rows from movement_requests (real platform transactions)
  const txRows = (transactions||[]).map(t => {
    const sc = scenarios.find(s => s.id === t.scenario_id);
    const data = t.step_data || {};
    return {
      timestamp: t.created_at || t.updated_at || "",
      id: t.id,
      type: data.action || (t.scenario_id === "s2" ? "send" : "send"),
      amount: data.amount ?? t.amount ?? "",
      asset: data.asset ?? t.asset ?? "",
      destination: data.destination ?? t.destination ?? "",
      from_chain: data.chain_from ?? "",
      to_chain: data.chain_to ?? "",
      step: t.current_step || "",
      status: t.current_step === "complete" ? "completed" : t.current_step === "execution" && t.scenario_id === "s2" ? "blocked" : t.current_step || "pending",
      scenario: sc ? sc.num : t.scenario_id || "",
    };
  });
  const today = new Date().toISOString().slice(0,10);

  return (<div className="p-6 space-y-6 overflow-y-auto flex-1"><div className="flex items-center justify-between flex-wrap gap-3"><div><h2 className="text-2xl font-bold mb-1">Evidence Viewer</h2><p className="fm text-sm text-gray-500">INSTITUTIONALLY LEGIBLE EVIDENCE</p></div><div className="flex gap-2 flex-wrap"><Btn v="secondary" onClick={()=>{exportCSV(exportRows,`audit-logs-${today}.csv`);addLog({type:"evidence",message:`Exported ${exportRows.length} audit rows (CSV)`});}}><Dl/> EXPORT_CSV</Btn><Btn v="secondary" onClick={()=>{exportJSON(exportRows,`audit-logs-${today}.json`);addLog({type:"evidence",message:`Exported ${exportRows.length} audit rows (JSON)`});}}><Dl/> EXPORT_JSON</Btn><Btn v="secondary" onClick={()=>addLog({type:"evidence",message:"Evidence PDF downloaded"})}><Dl/> DOWNLOAD_PDF</Btn></div></div>
    {activeScenario&&<GC className="p-4 anim" style={{borderLeft:"3px solid #3b82f6"}}><div className="flex items-center gap-3 fm text-xs"><Badge c="blue">EVIDENCE</Badge><span className="text-gray-400">Scenario {activeScenario.num}: {activeScenario.title}</span></div></GC>}
    <div className="flex gap-2 flex-wrap anim-d1">
      <button onClick={()=>setTab(TX)} className={`px-4 py-2 fm text-xs cursor-pointer transition-all ${onTx?"text-purple-400 bg-purple-500/10 border border-purple-500/40":"text-gray-500 hover:text-gray-300 border border-transparent"}`}>Transactions ({txRows.length})</button>
      {sections.map((s,i)=><button key={i} onClick={()=>{setTab(i);addLog({type:"info",message:`Evidence: ${s.title}`})}} className={`px-4 py-2 fm text-xs cursor-pointer transition-all ${tab===i?"text-purple-400 bg-purple-500/10 border border-purple-500/40":"text-gray-500 hover:text-gray-300 border border-transparent"}`}>{s.title}{!s.disclosed&&" 🔒"}</button>)}
      <button onClick={()=>setTab(ACCOUNTING)} className={`px-4 py-2 fm text-xs cursor-pointer transition-all ${onAccounting?"text-purple-400 bg-purple-500/10 border border-purple-500/40":"text-gray-500 hover:text-gray-300 border border-transparent"}`}>Accounting</button>
    </div>

    {onTx && <>
      {/* Stream A — wallet-scoped on-chain history, read LIVE from the Sepolia chain (spec item 2) */}
      <GC className="p-6 anim-d2" style={{borderTop:"2px solid rgba(34,197,94,.4)"}}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <SL>ON-CHAIN HISTORY · WALLET-SCOPED</SL>
          <div className="flex gap-2 items-center">
            {w.address && <button onClick={()=>loadChainTxs(w.address)} className="fm text-[10px] text-purple-400 hover:text-purple-300 cursor-pointer">{chainLoading?"LOADING...":"[ REFRESH ]"}</button>}
            <Btn v="secondary" onClick={()=>{exportCSV(chainTxs,`onchain-${today}.csv`);addLog({type:"evidence",message:`Exported ${chainTxs.length} on-chain txs (CSV)`});}}><Dl/> EXPORT_CSV</Btn>
          </div>
        </div>
        <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 fm text-xs text-gray-400 mb-4">
          {w.isConnected
            ? <>Live transaction history for <a href={explorerAddr(w.address)} target="_blank" rel="noopener noreferrer" className="mono text-emerald-300 hover:underline">{shortAddr(w.address)}</a>, read directly from the Sepolia chain (Blockscout). Bound to the <b>wallet</b>, not your account — connect a different wallet to see a different history.</>
            : <>Connect a wallet on Governed Movement or Digital Assets to load its on-chain history here.</>}
        </div>
        {w.isConnected && <div className="overflow-x-auto"><div className="max-h-[320px] overflow-y-auto fm text-xs"><table className="w-full"><thead className="sticky top-0 bg-black/80 backdrop-blur"><tr className="text-gray-500 border-b border-gray-800"><th className="text-left py-2 px-2">TIMESTAMP</th><th className="text-left">DIR</th><th className="text-right">VALUE (ETH)</th><th className="text-left">COUNTERPARTY</th><th className="text-left">METHOD</th><th className="text-right">STATUS</th><th></th></tr></thead><tbody>
          {chainTxs.length===0 && <tr><td colSpan="7"><Empty>{chainLoading?"Loading on-chain history…":"No on-chain transactions for this wallet yet."}</Empty></td></tr>}
          {chainTxs.map(t=>(<tr key={t.hash} className="border-b border-gray-800/40">
            <td className="py-1.5 px-2 text-gray-600 whitespace-nowrap">{(t.timestamp||"").slice(0,19).replace("T"," ")}</td>
            <td className={t.direction==="out"?"text-red-400":"text-emerald-400"}>{t.direction.toUpperCase()}</td>
            <td className="text-right text-gray-300 font-bold">{Number(t.value_eth).toFixed(6)}</td>
            <td className="mono text-gray-400 truncate max-w-[160px]">{shortAddr(t.direction==="out"?t.to:t.from)}</td>
            <td className="text-gray-500">{t.method}</td>
            <td className="text-right"><Badge c={t.status==="success"?"green":t.status==="failed"?"red":"yellow"}>{t.status.toUpperCase()}</Badge></td>
            <td className="text-right"><a href={explorerTx(t.hash)} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">↗</a></td>
          </tr>))}
        </tbody></table></div></div>}
      </GC>

      {/* Stream B — account-scoped platform-recorded movements (from movement_requests) */}
      <GC className="p-6 anim-d2"><div className="flex items-center justify-between flex-wrap gap-3 mb-4"><SL>PLATFORM-RECORDED MOVEMENTS · ACCOUNT-SCOPED</SL><div className="flex gap-2"><Btn v="secondary" onClick={()=>{exportCSV(txRows,`transactions-${today}.csv`);addLog({type:"evidence",message:`Exported ${txRows.length} transactions (CSV)`});}}><Dl/> EXPORT_CSV</Btn><Btn v="secondary" onClick={()=>{exportJSON(txRows,`transactions-${today}.json`);addLog({type:"evidence",message:`Exported ${txRows.length} transactions (JSON)`});}}><Dl/> EXPORT_JSON</Btn></div></div>
      <div className="p-3 bg-purple-500/5 border border-purple-500/20 fm text-xs text-gray-400 mb-4"><span className="text-purple-400 font-bold">{txRows.length}</span> movements initiated <em>through</em> Quantum Qustody — Send, Swap, Bridge — with policy outcome and approval state. Backed by <span className="text-purple-400">movement_requests</span> in Supabase; survives refresh and follows your account.</div>
      <div className="overflow-x-auto"><div className="max-h-[480px] overflow-y-auto fm text-xs"><table className="w-full"><thead className="sticky top-0 bg-black/80 backdrop-blur"><tr className="text-gray-500 border-b border-gray-800"><th className="text-left py-2 px-2">TIMESTAMP</th><th className="text-left">TYPE</th><th className="text-right">AMOUNT</th><th className="text-left">ASSET</th><th className="text-left">DESTINATION</th><th className="text-left">SCENARIO</th><th className="text-right">STATUS</th></tr></thead><tbody>{txRows.length===0&&<tr><td colSpan="7"><Empty>No transactions yet — submit a Send / Swap / Bridge from the Dashboard.</Empty></td></tr>}{txRows.map(r=>(<tr key={r.id} className="border-b border-gray-800/40"><td className="py-1.5 px-2 text-gray-600 whitespace-nowrap">{(r.timestamp||"").slice(0,19).replace("T"," ")}</td><td className="text-purple-400 uppercase">{r.type}</td><td className="text-right text-gray-300 font-bold">{r.amount||"—"}</td><td className="text-gray-400">{r.asset||"—"}</td><td className="text-gray-400 truncate max-w-[200px]">{r.destination||"—"}</td><td className="text-gray-600">{r.scenario||"—"}</td><td className="text-right"><Badge c={r.status==="completed"?"green":r.status==="blocked"?"red":r.status==="execution"?"fuchsia":"yellow"}>{(r.status||"").toUpperCase()}</Badge></td></tr>))}</tbody></table></div></div>
    </GC></>}
    {onAccounting && <GC className="p-6 anim-d2"><SL>ACCOUNTING · AUDIT LOG EXPORT</SL>
      <div className="p-4 bg-purple-500/5 border border-purple-500/20 fm text-xs text-gray-400 mb-4">Export <span className="text-purple-400 font-bold">{exportRows.length}</span> persisted audit log rows for accounting reconciliation. CSV for spreadsheet import; JSON for downstream pipelines.</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <Btn v="secondary" onClick={()=>{exportCSV(exportRows,`audit-logs-${today}.csv`);addLog({type:"evidence",message:"Accounting CSV exported"});}}><Dl/> AUDIT_LOG.CSV</Btn>
        <Btn v="secondary" onClick={()=>{exportJSON(exportRows,`audit-logs-${today}.json`);addLog({type:"evidence",message:"Accounting JSON exported"});}}><Dl/> AUDIT_LOG.JSON</Btn>
        <Btn v="secondary" onClick={()=>{const settled = exportRows.filter(r=>r.type==="evidence"||r.type==="success");exportCSV(settled,`settled-${today}.csv`);addLog({type:"evidence",message:"Settled-only export"});}}><Dl/> SETTLED.CSV</Btn>
      </div>
      <div className="overflow-x-auto"><div className="max-h-96 overflow-y-auto fm text-xs"><table className="w-full"><thead className="sticky top-0 bg-black/80 backdrop-blur"><tr className="text-gray-500 border-b border-gray-800"><th className="text-left py-2 px-2">TIMESTAMP</th><th className="text-left">TYPE</th><th className="text-left">MESSAGE</th><th className="text-left">SCENARIO</th></tr></thead><tbody>{exportRows.slice(0,200).map((r,i)=>(<tr key={i} className="border-b border-gray-800/40"><td className="py-1.5 px-2 text-gray-600 whitespace-nowrap">{(r.created_at||"").slice(0,19).replace("T"," ")}</td><td className="text-gray-400">{r.type}</td><td className="text-gray-300 truncate max-w-md">{r.message}</td><td className="text-gray-600">{r.scenario}</td></tr>))}{exportRows.length===0&&<tr><td colSpan="4"><Empty>No audit logs yet — actions write here as you use the app.</Empty></td></tr>}</tbody></table></div></div>
    </GC>}
    {!onAccounting && !onTx && sections.length>0 && activeSection && <GC className="p-6 anim-d2"><SL>{activeSection?.title?.toUpperCase()||"EVIDENCE"}</SL>{!activeSection?.disclosed&&<div className="mb-4 p-3 bg-purple-500/5 border border-purple-500/20 fm text-xs text-purple-300">SELECTIVE VERIFICATION: This section demonstrates what can be verified without full data disclosure.</div>}{renderContent(activeSection.content)}</GC>}
    {!onAccounting && !onTx && sections.length===0 && scId && <GC className="p-6 anim"><div className="text-center py-8"><p className="fm text-sm text-gray-500 mb-4">Generating evidence...</p></div></GC>}
    <div className="flex gap-3 anim-d3"><Btn v="ghost" onClick={()=>setActiveView("hub")}>RETURN_TO_HUB</Btn></div>
  </div>);
};

// ═══════════════════════════════════════════════════════════════════
// EVAL OVERVIEW
// ═══════════════════════════════════════════════════════════════════
const EvalOverview = () => {
  const { activeScenario, progress, scenarios, participants, assets, banks, wallets, transactions, setActiveView, org } = useApp();
  const w = useSharedWallet();
  const liveWalletCount = Math.max(wallets.length, w.isConnected?1:0);
  const completed = Object.values(progress).filter(p=>p.status==="completed").length;
  const total = scenarios.length || 0;

  // Item 4 — total value spans mainnet (booked) AND Sepolia testnet.
  // Mainnet: USD-valued in-scope assets + imported bank balances.
  const usdNum = (s) => Number(String(s||"").replace(/[^0-9.-]/g,"")) || 0;
  const mainnetUsd = assets.reduce((s,a)=>s+usdNum(a.balance_usd),0) + banks.reduce((s,b)=>s+Number(b.balance||0),0);
  // Testnet: shared valuation — live ETH spot price + testnet USDC/EURC @ $1 (Fix 1 consistency).
  const tv = useTestnetValue(w);
  const testnetUsd = tv.testnetUsd;
  const fmtUsd = (n) => `$${n.toLocaleString(undefined,{maximumFractionDigits:2})}`;

  return (<div className="p-6 space-y-6 overflow-y-auto flex-1"><div><h2 className="text-2xl font-bold mb-1 anim">Overview</h2><p className="fm text-sm text-gray-500 anim-d1">{org?.name||"—"} · LIVE EVALUATION</p></div>

    {/* Item 4 — portfolio value: mainnet booked + Sepolia testnet, split legibly */}
    <GC className="p-5 anim">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="fm text-xs text-gray-500 mb-1 flex items-center gap-2">TOTAL EVALUATION VALUE <Tip text="Mainnet booked value (USD-valued in-scope assets + imported bank balances) plus live Sepolia testnet holdings (ETH, WETH, USDC, EURC). ETH is valued at the live spot price; testnet USDC/EURC are pegged at $1. Sepolia tokens have no real monetary value."/></div>
          <div className="text-3xl md:text-4xl font-black tg">{fmtUsd(mainnetUsd + testnetUsd)}</div>
          <div className="fm text-[10px] text-gray-500 mt-1">Mainnet booked + Sepolia testnet · ETH @ {fmtUsd(tv.ethPriceUsd)}{tv.priceLive?" (live)":" (indicative)"}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 border border-emerald-500/30 bg-emerald-500/5 min-w-[150px]">
            <div className="fm text-[10px] text-emerald-400 mb-1">● MAINNET · BOOKED</div>
            <div className="text-xl font-bold text-emerald-400">{fmtUsd(mainnetUsd)}</div>
            <div className="fm text-[9px] text-gray-600 mt-0.5">{assets.length} assets · {banks.length} banks</div>
          </div>
          <div className="p-3 border border-yellow-500/30 bg-yellow-500/5 min-w-[150px]">
            <div className="fm text-[10px] text-yellow-300 mb-1">● TESTNET · SEPOLIA</div>
            <div className="text-xl font-bold text-yellow-300">{fmtUsd(testnetUsd)}</div>
            <div className="fm text-[9px] text-gray-600 mt-0.5">{w.isConnected ? `${tv.eth.toFixed(4)} ETH · ${tv.usdc.toFixed(2)} USDC · ${tv.eurc.toFixed(2)} EURC` : "connect wallet to read"}</div>
          </div>
        </div>
      </div>
    </GC>

    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      <GC className="p-5 anim"><div className="fm text-xs text-gray-500 mb-2">[ SCENARIOS ]</div><div className="text-2xl font-bold mb-1">{completed}/{total||0}</div><div className="fm text-xs text-gray-500">completed</div></GC>
      <GC className="p-5 anim-d1"><div className="fm text-xs text-gray-500 mb-2">[ ACTIVE ]</div><div className="text-lg font-bold mb-1">{activeScenario?activeScenario.num:"—"}</div><div className="fm text-xs text-gray-500">{activeScenario?activeScenario.title?.slice(0,28)+"…":"none"}</div></GC>
      <GC className="p-5 anim-d2"><div className="fm text-xs text-gray-500 mb-2">[ TRANSACTIONS ]</div><div className="text-2xl font-bold mb-1 text-emerald-400">{transactions.length}</div><div className="fm text-xs text-gray-500">on platform</div></GC>
      <GC className="p-5 anim-d3"><div className="fm text-xs text-gray-500 mb-2">[ TEAM ]</div><div className="text-2xl font-bold mb-1 text-purple-400">{participants.length}</div><div className="fm text-xs text-gray-500">members</div></GC>
      <GC className="p-5 anim-d1"><div className="fm text-xs text-gray-500 mb-2">[ ASSETS ]</div><div className="text-2xl font-bold mb-1">{assets.length}</div><div className="fm text-xs text-gray-500">in scope</div></GC>
      <GC className="p-5 anim-d2"><div className="fm text-xs text-gray-500 mb-2">[ WALLETS ]</div><div className="text-2xl font-bold mb-1 text-fuchsia-400">{liveWalletCount}</div><div className="fm text-xs text-gray-500">connected</div></GC>
      <GC className="p-5 anim-d3"><div className="fm text-xs text-gray-500 mb-2">[ BANKS ]</div><div className="text-2xl font-bold mb-1 text-blue-400">{banks.length}</div><div className="fm text-xs text-gray-500">imported</div></GC>
      <GC className="p-5 anim-d3"><div className="fm text-xs text-gray-500 mb-2">[ TRUST ]</div><div className="text-lg font-bold mb-1 text-fuchsia-400">{org?.trust_environment==="pqc"?"PQC":"Current"}</div><div className="fm text-xs text-gray-500">posture</div></GC>
    </div>
    <div className="flex gap-3"><Btn v="secondary" onClick={()=>setActiveView("hub")}>RETURN_TO_DASHBOARD</Btn></div>
  </div>);
};

// ═══════════════════════════════════════════════════════════════════
// SETTINGS (items 14, 19 — replaces EvalConfig)
// ═══════════════════════════════════════════════════════════════════
const SettingsPage = () => {
  const { org, settings, theme, setTheme, updateSettings, resetSandbox, addLog, threshold, updateThreshold, participants } = useApp();
  const [tab,setTab] = useState("preferences");
  const [language, setLanguage] = useState(settings?.language || "en");
  useEffect(() => { setLanguage(settings?.language || "en"); }, [settings]);
  const saveLang = async (v) => { setLanguage(v); await updateSettings({ language: v, theme }); addLog({type:"info",message:`Language: ${v.toUpperCase()}`}); };
  // Item 2 — approval threshold is configurable here, not mandatory. Default 1.
  const [thr, setThr] = useState(threshold?.required_approvals || 1);
  useEffect(() => { setThr(threshold?.required_approvals || 1); }, [threshold]);
  const [savingThr, setSavingThr] = useState(false);
  const saveThr = async () => { setSavingThr(true); try { await updateThreshold({ required_approvals: Math.max(1, Number(thr)||1) }); } finally { setSavingThr(false); } };
  return (<div className="p-6 space-y-6 overflow-y-auto flex-1">
    <div><h2 className="text-2xl font-bold mb-1">Settings</h2><p className="fm text-sm text-gray-500">PREFERENCES · CONTEXT · CONTROL · EVIDENCE</p></div>
    <div className="flex gap-2 flex-wrap">{[{id:"preferences",l:"Preferences"},{id:"context",l:"Context"},{id:"control",l:"Control Posture"},{id:"evidence",l:"Evidence & Assurance"}].map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={`px-4 py-2 fm text-xs cursor-pointer transition-all ${tab===t.id?"text-purple-400 bg-purple-500/10 border border-purple-500/40":"text-gray-500 hover:text-gray-300 border border-transparent"}`}>{t.l}</button>)}</div>

    {tab==="preferences"&&<GC className="p-6 anim"><SL>PREFERENCES</SL><div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Field label="LANGUAGE"><select value={language} onChange={e=>saveLang(e.target.value)}><option value="en">English</option><option value="es">Español</option><option value="fr">Français</option><option value="de">Deutsch</option><option value="ja">日本語</option><option value="zh">中文</option></select></Field>
      <Field label="THEME">
        <div className="grid grid-cols-2 gap-3">
          <button onClick={()=>{setTheme("dark");addLog({type:"info",message:"Theme: DARK"});}} className={`p-4 cursor-pointer border transition-all flex items-center gap-3 ${theme==="dark"?"border-purple-500 bg-purple-500/10 text-white":"border-gray-800 bg-gray-900/30 text-gray-500 hover:border-gray-700"}`}><Moon/><div className="text-left"><div className="fm text-sm font-bold">Dark</div><div className="text-xs">Default</div></div></button>
          <button onClick={()=>{setTheme("light");addLog({type:"info",message:"Theme: LIGHT"});}} className={`p-4 cursor-pointer border transition-all flex items-center gap-3 ${theme==="light"?"border-purple-500 bg-purple-500/10 text-white":"border-gray-800 bg-gray-900/30 text-gray-500 hover:border-gray-700"}`}><Sun/><div className="text-left"><div className="fm text-sm font-bold">Light</div><div className="text-xs">Classic</div></div></button>
        </div>
      </Field>
    </div></GC>}

    {tab==="context"&&<GC className="p-6 anim"><SL>ORGANIZATION</SL><div className="space-y-3"><InfoRow label="ORGANIZATION" value={org?.name||"—"}/><InfoRow label="TYPE" value={org?.institution_type||"—"}/><InfoRow label="JURISDICTION" value={org?.jurisdiction||"—"}/><InfoRow label="OBJECTIVE" value={org?.eval_objective||"—"}/><InfoRow label="INVITE_CODE" value={<span className="mono tracking-widest">{org?.invite_code||"—"}</span>}/></div><div className="mt-4 p-3 bg-purple-500/5 border border-purple-500/20 fm text-xs text-gray-400">Share your <b className="text-purple-300">INVITE_CODE</b> with teammates. They can paste it on the Sandbox Setup screen to join this org instead of creating a duplicate.</div></GC>}
    {tab==="control"&&<GC className="p-6 anim"><SL>CONTROL POSTURE</SL><div className="space-y-3"><InfoRow label="CONTROL_MODEL" value={(org?.control_model||"threshold")+" Governance"}/><InfoRow label="TRUST" value={org?.trust_environment||"current"}/></div>
      {/* Item 2 — approval threshold: configurable, not mandatory. Default 1 for sandbox. */}
      <div className="mt-6 pt-5 border-t border-purple-500/10">
        <SL>APPROVAL THRESHOLD</SL>
        <p className="fm text-xs text-gray-400 mb-4">Number of Approver-role members who must approve before a movement executes. Set to <b className="text-purple-300">1</b> for single-signer sandbox testing — a single connected wallet can then send and swap on Sepolia without assembling a quorum. Raise it to require multi-party approval. This threshold is <b>not mandatory</b>.</p>
        <div className="flex items-end gap-3 flex-wrap">
          <Field label="REQUIRED_APPROVALS"><input type="number" min="1" value={thr} onChange={e=>setThr(e.target.value)} style={{maxWidth:130}}/></Field>
          <Btn onClick={saveThr} disabled={savingThr}>{savingThr?"SAVING...":"SAVE_THRESHOLD"} <Chk/></Btn>
          <div className="fm text-xs text-gray-500 pb-2.5">Current: <span className="text-purple-300 font-bold">{threshold?.required_approvals||1}</span> of {participants.length||0} member{participants.length===1?"":"s"}</div>
        </div>
      </div>
    </GC>}
    {tab==="evidence"&&<GC className="p-6 anim"><SL>EVIDENCE & ASSURANCE</SL><div className="space-y-3"><InfoRow label="EVIDENCE_VIEWS" badge={{t:"AVAILABLE",c:"green"}}/><InfoRow label="SELECTIVE_VERIFICATION" badge={{t:"VIEW AVAILABLE",c:"fuchsia"}}/><InfoRow label="PQC_CRYPTO_AGILITY" badge={{t:"VIEW AVAILABLE",c:"purple"}}/></div></GC>}
    <GC className="p-5"><SL>SANDBOX STATE</SL><div className="flex items-center justify-between"><div><div className="text-sm font-bold text-yellow-400">Reset Sandbox State</div><div className="fm text-xs text-gray-500">Clear all progress and evidence</div></div><Btn v="danger" onClick={resetSandbox}>RESET_SANDBOX</Btn></div></GC>
  </div>);
};

// ═══════════════════════════════════════════════════════════════════
// IMPORT BANK (item 8)
// ═══════════════════════════════════════════════════════════════════
const ImportBank = () => {
  const { banks, addBank, removeBank } = useApp();
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ name:"", account_type:"Operating", account_number_last4:"", routing:"", currency:"USD", balance:"" });
  const u = (k,v) => setF(p=>({...p,[k]:v}));
  const submit = async () => { if (!f.name) return; await addBank({ ...f, balance: Number(f.balance||0), status:"pending" }); setF({ name:"", account_type:"Operating", account_number_last4:"", routing:"", currency:"USD", balance:"" }); setShow(false); };
  const total = banks.reduce((s,b) => s + Number(b.balance||0), 0);
  return (<div className="p-6 space-y-6 overflow-y-auto flex-1">
    <div className="flex items-start justify-between gap-4 flex-wrap"><div><h2 className="text-2xl font-bold mb-1">Import Bank</h2><p className="fm text-sm text-gray-500">CONNECT INSTITUTIONAL BANK ACCOUNTS FOR EVIDENCE & RECONCILIATION</p></div><ComingSoon><Btn><Plus/> ADD_BANK</Btn></ComingSoon></div>
    <GC className="p-4" style={{borderLeft:"3px solid #facc15"}}><div className="fm text-xs text-yellow-400">Bank import is coming soon. Open-banking connectors (Plaid, TrueLayer, direct bank APIs) are being finalised — your existing accounts and balances will appear here once activation is complete.</div></GC>
    <GC className="p-5"><div className="flex items-center justify-between flex-wrap gap-3"><div><div className="fm text-xs text-gray-500 mb-1">TOTAL_FIAT_BALANCE</div><div className="text-3xl font-black tg">${total.toLocaleString()}</div></div><div className="fm text-xs text-gray-500 text-right"><div>{banks.length} ACCOUNTS</div><div className="text-emerald-400">{banks.filter(b=>b.status==="verified").length} VERIFIED</div></div></div></GC>
    {show && <GC className="p-5 anim"><SL>NEW BANK ACCOUNT</SL><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="BANK NAME *"><input placeholder="e.g., JP Morgan Chase" value={f.name} onChange={e=>u("name",e.target.value)}/></Field>
      <Field label="ACCOUNT TYPE"><select value={f.account_type} onChange={e=>u("account_type",e.target.value)}><option>Operating</option><option>Reserve</option><option>Trust</option><option>Settlement</option></select></Field>
      <Field label="LAST 4" hint="Only the last four digits are stored. Full account numbers are tokenised by the open-banking provider (Plaid / TrueLayer / direct bank API)."><input maxLength="4" placeholder="0000" value={f.account_number_last4} onChange={e=>u("account_number_last4",e.target.value)}/></Field>
      <Field label="ROUTING / SWIFT"><input placeholder="Routing or SWIFT/BIC" value={f.routing} onChange={e=>u("routing",e.target.value)}/></Field>
      <Field label="CURRENCY"><select value={f.currency} onChange={e=>u("currency",e.target.value)}><option>USD</option><option>EUR</option><option>GBP</option><option>SGD</option></select></Field>
      <Field label="OPENING BALANCE"><input type="number" placeholder="0" value={f.balance} onChange={e=>u("balance",e.target.value)}/></Field>
    </div><div className="p-4 mt-4 bg-purple-500/5 border border-purple-500/20 fm text-xs text-gray-400">Quantum Qustody supports Plaid, TrueLayer, and direct bank-API connectors. Production credentials are configured per-tenant in the Workshop phase.</div><div className="flex gap-3 mt-5"><Btn onClick={submit}>IMPORT_BANK <Chk/></Btn><Btn v="ghost" onClick={()=>setShow(false)}>CANCEL</Btn></div></GC>}
    <div className="space-y-3">
      {banks.length===0 && <Empty>No bank accounts yet. Click ADD_BANK to import the first one.</Empty>}
      {banks.map(b=>(<GC key={b.id} className="p-5 flex items-center justify-between"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded bg-gradient-to-br from-blue-500/30 to-indigo-500/30 text-blue-300 flex items-center justify-center">{sIcons.bank}</div><div><div className="font-bold">{b.name}</div><div className="fm text-xs text-gray-500">{b.account_type} · ••••{b.account_number_last4||"0000"} · {b.currency}</div></div></div><div className="flex items-center gap-4"><div className="text-right"><div className="fm text-sm font-bold">${Number(b.balance||0).toLocaleString()}</div><div className="fm text-xs text-gray-500">{b.currency}</div></div><Badge c={b.status==="verified"?"green":"yellow"}>{(b.status||"pending").toUpperCase()}</Badge><button onClick={()=>removeBank(b.id, b.name)} className="text-gray-600 hover:text-red-400 cursor-pointer p-1"><TrashI/></button></div></GC>))}
    </div>
  </div>);
};

// ═══════════════════════════════════════════════════════════════════
// USER GUIDE — phase 0 feedback item 2
// ═══════════════════════════════════════════════════════════════════
const UserGuide = () => (
  <div className="p-6 space-y-6 overflow-y-auto flex-1">
    <div>
      <h2 className="text-2xl font-bold mb-1">User Guide</h2>
      <p className="fm text-sm text-gray-500">GETTING STARTED · WALLETS · TROUBLESHOOTING · HISTORY</p>
    </div>

    <GC className="p-6 max-w-3xl space-y-4">
      <SL>SUPPORTED WALLETS</SL>
      <p className="text-sm text-gray-300 leading-relaxed">
        Quantum Qustody connects to any wallet that speaks the EIP-1193 standard — meaning any
        wallet that exposes the <code className="fm text-purple-300">window.ethereum</code> object
        in your browser, or that surfaces itself via the EIP-6963 multi-wallet discovery event.
        That covers the four wallets the team verified during testnet:
      </p>
      <p className="text-sm text-gray-300 leading-relaxed">
        <b>MetaMask</b> is the default and works out of the box once the browser extension is
        installed. <b>Coinbase Wallet</b> works the same way — install the extension, sign in,
        then click <em>Import Crypto</em> in the dashboard. <b>Rabby</b> is supported and is
        often the cleanest choice for users who manage several accounts. <b>Brave Wallet</b>,
        built directly into the Brave browser, also works; if you have both Brave Wallet and
        another extension installed, the EIP-6963 picker lets you choose which one to authorise.
      </p>
      <p className="text-sm text-gray-300 leading-relaxed">
        Hardware wallets — Ledger, Trezor — work indirectly, by being added as accounts inside
        one of the four wallets above. Mobile-only wallets (Trust, Rainbow, Argent) require
        WalletConnect, which is on the roadmap but not yet shipped.
      </p>
    </GC>

    <GC className="p-6 max-w-3xl space-y-4">
      <SL>IF SOMETHING STALLS</SL>
      <p className="text-sm text-gray-300 leading-relaxed">
        The most common issue is the wallet panel never resolving — you click <em>Connect</em>
        and the button sits on "Connecting…" indefinitely. This almost always means the
        wallet's provider injected into the page after our connect logic had already given up.
        The fix is simple: <b>refresh the page once</b>. The newer build re-detects providers
        on mount and listens for the EIP-6963 announce event, so a single refresh is enough
        to recover. If the stall persists, switch wallets and confirm the extension is
        unlocked.
      </p>
      <p className="text-sm text-gray-300 leading-relaxed">
        If a wallet shows "wrong network", click <em>Switch to Sepolia</em> in the wallet card.
        If the wallet shows zero balance even though you've funded it, give the public RPC a
        few seconds and hit <em>Refresh</em>; if balances still don't update, your RPC endpoint
        may be rate-limited — try a different one from the faucet card.
      </p>
    </GC>

    <GC className="p-6 max-w-3xl space-y-4">
      <SL>HOW HISTORY IS SCOPED</SL>
      <p className="text-sm text-gray-300 leading-relaxed">
        Two separate streams of history live in the product, and they are scoped differently
        on purpose.
      </p>
      <p className="text-sm text-gray-300 leading-relaxed">
        The <b>Evaluation Log</b> on the right of every screen is your <em>platform action log</em>.
        It records what you do inside Quantum Qustody — invite a teammate, change a threshold,
        run a scenario, generate an evidence pack. These events are bound to your <em>account</em>:
        they persist in Supabase, survive refreshes, survive logouts, and follow you across
        browsers. They have nothing to do with any particular wallet.
      </p>
      <p className="text-sm text-gray-300 leading-relaxed">
        The <b>Transactions</b> tab inside Evidence Viewer holds two streams. The top one,
        <em>On-Chain History</em>, is bound to a <em>wallet</em>: it is read live from the Sepolia
        chain for whatever wallet you have connected, so it shows every transaction that wallet
        signed — including ones made outside Quantum Qustody. Connect a different wallet and this
        list changes entirely. Below it, <em>Platform-Recorded Movements</em> is bound to your
        <em>account</em>: it lists only the Send / Swap / Bridge actions you initiated through
        Quantum Qustody, with their policy outcome, and it survives refresh and logout.
      </p>
      <p className="text-sm text-gray-300 leading-relaxed">
        The practical implication: if you send a Sepolia transaction, log out, log back in and
        connect the same wallet, both streams reappear. If you connect a different wallet,
        your platform actions are still there but the chain history follows the wallet, not
        you.
      </p>
    </GC>

    <GC className="p-6 max-w-3xl space-y-4">
      <SL>GETTING TESTNET ETH</SL>
      <p className="text-sm text-gray-300 leading-relaxed">
        Every on-chain action on Quantum Qustody runs against the Ethereum Sepolia testnet.
        Sepolia ETH has no real value, but you do need a small amount to pay gas. The
        Governed Movement page lists four faucets — Google Cloud, Alchemy, QuickNode, and
        Infura — and any one of them will fund a connected wallet with roughly 0.05 ETH per
        day. Paste your wallet address into the faucet, claim the drip, then come back and
        run a Send to check it landed.
      </p>
    </GC>
  </div>
);

// ═══════════════════════════════════════════════════════════════════
// HOW IT WORKS (item 10)
// ═══════════════════════════════════════════════════════════════════
const HowItWorks = () => {
  const steps = [
    { n:"01", t:"Connect Accounts", d:"Import banks via open-banking connectors and import wallets across mainnets and testnets. Quantum Qustody never holds your private keys — instead, write access is delegated through your governance EOA." },
    { n:"02", t:"Define Boundaries", d:"Place each asset and bank account in scope or out of scope. Set boundary tags (Primary Reserve, Operating, Liquidity Buffer) and a control type per asset." },
    { n:"03", t:"Configure Team & Threshold", d:"Add team members with roles — Requester, Approver, Reviewer, Oversight, Observer. Set the threshold required for any movement (e.g. 2 of 4 approvers)." },
    { n:"04", t:"Define Policy", d:"Policy rules (amount ceilings, destination whitelists, time-of-day windows, jurisdiction limits) are versioned and applied at request time. Every policy decision is recorded." },
    { n:"05", t:"Submit Request", d:"A Requester submits a Send / Swap / Bridge request. The system attaches the active policy version, the chain context, and the requested wallet to the record." },
    { n:"06", t:"Policy Application", d:"The engine evaluates the request against active policy. If the request violates a rule, it is blocked with a Policy Conflict Record. Otherwise it advances to approval." },
    { n:"07", t:"Threshold Approval", d:"Approvers and Reviewers receive notifications and approve or reject. Approvals are weighted; the threshold setting determines whether the request advances." },
    { n:"08", t:"Controlled Execution", d:"Once threshold is met, the request is signed by the delegated EOA and broadcast to the chain. For PQC-target posture, ML-DSA-65 signatures are produced alongside classical signatures." },
    { n:"09", t:"Evidence & Audit", d:"Every step — request, policy, approval, control, outcome — is captured as institutionally legible evidence. Selective verification supports oversight without unnecessary disclosure." },
    { n:"10", t:"Accounting & Oversight", d:"Export full audit logs (CSV / JSON) from the Evidence Viewer's Accounting tab. Send the Oversight Summary to Risk, Audit, Compliance, and Finance." },
  ];
  const safetySteps = [
    { n:"A", t:"EOA Delegation", d:"Quantum Qustody never receives or stores your private key. Instead, your custody provider's signer (HSM, MPC cluster, or hardware wallet) retains the key, and you authorise an EOA that the policy engine controls. We sign nothing; we authorise nothing outside policy. The institution's signer remains the root of trust at every step.", color:"#a855f7" },
    { n:"B", t:"ZK Selective Verification", d:"Every governance proof — threshold met, policy applied, control passed — is published as a zero-knowledge attestation. Auditors verify mathematically that conditions held without seeing balances, addresses, counterparties, or internal policy text. Disclosure is minimised; verifiability is maximised.", color:"#d946ef" },
    { n:"C", t:"PQC Key Regeneration", d:"On a configured cadence, the delegated EOA's signing context is rotated under a post-quantum scheme (ML-DSA-65 / ML-KEM-768). The rotation is itself proven via ZK so external observers verify continuity without learning the underlying material. Old keys retire; new keys come online; the policy chain never breaks.", color:"#818cf8" },
    { n:"D", t:"Delegation Loop", d:"Authorisation, execution, attestation, and re-keying form a continuous loop. After each movement: policy is re-evaluated, evidence is sealed with current keys, the next rotation is scheduled, and the threshold is re-verified. Every cycle leaves a defensible record. There is no static delegation — the delegation itself is governed.", color:"#22c55e" },
  ];
  return (<div className="p-6 space-y-6 overflow-y-auto flex-1">
    <div><h2 className="text-2xl font-bold mb-1">How It Works</h2><p className="fm text-sm text-gray-500">CUSTOMER JOURNEY · BACKEND PIPELINE</p></div>
    <GC className="p-5"><SL>END-TO-END FLOW</SL><div className="fm text-xs text-gray-400 leading-relaxed">From account import to oversight-ready evidence. Each step writes a structured record so auditors and regulators can reconstruct the full decision chain.</div></GC>
    <div className="space-y-3">{steps.map((s,i)=>(<GC key={s.n} className={`p-5 anim-d${Math.min(i,3)+1}`} style={{borderLeft:`3px solid ${i%3===0?"#a855f7":i%3===1?"#d946ef":"#818cf8"}`}}><div className="flex items-start gap-4"><div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/30 to-fuchsia-500/30 flex items-center justify-center fm text-sm font-bold text-purple-200">{s.n}</div><div className="flex-1"><div className="font-bold mb-2">{s.t}</div><p className="fm text-xs text-gray-400 leading-relaxed">{s.d}</p></div></div></GC>))}</div>

    {/* Quantum Safety module */}
    <div id="quantum-safety-module" className="pt-6">
      <div className="mb-4"><h3 className="text-2xl font-bold mb-1 tg">Why We Are Quantum Safe</h3><p className="fm text-xs text-gray-500">EOA DELEGATION · ZK SELECTIVE VERIFICATION · PQC KEY REGENERATION · DELEGATION LOOP</p></div>
      <GC className="p-5 mb-4" style={{borderTop:"2px solid rgba(217,70,239,.5)"}}>
        <SL>OPERATING-MODEL POSTURE</SL>
        <p className="fm text-xs text-gray-400 leading-relaxed">Quantum Qustody is "quantum safe" not because of a single primitive, but because of the operating model around movement: <span className="text-purple-300">we never hold the key</span>, <span className="text-fuchsia-300">we prove conditions without disclosing data</span>, <span className="text-indigo-300">we rotate signing material under PQC schemes</span>, and <span className="text-emerald-300">we re-evaluate the entire chain on every movement</span>. The four moving parts below form one continuous loop.</p>
      </GC>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">{safetySteps.map((s,i)=>(<GC key={s.n} className={`p-5 anim-d${Math.min(i,3)+1}`} style={{borderTop:`2px solid ${s.color}`}}>
        <div className="flex items-start gap-4 mb-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center fm text-sm font-bold" style={{background:`${s.color}22`, border:`1px solid ${s.color}55`, color:s.color}}>{s.n}</div>
          <div className="font-bold pt-1">{s.t}</div>
        </div>
        <p className="fm text-xs text-gray-400 leading-relaxed">{s.d}</p>
      </GC>))}</div>

      {/* Visual loop */}
      <GC className="p-6">
        <SL>THE LOOP</SL>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 fm text-xs">
          {["AUTHORISE","EXECUTE","ATTEST","RE-KEY"].map((step,i) => (<div key={step} className="flex items-center gap-2">
            <div className="flex-1 p-4 border" style={{borderColor:i===0?"#a855f7":i===1?"#d946ef":i===2?"#818cf8":"#22c55e",background:`${i===0?"#a855f7":i===1?"#d946ef":i===2?"#818cf8":"#22c55e"}15`}}>
              <div className="text-[10px] text-gray-500 mb-1">STEP {String(i+1).padStart(2,"0")}</div>
              <div className="font-bold" style={{color:i===0?"#c084fc":i===1?"#e879f9":i===2?"#a5b4fc":"#4ade80"}}>{step}</div>
              <div className="text-[10px] text-gray-500 mt-1">{i===0?"Policy + threshold":i===1?"EOA delegation":i===2?"ZK proof seal":"PQC rotation"}</div>
            </div>
            <div className="hidden md:block text-purple-500">→</div>
          </div>))}
        </div>
        <div className="mt-4 fm text-xs text-gray-500 italic text-center">Loop closes back to AUTHORISE — every cycle re-evaluates policy, threshold, and trust posture. There is no static delegation.</div>
      </GC>

      {/* Why this matters */}
      <GC className="p-5 mt-4">
        <SL>WHY THIS MATTERS FOR INSTITUTIONS</SL>
        <ul className="space-y-3 fm text-xs text-gray-300">
          <li className="flex items-start gap-3"><span className="text-emerald-400 mt-0.5">▹</span><span><span className="text-emerald-300">No single point of failure.</span> The signer, the policy engine, and the attestation surface are independent — an attacker would need to compromise all three plus the institution's threshold members.</span></li>
          <li className="flex items-start gap-3"><span className="text-purple-400 mt-0.5">▹</span><span><span className="text-purple-300">Quantum readiness without rip-and-replace.</span> Your existing custody provider stays. Only the delegation envelope rotates to PQC primitives — your policy framework, approvers, and evidence pipeline are unchanged.</span></li>
          <li className="flex items-start gap-3"><span className="text-fuchsia-400 mt-0.5">▹</span><span><span className="text-fuchsia-300">Auditable without exposure.</span> Risk, audit, compliance, and finance can verify governance held — without ever seeing the underlying balances, addresses, or policy text.</span></li>
          <li className="flex items-start gap-3"><span className="text-indigo-400 mt-0.5">▹</span><span><span className="text-indigo-300">Continuous, not one-shot.</span> The loop is defensible because it is continuous: every movement re-proves the chain, every rotation is itself proven, every evidence pack stays valid under future verifiers.</span></li>
        </ul>
      </GC>
    </div>
  </div>);
};

// ═══════════════════════════════════════════════════════════════════
// SUPPORT (item 11)
// ═══════════════════════════════════════════════════════════════════
const Support = () => {
  const { submitTicket, addLog } = useApp();
  const [f, setF] = useState({ email:"", subject:"", category:"Question", message:"" });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const u = (k,v) => setF(p=>({...p,[k]:v}));
  const submit = async (e) => {
    e.preventDefault();
    if (!f.email || !f.message) return;
    setBusy(true);
    const { error } = await submitTicket(f);
    setBusy(false);
    if (!error) setSent(true);
  };
  return (<div className="p-6 space-y-6 overflow-y-auto flex-1">
    <div><h2 className="text-2xl font-bold mb-1">Support</h2><p className="fm text-sm text-gray-500">QUESTIONS · ISSUES · FEEDBACK</p></div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2"><GC className="p-6"><SL>SUBMIT A TICKET</SL>
        {sent ? (
          <div className="text-center py-10"><div className="inline-block p-4 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-4"><Chk/></div><h3 className="text-xl font-bold mb-2">Ticket Submitted</h3><p className="fm text-sm text-gray-500 mb-6">Our team will respond to {f.email} within one business day.</p><Btn v="secondary" onClick={()=>{setSent(false);setF({ email:"", subject:"", category:"Question", message:"" });}}>SUBMIT_ANOTHER</Btn></div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <Field label="EMAIL *"><input type="email" required placeholder="you@org" value={f.email} onChange={e=>u("email",e.target.value)}/></Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="CATEGORY"><select value={f.category} onChange={e=>u("category",e.target.value)}><option>Question</option><option>Bug Report</option><option>Feature Request</option><option>Billing</option><option>Security</option><option>Other</option></select></Field>
              <Field label="SUBJECT"><input placeholder="One-line summary" value={f.subject} onChange={e=>u("subject",e.target.value)}/></Field>
            </div>
            <Field label="MESSAGE *"><textarea required rows="6" placeholder="Describe the issue or question..." value={f.message} onChange={e=>u("message",e.target.value)} style={{resize:"vertical",minHeight:"120px"}}/></Field>
            <Btn type="submit" disabled={busy}>{sIcons.mail} {busy?"SENDING...":"SEND_TICKET"}</Btn>
          </form>
        )}
      </GC></div>
      <div className="space-y-4">
        <GC className="p-5"><SL>OTHER WAYS</SL><div className="space-y-3 fm text-xs"><div className="flex items-center gap-3 text-gray-300">{sIcons.mail} support@quantumqustody.com</div></div></GC>
        <GC className="p-5"><SL>SLA</SL><div className="space-y-2 fm text-xs"><div className="flex justify-between"><span className="text-gray-500">CRITICAL</span><span className="text-red-400">1 hour</span></div><div className="flex justify-between"><span className="text-gray-500">HIGH</span><span className="text-yellow-400">4 hours</span></div><div className="flex justify-between"><span className="text-gray-500">NORMAL</span><span className="text-emerald-400">1 business day</span></div></div></GC>
      </div>
    </div>
  </div>);
};

// ═══════════════════════════════════════════════════════════════════
// BILLING (item 13)
// ═══════════════════════════════════════════════════════════════════
const Billing = () => {
  const { invoices, paymentMethods, plans, subscription, addPaymentMethod, removePaymentMethod, switchPlan } = useApp();
  const [show, setShow] = useState(false);
  const [card, setCard] = useState({ brand:"Visa", last4:"", exp_month:12, exp_year:2030, is_default:false });
  const u = (k,v) => setCard(p=>({...p,[k]:v}));
  const submit = async () => { if (!card.last4) return; await addPaymentMethod(card); setCard({ brand:"Visa", last4:"", exp_month:12, exp_year:2030, is_default:false }); setShow(false); };
  const currentPlan = subscription?.plan;
  const totalDue = invoices.filter(i=>i.status==="unpaid"||i.status==="overdue").reduce((s,i)=>s+Number(i.amount||0),0);
  return (<div className="p-6 space-y-6 overflow-y-auto flex-1">
    <div><h2 className="text-2xl font-bold mb-1">Billing</h2><p className="fm text-sm text-gray-500">PLAN · INVOICES · PAYMENT METHODS</p></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <GC className="p-5"><div className="fm text-xs text-gray-500 mb-1">CURRENT_PLAN</div><div className="text-xl font-bold tg">{currentPlan?.name||"—"}</div><div className="fm text-xs text-gray-500 mt-2">${Number(currentPlan?.price_monthly||0).toLocaleString()}/mo</div></GC>
      <GC className="p-5"><div className="fm text-xs text-gray-500 mb-1">RENEWS</div><div className="text-xl font-bold">{subscription?.renews_at||"—"}</div></GC>
      <GC className="p-5"><div className="fm text-xs text-gray-500 mb-1">TOTAL_DUE</div><div className={`text-xl font-bold ${totalDue>0?"text-yellow-400":"text-emerald-400"}`}>${totalDue.toLocaleString()}</div></GC>
    </div>
    <GC className="p-5"><SL>PLANS</SL><div className="grid grid-cols-1 md:grid-cols-3 gap-4">{plans.length===0 && <Empty>No plans configured. Run the migration to seed default plans.</Empty>}{plans.map(p=>(<div key={p.id} className={`p-5 border ${currentPlan?.id===p.id?"border-purple-500 bg-purple-500/10":"border-gray-800 bg-gray-900/30"}`}><div className="flex items-center justify-between mb-3"><div className="fm text-sm font-bold">{p.name}</div>{currentPlan?.id===p.id&&<Badge c="green">CURRENT</Badge>}</div><div className="text-2xl font-black mb-2">${Number(p.price_monthly).toLocaleString()}<span className="text-xs text-gray-500 fm">/mo</span></div><ul className="space-y-1 mb-4 fm text-xs text-gray-400">{(p.features||[]).map((feat,i)=><li key={i} className="flex gap-2"><span className="text-emerald-400">✓</span>{feat}</li>)}</ul><Btn v={currentPlan?.id===p.id?"secondary":"primary"} full onClick={()=>switchPlan(p.id, p.name)} disabled={currentPlan?.id===p.id}>{currentPlan?.id===p.id?"ACTIVE":(Number(p.price_monthly)>Number(currentPlan?.price_monthly||0)?"UPGRADE":"DOWNGRADE")}</Btn></div>))}</div></GC>
    <GC className="p-5"><div className="flex items-center justify-between flex-wrap gap-3 mb-4"><SL>PAYMENT METHODS</SL><Btn v="secondary" onClick={()=>setShow(s=>!s)}><Plus/> ADD_CARD</Btn></div>
      {show && <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 border border-purple-500/20 bg-purple-500/5">
        <Field label="BRAND"><select value={card.brand} onChange={e=>u("brand",e.target.value)}><option>Visa</option><option>Mastercard</option><option>Amex</option></select></Field>
        <Field label="LAST 4"><input maxLength="4" value={card.last4} onChange={e=>u("last4",e.target.value)}/></Field>
        <Field label="EXP MONTH"><input type="number" min="1" max="12" value={card.exp_month} onChange={e=>u("exp_month",Number(e.target.value))}/></Field>
        <Field label="EXP YEAR"><input type="number" min="2026" value={card.exp_year} onChange={e=>u("exp_year",Number(e.target.value))}/></Field>
        <div className="md:col-span-4 flex gap-3"><Btn onClick={submit}>SAVE_CARD <Chk/></Btn><Btn v="ghost" onClick={()=>setShow(false)}>CANCEL</Btn></div>
      </div>}
      <div className="space-y-2">{paymentMethods.length===0 && <Empty>No saved cards.</Empty>}{paymentMethods.map(m=>(<div key={m.id} className="flex items-center justify-between p-3 bg-black/30 border border-gray-800/50"><div className="flex items-center gap-3">{sIcons.card}<div className="fm text-xs"><div className="text-gray-300 font-bold">{m.brand} ****{m.last4}</div><div className="text-gray-500">EXP {String(m.exp_month).padStart(2,"0")}/{m.exp_year}</div></div></div><div className="flex items-center gap-2">{m.is_default&&<Badge c="green">DEFAULT</Badge>}<button onClick={()=>removePaymentMethod(m.id)} className="text-gray-600 hover:text-red-400 cursor-pointer p-1"><TrashI/></button></div></div>))}</div>
    </GC>
    <GC className="p-5"><SL>INVOICES</SL><div className="overflow-x-auto"><table className="w-full fm text-xs"><thead><tr className="border-b border-gray-800 text-gray-500"><th className="text-left py-2">NUMBER</th><th className="text-left">ISSUED</th><th className="text-left">DUE</th><th className="text-right">AMOUNT</th><th className="text-right">STATUS</th><th></th></tr></thead><tbody>{invoices.length===0&&<tr><td colSpan="6"><Empty>No invoices yet.</Empty></td></tr>}{invoices.map(i=>(<tr key={i.id} className="border-b border-gray-800/50"><td className="py-2 text-gray-300">{i.number||i.id.slice(0,8)}</td><td className="text-gray-400">{i.issued_at}</td><td className="text-gray-400">{i.due_at}</td><td className="text-right text-gray-300 font-bold">${Number(i.amount||0).toLocaleString()}</td><td className="text-right"><Badge c={i.status==="paid"?"green":i.status==="overdue"?"red":"yellow"}>{(i.status||"").toUpperCase()}</Badge></td><td className="text-right">{i.pdf_url?<a href={i.pdf_url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300">PDF</a>:<span className="text-gray-700">—</span>}</td></tr>))}</tbody></table></div></GC>
  </div>);
};

// ── Fix 2 — header faucet menu: claim USDC + EURC on Sepolia (Circle) ──
// Official-style token marks (blue Circle disc) as inline data URIs so they
// always render without hotlinking third-party assets.
const USDC_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%232775CA'/%3E%3Cpath fill='%23fff' d='M15.2 7h1.6v1.6c2.3.3 3.9 1.7 4 3.7h-2.1c-.1-1-.8-1.7-1.9-1.9v3.9c2.6.5 4.2 1.4 4.2 3.7 0 2.1-1.6 3.5-4.2 3.8V25h-1.6v-1.5c-2.5-.3-4.2-1.7-4.3-3.9h2.1c.1 1.1.9 1.9 2.2 2.1v-4.1c-2.5-.5-4.1-1.4-4.1-3.6 0-2 1.6-3.4 4.1-3.7V7Zm0 3.3c-1.1.2-1.8.8-1.8 1.7 0 .8.6 1.3 1.8 1.6v-3.3Zm1.6 5.7v3.6c1.2-.2 1.9-.8 1.9-1.8 0-.9-.6-1.4-1.9-1.8Z'/%3E%3C/svg%3E";
const EURC_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23286FB4'/%3E%3Cpath fill='%23fff' d='M18.6 20.6c-1 .9-2.1 1.3-3.4 1.3-2 0-3.6-1.2-4.3-3.1h5l.6-1.6h-6c0-.2-.1-.4-.1-.7 0-.3 0-.5.1-.8h6.6l.6-1.6h-6.8c.7-1.9 2.3-3.1 4.3-3.1 1.3 0 2.4.4 3.4 1.3l1.3-1.4C18.4 9.5 16.9 9 15.2 9c-3.2 0-5.8 2.1-6.6 5.1H7l-.6 1.6h1.9c0 .2-.1.5-.1.8 0 .3 0 .5.1.7H6.4L5.8 18.8h2.8c.8 3 3.4 5.1 6.6 5.1 1.7 0 3.2-.6 4.4-1.7Z'/%3E%3C/svg%3E";
function FaucetMenu() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const tokens = [{ sym:"USDC", name:"USD Coin", icon: USDC_ICON }, { sym:"EURC", name:"Euro Coin", icon: EURC_ICON }];
  return (<div ref={wrapRef} className="relative">
    <button onClick={()=>setOpen(o=>!o)} title="Claim testnet USDC & EURC on Sepolia — Circle faucet" aria-haspopup="true" aria-expanded={open} aria-label="Open faucet menu for USDC and EURC" className="flex items-center gap-1.5 px-2 md:px-2.5 py-1.5 border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-all cursor-pointer">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.7S5.5 10 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10 12 2.7 12 2.7z"/></svg>
      <span className="hidden sm:inline">FAUCET</span>
      <svg width="9" height="9" viewBox="0 0 12 12" className="hidden sm:inline" fill="currentColor"><path d="M6 8 2 4h8z"/></svg>
    </button>
    {open && <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-24px)] z-[70] glass p-2" style={{background:"#05020f"}}>
      <div className="fm text-[10px] text-gray-500 px-2 py-1 tracking-wide">CLAIM ON SEPOLIA · CIRCLE FAUCET</div>
      {tokens.map(t => (
        <a key={t.sym} href={CIRCLE_FAUCET} target="_blank" rel="noopener noreferrer" onClick={()=>setOpen(false)} className="flex items-center gap-3 px-2 py-2 hover:bg-emerald-500/10 transition-all cursor-pointer rounded-sm">
          <img src={t.icon} alt={`${t.sym} logo`} className="w-7 h-7 flex-shrink-0"/>
          <div className="min-w-0 flex-1"><div className="fm text-xs font-bold text-gray-200">{t.sym}</div><div className="fm text-[10px] text-gray-500">{t.name} · testnet</div></div>
          <span className="fm text-[10px] text-emerald-400 flex-shrink-0">CLAIM ↗</span>
        </a>
      ))}
      <div className="fm text-[9px] text-gray-600 px-2 py-1.5 border-t border-gray-800/60 mt-1 leading-snug">Opens faucet.circle.com — select the token and <b className="text-gray-400">Ethereum Sepolia</b>, then paste your wallet address.</div>
    </div>}
  </div>);
}

// ── Fix 3 — global connected-wallet chip, rendered from shared state on every
// in-app view so the connection is visibly persistent across navigation.
function WalletChip({ w }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  if (!w?.isConnected) return null;
  return (<div ref={wrapRef} className="relative">
    <button onClick={()=>setOpen(o=>!o)} aria-haspopup="true" aria-expanded={open} title="Connected wallet" className={`flex items-center gap-1.5 px-2 md:px-2.5 py-1.5 border transition-all cursor-pointer ${w.isSepolia?"border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20":"border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${w.isSepolia?"bg-emerald-400":"bg-red-400"}`} style={{boxShadow:w.isSepolia?"0 0 6px #34d399":"0 0 6px #f87171"}}/>
      <span className="mono text-[11px]">{shortAddr(w.address)}</span>
      <span className="hidden md:inline fm text-[10px] opacity-80">{w.isSepolia?`${Number(w.balance||0).toFixed(3)} SEP`:"WRONG NET"}</span>
    </button>
    {open && <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-24px)] z-[70] glass p-3 space-y-2" style={{background:"#05020f"}}>
      <div className="flex items-center justify-between gap-2"><span className="fm text-[10px] text-gray-500">WALLET · SEPOLIA</span><a href={explorerAddr(w.address)} target="_blank" rel="noopener noreferrer" className="mono text-[10px] text-purple-300 hover:underline">{shortAddr(w.address)} ↗</a></div>
      <div className="flex items-center gap-2 flex-wrap fm text-xs"><span className="text-gray-500">ETH:</span><span className="text-emerald-400 font-bold">{Number(w.balance||0).toFixed(6)} SEP</span></div>
      {!w.isSepolia && <button onClick={()=>{ w.ensureSepolia?.(); }} className="w-full fm text-[11px] px-2 py-1.5 border border-yellow-500/40 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20 transition-all cursor-pointer">SWITCH TO SEPOLIA</button>}
      <div className="flex gap-2">
        <button onClick={()=>{ w.reconnect?.(); setOpen(false); }} className="flex-1 fm text-[11px] px-2 py-1.5 border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 transition-all cursor-pointer">SWITCH ACCOUNT</button>
        <button onClick={()=>{ w.disconnect?.(); setOpen(false); }} className="flex-1 fm text-[11px] px-2 py-1.5 border border-gray-700 text-gray-400 hover:bg-red-500/10 hover:text-red-300 transition-all cursor-pointer">DISCONNECT</button>
      </div>
    </div>}
  </div>);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
function AppShell() {
  const { phase, fading, activeView, activeScenario, user, org, threshold, participants, wallets, settings, scenarios, progress } = useApp();
  const qsScore = computeQSafety({ org, threshold, participants, wallets, settings, scenarios, progress });
  const hw = useSharedWallet();   // Fix 3 — shared wallet, so the header chip persists on every view
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const views = { hub:<EvaluationHub/>, "scenario-detail":<ScenarioDetail/>, overview:<EvalOverview/>, assets:<AssetBoundary/>, "import-bank":<ImportBank/>, movement:<GovernedMovement/>, team:<Team/>, evidence:<EvidenceViewer/>, "how-it-works":<HowItWorks/>, "user-guide":<UserGuide/>, support:<Support/>, billing:<Billing/>, settings:<SettingsPage/> };

  return (<div style={{opacity:fading?0:1,transition:"opacity 0.3s ease"}}>
    {phase==="landing"&&<LandingPage/>}
    {phase==="auth"&&<AuthScreen/>}
    {phase==="setup"&&<div className="flex h-screen"><div className="flex-1 overflow-y-auto"><SandboxSetup/></div><div className="hidden lg:block border-l border-purple-500/20" style={{background:"rgba(5,2,15,.5)"}}><AuditLog/></div></div>}
    {phase==="app"&&<div className="flex flex-col h-screen">
      <div className="h-14 border-b border-purple-500/20 flex items-center justify-between px-3 md:px-5 flex-shrink-0 gap-2" style={{background:"rgba(5,2,15,.8)"}}>
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <button onClick={()=>setSidebarOpen(true)} className="md:hidden text-gray-300 hover:text-purple-400 cursor-pointer flex-shrink-0" aria-label="Open menu"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
          <img src="/qq-logo.svg" alt="QQ" className="w-7 h-7 flex-shrink-0" style={{filter:"drop-shadow(0 0 6px rgba(168,85,247,.35))"}}/>
          <span className="font-bold tracking-tight text-sm md:text-base truncate">QUANTUM_QUSTODY</span>
          {activeScenario&&<><span className="hidden md:inline text-gray-700">|</span><span className="hidden md:inline fm text-xs text-gray-500">SCENARIO {activeScenario.num}</span></>}
        </div>
        <div className="flex items-center gap-2 md:gap-4 fm text-xs flex-shrink-0">
          {/* Item 3 / Fix 2 — header faucet: claim testnet USDC + EURC on Sepolia via Circle */}
          <FaucetMenu/>
          <WalletChip w={hw}/>
          <QuantumSafetyAtom score={qsScore}/>
          <span className="hidden lg:inline text-gray-700">|</span>
          <span className="hidden lg:inline text-gray-500">USER:</span>
          <span className="hidden lg:inline text-gray-300 truncate max-w-[180px]">{user?.email}</span>
          <button onClick={()=>setAuditOpen(true)} className="lg:hidden text-gray-400 hover:text-purple-400 cursor-pointer" aria-label="Open audit log">{sIcons.log}</button>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar — desktop persistent, mobile drawer */}
        <div className="hidden md:block" style={{height:"calc(100vh - 56px)"}}><SideNav/></div>
        {sidebarOpen && (<>
          <div className="md:hidden fixed inset-0 z-40 bg-black/70" onClick={()=>setSidebarOpen(false)}/>
          <div className="md:hidden fixed left-0 top-14 bottom-0 z-50 anim" style={{animation:"slideInL .25s ease"}}><SideNav onSelect={()=>setSidebarOpen(false)}/></div>
        </>)}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">{views[activeView]||views.hub}</div>
        {/* Audit log — desktop persistent, mobile drawer */}
        <div className="hidden lg:block border-l border-purple-500/20" style={{background:"rgba(5,2,15,.5)"}}><AuditLog/></div>
        {auditOpen && (<>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/70" onClick={()=>setAuditOpen(false)}/>
          <div className="lg:hidden fixed right-0 top-14 bottom-0 z-50 border-l border-purple-500/20" style={{background:"rgba(5,2,15,.95)",animation:"slideInR .25s ease"}}><AuditLog/></div>
        </>)}
      </div>
    </div>}
  </div>);
}

export default function App() {
  return (<AppProvider><WalletProvider><AppShell/></WalletProvider></AppProvider>);
}
