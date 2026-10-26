import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import AppointmentForm from "./AppointmentForm";

const STATUS_CHIP = {
  scheduled: { label: "Programada", cls: "mm-chip--blue" },
  completed:  { label: "Completada", cls: "mm-chip--green" },
  cancelled:  { label: "Cancelada",  cls: "mm-chip--red" },
  no_show:    { label: "No asistió", cls: "mm-chip--warn" },
};

export default function AppointmentList({ patientId }) {
  const [appts,   setAppts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [newAppt, setNewAppt] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("appointments").select("*, patients(first_name, last_name)").order("date", { ascending: false });
    if (patientId) q = q.eq("patient_id", patientId);
    const { data } = await q.limit(50);
    setAppts(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [patientId]);

  const fmt = (d, t) => {
    if (!d) return "—";
    const dateStr = new Date(d + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
    return t ? `${dateStr} · ${t.slice(0, 5)}` : dateStr;
  };

  const updateStatus = async (id, status) => {
    await supabase.from("appointments").update({ status }).eq("id", id);
    load();
  };

  return (
    <div>
      <div className="mm-card" style={{ padding: 0 }}>
        <div className="mm-card-accent-bar" />
        <div className="mm-section-head">
          <div className="mm-card-title">Citas ({appts.length})</div>
          <button onClick={() => setNewAppt(true)} className="mm-btn mm-btn--sm">＋ Nueva cita</button>
        </div>
        <div className="mm-table-wrap">
          <table className="mm-table">
            <thead>
              <tr>
                {!patientId && <th>Paciente</th>}
                <th>Fecha / Hora</th>
                <th>Motivo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--c-muted)", padding: "32px 0" }}>Cargando…</td></tr>
              ) : appts.length === 0 ? (
                <tr><td colSpan={5}><div className="mm-empty">Sin citas registradas</div></td></tr>
              ) : appts.map(a => {
                const chip = STATUS_CHIP[a.status] ?? { label: a.status, cls: "" };
                return (
                  <tr key={a.id}>
                    {!patientId && <td style={{ fontWeight: 600 }}>{a.patients?.first_name} {a.patients?.last_name}</td>}
                    <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{fmt(a.date, a.time)}</td>
                    <td style={{ color: "var(--c-text-2)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.reason || "—"}
                    </td>
                    <td><span className={`mm-chip ${chip.cls}`}>{chip.label}</span></td>
                    <td>
                      {a.status === "scheduled" && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => updateStatus(a.id, "completed")} className="mm-btn mm-btn--sm" style={{ padding: "4px 10px", fontSize: 11 }}>✓</button>
                          <button onClick={() => updateStatus(a.id, "cancelled")} className="mm-btn mm-btn--danger mm-btn--sm" style={{ padding: "4px 10px", fontSize: 11 }}>✕</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {newAppt && (
        <AppointmentForm
          patientId={patientId}
          onClose={() => setNewAppt(false)}
          onSaved={() => { setNewAppt(false); load(); }}
        />
      )}
    </div>
  );
}
