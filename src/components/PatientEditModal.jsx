import { useMemo, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

function toTextArray(csv) {
  const s = (csv || "").trim();
  if (!s) return [];
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}
function toCSV(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.filter(Boolean).join(", ");
}
function calcAgeFromBirthdate(birthdate) {
  if (!birthdate) return null;
  const b = new Date(birthdate);
  if (Number.isNaN(b.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age >= 0 ? age : null;
}
function ageLabelFromBirthdate(birthdate) {
  if (!birthdate) return "-";
  const b = new Date(birthdate);
  if (Number.isNaN(b.getTime())) return "-";
  const today = new Date();
  let years = today.getFullYear() - b.getFullYear();
  let months = today.getMonth() - b.getMonth();
  let days = today.getDate() - b.getDate();
  if (days < 0) months--;
  if (months < 0) { years--; months += 12; }
  if (years <= 0) return `${Math.max(months, 0)} mes(es)`;
  return `${years} año(s)`;
}

export default function PatientEditModal({ open, patient, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [sex, setSex] = useState("F");
  const [cedula, setCedula] = useState("");
  const [phone, setPhone] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [ageManual, setAgeManual] = useState("");
  const [allergiesCSV, setAllergiesCSV] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open || !patient) return;
    setName(patient.name || "");
    setSex(patient.sex || "F");
    setCedula(patient.cedula || "");
    setPhone(patient.phone || "");
    setBirthdate(patient.birthdate ? String(patient.birthdate).slice(0, 10) : "");
    setAgeManual(patient.age ? String(patient.age) : "");
    setAllergiesCSV(toCSV(patient.allergies || []));
    setNotes(patient.notes || "");
  }, [open, patient]);

  const autoAge = useMemo(() => calcAgeFromBirthdate(birthdate), [birthdate]);

  useEffect(() => { if (birthdate) setAgeManual(""); }, [birthdate]);

  const ageManualNum = useMemo(() => {
    const s = String(ageManual || "").trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }, [ageManual]);

  const canSave = useMemo(() => {
    if (!patient?.id) return false;
    return name.trim().length >= 3 && (Boolean(birthdate) || ageManualNum !== null) && !saving;
  }, [patient, name, birthdate, ageManualNum, saving]);

  const displayedAgeValue = useMemo(() => {
    if (birthdate && autoAge !== null) return String(autoAge);
    return String(ageManual || "");
  }, [birthdate, autoAge, ageManual]);

  async function save() {
    if (!canSave) return;
    setSaving(true);
    const calculatedAge = birthdate ? calcAgeFromBirthdate(birthdate) : ageManualNum;
    const payload = {
      name: name.trim(), sex,
      cedula: cedula.trim() || null,
      phone: phone.trim() || null,
      birthdate: birthdate || null,
      age: calculatedAge,
      allergies: toTextArray(allergiesCSV),
      notes: notes.trim() || null,
    };
    const { error } = await supabase.from("patients").update(payload).eq("id", patient.id);
    setSaving(false);
    if (error) { alert(error.message || "Error actualizando paciente"); return; }
    onSaved?.();
    onClose?.();
  }

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,.5)",
        display: "grid", placeItems: "center",
        padding: 16, zIndex: 9999,
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--mm-surface)",
          borderRadius: 16,
          width: "min(680px, 100%)",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,.25)",
          border: "1px solid var(--mm-border)",
        }}
      >
        {/* Header del modal */}
        <div style={{
          padding: "18px 24px",
          borderBottom: "1px solid var(--mm-border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--mm-bg)",
          borderRadius: "16px 16px 0 0",
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--mm-text)" }}>
              ✏ Editar paciente
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--mm-muted)" }}>
              {patient?.name}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button className="mm-btn mm-btn--primary mm-btn--sm" onClick={save} disabled={!canSave}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: 24, display: "grid", gap: 14 }}>
          <div>
            <label className="mm-label">Nombre completo *</label>
            <input className="mm-input" value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label className="mm-label">Fecha de nacimiento</label>
              <input className="mm-input" type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} disabled={saving} />
            </div>
            <div>
              <label className="mm-label">Edad {birthdate ? "(calculada)" : "(manual)"}</label>
              <input
                className="mm-input" type="number" min={0} step={1}
                value={displayedAgeValue}
                onChange={(e) => setAgeManual(e.target.value)}
                disabled={saving || Boolean(birthdate)}
              />
            </div>
          </div>

          {birthdate && (
            <p className="mm-hint" style={{ marginTop: -6 }}>
              Edad calculada: <strong>{ageLabelFromBirthdate(birthdate)}</strong>
            </p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label className="mm-label">Cédula (opcional)</label>
              <input className="mm-input" placeholder="Ej: 0501234567" value={cedula} onChange={(e) => setCedula(e.target.value)} disabled={saving} />
            </div>
            <div>
              <label className="mm-label">Sexo</label>
              <select className="mm-input" value={sex} onChange={(e) => setSex(e.target.value)} disabled={saving}>
                <option value="F">Femenino</option>
                <option value="M">Masculino</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mm-label">Teléfono</label>
            <input className="mm-input" placeholder="Ej: 0991234567" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={saving} />
          </div>

          <div>
            <label className="mm-label">Alergias (separa con comas)</label>
            <textarea
              className="mm-input"
              placeholder="Ej: Penicilina, Mariscos"
              value={allergiesCSV}
              onChange={(e) => setAllergiesCSV(e.target.value)}
              disabled={saving}
              style={{ minHeight: 72, paddingTop: 10, resize: "vertical" }}
            />
          </div>

          <div>
            <label className="mm-label">Notas / Antecedentes</label>
            <textarea
              className="mm-input"
              placeholder="Antecedentes médicos, observaciones..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
              style={{ minHeight: 90, paddingTop: 10, resize: "vertical" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
