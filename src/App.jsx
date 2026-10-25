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
  { to: "/dashboard", icon: "⊞", label: "Dashboard" },
  { to: "/patients",  icon: "👤", label: "Pacientes" },
  { to: "/agenda",    icon: "📅", label: "Agenda"    },
  { to: "/billing",   icon: "🧾", label: "Facturas"  },
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

  const email = session.user.email || "";
  const initials = email.substring(0, 2).toUpperCase();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>

      {/* ── TOPBAR horizontal estilo Quixotic ── */}
      <header className="mm-topbar">
        {/* Logo / Brand */}
        <div className="mm-topbar-brand">
          <div className="mm-topbar-brand-icon">🏥</div>
          MicMEDIC
        </div>

        {/* Nav links */}
        <nav className="mm-nav-bar">
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => "mm-nav-link" + (isActive ? " active" : "")}
            >
              <span>{n.icon}</span>
              <span className="label">{n.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Acciones derechas */}
        <div className="mm-topbar-actions">
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{email}</span>
          <button
            onClick={signOut}
            className="mm-btn mm-btn--ghost mm-btn--sm"
          >
            Salir
          </button>
          <div className="mm-avatar" style={{ width: 36, height: 36, fontSize: 13 }}>
            {initials}
          </div>
        </div>
      </header>

      {/* ── CONTENIDO ── */}
      <main>
        <Routes>
          <Route path="/"                        element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"               element={<Dashboard />} />
          <Route path="/patients"                element={<Patients />} />
          <Route path="/patients/:id"            element={<PatientDetail />} />
          <Route path="/visits/:id"              element={<VisitDetail />} />
          <Route path="/visits/:id/prescription" element={<PrescriptionDetail />} />
          <Route path="/agenda"                  element={<Agenda />} />
          <Route path="/billing"                 element={<Billing />} />
          <Route path="*"                        element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}
