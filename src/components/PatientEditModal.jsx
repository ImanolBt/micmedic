import { useMemo, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

function toTextArray(csv) {
  const s = (csv || "").trim();
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
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

  // 👇 Para bebés, devolvemos 0 (no rompe nada)
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
  if (months < 0) {
    years--;
    months += 12;
  }

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
  const [ageManual, setAgeManual] = useState(""); // solo si no hay birthdate
  const [allergiesCSV, setAllergiesCSV] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open || !patient) return;
    setName(patient.name || "");
    setSex(patient.sex || "F");
    setCedula(patient.cedula || "");
    setPhone(patient.phone || "");
    setBirthdate(patient.birthdate ? String(patient.birthdate).slice(0, 10) : "");
    setAgeManual(""); // solo si no hay birthdate
    setAllergiesCSV(toCSV(patient.allergies || []));
    setNotes(patient.notes || "");
  }, [open, patient]);

const age = useMemo(() => calcAgeFromBirthdate(birthdate), [birthdate]);

useEffect(() => {
  // aquí solo efectos secundarios
}, [age]);

  const canSave = useMemo(() => {
    if (!patient?.id) return false;

    const hasName = name.trim().length >= 3;
    const hasCedula = cedula.trim().length >= 8;
    const hasBirthOrAge = Boolean(birthdate) || ageManual.trim() !== "";

    const canSubmit = useMemo(() => {
  const hasName = name.trim().length >= 3;

  // cédula ya es opcional
  const hasBirthOrAge = Boolean(birthdate) || ageManual.trim() !== "";

  return hasName && hasBirthOrAge;
}, [name, birthdate, ageManual]);


    return hasName && hasCedula && hasBirthOrAge && ageOk && !saving;
  }, [patient, name, cedula, birthdate, ageManual, saving]);

  async function save() {
    if (!canSave) return;

    setSaving(true);

    // Si no hay birthdate, NO guardamos age en DB (porque tu esquema recomendado no la usa)
    const payload = {
      name: name.trim(),
      sex,
      cedula: cedula.trim(),
      phone: phone.trim() || null,
      birthdate: birthdate ? birthdate : null,
      allergies: toTextArray(allergiesCSV),
      notes: notes.trim() || null,
    };

    const { error } = await supabase.from("patients").update(payload).eq("id", patient.id);

    setSaving(false);

    if (error) {
      console.error(error);
      alert(error.message || "Error actualizando paciente");
      return;
    }

    onSaved?.();
    onClose?.();
  }

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        display: "grid",
        placeItems: "center",
        padding: 14,
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mm-card"
        style={{ width: "min(760px, 100%)" }}
      >
        <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
          <div className="mm-cardTitle">Editar paciente</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="mm-btn mm-btn--ghost" type="button" onClick={onClose}>
              Cerrar
            </button>
            <button className="mm-btn" type="button" onClick={save} disabled={!canSave}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>

        <div style={{ padding: 14, display: "grid", gap: 10 }}>
          <input
            className="mm-input"
            placeholder="Nombre completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
          />

          <div className="mm-row">
            <input
              className="mm-input"
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              disabled={saving}
              title="Fecha de nacimiento"
            />

            <input
              className="mm-input"
              type="number"
              placeholder="Edad (si no hay fecha)"
              value={autoAge ?? ageManual}
              onChange={(e) => setAgeManual(e.target.value)}
              disabled={saving || autoAge !== null}
              title={autoAge !== null ? "Se calcula desde la fecha" : "Edad manual solo si no hay fecha"}
            />
          </div>

          <div className="mm-row">
            <input
              className="mm-input"
              placeholder="Cédula"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              disabled={saving}
            />

            <select
              className="mm-input"
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              disabled={saving}
            >
              <option value="F">Femenino</option>
              <option value="M">Masculino</option>
            </select>
          </div>

          <input
            className="mm-input"
            placeholder="Teléfono (ej: 0991234567)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={saving}
          />

          <textarea
            className="mm-input"
            placeholder={`Alergias (separa con comas).
Ej: Penicilina, Mariscos`}
            value={allergiesCSV}
            onChange={(e) => setAllergiesCSV(e.target.value)}
            disabled={saving}
            rows={4}
            style={{ resize: "vertical", paddingTop: 12, lineHeight: 1.4, whiteSpace: "pre-wrap" }}
          />

          <textarea
            className="mm-input"
            placeholder="Notas (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={saving}
            rows={3}
            style={{ resize: "vertical", paddingTop: 12, lineHeight: 1.4, whiteSpace: "pre-wrap" }}
          />

          <div className="mm-hint" style={{ margin: 0 }}>
            Tip: si cambias cédula, revisa que quede correcta (se usa como referencia en varios lados).
          </div>
        </div>
      </div>
    </div>
  );
}
