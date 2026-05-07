import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { createClient } from "@supabase/supabase-js";
import { useWallet, FAUCETS, SEPOLIA_CHAIN_ID, explorerTx, explorerAddr, shortAddr, readBalance } from "./sepolia.js";

// ═══════════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════════════

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
}

const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

const FUNCTIONS_URL = `${supabaseUrl}/functions/v1`;

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

  const addLog = useCallback((entry) => {
    // Local optimistic log entry (also persisted via edge function when session exists)
    const log = { id: `tmp-${Math.random()}`, ...entry, type: entry.type || "info", created_at: new Date().toISOString(), time: timeStr() };
    setLogs(prev => [log, ...prev]);
    return log;
  }, []);

  // ── Load scenarios from DB on mount ──
  useEffect(() => {
    (async () => {
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
    const [partsRes, astRes, progRes, logsRes, moveRes, evRes,
      banksRes, chainsRes, walletsRes, threshRes,
      invRes, pmRes, plansRes, subRes, settingsRes] = await Promise.all([
      supabase.from("participants").select("*").eq("org_id", orgId),
      supabase.from("assets").select("*").eq("org_id", orgId),
      supabase.from("scenario_progress").select("*").eq("session_id", sessionId),
      supabase.from("audit_logs").select("*").eq("session_id", sessionId).order("created_at", { ascending: false }).limit(500),
      supabase.from("movement_requests").select("*").eq("session_id", sessionId),
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
    setChains(chainsRes.data || []);
    setWallets(walletsRes.data || []);
    setThreshold(threshRes.data);
    setInvoices(invRes.data || []);
    setPaymentMethods(pmRes.data || []);
    setPlans(plansRes.data || []);
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

    const auditChannel = supabase
      .channel(`audit-${session.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_logs", filter: `session_id=eq.${session.id}` },
        (payload) => {
          const newLog = { ...payload.new, time: timeStr(payload.new.created_at) };
          setLogs(prev => {
            // Dedupe: remove temp entries with same message
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
  const signIn = async (email, password, fullName) => {
    setAuthError(null);
    setLoading(true);
    try {
      // Try sign up first (for new users), fall back to sign in
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName || email.split("@")[0] } },
      });

      if (signUpError && signUpError.message.includes("already registered")) {
        // User exists, sign them in
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        setUser(signInData.user);
        await loadActiveSession(signInData.user.id);
        return;
      }

      if (signUpError) throw signUpError;

      setUser(signUpData.user);
      // New user → go to setup
      go("setup");
    } catch (err) {
      setAuthError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
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
    try {
      const result = await callFunction("scenario-engine", { action: "create_session", org_config: orgConfig });
      setSession(result.session);
      setOrg(result.org);
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
      signIn, signOut, createSession, startScenario, advanceStep, generateEvidence, completeScenario, resetSandbox,
      // items 6-20
      banks, chains, wallets, threshold, invoices, paymentMethods, plans, subscription, settings, theme,
      addBank, removeBank, addWallet, removeWallet, addAsset, removeAsset,
      addParticipant, removeParticipant, updateThreshold,
      addPaymentMethod, removePaymentMethod, switchPlan, submitTicket, updateSettings, setTheme,
      invitations, sendInvitation, resendInvitation, revokeInvitation, reloadInvitations, reloadParticipants,
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
  const { signIn, authError, loading } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = async () => {
    if (!email || !password) return;
    try { await signIn(email, password, name); } catch {}
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <div className="absolute inset-0 pointer-events-none" style={{background:"radial-gradient(circle at center,rgba(168,85,247,.06) 0%,transparent 50%)"}}/>
      <div className="w-full max-w-md anim">
        <div className="text-center mb-8"><div className="flex items-center justify-center gap-2"><img src="/qq-logo.svg" alt="QQ" className="w-9 h-9" style={{filter:"drop-shadow(0 0 10px rgba(168,85,247,.4))"}}/><span className="font-bold text-xl tracking-tight">QUANTUM_QUSTODY</span></div></div>
        <GC className="p-8">
          <SL>SIGN IN / SIGN UP</SL>
          <div className="space-y-4">
            <div><label className="fm text-xs text-gray-500 mb-2 block">FULL_NAME (new users)</label><input placeholder="Your name" value={name} onChange={e=>setName(e.target.value)}/></div>
            <div><label className="fm text-xs text-gray-500 mb-2 block">EMAIL</label><input type="email" placeholder="you@institution.com" value={email} onChange={e=>setEmail(e.target.value)}/></div>
            <div><label className="fm text-xs text-gray-500 mb-2 block">PASSWORD</label><input type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/></div>
            {authError && <div className="p-3 bg-red-500/10 border border-red-500/30 fm text-xs text-red-300">{authError}</div>}
            <Btn full onClick={handleSubmit} disabled={loading || !email || !password}>{loading?"WORKING...":"SIGN_IN_OR_CREATE_ACCOUNT"} <Arr /></Btn>
          </div>
          <div className="mt-6 p-3 bg-purple-500/5 border border-purple-500/20 fm text-xs text-gray-500"><span className="text-purple-400">NEW USERS:</span> Fill in all fields to create an account. <span className="text-purple-400">EXISTING USERS:</span> Email and password are enough.</div>
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
      <nav className="fixed top-0 w-full z-50 p-4"><div className="max-w-7xl mx-auto glass rounded-sm flex justify-between items-center px-6 py-3"><div className="flex items-center gap-3"><img src="/qq-logo.svg" alt="QQ" className="w-8 h-8" style={{filter:"drop-shadow(0 0 8px rgba(168,85,247,.3))"}}/><span className="font-bold text-lg tracking-tight">QUANTUM_QUSTODY</span></div><div className="hidden md:flex gap-6 text-sm text-gray-400 fm"><a href="#home" className="hover:text-purple-400 transition-colors">[ HOME ]</a></div><button onClick={enter} className="bg-purple-500/10 border border-purple-500/50 text-purple-400 px-4 py-2 text-sm fm hover:bg-purple-500/20 transition-all cursor-pointer">ACCESS SANDBOX</button></div></nav>

      {/* HERO */}
      <section id="home" className="pt-32 md:pt-48 pb-16 md:pb-24 px-4 flex flex-col items-center justify-center text-center relative">
        <div className="absolute inset-0 pointer-events-none" style={{background:"radial-gradient(circle at center,rgba(168,85,247,.1) 0%,transparent 50%)"}}/>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-tight anim">Institutional Control.<br/><span className="tg">Defensible Evidence.</span></h1>
        <p className="text-gray-400 text-base sm:text-lg md:text-xl max-w-2xl fm mb-10 leading-relaxed anim-d1">A new institutional operating model built around governed movement, policy enforcement, selective verification, and crypto-agile evidence.</p>
        <div className="flex flex-col sm:flex-row gap-4 anim-d2"><button onClick={enter} className="bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white px-8 py-4 fm font-bold hover:from-purple-500 hover:to-fuchsia-500 transition-colors glow cursor-pointer">ENTER SANDBOX</button></div>
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

      {/* FOOTER */}
      <footer className="border-t border-purple-500/20 bg-black py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 fm text-xs text-gray-600">
          <div className="flex items-center gap-2"><img src="/qq-logo.svg" alt="QQ" className="w-6 h-6"/><span className="font-bold text-white text-sm">QUANTUM_QUSTODY</span></div>
          <div className="flex items-center gap-3">
            <a href="https://x.com/quantumqustody" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-purple-400 transition-colors glass"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg></a>
            <a href="https://www.instagram.com/quantumqustody/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-purple-400 transition-colors glass"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>
            <a href="https://www.linkedin.com/in/quantumqustody/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-purple-400 transition-colors glass"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg></a>
          </div>
          <div>© 2026 QUANTUM QUSTODY</div>
        </div>
      </footer>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// SANDBOX SETUP
// ═══════════════════════════════════════════════════════════════════
const SandboxSetup = () => {
  const { createSession, addLog, loading } = useApp();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({orgName:"",instType:"",jurisdiction:"",evalObjective:"",controlModel:"threshold",trustEnv:"current"});
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
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
          {step===0&&<div className="space-y-5 anim" key="s0"><SL>ORGANIZATION CONTEXT</SL><div><label className="fm text-xs text-gray-500 mb-2 block">ORGANIZATION *</label><input placeholder="Institution name" value={f.orgName} onChange={e=>u("orgName",e.target.value)}/></div><div className="grid grid-cols-2 gap-4"><div><label className="fm text-xs text-gray-500 mb-2 block">INSTITUTION_TYPE</label><select value={f.instType} onChange={e=>u("instType",e.target.value)}><option value="">Select...</option><option>Asset Manager</option><option>Bank / Custodian</option><option>Fund</option><option>Corporate Treasury</option></select></div><div><label className="fm text-xs text-gray-500 mb-2 block">JURISDICTION</label><select value={f.jurisdiction} onChange={e=>u("jurisdiction",e.target.value)}><option value="">Select...</option><option>United States</option><option>European Union</option><option>United Kingdom</option><option>Singapore</option></select></div></div><div><label className="fm text-xs text-gray-500 mb-2 block">EVALUATION_OBJECTIVE</label><input placeholder="e.g., Assess governed treasury controls" value={f.evalObjective} onChange={e=>u("evalObjective",e.target.value)}/></div></div>}
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
    {id:"support",l:"SUPPORT",i:sIcons.mail},
    {id:"billing",l:"BILLING",i:sIcons.card},
    {id:"settings",l:"SETTINGS",i:sIcons.config},
  ];
  return (<div className="w-56 flex-shrink-0 border-r border-purple-500/20 flex flex-col h-full" style={{background:"rgba(5,2,15,.95)"}}><div className="p-4 space-y-1 flex-1 overflow-y-auto">{nav.map(n=><button key={n.id} onClick={()=>pick(n.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 fm text-xs transition-all cursor-pointer ${activeView===n.id?"text-purple-400 bg-purple-500/10 border-l-2 border-purple-500":"text-gray-500 hover:text-gray-300 hover:bg-white/5 border-l-2 border-transparent"}`}>{n.i}<span className="flex-1 text-left">{n.l}</span>{n.soon&&<span className="fm text-[8px] px-1.5 py-0.5 bg-yellow-400/20 text-yellow-400 border border-yellow-400/40">SOON</span>}</button>)}</div><div className="p-4 border-t border-purple-500/10 space-y-2"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-xs font-bold">{(user?.email||"U")[0].toUpperCase()}</div><div className="fm text-xs text-gray-400 truncate">{user?.email}</div></div><button onClick={signOut} className="w-full fm text-xs text-gray-600 hover:text-red-400 transition-colors cursor-pointer text-left px-1 py-1">← EXIT_SANDBOX</button></div></div>);
};

// ═══════════════════════════════════════════════════════════════════
// EVALUATION HUB
// ═══════════════════════════════════════════════════════════════════
const EvaluationHub = () => {
  const { org, threshold, participants, wallets, assets, banks, logs, settings, scenarios, progress, setActiveView, addLog } = useApp();
  const usdNum = (s) => Number(String(s||"").replace(/[^0-9.-]/g,"")) || 0;
  const cryptoUsd = assets.reduce((s,a) => s + usdNum(a.balance_usd), 0);
  const banksUsd = banks.reduce((s,b) => s + Number(b.balance||0), 0);
  const totalUsd = cryptoUsd + banksUsd;
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
        <div className="text-5xl md:text-6xl font-black tg leading-none mb-3">${totalUsd.toLocaleString()}</div>
        <div className="flex flex-wrap gap-4 fm text-xs"><span className="text-gray-500">BANKS:</span><span className="text-blue-400 font-bold">${banksUsd.toLocaleString()}</span><span className="text-gray-700">·</span><span className="text-gray-500">CRYPTO:</span><span className="text-purple-400 font-bold">${cryptoUsd.toLocaleString()}</span></div>
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
        { l:"WALLETS", v:wallets.length, c:"text-fuchsia-400" },
        { l:"TEAM", v:participants.length, c:"text-indigo-400" },
        { l:"THRESHOLD", v:`${threshold?.required_approvals||0}/${participants.length||0}`, c:"text-yellow-400" },
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

  const w = useWallet();

  // Auto-persist a connected MetaMask wallet to the wallets table the first time we see it.
  useEffect(() => {
    if (!w.address || !org?.id) return;
    const sepoliaChain = chains.find(c => c.network === "ethereum-sepolia");
    if (!sepoliaChain) return;
    const exists = wallets.find(x => x.address?.toLowerCase() === w.address.toLowerCase());
    if (exists) return;
    addWallet({ chain_id: sepoliaChain.id, label: "MetaMask Sepolia", address: w.address, type: "EOA" });
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

    <GC className="p-5 anim-d1"><div className="flex items-center justify-between flex-wrap gap-3">
      <div><div className="fm text-xs text-gray-500 mb-1 flex items-center gap-2">TOTAL_BALANCE_HIGHLIGHTED <Tip text="Sum of USD-valued in-scope assets across all connected wallets and chains. Live wallet balances are shown separately as Sepolia testnet (no real USD value)."/></div><div className="text-3xl font-black tg">${manualUsd.toLocaleString(undefined,{maximumFractionDigits:2})}</div></div>
      <div className="fm text-xs text-gray-500 text-right"><div>{assets.filter(a=>a.scope==="in-scope").length} IN-SCOPE</div><div className="text-emerald-400">{wallets.length} WALLETS · {chains.length} CHAINS</div></div>
    </div></GC>

    {/* IMPORT_CRYPTO: connect wallet flow (same as Governed Movement) */}
    {mode==="wallet" && <GC className="p-5 anim" style={{borderTop:"2px solid rgba(34,197,94,.4)"}}>
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex-1 min-w-[240px]">
          <SL>CONNECT WALLET · SEPOLIA TESTNET</SL>
          {!w.hasProvider && <div className="fm text-xs text-yellow-300">No EIP-1193 wallet detected. Install <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">MetaMask</a>, Coinbase Wallet, Rabby, or Brave to import.</div>}
          {w.hasProvider && !w.isConnected && <div className="fm text-xs text-gray-400 mb-3">Click CONNECT WALLET — MetaMask will ask permission and we'll auto-switch to Sepolia. Your private key never leaves your wallet; the address is delegated for policy enforcement only.</div>}
          {w.isConnected && (<div className="space-y-2 fm text-xs">
            <div className="flex items-center gap-2 flex-wrap"><span className="text-gray-500">ADDRESS:</span><a href={explorerAddr(w.address)} target="_blank" rel="noopener noreferrer" className="text-purple-300 hover:text-purple-200 hover:underline">{shortAddr(w.address)}</a><Badge c={w.isSepolia?"green":"red"}>{w.isSepolia?"SEPOLIA":`WRONG NETWORK (${w.chainId||"?"})`}</Badge></div>
            <div className="flex items-center gap-4 flex-wrap"><span className="text-gray-500">ETH:</span><span className="text-emerald-400 font-bold">{liveEth.toFixed(6)} SEP</span><span className="text-gray-500">WETH:</span><span className="text-fuchsia-400 font-bold">{liveWeth.toFixed(6)}</span><button onClick={()=>w.refreshBalance()} className="fm text-[10px] text-purple-400 hover:text-purple-300 cursor-pointer">[ REFRESH ]</button></div>
          </div>)}
        </div>
        <div className="flex gap-2 flex-wrap">
          {!w.isConnected && w.hasProvider && <Btn onClick={w.connect} disabled={w.busy}>{w.busy?"CONNECTING...":"CONNECT WALLET"}</Btn>}
          {w.isConnected && !w.isSepolia && <Btn v="secondary" onClick={w.ensureSepolia}>SWITCH TO SEPOLIA</Btn>}
          {w.isConnected && <Btn v="ghost" onClick={()=>setMode(null)}>DONE</Btn>}
        </div>
      </div>
      {w.error && <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 fm text-xs text-red-300">{w.error}</div>}
    </GC>}

    {/* Live wallet balance card — shown whenever a wallet is connected */}
    {w.isConnected && mode!=="wallet" && <GC className="p-5" style={{borderLeft:"3px solid #22c55e"}}>
      <div className="flex items-center justify-between flex-wrap gap-3"><SL>LIVE WALLET</SL><a href={explorerAddr(w.address)} target="_blank" rel="noopener noreferrer" className="fm text-xs text-purple-300 hover:underline">{shortAddr(w.address)} ↗</a></div>
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
    {wallets.length>0 && <GC className="p-4"><SL>IMPORTED WALLETS ({wallets.length})</SL><div className="space-y-2">{wallets.map(wl=>(<div key={wl.id} className="flex items-center justify-between p-3 bg-black/30 border border-gray-800/50 flex-wrap gap-2"><div className="flex items-center gap-3 min-w-0 flex-1"><Wallet/><div className="fm text-xs min-w-0"><div className="text-gray-300 font-bold truncate">{wl.label||wl.address?.slice(0,10)} · {wl.chain?.name}{wl.chain?.is_testnet?" (Testnet)":""}</div><a href={wl.chain?.explorer_url ? `${wl.chain.explorer_url}/address/${wl.address}` : "#"} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-purple-400 truncate block">{wl.address}</a></div></div><div className="flex items-center gap-2"><Badge c={wl.chain?.is_testnet?"yellow":"green"}>{(wl.type||"EOA").toUpperCase()}</Badge><button onClick={()=>removeWallet(wl.id, wl.label)} className="text-gray-600 hover:text-red-400 cursor-pointer p-1"><TrashI/></button></div></div>))}</div></GC>}

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
          banks, chains, wallets, threshold, addWallet, removeWallet, session, org } = useApp();
  const scId = activeScenario?.id;
  const pg = scId ? progress[scId] : null;
  const step = pg?.current_step || "request";
  const [action, setAction] = useState("send");
  const [fd, setFd] = useState({ destination:"", amount:"", asset:"ETH" });
  const up = (k,v) => setFd(p=>({...p,[k]:v}));
  const [pendingTx, setPendingTx] = useState(null);
  const [recentTxs, setRecentTxs] = useState([]);
  const [walletWarning, setWalletWarning] = useState(null);
  const isBlocked = scId === "s2";

  const w = useWallet();

  // When MetaMask connects, persist that wallet to Supabase wallets table (idempotent best-effort)
  useEffect(() => {
    if (!w.address || !org?.id) return;
    const sepoliaChain = chains.find(c => c.network === "ethereum-sepolia");
    if (!sepoliaChain) return;
    const exists = wallets.find(x => x.address?.toLowerCase() === w.address.toLowerCase());
    if (exists) return;
    addWallet({ chain_id: sepoliaChain.id, label: "MetaMask Sepolia", address: w.address, type: "EOA" });
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
    { l: "WALLETS", v: wallets.length, c: "fuchsia" },
    { l: "TEAM", v: teamCount, c: "indigo" },
    { l: "THRESHOLD", v: `${threshold?.required_approvals || 0}/${teamCount || 0}`, c: "yellow" },
  ];

  return (<div className="p-6 space-y-6 overflow-y-auto flex-1">
    <div className="flex items-start justify-between flex-wrap gap-3"><div><h2 className="text-2xl font-bold mb-1">Governed Movement</h2><p className="fm text-sm text-gray-500">REAL ON-CHAIN TRANSACTIONS · ETHEREUM SEPOLIA TESTNET</p></div></div>

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
            <div className="flex items-center gap-2"><span className="text-gray-500">ADDRESS:</span><a href={explorerAddr(w.address)} target="_blank" rel="noopener noreferrer" className="text-purple-300 hover:text-purple-200 hover:underline">{shortAddr(w.address)}</a><Badge c={w.isSepolia?"green":"red"}>{w.isSepolia?"SEPOLIA":`WRONG NETWORK (${w.chainId||"?"})`}</Badge></div>
            <div className="flex items-center gap-4 flex-wrap"><span className="text-gray-500">ETH:</span><span className="text-emerald-400 font-bold">{Number(w.balance).toFixed(6)} SEP</span><span className="text-gray-500">WETH:</span><span className="text-fuchsia-400 font-bold">{Number(w.wethBalance).toFixed(6)}</span><button onClick={()=>w.refreshBalance()} className="fm text-[10px] text-purple-400 hover:text-purple-300 cursor-pointer">[ REFRESH ]</button></div>
          </div>)}
        </div>
        <div className="flex gap-2 flex-wrap">
          {!w.isConnected && w.hasProvider && <Btn onClick={w.connect} disabled={w.busy}>{w.busy?"CONNECTING...":"CONNECT WALLET"}</Btn>}
          {w.isConnected && !w.isSepolia && <Btn v="secondary" onClick={w.ensureSepolia}>SWITCH TO SEPOLIA</Btn>}
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
        {pendingTx && (<div className="p-3 bg-purple-500/10 border border-purple-500/30 fm text-xs text-purple-200 space-y-1">
          <div>{pendingTx.status==="signing"?"Awaiting MetaMask signature...":pendingTx.status==="pending"?"Broadcasted — waiting for confirmation...":pendingTx.status==="complete"?"✓ Confirmed on Sepolia":"✗ Failed"}</div>
          {pendingTx.hash && <a href={explorerTx(pendingTx.hash)} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline break-all">{pendingTx.hash} ↗</a>}
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
      <a href={explorerTx(t.hash)} target="_blank" rel="noopener noreferrer" className="text-purple-300 hover:underline truncate flex-1">{t.hash}</a>
    </div>))}</div></GC>}

    {/* Scenario flow — only when an evaluation scenario is active */}
    {activeScenario && (<>
      <GC className="p-4" style={{borderLeft:"3px solid #a855f7"}}><div className="flex items-center gap-3 fm text-xs flex-wrap"><Badge c="purple">SCENARIO {activeScenario.num}</Badge><span className="text-gray-400">{activeScenario.title}</span><span className="text-gray-600">|</span><span className="text-purple-400 font-bold">{step.toUpperCase()}</span>{isBlocked&&<Badge c="red">BLOCKED PATH</Badge>}</div>{(() => { const requester = participants.find(p=>p.scenario_role==="Requester"); const approver = participants.find(p=>p.scenario_role==="Approver"); const actor = step==="request"?(requester?.institution_fn||"Requester"):step==="policy"?"Policy Engine":(approver?.institution_fn||"Approver"); return (<div className="fm text-xs text-gray-600 mt-1">Policy: Movement Policy {threshold?.policy_version||"—"} · Actor: {actor}</div>); })()}</GC>
      <div className="flex gap-2 flex-wrap">{["request","policy","approval","execution"].map((s,i)=><div key={s} className={`flex items-center gap-1 px-3 py-1.5 fm text-xs ${step===s?"text-purple-400 bg-purple-500/10 border border-purple-500/30":i<["request","policy","approval","execution"].indexOf(step)?"text-emerald-400":"text-gray-600"}`}>{i<["request","policy","approval","execution"].indexOf(step)?"✓":String(i+1).padStart(2,"0")} {s.toUpperCase()}</div>)}</div>
      {step==="policy"&&<GC className="p-6 max-w-xl"><SL>POLICY APPLICATION</SL><div className="space-y-4"><InfoRow label="POLICY_IN_FORCE" value={`Movement Policy ${threshold?.policy_version||"—"}`}/><InfoRow label="ACTING_FUNCTION" value={participants.find(p=>p.scenario_role==="Requester")?.institution_fn||"—"}/><InfoRow label="OUTCOME" badge={isBlocked?{t:"BLOCKED",c:"red"}:{t:"PASSED",c:"green"}}/>{isBlocked&&<div className="p-4 bg-red-500/5 border border-red-500/20 fm text-xs text-red-300">Policy conflict detected. Exception trail being generated.</div>}<Btn full onClick={()=>advance()}>{isBlocked?"VIEW_EXCEPTION":"VIEW_POLICY_PATH"} <Arr/></Btn></div></GC>}
      {step==="approval"&&<GC className="p-6 max-w-xl"><SL>THRESHOLD APPROVAL</SL><div className="space-y-4">{participants.filter(p=>["Approver","Reviewer"].includes(p.scenario_role)).map(p=><div key={p.id} className="flex items-center justify-between p-3 bg-black/30 border border-gray-800/50"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-xs font-bold">{p.initials}</div><div><div className="text-sm font-bold">{p.name}</div><div className="fm text-xs text-gray-500">{p.institution_fn}</div></div></div><Badge c="green">APPROVED</Badge></div>)}<InfoRow label="THRESHOLD" value={`${threshold?.required_approvals||2} of ${teamCount||2} — Met`}/><Btn full onClick={()=>advance()}>ADVANCE_TO_EXECUTION <Arr/></Btn></div></GC>}
      {step==="execution"&&<GC className="p-6 max-w-xl"><SL>{isBlocked?"BLOCKED OUTCOME":"EXECUTION"}</SL><div className="space-y-4"><div className="text-center py-4"><div className={`inline-block p-4 rounded-full mb-4 ${isBlocked?"bg-red-500/10 border border-red-500/30":"bg-emerald-500/10 border border-emerald-500/30"}`}>{isBlocked?<Blk/>:<Chk/>}</div><h3 className="text-xl font-bold mb-2">{isBlocked?"Movement Blocked":"Movement Executed"}</h3></div><Btn full onClick={()=>advance()}>COMPLETE <Arr/></Btn></div></GC>}
      {step==="complete"&&<GC className="p-6 max-w-xl"><div className="text-center py-4"><div className="inline-block p-4 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-4"><Chk/></div><h3 className="text-xl font-bold mb-2">Scenario Flow Complete</h3></div><div className="flex gap-3 justify-center"><Btn onClick={()=>setActiveView("evidence")}>VIEW_EVIDENCE</Btn></div></GC>}
    </>)}

    {/* Connected wallets list */}
    {wallets.length>0 && <GC className="p-4"><SL>SAVED WALLETS</SL><div className="space-y-2">{wallets.map(wl=>(<div key={wl.id} className="flex items-center justify-between p-3 bg-black/30 border border-gray-800/50"><div className="flex items-center gap-3"><Wallet/><div className="fm text-xs"><div className="text-gray-300 font-bold">{wl.label||wl.address?.slice(0,10)} · {wl.chain?.name}{wl.chain?.is_testnet?" (Testnet)":""}</div><div className="text-gray-600 truncate max-w-md">{wl.address}</div></div></div><div className="flex items-center gap-2"><Badge c={wl.chain?.is_testnet?"yellow":"green"}>{(wl.type||"EOA").toUpperCase()}</Badge><button onClick={()=>removeWallet(wl.id, wl.label)} className="text-gray-600 hover:text-red-400 cursor-pointer p-1"><TrashI/></button></div></div>))}</div></GC>}
  </div>);
};

// ═══════════════════════════════════════════════════════════════════
// TEAM (item 12 — renamed from Participants)
// ═══════════════════════════════════════════════════════════════════
const Team = () => {
  const { participants, threshold, addParticipant, removeParticipant, updateThreshold,
          invitations, sendInvitation, resendInvitation, revokeInvitation, reloadInvitations, reloadParticipants } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => { setRefreshing(true); try { await Promise.all([reloadParticipants(), reloadInvitations()]); } finally { setRefreshing(false); } };
  const [mode, setMode] = useState(null); // null | "invite" | "manual"
  const [busy, setBusy] = useState(false);
  const [inv, setInv] = useState({ email:"", full_name:"", institution_fn:"", scenario_role:"Requester", threshold_weight:1 });
  const [m, setM] = useState({ name:"", email:"", institution_fn:"", scenario_role:"Requester", threshold_weight:1 });
  const [t, setT] = useState({ required_approvals: threshold?.required_approvals||2, required_reviewers: threshold?.required_reviewers||1, policy_version: threshold?.policy_version||"v2.1" });
  useEffect(() => { setT({ required_approvals: threshold?.required_approvals||2, required_reviewers: threshold?.required_reviewers||1, policy_version: threshold?.policy_version||"v2.1" }); }, [threshold]);
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

    {/* Active members */}
    <div>
      <SL>ACTIVE MEMBERS ({participants.length})</SL>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {participants.length===0 && <Empty>No team members yet — invite the first one above.</Empty>}
        {participants.map(p=>(<GC key={p.id} className="p-5 flex flex-col" style={{borderTop:`2px solid ${p.scenario_role==="Approver"?"rgba(217,70,239,.5)":p.scenario_role==="Reviewer"?"rgba(59,130,246,.5)":"rgba(168,85,247,.4)"}`}}>
          <div className="flex items-center gap-3 mb-4"><div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center font-bold">{p.initials}</div><div><div className="font-bold">{p.name}</div><div className="fm text-xs text-gray-500">{p.institution_fn}</div></div></div>
          <div className="space-y-2 mb-4 fm text-xs">
            <div className="flex justify-between"><span className="text-gray-500">EMAIL</span><span className="text-gray-300 truncate ml-2 max-w-[160px]">{p.email||"—"}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">WEIGHT</span><span className="text-gray-300">{p.threshold_weight||1}</span></div>
          </div>
          <div className="flex items-center justify-between mt-auto"><Badge c={roleColor[p.scenario_role]||"purple"}>{(p.scenario_role||"").toUpperCase()}</Badge><div className="flex items-center gap-2"><Badge c={p.status==="active"?"green":"yellow"}>{(p.status||"").toUpperCase()}</Badge><button onClick={()=>removeParticipant(p.id, p.name)} className="text-gray-600 hover:text-red-400 cursor-pointer p-1"><TrashI/></button></div></div>
        </GC>))}
      </div>
    </div>
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

    {onTx && <GC className="p-6 anim-d2"><div className="flex items-center justify-between flex-wrap gap-3 mb-4"><SL>TRANSACTION HISTORY</SL><div className="flex gap-2"><Btn v="secondary" onClick={()=>{exportCSV(txRows,`transactions-${today}.csv`);addLog({type:"evidence",message:`Exported ${txRows.length} transactions (CSV)`});}}><Dl/> EXPORT_CSV</Btn><Btn v="secondary" onClick={()=>{exportJSON(txRows,`transactions-${today}.json`);addLog({type:"evidence",message:`Exported ${txRows.length} transactions (JSON)`});}}><Dl/> EXPORT_JSON</Btn></div></div>
      <div className="p-3 bg-purple-500/5 border border-purple-500/20 fm text-xs text-gray-400 mb-4">All <span className="text-purple-400 font-bold">{txRows.length}</span> transactions executed on the platform — Send, Swap, Bridge — with policy outcome and approval state. Backed by <span className="text-purple-400">movement_requests</span> in Supabase.</div>
      <div className="overflow-x-auto"><div className="max-h-[480px] overflow-y-auto fm text-xs"><table className="w-full"><thead className="sticky top-0 bg-black/80 backdrop-blur"><tr className="text-gray-500 border-b border-gray-800"><th className="text-left py-2 px-2">TIMESTAMP</th><th className="text-left">TYPE</th><th className="text-right">AMOUNT</th><th className="text-left">ASSET</th><th className="text-left">DESTINATION</th><th className="text-left">SCENARIO</th><th className="text-right">STATUS</th></tr></thead><tbody>{txRows.length===0&&<tr><td colSpan="7"><Empty>No transactions yet — submit a Send / Swap / Bridge from the Dashboard.</Empty></td></tr>}{txRows.map(r=>(<tr key={r.id} className="border-b border-gray-800/40"><td className="py-1.5 px-2 text-gray-600 whitespace-nowrap">{(r.timestamp||"").slice(0,19).replace("T"," ")}</td><td className="text-purple-400 uppercase">{r.type}</td><td className="text-right text-gray-300 font-bold">{r.amount||"—"}</td><td className="text-gray-400">{r.asset||"—"}</td><td className="text-gray-400 truncate max-w-[200px]">{r.destination||"—"}</td><td className="text-gray-600">{r.scenario||"—"}</td><td className="text-right"><Badge c={r.status==="completed"?"green":r.status==="blocked"?"red":r.status==="execution"?"fuchsia":"yellow"}>{(r.status||"").toUpperCase()}</Badge></td></tr>))}</tbody></table></div></div>
    </GC>}
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
  const completed = Object.values(progress).filter(p=>p.status==="completed").length;
  const total = scenarios.length || 0;
  return (<div className="p-6 space-y-6 overflow-y-auto flex-1"><div><h2 className="text-2xl font-bold mb-1 anim">Overview</h2><p className="fm text-sm text-gray-500 anim-d1">{org?.name||"—"} · LIVE EVALUATION</p></div>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      <GC className="p-5 anim"><div className="fm text-xs text-gray-500 mb-2">[ SCENARIOS ]</div><div className="text-2xl font-bold mb-1">{completed}/{total||0}</div><div className="fm text-xs text-gray-500">completed</div></GC>
      <GC className="p-5 anim-d1"><div className="fm text-xs text-gray-500 mb-2">[ ACTIVE ]</div><div className="text-lg font-bold mb-1">{activeScenario?activeScenario.num:"—"}</div><div className="fm text-xs text-gray-500">{activeScenario?activeScenario.title?.slice(0,28)+"…":"none"}</div></GC>
      <GC className="p-5 anim-d2"><div className="fm text-xs text-gray-500 mb-2">[ TRANSACTIONS ]</div><div className="text-2xl font-bold mb-1 text-emerald-400">{transactions.length}</div><div className="fm text-xs text-gray-500">on platform</div></GC>
      <GC className="p-5 anim-d3"><div className="fm text-xs text-gray-500 mb-2">[ TEAM ]</div><div className="text-2xl font-bold mb-1 text-purple-400">{participants.length}</div><div className="fm text-xs text-gray-500">members</div></GC>
      <GC className="p-5 anim-d1"><div className="fm text-xs text-gray-500 mb-2">[ ASSETS ]</div><div className="text-2xl font-bold mb-1">{assets.length}</div><div className="fm text-xs text-gray-500">in scope</div></GC>
      <GC className="p-5 anim-d2"><div className="fm text-xs text-gray-500 mb-2">[ WALLETS ]</div><div className="text-2xl font-bold mb-1 text-fuchsia-400">{wallets.length}</div><div className="fm text-xs text-gray-500">connected</div></GC>
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
  const { org, settings, theme, setTheme, updateSettings, resetSandbox, addLog } = useApp();
  const [tab,setTab] = useState("preferences");
  const [language, setLanguage] = useState(settings?.language || "en");
  useEffect(() => { setLanguage(settings?.language || "en"); }, [settings]);
  const saveLang = async (v) => { setLanguage(v); await updateSettings({ language: v, theme }); addLog({type:"info",message:`Language: ${v.toUpperCase()}`}); };
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

    {tab==="context"&&<GC className="p-6 anim"><SL>ORGANIZATION</SL><div className="space-y-3"><InfoRow label="ORGANIZATION" value={org?.name||"—"}/><InfoRow label="TYPE" value={org?.institution_type||"—"}/><InfoRow label="JURISDICTION" value={org?.jurisdiction||"—"}/><InfoRow label="OBJECTIVE" value={org?.eval_objective||"—"}/></div></GC>}
    {tab==="control"&&<GC className="p-6 anim"><SL>CONTROL POSTURE</SL><div className="space-y-3"><InfoRow label="CONTROL_MODEL" value={(org?.control_model||"threshold")+" Governance"}/><InfoRow label="TRUST" value={org?.trust_environment||"current"}/></div></GC>}
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

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
function AppShell() {
  const { phase, fading, activeView, activeScenario, user, org, threshold, participants, wallets, settings, scenarios, progress } = useApp();
  const qsScore = computeQSafety({ org, threshold, participants, wallets, settings, scenarios, progress });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const views = { hub:<EvaluationHub/>, "scenario-detail":<ScenarioDetail/>, overview:<EvalOverview/>, assets:<AssetBoundary/>, "import-bank":<ImportBank/>, movement:<GovernedMovement/>, team:<Team/>, evidence:<EvidenceViewer/>, "how-it-works":<HowItWorks/>, support:<Support/>, billing:<Billing/>, settings:<SettingsPage/> };

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
  return (<AppProvider><AppShell/></AppProvider>);
}
