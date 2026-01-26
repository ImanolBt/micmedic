import { useMemo, useState } from "react";

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
  return age >= 0 ? age : null;
}

export default function PatientForm({ onCreate, disabled }) {
  const [name, setName] = useState("");
  const [sex, setSex] = useState("F");
  const [cedula, setCedula] = useState("");
  const [phone, setPhone] = useState("");

  const [birthdate, setBirthdate] = useState(""); // YYYY-MM-DD
  const [ageManual, setAgeManual] = useState(""); // solo referencia

  const [allergiesCSV, setAllergiesCSV] = useState("");
  const [notes, setNotes] = useState("");

  const autoAge = useMemo(() => calcAgeFromBirthdate(birthdate), [birthdate]);

  const canSubmit = useMemo(() => {
    const hasName = name.trim().length >= 3;

    // Exigir que exista birthdate o edad manual válida
    const hasBirthOrAge = Boolean(birthdate) || ageManual.trim() !== "";

    let ageOk = true;
    if (!birthdate && ageManual.trim() !== "") {
      const n = Number(ageManual);
      ageOk = Number.isFinite(n) && n >= 0 && n <= 130;
    }

    return hasName && hasBirthOrAge && ageOk;
  }, [name, birthdate, ageManual]);

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

    const payload = {
      name: name.trim(),
      sex,
      cedula: cedula.trim() || null,   // ✅ ahora puede ir null
      phone: phone.trim() || null,
      birthdate: birthdate ? birthdate : null,
      allergies: toTextArray(allergiesCSV),
      notes: notes.trim() || null,
    };

    onCreate(payload);
    reset();
  }

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
          placeholder="Edad (si no hay fecha)"
          value={autoAge ?? ageManual}
          onChange={(e) => setAgeManual(e.target.value)}
          disabled={disabled || autoAge !== null}
          title={
            autoAge !== null
              ? "Se calcula desde la fecha de nacimiento"
              : "Edad manual solo si no hay fecha"
          }
        />
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
        style={{ minHeight: 80, paddingTop: 10 }}
      />

      <textarea
        className="mm-input"
        placeholder="Notas (opcional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        disabled={disabled}
        style={{ minHeight: 80, paddingTop: 10 }}
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
