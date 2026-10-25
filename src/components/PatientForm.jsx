import { useEffect, useMemo, useState } from "react";

function toTextArray(csv) {
  const s = (csv || "").trim();
  if (!s) return [];
  return s.split(",").map((x) => x.trim()).filter(Boolean);
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

export default function PatientForm({ onCreate, disabled }) {
  const [name, setName] = useState("");
  const [sex, setSex] = useState("F");
  const [cedula, setCedula] = useState("");
  const [phone, setPhone] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [ageManual, setAgeManual] = useState("");
  const [allergiesCSV, setAllergiesCSV] = useState("");
  const [notes, setNotes] = useState("");

  const autoAge = useMemo(() => calcAgeFromBirthdate(birthdate), [birthdate]);

  useEffect(() => {
    if (birthdate) setAgeManual("");
  }, [birthdate]);

  const ageManualNum = useMemo(() => {
    const s = String(ageManual || "").trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }, [ageManual]);

  const canSubmit = useMemo(() => {
    const hasName = name.trim().length >= 3;
    const hasBirthOrAge = Boolean(birthdate) || ageManualNum !== null;
    return hasName && hasBirthOrAge;
  }, [name, birthdate, ageManualNum]);

  function reset() {
    setName(""); setSex("F"); setCedula(""); setPhone("");
    setBirthdate(""); setAgeManual(""); setAllergiesCSV(""); setNotes("");
  }

  function submit(e) {
    e.preventDefault();
    if (!canSubmit || disabled) return;
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
    onCreate(payload);
    reset();
  }

  const displayedAgeValue = useMemo(() => {
    if (birthdate && autoAge !== null) return String(autoAge);
    return String(ageManual || "");
  }, [birthdate, autoAge, ageManual]);

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
      {/* Nombre */}
      <div>
        <label className="mm-label">Nombre completo *</label>
        <input
          className="mm-input"
          placeholder="Ej: María García López"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={disabled}
        />
      </div>

      {/* Fecha nacimiento + Edad */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label className="mm-label">Fecha de nacimiento</label>
          <input
            className="mm-input"
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            disabled={disabled}
          />
        </div>
        <div>
          <label className="mm-label">
            Edad {birthdate ? "(calculada)" : "(manual si no hay fecha)"}
          </label>
          <input
            className="mm-input"
            type="number"
            min={0}
            step={1}
            placeholder="Ej: 34"
            value={displayedAgeValue}
            onChange={(e) => setAgeManual(e.target.value)}
            disabled={disabled || Boolean(birthdate)}
          />
        </div>
      </div>

      {birthdate && (
        <p className="mm-hint" style={{ marginTop: -4 }}>
          Edad calculada: <strong>{ageLabelFromBirthdate(birthdate)}</strong>
        </p>
      )}

      {/* Cédula + Sexo */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label className="mm-label">Cédula (opcional)</label>
          <input
            className="mm-input"
            placeholder="Ej: 0501234567"
            value={cedula}
            onChange={(e) => setCedula(e.target.value)}
            disabled={disabled}
          />
        </div>
        <div>
          <label className="mm-label">Sexo</label>
          <select
            className="mm-input"
            value={sex}
            onChange={(e) => setSex(e.target.value)}
            disabled={disabled}
          >
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
          </select>
        </div>
      </div>

      {/* Teléfono */}
      <div>
        <label className="mm-label">Teléfono</label>
        <input
          className="mm-input"
          placeholder="Ej: 0991234567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={disabled}
        />
      </div>

      {/* Alergias */}
      <div>
        <label className="mm-label">Alergias (separa con comas)</label>
        <textarea
          className="mm-input"
          placeholder="Ej: Penicilina, Mariscos, Polen"
          value={allergiesCSV}
          onChange={(e) => setAllergiesCSV(e.target.value)}
          disabled={disabled}
          style={{ minHeight: 72, paddingTop: 10, resize: "vertical" }}
        />
      </div>

      {/* Notas */}
      <div>
        <label className="mm-label">Notas / Antecedentes</label>
        <textarea
          className="mm-input"
          placeholder="Antecedentes médicos, observaciones generales..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={disabled}
          style={{ minHeight: 90, paddingTop: 10, resize: "vertical" }}
        />
      </div>

      <button
        type="submit"
        className="mm-btn mm-btn--primary"
        disabled={!canSubmit || disabled}
        style={{ marginTop: 4 }}
      >
        Registrar paciente
      </button>

      <p className="mm-hint">
        * Nombre y edad (o fecha de nacimiento) son obligatorios. La cédula es opcional.
      </p>
    </form>
  );
}
