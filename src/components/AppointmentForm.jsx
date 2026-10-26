import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function AppointmentForm({ patientId, onClose, onSaved }) {
  const [patients, setPatients] = useState([]);
  const [form, setForm] = useState({
    patient_id: patientId ?? "",
    date:       new Date().toISOString().slice(0, 10),
    time:       "09:00",
    duration:   30,
    reason:     "",
    notes:      "",
    status:     "scheduled",
  });
  const [error,  setError]  = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!patientId) {
      supabase.from("patients").select("id, first_name, last_name").order("last_name").then(({ data }) => setPatients(data ?? []));
    }
  }, [patientId]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.patient_id) { setError("Selecciona un paciente."); return; }
    if (!form.date)        { setError("La fecha es obligatoria."); return; }
    setSaving(true); setError("");
    const { error: err } = await supabase.from("appointments").insert({
      patient_id: form.patient_id,
      date:       form.date,
      time:       form.time || null,
      duration:   parseInt(form.duration),
      reason:     form.reason || null,
      notes:      form.notes  || null,
      status:     form.status,
    });
    if (err) { setError(err.message); setSaving(false); return; }
    onSaved();
  };

  return (
    <div className="mm-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mm-modal">
        <div className="mm-modal-head">
          <span className="mm-modal-title">📅 Nueva cita</span>
          <button onClick={onClose} className="mm-icon-btn">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="mm-modal-body">
          {!patientId && (
            <div className="mm-field">
              <label className="mm-label">Paciente *</label>
              <select className="mm-input" value={form.patient_id} onChange={set("patient_id")} required>
                <option value="">— Seleccionar paciente —</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="mm-row-3">
            <div className="mm-field">
              <label className="mm-label">Fecha *</label>
              <input className="mm-input" type="date" value={form.date} onChange={set("date")} required />
            </div>
            <div className="mm-field">
              <label className="mm-label">Hora</label>
              <input className="mm-input" type="time" value={form.time} onChange={set("time")} />
            </div>
            <div className="mm-field">
              <label className="mm-label">Duración (min)</label>
              <select className="mm-input" value={form.duration} onChange={set("duration")}>
                {[15,20,30,45,60,90].map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>

          <div className="mm-field">
            <label className="mm-label">Motivo</label>
            <input className="mm-input" value={form.reason} onChange={set("reason")} placeholder="Consulta general, seguimiento…" />
          </div>

          <div className="mm-field">
            <label className="mm-label">Notas</label>
            <textarea className="mm-input" rows={2} value={form.notes} onChange={set("notes")} placeholder="Indicaciones previas, preparación…" />
          </div>

          {error && <div className="mm-alert mm-alert--error">⚠️ {error}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" onClick={onClose} className="mm-btn mm-btn--ghost">Cancelar</button>
            <button type="submit" className="mm-btn" disabled={saving}>
              {saving ? "Guardando…" : "Agendar cita"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
