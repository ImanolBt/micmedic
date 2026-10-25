import { useEffect, useState } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import VisitDetail from "./pages/VisitDetail.jsx";
import PrescriptionDetail from "./pages/PrescriptionDetail.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Patients from "./pages/Patients.jsx";
import PatientDetail from "./pages/PatientDetail.jsx";
import Billing from "./pages/Billing.jsx";
import Agenda from "./pages/Agenda.jsx";

const NAV = [
  { to: "/dashboard", icon: "⊞",  label: "Dashboard"   },
  { to: "/patients",  icon: "👤",  label: "Pacientes"   },
  { to: "/agenda",    icon: "📅",  label: "Agenda"      },
  { to: "/billing",   icon: "🧾",  label: "Facturas"    },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() { await supabase.auth.signOut(); }

  if (loadingSession) return null;
  if (!session) return <Login />;

  const initials = (session.user.email || "?").substring(0, 2).toUpperCase();

  return (
    <div style={{ minHeight: "100vh", background: "var(--mm-bg)" }}>
      {/* ── Topbar ── */}
      <div className="mm-topbar">
        <div className="mm-topbar-brand">
          <span>🏥</span>
          MicMEDIC
        </div>
        <div className="mm-topbar-user">
          <span style={{ fontSize: 12 }}>{session.user.email}</span>
          <button
            onClick={signOut}
            style={{
              padding: "7px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,.18)",
              background: "rgba(255,255,255,.10)",
              color: "white",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Salir
          </button>
          <div className="mm-avatar" style={{ width: 34, height: 34, fontSize: 13 }}>
            {initials}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mm-layout">
        {/* Sidebar */}
        <aside className="mm-sidebar">
          <div style={{ padding: "4px 14px 14px", fontSize: 11, fontWeight: 800,
            textTransform: "uppercase", letterSpacing: ".6px", color: "rgba(255,255,255,.35)" }}>
            Menú
          </div>
          {NAV.map(n => (
            <NavLink key={n.to} className="mm-nav" to={n.to}>
              <span className="mm-nav-icon">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
          <div style={{ flex: 1 }} />
          <button
            onClick={signOut}
            className="mm-nav"
            style={{ color: "rgba(255,80,80,.75)", marginTop: 8 }}
          >
            <span className="mm-nav-icon">⏻</span>
            Cerrar sesión
          </button>
        </aside>

        {/* Main */}
        <main className="mm-main">
          <Routes>
            <Route path="/"                         element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"                element={<Dashboard />} />
            <Route path="/patients"                 element={<Patients />} />
            <Route path="/patients/:id"             element={<PatientDetail />} />
            <Route path="/visits/:id"               element={<VisitDetail />} />
            <Route path="/visits/:id/prescription"  element={<PrescriptionDetail />} />
            <Route path="/agenda"                   element={<Agenda />} />
            <Route path="/billing"                  element={<Billing />} />
            <Route path="*"                         element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
