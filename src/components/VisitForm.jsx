import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function VisitForm({ patientId, onClose, onSaved }) {
  const [form, setForm] = useState({
    visit_date:      new Date().toISOString().slice(0, 10),
    chief_complaint: "",
    diagnosis:       "",
    treatment:       "",
    notes:           "",
    weight:          "",
    height:          "",
    temperature:     "",
    heart_rate:      "",
    systolic_bp:     "",
    diastolic_bp:    "",
    oxygen_sat:      "",
  });
  const [error,  setError]  = useState("");
  const [saving, setSaving] = useState(false);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.chief_complaint.trim()) { setError("El motivo de consulta es obligatorio."); return; }
    setSaving(true); setError("");
    const payload = {
      patient_id:      patientId,
      visit_date:      form.visit_date,
      chief_complaint: form.chief_complaint,
      diagnosis:       form.diagnosis || null,
      treatment:       form.treatment || null,
      notes:           form.notes     || null,
      weight:          form.weight    ? parseFloat(form.weight) : null,
      height:          form.height    ? parseFloat(form.height) : null,
      temperature:     form.temperature ? parseFloat(form.temperature) : null,
      heart_rate:      form.heart_rate  ? parseInt(form.heart_rate)    : null,
      systolic_bp:     form.systolic_bp  ? parseInt(form.systolic_bp)  : null,
      diastolic_bp:    form.diastolic_bp ? parseInt(form.diastolic_bp) : null,
      oxygen_sat:      form.oxygen_sat  ? parseFloat(form.oxygen_sat)  : null,
    };
    const { error: err } = await supabase.from("visits").insert(payload);
    if (err) { setError(err.message); setSaving(false); return; }
    onSaved();
  };

  return (
    <div className="mm-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mm-modal mm-modal--wide">
        <div className="mm-modal-head">
          <span className="mm-modal-title">🩺 Nueva consulta</span>
          <button onClick={onClose} className="mm-icon-btn">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="mm-modal-body">

          {/* Datos de consulta */}
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--c-muted)", textTransform: "uppercase", letterSpacing: ".6px" }}>
            Consulta
          </div>

          <div className="mm-field">
            <label className="mm-label">Fecha *</label>
            <input className="mm-input" type="date" value={form.visit_date} onChange={set("visit_date")} required />
          </div>

          <div className="mm-field">
            <label className="mm-label">Motivo de consulta *</label>
            <textarea className="mm-input" rows={2} value={form.chief_complaint} onChange={set("chief_complaint")} placeholder="Describe el motivo principal…" required />
          </div>

          <div className="mm-field">
            <label className="mm-label">Diagnóstico</label>
            <textarea className="mm-input" rows={2} value={form.diagnosis} onChange={set("diagnosis")} placeholder="CIE-10, descripción clínica…" />
          </div>

          <div className="mm-field">
            <label className="mm-label">Tratamiento / Indicaciones</label>
            <textarea className="mm-input" rows={2} value={form.treatment} onChange={set("treatment")} placeholder="Medicamentos, dosis, indicaciones…" />
          </div>

          <div className="mm-field">
            <label className="mm-label">Notas adicionales</label>
            <textarea className="mm-input" rows={2} value={form.notes} onChange={set("notes")} placeholder="Observaciones, seguimiento…" />
          </div>

          <hr className="mm-divider" />

          {/* Signos vitales */}
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--c-muted)", textTransform: "uppercase", letterSpacing: ".6px" }}>
            Signos vitales
          </div>

          <div className="mm-row-3">
            <div className="mm-field">
              <label className="mm-label">Peso (kg)</label>
              <input className="mm-input" type="number" step="0.1" min="0" value={form.weight} onChange={set("weight")} placeholder="68.5" />
            </div>
            <div className="mm-field">
              <label className="mm-label">Talla (cm)</label>
              <input className="mm-input" type="number" step="0.1" min="0" value={form.height} onChange={set("height")} placeholder="165" />
            </div>
            <div className="mm-field">
              <label className="mm-label">Temperatura (°C)</label>
              <input className="mm-input" type="number" step="0.1" min="30" max="44" value={form.temperature} onChange={set("temperature")} placeholder="36.5" />
            </div>
          </div>

          <div className="mm-row-3">
            <div className="mm-field">
              <label className="mm-label">T/A sistólica</label>
              <input className="mm-input" type="number" min="50" max="250" value={form.systolic_bp} onChange={set("systolic_bp")} placeholder="120" />
            </div>
            <div className="mm-field">
              <label className="mm-label">T/A diastólica</label>
              <input className="mm-input" type="number" min="30" max="150" value={form.diastolic_bp} onChange={set("diastolic_bp")} placeholder="80" />
            </div>
            <div className="mm-field">
              <label className="mm-label">FC (lpm)</label>
              <input className="mm-input" type="number" min="30" max="250" value={form.heart_rate} onChange={set("heart_rate")} placeholder="72" />
            </div>
          </div>

          <div className="mm-field" style={{ maxWidth: 200 }}>
            <label className="mm-label">SpO₂ (%)</label>
            <input className="mm-input" type="number" step="0.1" min="70" max="100" value={form.oxygen_sat} onChange={set("oxygen_sat")} placeholder="98" />
          </div>

          {error && <div className="mm-alert mm-alert--error">⚠️ {error}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" onClick={onClose} className="mm-btn mm-btn--ghost">Cancelar</button>
            <button type="submit" className="mm-btn" disabled={saving}>
              {saving ? "Guardando…" : "Registrar consulta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
