import { useState } from "react";
import { supabase } from "../supabaseClient";

const BLOOD_TYPES = ["A+","A-","B+","B-","AB+","AB-","O+","O-"];

export default function PatientForm({ patient, onClose, onSaved }) {
  const [form, setForm] = useState({
    first_name:    patient?.first_name    ?? "",
    last_name:     patient?.last_name     ?? "",
    date_of_birth: patient?.date_of_birth ?? "",
    gender:        patient?.gender        ?? "",
    phone:         patient?.phone         ?? "",
    email:         patient?.email         ?? "",
    address:       patient?.address       ?? "",
    blood_type:    patient?.blood_type    ?? "",
    allergies:     patient?.allergies     ?? "",
    notes:         patient?.notes         ?? "",
    curp:          patient?.curp          ?? "",
  });
  const [error,   setError]   = useState("");
  const [saving,  setSaving]  = useState(false);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError("Nombre y apellido son obligatorios."); return;
    }
    setSaving(true); setError("");
    const payload = { ...form };
    const { error: err } = patient
      ? await supabase.from("patients").update(payload).eq("id", patient.id)
      : await supabase.from("patients").insert(payload);
    if (err) { setError(err.message); setSaving(false); return; }
    onSaved();
  };

  return (
    <div className="mm-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mm-modal mm-modal--wide">
        <div className="mm-modal-head">
          <span className="mm-modal-title">{patient ? "Editar paciente" : "Nuevo paciente"}</span>
          <button onClick={onClose} className="mm-icon-btn">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="mm-modal-body">
          <div className="mm-row-2">
            <div className="mm-field">
              <label className="mm-label">Nombre *</label>
              <input className="mm-input" value={form.first_name} onChange={set("first_name")} placeholder="Nombre(s)" required />
            </div>
            <div className="mm-field">
              <label className="mm-label">Apellido *</label>
              <input className="mm-input" value={form.last_name} onChange={set("last_name")} placeholder="Apellido(s)" required />
            </div>
          </div>

          <div className="mm-row-3">
            <div className="mm-field">
              <label className="mm-label">Fecha de nacimiento</label>
              <input className="mm-input" type="date" value={form.date_of_birth} onChange={set("date_of_birth")} />
            </div>
            <div className="mm-field">
              <label className="mm-label">Sexo</label>
              <select className="mm-input" value={form.gender} onChange={set("gender")}>
                <option value="">— Seleccionar —</option>
                <option value="F">Femenino</option>
                <option value="M">Masculino</option>
                <option value="O">Otro</option>
              </select>
            </div>
            <div className="mm-field">
              <label className="mm-label">Tipo de sangre</label>
              <select className="mm-input" value={form.blood_type} onChange={set("blood_type")}>
                <option value="">— Seleccionar —</option>
                {BLOOD_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="mm-row-2">
            <div className="mm-field">
              <label className="mm-label">Teléfono</label>
              <input className="mm-input" value={form.phone} onChange={set("phone")} placeholder="55 1234 5678" />
            </div>
            <div className="mm-field">
              <label className="mm-label">Correo electrónico</label>
              <input className="mm-input" type="email" value={form.email} onChange={set("email")} placeholder="paciente@ejemplo.com" />
            </div>
          </div>

          <div className="mm-field">
            <label className="mm-label">CURP</label>
            <input className="mm-input" value={form.curp} onChange={set("curp")} placeholder="XXXX000000XXXXXX00" maxLength={18} />
          </div>

          <div className="mm-field">
            <label className="mm-label">Dirección</label>
            <input className="mm-input" value={form.address} onChange={set("address")} placeholder="Calle, colonia, ciudad" />
          </div>

          <div className="mm-field">
            <label className="mm-label">Alergias</label>
            <textarea className="mm-input" rows={2} value={form.allergies} onChange={set("allergies")} placeholder="Penicilina, latex…" />
          </div>

          <div className="mm-field">
            <label className="mm-label">Notas adicionales</label>
            <textarea className="mm-input" rows={2} value={form.notes} onChange={set("notes")} placeholder="Antecedentes relevantes…" />
          </div>

          {error && <div className="mm-alert mm-alert--error">⚠️ {error}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={onClose} className="mm-btn mm-btn--ghost">Cancelar</button>
            <button type="submit" className="mm-btn" disabled={saving}>
              {saving ? "Guardando…" : patient ? "Guardar cambios" : "Crear paciente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
