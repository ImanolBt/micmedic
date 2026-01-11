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
  const [age, setAge] = useState(""); // string para input

  const [allergiesCSV, setAllergiesCSV] = useState("");
  const [notes, setNotes] = useState("");

  const autoAge = useMemo(() => calcAgeFromBirthdate(birthdate), [birthdate]);

  const canSubmit = useMemo(() => {
    const hasName = name.trim().length >= 3;
    const hasCedula = cedula.trim().length >= 8;
    const ageNum = autoAge ?? (age ? Number(age) : null);
    const hasAge = ageNum === null || (Number.isFinite(ageNum) && ageNum >= 0 && ageNum <= 130);
    return hasName && hasCedula && hasAge;
  }, [name, cedula, age, autoAge]);

  function reset() {
    setName("");
    setSex("F");
    setCedula("");
    setPhone("");
    setBirthdate("");
    setAge("");
    setAllergiesCSV("");
    setNotes("");
  }

  function submit(e) {
    e.preventDefault();
    if (!canSubmit || disabled) return;

    const ageToSave = autoAge ?? (age ? Number(age) : null);

    const payload = {
      name: name.trim(),
      sex,
      cedula: cedula.trim(),
      phone: phone.trim() || null,
      birthdate: birthdate ? birthdate : null,
      age: Number.isFinite(ageToSave) ? ageToSave : null, // <-- GUARDA age
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
          placeholder="Edad"
          value={autoAge ?? age}
          onChange={(e) => setAge(e.target.value)}
          disabled={disabled || autoAge !== null}
          title={autoAge !== null ? "Se calcula desde la fecha de nacimiento" : "Edad manual"}
        />
      </div>

      <div className="mm-row">
        <input
          className="mm-input"
          placeholder="Cédula"
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

      <input
        className="mm-input"
        placeholder="Alergias (separa con comas). Ej: Penicilina, Mariscos"
        value={allergiesCSV}
        onChange={(e) => setAllergiesCSV(e.target.value)}
        disabled={disabled}
      />

      <input
        className="mm-input"
        placeholder="Notas (opcional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        disabled={disabled}
      />

      <button className="mm-btn" disabled={!canSubmit || disabled}>
        Registrar paciente
      </button>

      <div className="mm-hint">Recomendado: fecha de nacimiento. La edad se calcula sola.</div>
    </form>
  );
}
