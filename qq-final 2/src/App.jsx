import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { createClient } from "@supabase/supabase-js";

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
  const [evidenceStore, setEvidenceStore] = useState({});
  const [activeScenario, setActiveScenario] = useState(null);
  const [phase, setPhase] = useState("landing");
  const [activeView, setActiveView] = useState("hub");
  const [fading, setFading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

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

  // ── Auth state listener ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: authSession } }) => {
      if (authSession?.user) {
        setUser(authSession.user);
        loadActiveSession(authSession.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, authSession) => {
      setUser(authSession?.user ?? null);
      if (!authSession?.user) {
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
    const [partsRes, astRes, progRes, logsRes, moveRes, evRes] = await Promise.all([
      supabase.from("participants").select("*").eq("org_id", orgId),
      supabase.from("assets").select("*").eq("org_id", orgId),
      supabase.from("scenario_progress").select("*").eq("session_id", sessionId),
      supabase.from("audit_logs").select("*").eq("session_id", sessionId).order("created_at", { ascending: false }).limit(100),
      supabase.from("movement_requests").select("*").eq("session_id", sessionId),
      supabase.from("evidence_outputs").select("*, evidence_sections(*)").eq("session_id", sessionId),
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

    const evMap = {};
    (evRes.data || []).forEach(e => { evMap[e.scenario_id] = { ...e, sections: (e.evidence_sections || []).sort((a, b) => a.sort_order - b.sort_order) }; });
    setEvidenceStore(evMap);
  };

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

    return () => {
      supabase.removeChannel(auditChannel);
      supabase.removeChannel(progressChannel);
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
      if (mv) setMovements(prev => ({ ...prev, [scenarioId]: mv }));
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
      user, org, session, participants, assets, scenarios, progress, logs, movements, evidenceStore,
      activeScenario, phase, activeView, fading, loading, authError,
      go, setActiveView, setActiveScenario, addLog,
      signIn, signOut, createSession, startScenario, advanceStep, generateEvidence, completeScenario, resetSandbox,
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
};

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
        <div className="text-center mb-8"><span className="font-bold text-xl tracking-tight">QUANTUM_QUSTODY</span><span className="text-purple-500 fm" style={{animation:"pulse 2s infinite"}}> _</span><div className="mt-2"><Badge c="fuchsia">SANDBOX</Badge></div></div>
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
  return (
    <div className="min-h-screen">
      <nav className="fixed top-0 w-full z-50 p-4"><div className="max-w-7xl mx-auto glass rounded-sm flex justify-between items-center px-6 py-3"><div className="flex items-center gap-3"><span className="font-bold text-lg tracking-tight">QUANTUM_QUSTODY</span><span className="text-purple-500 fm" style={{animation:"pulse 2s infinite"}}>_</span><Badge c="fuchsia">SANDBOX</Badge></div><div className="hidden md:flex gap-6 text-sm text-gray-400 fm"><a href="#scenarios" className="hover:text-purple-400 transition-colors">[ SCENARIOS ]</a></div><button onClick={enter} className="bg-purple-500/10 border border-purple-500/50 text-purple-400 px-4 py-2 text-sm fm hover:bg-purple-500/20 transition-all cursor-pointer">ACCESS SANDBOX</button></div></nav>
      <section className="pt-48 pb-24 px-4 flex flex-col items-center justify-center text-center relative">
        <div className="absolute inset-0 pointer-events-none" style={{background:"radial-gradient(circle at center,rgba(168,85,247,.1) 0%,transparent 50%)"}}/>
        <div className="glass px-4 py-1.5 rounded-full mb-8 fm text-xs text-purple-400 flex items-center gap-2 anim"><span className="w-2 h-2 rounded-full bg-purple-500" style={{animation:"pulse 2s infinite"}}/>MVP ALPHA SANDBOX</div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-tight anim-d1">Institutional Control.<br/><span className="tg">Defensible Evidence.</span></h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl fm mb-10 leading-relaxed anim-d2">Governed movement, policy enforcement, selective verification, and crypto-agile evidence.</p>
        <div className="flex flex-col sm:flex-row gap-4 anim-d3"><button onClick={enter} className="bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white px-8 py-4 fm font-bold hover:from-purple-500 hover:to-fuchsia-500 transition-colors glow cursor-pointer">ENTER SANDBOX</button></div>
      </section>
      <div className="w-full border-y border-purple-500/20 py-4" style={{background:"rgba(3,4,11,.8)"}}><div className="flex justify-center gap-8 md:gap-16 px-8 max-w-7xl mx-auto fm text-sm"><div className="flex gap-2"><span className="text-gray-500">[MODE]:</span><span className="text-fuchsia-400">SANDBOX</span></div><div className="flex gap-2"><span className="text-gray-500">[SCENARIOS]:</span><span className="text-white">5</span></div><div className="flex gap-2"><span className="text-gray-500">[AUTH]:</span><span className="text-emerald-400">SUPABASE</span></div><div className="flex gap-2"><span className="text-gray-500">[DB]:</span><span className="text-purple-400">PERSISTENT</span></div></div></div>
      <section id="scenarios" className="py-24 px-4" style={{background:"linear-gradient(to bottom,transparent,rgba(88,28,135,.08))"}}><div className="max-w-7xl mx-auto"><h2 className="text-center text-sm fm text-purple-500 tracking-widest mb-4">[ SANDBOX SCENARIOS ]</h2><h3 className="text-center text-3xl font-bold mb-12">Five Questions That Matter</h3><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{scenarios.map(s=><div key={s.id} className="glass p-6 hover:-translate-y-2 transition-transform duration-300" style={{borderTop:`2px solid ${s.color==="purple"?"rgba(168,85,247,.5)":s.color==="fuchsia"?"rgba(217,70,239,.5)":"rgba(99,102,241,.5)"}`}}><div className="flex items-center gap-2 mb-3"><Badge c={s.tier===1?"green":"yellow"}>TIER {s.tier}</Badge></div><h4 className="font-bold text-sm mb-3">{s.title}</h4><p className="text-xs fm text-gray-400">{s.question}</p></div>)}</div></div></section>
      <section className="py-24 px-4 max-w-3xl mx-auto"><h2 className="text-2xl font-bold mb-8 text-center">Evaluation Questions</h2><div className="space-y-4"><FAQ q="What is the sandbox?" a="A bounded institutional evaluation environment demonstrating governed movement, policy enforcement, evidence generation, selective verification, and crypto-agility."/><FAQ q="Is data persistent?" a="Yes. Your sandbox session, scenario progress, audit logs, and evidence outputs are stored in Supabase and persist across sessions."/></div></section>
      <footer className="border-t border-purple-500/20 bg-black py-12 px-6"><div className="max-w-7xl mx-auto flex justify-between items-center fm text-xs text-gray-600"><div className="flex items-center gap-2"><span className="font-bold text-white text-sm">QUANTUM_QUSTODY</span><Badge c="fuchsia">SANDBOX</Badge></div><div>© 2026 MVP ALPHA</div></div></footer>
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
      <div className="w-full max-w-2xl anim"><div className="text-center mb-10"><span className="font-bold text-xl tracking-tight">QUANTUM_QUSTODY</span><span className="text-purple-500 fm" style={{animation:"pulse 2s infinite"}}> _</span><h1 className="text-3xl font-bold mb-2 mt-4">Sandbox Setup</h1><p className="fm text-sm text-gray-500">CONFIGURE EVALUATION ENVIRONMENT</p></div>
        <div className="flex items-center justify-center gap-1 mb-10">{steps.map((s,i)=><div key={i} className="flex items-center"><div className={`flex items-center gap-2 px-3 py-1.5 fm text-xs transition-all ${i===step?"text-purple-400 bg-purple-500/10 border border-purple-500/30":i<step?"text-emerald-400":"text-gray-600"}`}><span>{i<step?"✓":s.n}</span><span className="hidden sm:inline">{s.l}</span></div>{i<3&&<div className={`w-8 h-px mx-1 ${i<step?"bg-emerald-500/50":"bg-gray-800"}`}/>}</div>)}</div>
        <GC className="p-8">
          {step===0&&<div className="space-y-5 anim" key="s0"><SL>ORGANIZATION CONTEXT</SL><div><label className="fm text-xs text-gray-500 mb-2 block">ORGANIZATION *</label><input placeholder="Institution name" value={f.orgName} onChange={e=>u("orgName",e.target.value)}/></div><div className="grid grid-cols-2 gap-4"><div><label className="fm text-xs text-gray-500 mb-2 block">INSTITUTION_TYPE</label><select value={f.instType} onChange={e=>u("instType",e.target.value)}><option value="">Select...</option><option>Asset Manager</option><option>Bank / Custodian</option><option>Fund</option><option>Corporate Treasury</option></select></div><div><label className="fm text-xs text-gray-500 mb-2 block">JURISDICTION</label><select value={f.jurisdiction} onChange={e=>u("jurisdiction",e.target.value)}><option value="">Select...</option><option>United States</option><option>European Union</option><option>United Kingdom</option><option>Singapore</option></select></div></div><div><label className="fm text-xs text-gray-500 mb-2 block">EVALUATION_OBJECTIVE</label><input placeholder="e.g., Assess governed treasury controls" value={f.evalObjective} onChange={e=>u("evalObjective",e.target.value)}/></div></div>}
          {step===1&&<div className="space-y-5 anim" key="s1"><SL>ROLES & ACCESS</SL><p className="fm text-xs text-gray-400 mb-4">5 institutional governance functions will be created when you launch.</p><div className="space-y-2">{[["Alexandra Chen","Treasury / Operations","Requester","AC"],["Marcus Webb","Risk Management","Approver","MW"],["Diana Frost","Compliance","Reviewer","DF"],["Raj Patel","Audit / Internal Audit","Oversight","RP"],["Sarah Liu","Finance","Observer","SL"]].map(([n,fn,r,ini])=><div key={n} className="flex items-center justify-between p-3 bg-black/30 border border-gray-800/50"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-xs font-bold">{ini}</div><div><div className="text-sm font-bold">{n}</div><div className="fm text-xs text-gray-500">{fn}</div></div></div><Badge c="purple">{r.toUpperCase()}</Badge></div>)}</div></div>}
          {step===2&&<div className="space-y-5 anim" key="s2"><SL>CONTROL POSTURE</SL><div><label className="fm text-xs text-gray-500 mb-3 block">CONTROL_MODEL</label><div className="grid grid-cols-3 gap-3">{[{id:"single",l:"Single",d:"One approver"},{id:"threshold",l:"Threshold",d:"Multi-approval"},{id:"committee",l:"Committee",d:"Full governance"}].map(o=><div key={o.id} onClick={()=>u("controlModel",o.id)} className={`p-4 cursor-pointer border transition-all ${f.controlModel===o.id?"border-purple-500 bg-purple-500/10 text-white":"border-gray-800 bg-gray-900/30 text-gray-500 hover:border-gray-700"}`}><div className="fm text-sm font-bold mb-1">{o.l}</div><div className="text-xs">{o.d}</div></div>)}</div></div><div><label className="fm text-xs text-gray-500 mb-3 block">TRUST_ENVIRONMENT</label><div className="grid grid-cols-2 gap-3">{[{id:"current",l:"Current Trust",d:"Standard crypto"},{id:"pqc",l:"PQC Target",d:"Post-quantum view"}].map(o=><div key={o.id} onClick={()=>u("trustEnv",o.id)} className={`p-4 cursor-pointer border transition-all ${f.trustEnv===o.id?"border-fuchsia-500 bg-fuchsia-500/10 text-white":"border-gray-800 bg-gray-900/30 text-gray-500 hover:border-gray-700"}`}><div className="fm text-sm font-bold mb-1">{o.l}</div><div className="text-xs">{o.d}</div></div>)}</div></div></div>}
          {step===3&&<div className="space-y-5 anim" key="s3"><SL>LAUNCH SANDBOX</SL><div className="text-center py-4"><div className="inline-block p-4 rounded-full bg-purple-500/10 border border-purple-500/30 mb-4"><Shld/></div><h3 className="text-xl font-bold mb-2">Ready to Launch</h3><p className="fm text-sm text-gray-500">Session will be persisted to Supabase.</p></div><div className="space-y-2 p-4 bg-black/40 border border-gray-800 fm text-xs"><div className="flex justify-between"><span className="text-gray-500">ORG:</span><span>{f.orgName||"—"}</span></div><div className="flex justify-between"><span className="text-gray-500">CONTROL:</span><span className="text-purple-400">{f.controlModel.toUpperCase()}</span></div><div className="flex justify-between"><span className="text-gray-500">TRUST:</span><span className="text-fuchsia-400">{f.trustEnv==="pqc"?"PQC TARGET":"CURRENT"}</span></div><div className="flex justify-between"><span className="text-gray-500">BACKEND:</span><span className="text-emerald-400">SUPABASE LIVE</span></div></div></div>}
          <div className="flex justify-between mt-8 pt-6 border-t border-purple-500/10"><Btn v="ghost" onClick={()=>step>0&&setStep(step-1)} disabled={step===0||loading}>BACK</Btn><Btn onClick={next} disabled={loading||(step===0&&!f.orgName)}>{loading?"LAUNCHING...":step===3?"LAUNCH_SANDBOX":"CONTINUE"} <Arr/></Btn></div>
        </GC></div></div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════════
const SideNav = () => {
  const { activeView, setActiveView, signOut, user } = useApp();
  const nav=[{id:"hub",l:"EVALUATION HUB",i:sIcons.hub},{id:"overview",l:"EVAL OVERVIEW",i:sIcons.overview},{id:"assets",l:"ASSET BOUNDARY",i:sIcons.assets},{id:"movement",l:"GOVERNED MOVEMENT",i:sIcons.movement},{id:"participants",l:"PARTICIPANTS",i:sIcons.participants},{id:"evidence",l:"EVIDENCE VIEWER",i:sIcons.evidence},{id:"config",l:"EVAL CONFIG",i:sIcons.config}];
  return (<div className="w-56 flex-shrink-0 border-r border-purple-500/20 flex flex-col" style={{height:"calc(100vh - 56px)",background:"rgba(5,2,15,.5)"}}><div className="p-4 space-y-1 flex-1">{nav.map(n=><button key={n.id} onClick={()=>setActiveView(n.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 fm text-xs transition-all cursor-pointer ${activeView===n.id?"text-purple-400 bg-purple-500/10 border-l-2 border-purple-500":"text-gray-500 hover:text-gray-300 hover:bg-white/5 border-l-2 border-transparent"}`}>{n.i}{n.l}</button>)}</div><div className="p-4 border-t border-purple-500/10 space-y-2"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-xs font-bold">{(user?.email||"U")[0].toUpperCase()}</div><div className="fm text-xs text-gray-400 truncate">{user?.email}</div></div><button onClick={signOut} className="w-full fm text-xs text-gray-600 hover:text-red-400 transition-colors cursor-pointer text-left px-1 py-1">← EXIT_SANDBOX</button></div></div>);
};

// ═══════════════════════════════════════════════════════════════════
// EVALUATION HUB
// ═══════════════════════════════════════════════════════════════════
const EvaluationHub = () => {
  const { scenarios, progress, org, startScenario, setActiveView, addLog } = useApp();
  const start = async (s) => { await startScenario(s.id); setActiveView("scenario-detail"); };
  return (<div className="p-6 space-y-6 overflow-y-auto flex-1">
    <div className="anim"><h2 className="text-2xl font-bold mb-1">Evaluation Hub</h2><p className="fm text-sm text-gray-500">YOUR SANDBOX IS CONFIGURED AND READY</p></div>
    <GC className="p-5 anim-d1"><SL>ENVIRONMENT</SL><div className="grid grid-cols-2 md:grid-cols-4 gap-4"><div><div className="fm text-xs text-gray-500 mb-1">ORG</div><div className="text-sm font-bold">{org?.name||"—"}</div></div><div><div className="fm text-xs text-gray-500 mb-1">TYPE</div><div className="text-sm font-bold">{org?.institution_type||"—"}</div></div><div><div className="fm text-xs text-gray-500 mb-1">CONTROL</div><div className="text-sm font-bold text-purple-400">{(org?.control_model||"threshold").toUpperCase()}</div></div><div><div className="fm text-xs text-gray-500 mb-1">BACKEND</div><div className="text-sm font-bold text-emerald-400">LIVE</div></div></div></GC>
    {scenarios[0]&&<GC className="p-5 anim-d2" style={{borderTop:"2px solid rgba(168,85,247,.4)"}}><div className="flex items-center gap-2 mb-3"><Badge c="green">RECOMMENDED</Badge></div><h3 className="font-bold text-lg mb-2">{scenarios[0].title}</h3><p className="fm text-xs text-gray-400 mb-3">{scenarios[0].question}</p><div className="flex flex-wrap gap-2 mb-4">{scenarios[0].evidence_types.map((e,i)=><Badge key={i} c="purple">{e}</Badge>)}</div><Btn onClick={()=>start(scenarios[0])}>START_RECOMMENDED <Arr/></Btn></GC>}
    <SL>ALL SCENARIOS</SL>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{scenarios.map((s,i)=>{const pg=progress[s.id]; return <GC key={s.id} hover className={`p-5 anim-d${Math.min(i,3)+1}`} style={{borderLeft:`3px solid ${s.color==="purple"?"#a855f7":s.color==="fuchsia"?"#d946ef":"#818cf8"}`}} onClick={()=>start(s)}><div className="flex items-center gap-2 mb-2"><Badge c={s.tier===1?"green":"yellow"}>TIER {s.tier}</Badge><span className="fm text-xs text-gray-600">{s.num}</span>{pg?.status==="completed"&&<Badge c="green">DONE</Badge>}{pg?.status==="in_progress"&&<Badge c="yellow">IN PROGRESS</Badge>}</div><h4 className="font-bold text-sm mb-2">{s.title}</h4><p className="fm text-xs text-gray-500 leading-relaxed mb-2">{s.question}</p><div className="fm text-xs text-gray-600">Uses: {s.screens.join(" → ")}</div></GC>})}</div>
    <GC className="p-5 anim-d4"><SL>STAGE HONESTY</SL><div className="grid grid-cols-2 md:grid-cols-4 gap-4 fm text-xs"><div><div className="flex items-center gap-2 mb-2"><span className="w-2 h-2 rounded-full bg-emerald-400"/><span className="text-emerald-400">Live</span></div><div className="text-gray-500">Governance, policy, evidence, audit, persistent state</div></div><div><div className="flex items-center gap-2 mb-2"><span className="w-2 h-2 rounded-full bg-yellow-400"/><span className="text-yellow-400">Simulated</span></div><div className="text-gray-500">Signing, settlement, on-chain</div></div><div><div className="flex items-center gap-2 mb-2"><span className="w-2 h-2 rounded-full bg-blue-400"/><span className="text-blue-400">Workshop</span></div><div className="text-gray-500">Custom policy, integration</div></div><div><div className="flex items-center gap-2 mb-2"><span className="w-2 h-2 rounded-full bg-gray-500"/><span className="text-gray-400">Roadmap</span></div><div className="text-gray-500">Full PQC, production HSM</div></div></div></GC>
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
  const { assets, addLog, setActiveView } = useApp();
  return (<div className="p-6 space-y-6 overflow-y-auto flex-1"><div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold mb-1">Asset Boundary</h2><p className="fm text-sm text-gray-500">IN-SCOPE ASSETS</p></div><Btn onClick={()=>addLog({type:"info",message:"Add in-scope asset"})}>ADD_IN_SCOPE_ASSET</Btn></div>
    <div className="space-y-3">{assets.map((a,i)=><GC key={a.id} hover className={`p-5 flex items-center justify-between anim-d${Math.min(i,3)+1}`} onClick={()=>{addLog({type:"info",message:`Asset selected: ${a.name}`,detail:`BOUNDARY: ${a.boundary_tag}`});setActiveView("movement")}}><div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-full flex items-center justify-center fm text-xs font-bold ${a.scope==="in-scope"?"bg-gradient-to-br from-purple-500/30 to-fuchsia-500/30 text-purple-300":"bg-gray-800/50 text-gray-500"}`}>{a.chain?.slice(0,3).toUpperCase()}</div><div><div className="font-bold">{a.name}</div><div className="fm text-xs text-gray-500">{a.chain} · {a.control_model}</div><div className="fm text-xs text-gray-600 mt-0.5">{a.evidence_path}</div></div></div><div className="flex items-center gap-3"><div className="text-right"><div className="fm text-sm font-bold">{a.balance}</div><div className="fm text-xs text-gray-500">{a.balance_usd}</div></div><Badge c={a.scope==="in-scope"?"green":"yellow"}>{a.scope?.toUpperCase()}</Badge><Badge c="purple">{a.boundary_tag?.toUpperCase()}</Badge></div></GC>)}</div>
    {assets.length===0 && <GC className="p-6 text-center"><p className="fm text-sm text-gray-500">No assets configured yet.</p></GC>}
  </div>);
};

// ═══════════════════════════════════════════════════════════════════
// GOVERNED MOVEMENT
// ═══════════════════════════════════════════════════════════════════
const GovernedMovement = () => {
  const { activeScenario, progress, assets, participants, advanceStep, generateEvidence, setActiveView, addLog } = useApp();
  const scId = activeScenario?.id;
  const pg = scId ? progress[scId] : null;
  const step = pg?.current_step || "request";
  const [fd,setFd]=useState({from:"",amount:"",asset:"ETH"});
  const up=(k,v)=>setFd(p=>({...p,[k]:v}));
  const isBlocked = scId === "s2";

  const advance = async (stepData={}) => {
    if(!scId) return;
    const result = await advanceStep(scId, step, stepData);
    if(result?.next_step==="complete") await generateEvidence(scId);
  };

  return (<div className="p-6 space-y-6 overflow-y-auto flex-1"><div><h2 className="text-2xl font-bold mb-1">Governed Movement</h2><p className="fm text-sm text-gray-500">REQUEST → GOVERNANCE → EXECUTION</p></div>
    {activeScenario&&<GC className="p-4 anim" style={{borderLeft:"3px solid #a855f7"}}><div className="flex items-center gap-3 fm text-xs"><Badge c="purple">SCENARIO {activeScenario.num}</Badge><span className="text-gray-400">{activeScenario.title}</span><span className="text-gray-600">|</span><span className="text-purple-400 font-bold">{step.toUpperCase()}</span>{isBlocked&&<Badge c="red">BLOCKED PATH</Badge>}</div><div className="fm text-xs text-gray-600 mt-1">Policy: Treasury Movement Policy v2.1 · Actor: {step==="request"?"Treasury / Operations":step==="policy"?"System":"Risk Management"}</div></GC>}
    <div className="flex gap-2 anim-d1">{["request","policy","approval","execution"].map((s,i)=><div key={s} className={`flex items-center gap-1 px-3 py-1.5 fm text-xs ${step===s?"text-purple-400 bg-purple-500/10 border border-purple-500/30":i<["request","policy","approval","execution"].indexOf(step)?"text-emerald-400":"text-gray-600"}`}>{i<["request","policy","approval","execution"].indexOf(step)?"✓":String(i+1).padStart(2,"0")} {s.toUpperCase()}</div>)}</div>
    {step==="request"&&<GC className="p-6 anim max-w-xl"><SL>SUBMIT REQUEST</SL><div className="space-y-5"><div><label className="fm text-xs text-gray-500 mb-2 block">FROM_ASSET</label><select value={fd.from} onChange={e=>up("from",e.target.value)}><option value="">Select in-scope asset...</option>{assets.filter(a=>a.scope==="in-scope").map(a=><option key={a.id} value={a.id}>{a.name} — {a.balance}</option>)}</select></div><div className="grid grid-cols-2 gap-4"><div><label className="fm text-xs text-gray-500 mb-2 block">AMOUNT</label><input type="number" placeholder="0.00" value={fd.amount} onChange={e=>up("amount",e.target.value)}/></div><div><label className="fm text-xs text-gray-500 mb-2 block">ASSET</label><select value={fd.asset} onChange={e=>up("asset",e.target.value)}><option>ETH</option><option>BTC</option><option>USDC</option></select></div></div><Btn full onClick={()=>advance({amount:fd.amount,asset:fd.asset})}>SUBMIT_REQUEST <Arr/></Btn></div></GC>}
    {step==="policy"&&<GC className="p-6 anim max-w-xl"><SL>POLICY APPLICATION</SL><div className="space-y-4"><InfoRow label="POLICY_IN_FORCE" value="Treasury Movement Policy v2.1"/><InfoRow label="ACTING_FUNCTION" value="Treasury / Operations"/><InfoRow label="OUTCOME" badge={isBlocked?{t:"BLOCKED",c:"red"}:{t:"PASSED",c:"green"}}/>{isBlocked&&<div className="p-4 bg-red-500/5 border border-red-500/20 fm text-xs text-red-300">Policy conflict detected. Exception trail being generated.</div>}<Btn full onClick={()=>advance()}>{isBlocked?"VIEW_EXCEPTION":"VIEW_POLICY_PATH"} <Arr/></Btn></div></GC>}
    {step==="approval"&&<GC className="p-6 anim max-w-xl"><SL>THRESHOLD APPROVAL</SL><div className="space-y-4">{participants.filter(p=>["Approver","Reviewer"].includes(p.scenario_role)).map(p=><div key={p.id} className="flex items-center justify-between p-3 bg-black/30 border border-gray-800/50"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-xs font-bold">{p.initials}</div><div><div className="text-sm font-bold">{p.name}</div><div className="fm text-xs text-gray-500">{p.institution_fn}</div></div></div><Badge c="green">APPROVED</Badge></div>)}<InfoRow label="THRESHOLD" value="2 of 2 — Met"/><Btn full onClick={()=>advance()}>ADVANCE_TO_EXECUTION <Arr/></Btn></div></GC>}
    {step==="execution"&&<GC className="p-6 anim max-w-xl"><SL>{isBlocked?"BLOCKED OUTCOME":"EXECUTION"}</SL><div className="space-y-4"><div className="text-center py-4"><div className={`inline-block p-4 rounded-full mb-4 ${isBlocked?"bg-red-500/10 border border-red-500/30":"bg-emerald-500/10 border border-emerald-500/30"}`}>{isBlocked?<Blk/>:<Chk/>}</div><h3 className="text-xl font-bold mb-2">{isBlocked?"Movement Blocked":"Movement Executed"}</h3></div><Btn full onClick={()=>advance()}>COMPLETE <Arr/></Btn></div></GC>}
    {step==="complete"&&<GC className="p-6 anim max-w-xl"><div className="text-center py-4"><div className="inline-block p-4 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-4"><Chk/></div><h3 className="text-xl font-bold mb-2">Scenario Flow Complete</h3></div><div className="flex gap-3 justify-center"><Btn onClick={()=>setActiveView("evidence")}>VIEW_EVIDENCE</Btn></div></GC>}
    {!scId&&<GC className="p-6 anim"><div className="text-center py-8"><p className="fm text-sm text-gray-500 mb-4">No active scenario. Start one from the Evaluation Hub.</p><Btn v="secondary" onClick={()=>setActiveView("hub")}>GO_TO_HUB</Btn></div></GC>}
  </div>);
};

// ═══════════════════════════════════════════════════════════════════
// PARTICIPANTS
// ═══════════════════════════════════════════════════════════════════
const GovParticipants = () => {
  const { participants } = useApp();
  return (<div className="p-6 space-y-6 overflow-y-auto flex-1"><div><h2 className="text-2xl font-bold mb-1">Governance Participants</h2><p className="fm text-sm text-gray-500">FUNCTIONS · AUTHORITY · OVERSIGHT</p></div>
    <div className="space-y-3">{participants.map((p,i)=><GC key={p.id} hover className={`p-5 flex items-center justify-between anim-d${Math.min(i,3)+1}`}><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center font-bold text-sm">{p.initials}</div><div><div className="font-bold">{p.name}</div><div className="fm text-xs text-gray-500">{p.institution_fn}</div></div></div><div className="flex items-center gap-3"><Badge c="purple">{p.scenario_role?.toUpperCase()}</Badge><Badge c={p.status==="active"?"green":"yellow"}>{p.status?.toUpperCase()}</Badge></div></GC>)}</div>
  </div>);
};

// ═══════════════════════════════════════════════════════════════════
// EVIDENCE VIEWER
// ═══════════════════════════════════════════════════════════════════
const EvidenceViewer = () => {
  const { activeScenario, evidenceStore, generateEvidence, addLog, setActiveView } = useApp();
  const scId = activeScenario?.id;
  const ev = scId ? evidenceStore[scId] : null;
  const [tab, setTab] = useState(0);

  useEffect(()=>{setTab(0)},[scId]);
  useEffect(()=>{ if(scId && !ev) generateEvidence(scId); },[scId]);

  const sections = ev?.sections || [];
  const activeSection = sections[tab];

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

  return (<div className="p-6 space-y-6 overflow-y-auto flex-1"><div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold mb-1">Evidence Viewer</h2><p className="fm text-sm text-gray-500">INSTITUTIONALLY LEGIBLE EVIDENCE</p></div><Btn v="secondary" onClick={()=>addLog({type:"evidence",message:"Evidence PDF downloaded"})}><Dl/> DOWNLOAD_PDF</Btn></div>
    {activeScenario&&<GC className="p-4 anim" style={{borderLeft:"3px solid #3b82f6"}}><div className="flex items-center gap-3 fm text-xs"><Badge c="blue">EVIDENCE</Badge><span className="text-gray-400">Scenario {activeScenario.num}: {activeScenario.title}</span></div></GC>}
    {sections.length>0&&<><div className="flex gap-2 flex-wrap anim-d1">{sections.map((s,i)=><button key={i} onClick={()=>{setTab(i);addLog({type:"info",message:`Evidence: ${s.title}`})}} className={`px-4 py-2 fm text-xs cursor-pointer transition-all ${tab===i?"text-purple-400 bg-purple-500/10 border border-purple-500/40":"text-gray-500 hover:text-gray-300 border border-transparent"}`}>{s.title}{!s.disclosed&&" 🔒"}</button>)}</div>
      <GC className="p-6 anim-d2"><SL>{activeSection?.title?.toUpperCase()||"EVIDENCE"}</SL>{!activeSection?.disclosed&&<div className="mb-4 p-3 bg-purple-500/5 border border-purple-500/20 fm text-xs text-purple-300">SELECTIVE VERIFICATION: This section demonstrates what can be verified without full data disclosure.</div>}{activeSection&&renderContent(activeSection.content)}</GC></>}
    {sections.length===0&&<GC className="p-6 anim"><div className="text-center py-8"><p className="fm text-sm text-gray-500 mb-4">{scId?"Generating evidence...":"No scenario selected."}</p><Btn v="secondary" onClick={()=>setActiveView("hub")}>GO_TO_HUB</Btn></div></GC>}
    <div className="flex gap-3 anim-d3"><Btn v="ghost" onClick={()=>setActiveView("hub")}>RETURN_TO_HUB</Btn></div>
  </div>);
};

// ═══════════════════════════════════════════════════════════════════
// EVAL OVERVIEW
// ═══════════════════════════════════════════════════════════════════
const EvalOverview = () => {
  const { activeScenario, progress, setActiveView } = useApp();
  const completed = Object.values(progress).filter(p=>p.status==="completed").length;
  return (<div className="p-6 space-y-6 overflow-y-auto flex-1"><div><h2 className="text-2xl font-bold mb-1 anim">Evaluation Overview</h2><p className="fm text-sm text-gray-500 anim-d1">ACTIVE SANDBOX EVALUATION</p></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <GC className="p-5 anim"><div className="fm text-xs text-gray-500 mb-2">[ SCENARIOS ]</div><div className="text-2xl font-bold mb-1">{completed}/5</div><div className="fm text-xs text-gray-500">completed</div></GC>
      <GC className="p-5 anim-d1"><div className="fm text-xs text-gray-500 mb-2">[ ACTIVE ]</div><div className="text-lg font-bold mb-1">{activeScenario?activeScenario.num:"None"}</div></GC>
      <GC className="p-5 anim-d2"><div className="fm text-xs text-gray-500 mb-2">[ EVIDENCE ]</div><div className="text-lg font-bold mb-1 text-emerald-400">Available</div></GC>
      <GC className="p-5 anim-d3"><div className="fm text-xs text-gray-500 mb-2">[ BACKEND ]</div><div className="text-lg font-bold mb-1 text-fuchsia-400">Live</div></GC>
    </div>
    <div className="flex gap-3"><Btn v="secondary" onClick={()=>setActiveView("hub")}>RETURN_TO_HUB</Btn></div>
  </div>);
};

// ═══════════════════════════════════════════════════════════════════
// EVAL CONFIG
// ═══════════════════════════════════════════════════════════════════
const EvalConfig = () => {
  const { org, resetSandbox } = useApp();
  const [tab,setTab]=useState("context");
  return (<div className="p-6 space-y-6 overflow-y-auto flex-1"><div><h2 className="text-2xl font-bold mb-1">Evaluation Configuration</h2><p className="fm text-sm text-gray-500">CONTEXT · CONTROL POSTURE · EVIDENCE & ASSURANCE</p></div>
    <div className="flex gap-2">{[{id:"context",l:"Context"},{id:"control",l:"Control Posture"},{id:"evidence",l:"Evidence & Assurance"}].map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={`px-4 py-2 fm text-xs cursor-pointer transition-all ${tab===t.id?"text-purple-400 bg-purple-500/10 border border-purple-500/40":"text-gray-500 hover:text-gray-300 border border-transparent"}`}>{t.l}</button>)}</div>
    {tab==="context"&&<GC className="p-6 anim"><SL>ORGANIZATION</SL><div className="space-y-3"><InfoRow label="ORGANIZATION" value={org?.name||"—"}/><InfoRow label="TYPE" value={org?.institution_type||"—"}/><InfoRow label="JURISDICTION" value={org?.jurisdiction||"—"}/><InfoRow label="OBJECTIVE" value={org?.eval_objective||"—"}/></div></GC>}
    {tab==="control"&&<GC className="p-6 anim"><SL>CONTROL POSTURE</SL><div className="space-y-3"><InfoRow label="CONTROL_MODEL" value={(org?.control_model||"threshold")+" Governance"}/><InfoRow label="TRUST" value={org?.trust_environment||"current"}/></div></GC>}
    {tab==="evidence"&&<GC className="p-6 anim"><SL>EVIDENCE & ASSURANCE</SL><div className="space-y-3"><InfoRow label="EVIDENCE_VIEWS" badge={{t:"AVAILABLE",c:"green"}}/><InfoRow label="SELECTIVE_VERIFICATION" badge={{t:"VIEW AVAILABLE",c:"fuchsia"}}/><InfoRow label="PQC_CRYPTO_AGILITY" badge={{t:"VIEW AVAILABLE",c:"purple"}}/></div></GC>}
    <GC className="p-5 anim-d2"><SL>SANDBOX STATE</SL><div className="flex items-center justify-between"><div><div className="text-sm font-bold text-yellow-400">Reset Sandbox State</div><div className="fm text-xs text-gray-500">Clear all progress and evidence</div></div><Btn v="danger" onClick={resetSandbox}>RESET_SANDBOX</Btn></div></GC>
  </div>);
};

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
function AppShell() {
  const { phase, fading, activeView, activeScenario, user } = useApp();
  const views = { hub:<EvaluationHub/>, "scenario-detail":<ScenarioDetail/>, overview:<EvalOverview/>, assets:<AssetBoundary/>, movement:<GovernedMovement/>, participants:<GovParticipants/>, evidence:<EvidenceViewer/>, config:<EvalConfig/> };

  return (<div style={{opacity:fading?0:1,transition:"opacity 0.3s ease"}}>
    {phase==="landing"&&<LandingPage/>}
    {phase==="auth"&&<AuthScreen/>}
    {phase==="setup"&&<div className="flex h-screen"><div className="flex-1 overflow-y-auto"><SandboxSetup/></div><div className="hidden lg:block border-l border-purple-500/20" style={{background:"rgba(5,2,15,.5)"}}><AuditLog/></div></div>}
    {phase==="app"&&<div className="flex flex-col h-screen">
      <div className="h-14 border-b border-purple-500/20 flex items-center justify-between px-5 flex-shrink-0" style={{background:"rgba(5,2,15,.8)"}}>
        <div className="flex items-center gap-3"><span className="font-bold tracking-tight">QUANTUM_QUSTODY</span><span className="text-purple-500 fm" style={{animation:"pulse 2s infinite"}}>_</span><Badge c="fuchsia">SANDBOX</Badge>{activeScenario&&<><span className="text-gray-700 ml-2">|</span><span className="fm text-xs text-gray-500 ml-2">SCENARIO {activeScenario.num}</span></>}</div>
        <div className="flex items-center gap-4 fm text-xs"><span className="text-gray-500">USER:</span><span className="text-gray-300">{user?.email}</span><span className="text-gray-700">|</span><span className="text-gray-500">DB:</span><span className="text-emerald-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{animation:"pulse-ring 2s infinite"}}/>CONNECTED</span></div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <SideNav/>
        <div className="flex-1 overflow-hidden flex flex-col">{views[activeView]||views.hub}</div>
        <div className="hidden lg:block border-l border-purple-500/20" style={{background:"rgba(5,2,15,.5)"}}><AuditLog/></div>
      </div>
    </div>}
  </div>);
}

export default function App() {
  return (<AppProvider><AppShell/></AppProvider>);
}
