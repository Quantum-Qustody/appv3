import "./index.css";
import React, { lazy, Suspense, useState } from "react";
import ReactDOM from "react-dom/client";
import Site from "./site/Site.jsx";

// The platform (sandbox) is a separate chunk: wallet SDKs, ethers and the
// Supabase client only load when someone actually enters it.
const App = lazy(() => import("./App.jsx"));

// Read the persisted Supabase session without loading supabase-js.
function storedSession() {
  try {
    const key = Object.keys(localStorage).find((k) => /^sb-.+-auth-token$/.test(k));
    if (!key) return null;
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return v?.user ? v : v?.currentSession?.user ? v.currentSession : null;
  } catch { return null; }
}

// Decide where a visitor starts. Returns null for the public site, or the
// platform phase to boot into.
function initialRoute() {
  const path = window.location.pathname;
  const search = window.location.search;
  const hash = window.location.hash;
  // Public-only routes always render the site.
  if (/^\/(research|brand|design-partner)(\/|$)/.test(path)) return null;
  // Auth redirects (magic link, recovery, invite acceptance) need the platform.
  if (/access_token=|type=recovery|type=invite|type=signup|error_description=/.test(hash + search)) return "boot";
  if (new URLSearchParams(search).has("invite")) return "auth";
  // Returning sandbox users go straight back in, as before. Design partners
  // signed in to the intake are not sandbox users, so they stay on the site.
  const s = storedSession();
  if (s && s.user?.app_metadata?.role !== "design_partner") return "boot";
  return null;
}

const Loading = () => (
  <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
    Loading sandbox…
  </div>
);

function Root() {
  const [platform, setPlatform] = useState(initialRoute);
  // Paper for the public site, ink for the platform (see index.css).
  document.documentElement.setAttribute("data-surface", platform ? "app" : "site");

  if (platform) {
    return (
      <Suspense fallback={<Loading />}>
        <App
          initialPhase={platform}
          onHome={() => {
            if (window.location.pathname !== "/") window.history.pushState({}, "", "/");
            setPlatform(null);
            window.scrollTo({ top: 0 });
          }}
        />
      </Suspense>
    );
  }
  return (
    <Site
      enterPlatform={(phase) => {
        // The sandbox lives at "/", so a refresh after sign-in returns to it.
        if (window.location.pathname !== "/") window.history.pushState({}, "", "/" + window.location.search);
        setPlatform(phase || "auth");
        window.scrollTo({ top: 0 });
      }}
    />
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode><Root /></React.StrictMode>);
