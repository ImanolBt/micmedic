import { useEffect, useMemo, useState } from "react";

function toTextArray(csv) {
  const s = (csv || "").trim();
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function calcAgeFromBirthdate(birthdate) {
  if (!birthdate) return null;

  const b = new Date(birthdate);
  if (Number.isNaN(b.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;

  // ✅ Bebés: 0 años es válido
  return age >= 0 ? age : null;
}

// ✅ Etiqueta “bonita”: meses si < 1 año
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

export default function PatientForm({ onCreate, disabled }) {
  const [name, setName] = useState("");
  const [sex, setSex] = useState("F");
  const [cedula, setCedula] = useState("");
  const [phone, setPhone] = useState("");

  const [birthdate, setBirthdate] = useState(""); // YYYY-MM-DD
  const [ageManual, setAgeManual] = useState(""); // usado solo si no hay birthdate

  const [allergiesCSV, setAllergiesCSV] = useState("");
  const [notes, setNotes] = useState("");

  // ✅ edad calculada automáticamente si hay fecha
  const autoAge = useMemo(() => calcAgeFromBirthdate(birthdate), [birthdate]);

  // ✅ si el usuario pone fecha, limpiamos edad manual para evitar inconsistencias
  useEffect(() => {
    if (birthdate) setAgeManual("");
  }, [birthdate]);

  // ✅ validación de edad manual (si se usa)
  const ageManualNum = useMemo(() => {
    const s = String(ageManual || "").trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : null; // ✅ permite 0 (bebé)
  }, [ageManual]);

  // ✅ puede enviar si: nombre ok + (fecha o edadManual válida)
  const canSubmit = useMemo(() => {
    const hasName = name.trim().length >= 3;
    const hasBirthOrAge = Boolean(birthdate) || ageManualNum !== null;
    return hasName && hasBirthOrAge;
  }, [name, birthdate, ageManualNum]);

  function reset() {
    setName("");
    setSex("F");
    setCedula("");
    setPhone("");
    setBirthdate("");
    setAgeManual("");
    setAllergiesCSV("");
    setNotes("");
  }

  function submit(e) {
    e.preventDefault();
    if (!canSubmit || disabled) return;

    // ✅ Si no hay birthdate, igual guardas con edad manual (si tu tabla tiene campo age)
    // Si tu tabla NO tiene campo "age", no lo mandes. Aquí lo mando solo como ejemplo:
    const payload = {
      name: name.trim(),
      sex,
      cedula: cedula.trim() || null, // ✅ opcional
      phone: phone.trim() || null,
      birthdate: birthdate ? birthdate : null,
      // age: birthdate ? autoAge : ageManualNum, // <-- descomenta SOLO si tu tabla patients tiene columna "age"
      allergies: toTextArray(allergiesCSV),
      notes: notes.trim() || null,
    };

    onCreate(payload);
    reset();
  }

  // ✅ valor que se muestra en input edad
  const displayedAgeValue = useMemo(() => {
    // si hay birthdate, mostramos autoAge (años)
    if (birthdate && autoAge !== null) return String(autoAge);
    // si no, mostramos lo que escribe el usuario
    return String(ageManual || "");
  }, [birthdate, autoAge, ageManual]);

  return (
    <form className="mm-form" onSubmit={submit}>
      <input
        className="mm-input"
        placeholder="Nombre completo"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={disabled}
      />

      <div className="mm-row">
        <input
          className="mm-input"
          type="date"
          value={birthdate}
          onChange={(e) => setBirthdate(e.target.value)}
          disabled={disabled}
          title="Fecha de nacimiento"
        />

        <input
          className="mm-input"
          type="number"
          min={0}
          step={1}
          placeholder="Edad (si no hay fecha)"
          value={displayedAgeValue}
          onChange={(e) => setAgeManual(e.target.value)}
          disabled={disabled || Boolean(birthdate)} // ✅ si hay fecha, no deja editar edad manual
          title={birthdate ? "Se calcula desde la fecha de nacimiento" : "Edad manual solo si no hay fecha"}
        />
      </div>

      {/* ✅ etiqueta para bebés: meses si < 1 año */}
      <div className="mm-hint" style={{ marginTop: -6 }}>
        Edad calculada: <b>{birthdate ? ageLabelFromBirthdate(birthdate) : (ageManualNum !== null ? `${ageManualNum} año(s)` : "-")}</b>
      </div>

      <div className="mm-row">
        <input
          className="mm-input"
          placeholder="Cédula (opcional)"
          value={cedula}
          onChange={(e) => setCedula(e.target.value)}
          disabled={disabled}
        />

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

      <input
        className="mm-input"
        placeholder="Teléfono (ej: 0991234567)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        disabled={disabled}
      />

      <textarea
        className="mm-input"
        placeholder="Alergias (separa con comas). Ej: Penicilina, Mariscos"
        value={allergiesCSV}
        onChange={(e) => setAllergiesCSV(e.target.value)}
        disabled={disabled}
        style={{ minHeight: 80, paddingTop: 10, resize: "vertical", whiteSpace: "pre-wrap" }}
      />

      <textarea
        className="mm-input"
        placeholder="Notas / Evolución (opcional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        disabled={disabled}
        style={{ minHeight: 110, paddingTop: 10, resize: "vertical", whiteSpace: "pre-wrap" }}
      />

      <button className="mm-btn" disabled={!canSubmit || disabled}>
        Registrar paciente
      </button>

      <div className="mm-hint">
        La cédula es opcional. Si no se conoce, el sistema permite guardar sin ese dato.
      </div>
    </form>
  );
}
