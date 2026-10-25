import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function startOfTodayISO() { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString(); }
function endOfTodayISO()   { const d = new Date(); d.setHours(23,59,59,999); return d.toISOString(); }
function fmtDateTime(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("es-EC", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" });
}
function initials(name = "") {
  return name.split(" ").slice(0,2).map(w => w[0]).join("").toUpperCase() || "?";
}

const KPI_DEFS = [
  { key:"patients", label:"Total pacientes", icon:"👤", sub:"registrados" },
  { key:"visits",   label:"Consultas hoy",   icon:"🩺", sub:"hoy"         },
  { key:"certs",    label:"Certificados",     icon:"📄", sub:"hoy"         },
  { key:"rx",       label:"Recetas",          icon:"💊", sub:"hoy"         },
];

export default function Dashboard() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ patients:0, visits:0, certs:0, rx:0 });
  const [recentVisits, setRecentVisits] = useState([]);
  const today = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString("es-EC", { weekday:"long", day:"numeric", month:"long" });
  }, []);

  async function load() {
    setLoading(true);
    const from = startOfTodayISO(), to = endOfTodayISO();
    const [p, vT, cT, rT] = await Promise.all([
      supabase.from("patients").select("id", { count:"exact", head:true }),
      supabase.from("medical_visits").select("id", { count:"exact", head:true }).gte("visit_date", from).lte("visit_date", to),
      supabase.from("certificates").select("id", { count:"exact", head:true }).gte("date", from).lte("date", to),
      supabase.from("prescriptions").select("id", { count:"exact", head:true }).gte("date", from).lte("date", to),
    ]);
    setKpis({ patients: p.count||0, visits: vT.count||0, certs: cT.count||0, rx: rT.count||0 });

    const v = await supabase.from("medical_visits")
      .select("id, patient_id, visit_date, reason")
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
    <div className="mm-page">
      {/* ── Header ── */}
      <div className="mm-page-header">
        <div>
          <h1 className="mm-page-title">Dashboard</h1>
          <div className="mm-page-sub" style={{ textTransform:"capitalize" }}>{today}</div>
        </div>
        <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={load}>↻ Actualizar</button>
      </div>

      {/* ── KPI tiles ── */}
      <div className="mm-kpi-grid">
        {KPI_DEFS.map(k => (
          <div key={k.key} className="mm-kpi">
            <div className="mm-kpi-icon">{k.icon}</div>
            <div className="mm-kpi-label">{k.label}</div>
            <div className="mm-kpi-value">{loading ? "—" : kpis[k.key]}</div>
            <div className="mm-kpi-badge">● {k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Grid 2 columnas: tabla + accesos ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:20, alignItems:"start" }}>

        {/* Últimas consultas */}
        <div className="mm-card" style={{ padding:0, overflow:"hidden" }}>
          <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div className="mm-card-title">Últimas consultas</div>
              <div className="mm-card-sub">Historial más reciente</div>
            </div>
            <span className="mm-chip mm-chip--green">{recentVisits.length} registros</span>
          </div>
          <div className="mm-table-wrap">
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
                {loading ? (
                  <tr><td colSpan={4} style={{ textAlign:"center", color:"var(--muted)", padding:32 }}>Cargando...</td></tr>
                ) : recentVisits.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign:"center", color:"var(--muted)", padding:32 }}>Sin consultas</td></tr>
                ) : recentVisits.map(v => (
                  <tr key={v.id} className="mm-table-click" onClick={() => nav(`/visits/${v.id}`)}>
                    <td>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div className="mm-avatar" style={{ width:30, height:30, fontSize:11 }}>
                          {initials(v.patient?.name || "")}
                        </div>
                        <div>
                          <div style={{ fontWeight:600, fontSize:13 }}>{v.patient?.name || "—"}</div>
                          <div style={{ fontSize:11, color:"var(--muted)" }}>{v.patient?.cedula || ""}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize:12, color:"var(--muted)", whiteSpace:"nowrap" }}>{fmtDateTime(v.visit_date)}</td>
                    <td style={{ fontSize:13, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.reason}</td>
                    <td><span style={{ color:"var(--green)", fontWeight:700, fontSize:12 }}>Ver →</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Accesos rápidos */}
        <div style={{ display:"grid", gap:12 }}>
          <div className="mm-card">
            <div className="mm-card-title" style={{ marginBottom:14 }}>Accesos rápidos</div>
            <div style={{ display:"grid", gap:8 }}>
              <button className="mm-btn" style={{ width:"100%", justifyContent:"flex-start" }}
                onClick={() => nav("/patients")}>
                👤 Ver pacientes
              </button>
              <button className="mm-btn mm-btn--ghost" style={{ width:"100%", justifyContent:"flex-start" }}
                onClick={() => nav("/agenda")}>
                📅 Abrir agenda
              </button>
              <button className="mm-btn mm-btn--ghost" style={{ width:"100%", justifyContent:"flex-start" }}
                onClick={() => nav("/billing")}>
                🧾 Facturación
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
