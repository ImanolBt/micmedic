import { useState, useEffect } from "react";
import { Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientDetail from "./pages/PatientDetail";
import VisitDetail from "./pages/VisitDetail";
import PrescriptionDetail from "./pages/PrescriptionDetail";
import Agenda from "./pages/Agenda";
import Billing from "./pages/Billing";
import FarmaciaCaja from "./pages/FarmaciaCaja";
import { UIProvider } from "./components/ui/kit";

const NAV = [
  { to: "/dashboard", icon: "📊", label: "Dashboard" },
  { to: "/patients",  icon: "👥", label: "Pacientes" },
  { to: "/agenda",    icon: "📅", label: "Agenda" },
  { to: "/billing",   icon: "💳", label: "Facturación" },
  { to: "/caja",      icon: "🧾", label: "Farmacia & Caja" },
];

export default function App() {
  const [session, setSession] = useState(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--c-bg)" }}>
      <div style={{ fontSize: 13, color: "var(--c-muted)" }}>Cargando…</div>
    </div>
  );

  if (!session) return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );

  const email = session.user?.email ?? "";
  const initials = email.slice(0, 2).toUpperCase();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <>
      <header className="mm-topbar">
        <div className="mm-topbar-brand">
          <div className="mm-topbar-brand-icon">🏥</div>
          MicMEDIC
        </div>

        <nav className="mm-nav-bar">
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => "mm-nav-link" + (isActive ? " active" : "")}
            >
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mm-topbar-actions">
          <span className="mm-topbar-email">{email}</span>
          <button onClick={signOut} className="mm-btn mm-btn--ghost mm-btn--sm">
            Salir
          </button>
          <div className="mm-avatar" style={{ width: 34, height: 34, fontSize: 12 }}>
            {initials}
          </div>
        </div>
      </header>

      <UIProvider>
      <main>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/:id" element={<PatientDetail />} />
          <Route path="/visits/:id" element={<VisitDetail />} />
          <Route path="/visits/:id/prescription" element={<PrescriptionDetail />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/caja" element={<FarmaciaCaja />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
      </UIProvider>
    </>
  );
}
