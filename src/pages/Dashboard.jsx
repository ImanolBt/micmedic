import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const KPI_DEFS = [
  { key: "patients",     label: "Pacientes",         icon: "👥", sub: "Total registrados", color: "var(--c-brand)" },
  { key: "today",        label: "Citas hoy",          icon: "📅", sub: "Programadas",       color: "var(--c-info)" },
  { key: "month",        label: "Consultas mes",      icon: "🩺", sub: "Último período",    color: "var(--c-warn)" },
  { key: "pending",      label: "Facturas pendientes",icon: "💳", sub: "Por cobrar",        color: "var(--c-danger)" },
];

export default function Dashboard() {
  const [kpis, setKpis]       = useState({ patients: "—", today: "—", month: "—", pending: "—" });
  const [visits, setVisits]   = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const today = new Date().toISOString().slice(0, 10);
  const now   = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const load = async () => {
    setLoading(true);
    const [
      { count: patients },
      { count: todayCnt },
      { count: month },
      { count: pending },
      { data: recentVisits },
    ] = await Promise.all([
      supabase.from("patients").select("*", { count: "exact", head: true }),
      supabase.from("appointments").select("*", { count: "exact", head: true }).eq("date", today),
      supabase.from("appointments").select("*", { count: "exact", head: true }).gte("date", firstOfMonth),
      supabase.from("invoices").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("visits")
        .select("id, visit_date, chief_complaint, patients(first_name, last_name)")
        .order("visit_date", { ascending: false })
        .limit(8),
    ]);
    setKpis({
      patients: patients ?? "—",
      today:    todayCnt ?? "—",
      month:    month ?? "—",
      pending:  pending ?? "—",
    });
    setVisits(recentVisits ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const fmt = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="mm-page">
      {/* Header */}
      <div className="mm-page-header">
        <div>
          <h1 className="mm-page-title">Dashboard</h1>
          <p className="mm-page-sub">
            {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <button onClick={load} className="mm-btn mm-btn--ghost mm-btn--sm">
          ↻ Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="mm-kpi-grid">
        {KPI_DEFS.map(k => (
          <div key={k.key} className="mm-kpi">
            <div className="mm-kpi-icon">{k.icon}</div>
            <div className="mm-kpi-label">{k.label}</div>
            <div className="mm-kpi-value">
              {loading ? <span style={{ fontSize: 18, opacity: .4 }}>…</span> : kpis[k.key]}
            </div>
            <div className="mm-kpi-badge">● {k.sub}</div>
          </div>
        ))}
      </div>

      {/* Content grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>
        {/* Visitas recientes */}
        <div className="mm-card" style={{ padding: 0 }}>
          <div className="mm-card-accent-bar" />
          <div className="mm-section-head">
            <div>
              <div className="mm-card-title">Consultas recientes</div>
              <div className="mm-card-sub">Últimas 8 visitas registradas</div>
            </div>
            <button onClick={() => navigate("/patients")} className="mm-btn mm-btn--ghost mm-btn--sm">
              Ver pacientes →
            </button>
          </div>
          <div className="mm-table-wrap">
            <table className="mm-table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Fecha</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--c-muted)", padding: "32px 0" }}>Cargando…</td></tr>
                ) : visits.length === 0 ? (
                  <tr><td colSpan={3}><div className="mm-empty">Sin consultas registradas</div></td></tr>
                ) : visits.map(v => (
                  <tr key={v.id} className="mm-table-click" onClick={() => navigate("/patients")}>
                    <td style={{ fontWeight: 600 }}>
                      {v.patients?.first_name} {v.patients?.last_name}
                    </td>
                    <td style={{ color: "var(--c-muted)", fontSize: 13 }}>{fmt(v.visit_date)}</td>
                    <td style={{ color: "var(--c-text-2)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {v.chief_complaint || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Acceso rápido */}
        <div style={{ display: "grid", gap: 14 }}>
          <div className="mm-card">
            <div className="mm-card-head">
              <span className="mm-card-title">Acceso rápido</span>
            </div>
            {[
              { label: "Nuevo paciente",   icon: "➕", path: "/patients" },
              { label: "Nueva cita",        icon: "📅", path: "/agenda" },
              { label: "Ver facturación",   icon: "💳", path: "/billing" },
            ].map(a => (
              <button
                key={a.path}
                onClick={() => navigate(a.path)}
                className="mm-btn mm-btn--ghost"
                style={{ width: "100%", justifyContent: "flex-start", marginBottom: 8 }}
              >
                <span>{a.icon}</span> {a.label}
              </button>
            ))}
          </div>

          <div className="mm-card" style={{ background: "linear-gradient(135deg, var(--c-brand), var(--c-brand-dark))", border: "none" }}>
            <div style={{ color: "rgba(255,255,255,.8)", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>SISTEMA</div>
            <div style={{ color: "white", fontWeight: 800, fontSize: 15, marginBottom: 6 }}>MicMEDIC</div>
            <div style={{ color: "rgba(255,255,255,.7)", fontSize: 12 }}>Gestión médica para Dra. Daniela Romo</div>
          </div>
        </div>
      </div>
    </div>
  );
}
