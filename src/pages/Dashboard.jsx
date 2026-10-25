import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function startOfTodayISO() {
  const d = new Date(); d.setHours(0,0,0,0); return d.toISOString();
}
function endOfTodayISO() {
  const d = new Date(); d.setHours(23,59,59,999); return d.toISOString();
}
function fmtDateTime(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("es-EC", {
    day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"
  });
}
function fmtTimeOnly(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("es-EC", { hour:"2-digit", minute:"2-digit" });
}
function initials(name = "") {
  return name.split(" ").slice(0,2).map(w => w[0]).join("").toUpperCase() || "?";
}

const KPI_DEFS = [
  { key:"patients",  label:"Total pacientes",   icon:"👤", sub:"registrados" },
  { key:"visits",    label:"Consultas",          icon:"🩺", sub:"hoy" },
  { key:"certs",     label:"Certificados",       icon:"📄", sub:"hoy" },
  { key:"rx",        label:"Recetas",            icon:"💊", sub:"hoy" },
];

export default function Dashboard() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ patients:0, visits:0, certs:0, rx:0 });
  const [recentVisits, setRecentVisits] = useState([]);
  const today = useMemo(() => new Date().toLocaleDateString("es-EC", { weekday:"long", day:"numeric", month:"long" }), []);

  async function load() {
    setLoading(true);
    const from = startOfTodayISO(), to = endOfTodayISO();

    const [p, vT, cT, rT] = await Promise.all([
      supabase.from("patients").select("id", { count:"exact", head:true }),
      supabase.from("medical_visits").select("id", { count:"exact", head:true }).gte("visit_date", from).lte("visit_date", to),
      supabase.from("certificates").select("id", { count:"exact", head:true }).gte("date", from).lte("date", to),
      supabase.from("prescriptions").select("id", { count:"exact", head:true }).gte("date", from).lte("date", to),
    ]);
    setKpis({
      patients: p.count || 0,
      visits: vT.count || 0,
      certs: cT.count || 0,
      rx: rT.error ? 0 : (rT.count || 0),
    });

    const v = await supabase
      .from("medical_visits").select("id, patient_id, visit_date, reason, cie10_code, cie10_name")
      .order("visit_date", { ascending:false }).limit(8);

    const rows = v.data || [];
    const ids = [...new Set(rows.map(x => x.patient_id).filter(Boolean))];
    let pMap = {};
    if (ids.length) {
      const pp = await supabase.from("patients").select("id, name, cedula").in("id", ids);
      pMap = Object.fromEntries((pp.data||[]).map(x=>[x.id,x]));
    }
    setRecentVisits(rows.map(x => ({ ...x, patient: pMap[x.patient_id]||null })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  return (
    <div style={{ display:"grid", gap: 22 }}>
      {/* Header */}
      <div className="mm-header">
        <div>
          <h1 className="mm-title">Dashboard</h1>
          <div className="mm-subtitle" style={{ textTransform:"capitalize" }}>{today}</div>
        </div>
        <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={load}>
          {loading ? "⏳" : "↺"} Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="mm-kpi-grid">
        {KPI_DEFS.map(def => (
          <div className="mm-kpi" key={def.key}>
            <div className="mm-kpi-icon">{def.icon}</div>
            <div className="mm-kpi-label">{def.label}</div>
            <div className="mm-kpi-value">{loading ? "—" : kpis[def.key]}</div>
            <div className="mm-kpi-sub">{def.sub}</div>
            <div className="mm-kpi-badge">↑ activo</div>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr", gap: 18 }}>
        {/* Últimas consultas */}
        <div className="mm-card">
          <div className="mm-cardHead">
            <div>
              <div className="mm-cardTitle">Últimas consultas</div>
              <div style={{ fontSize:12, color:"var(--mm-muted)", marginTop:2 }}>Historial más reciente</div>
            </div>
            <span className="mm-chip mm-chip--green">{recentVisits.length} registros</span>
          </div>

          {loading ? (
            <div className="mm-empty">Cargando...</div>
          ) : recentVisits.length === 0 ? (
            <div className="mm-empty">Sin consultas registradas</div>
          ) : (
            <table className="mm-table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Fecha</th>
                  <th>Motivo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recentVisits.map(v => (
                  <tr key={v.id} className="mm-table-click" onClick={() => nav(`/visits/${v.id}`)}>
                    <td>
                      <div style={{ display:"flex", alignItems:"center", gap: 10 }}>
                        <div className="mm-avatar" style={{ width:32, height:32, fontSize:12 }}>
                          {initials(v.patient?.name)}
                        </div>
                        <div>
                          <div style={{ fontWeight:700, fontSize:14 }}>{v.patient?.name || "—"}</div>
                          <div style={{ fontSize:11, color:"var(--mm-muted)" }}>{v.patient?.cedula || "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize:13, color:"var(--mm-muted)" }}>{fmtDateTime(v.visit_date)}</td>
                    <td style={{ fontSize:13 }}>{v.reason || "—"}</td>
                    <td>
                      <span className="mm-chip" style={{ cursor:"pointer" }}>Ver →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right column */}
        <div style={{ display:"grid", gap: 18, alignContent:"start" }}>
          {/* Accesos rápidos */}
          <div className="mm-card">
            <div className="mm-cardHead">
              <div className="mm-cardTitle">Accesos rápidos</div>
            </div>
            <div style={{ padding:16, display:"grid", gap:10 }}>
              {[
                { label:"👤 Ver pacientes",   path:"/patients",  primary:true  },
                { label:"📅 Abrir agenda",    path:"/agenda",    primary:false },
                { label:"🧾 Facturas",        path:"/billing",   primary:false },
              ].map(a => (
                <button
                  key={a.path}
                  className={`mm-btn ${a.primary ? "mm-btn--primary" : "mm-btn--ghost"}`}
                  onClick={() => nav(a.path)}
                  style={{ justifyContent:"flex-start" }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mini status */}
          <div className="mm-card-green" style={{ display:"grid", gap: 10 }}>
            <div style={{ fontWeight:900, fontSize:16 }}>Estado del sistema</div>
            {[
              { label:"Base de datos", ok:true },
              { label:"Supabase API",  ok:true },
              { label:"Certificados",  ok:true },
            ].map(s => (
              <div key={s.label} style={{ display:"flex", justifyContent:"space-between",
                fontSize:13, borderTop:"1px solid rgba(255,255,255,.15)", paddingTop: 8 }}>
                <span style={{ opacity:.85 }}>{s.label}</span>
                <span style={{ fontWeight:800 }}>{s.ok ? "✓ OK" : "✗ Error"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
