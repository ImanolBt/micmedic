import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

function toTextArray(csv) {
  const s = (csv || "").trim();
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function arrToCSV(a) {
  if (Array.isArray(a)) return a.filter(Boolean).join(", ");
  if (typeof a === "string") return a;
  return "";
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

export default function PatientDetail() {
  const { id } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState(null);

  // form
  const [name, setName] = useState("");
  const [sex, setSex] = useState("F");
  const [cedula, setCedula] = useState("");
  const [phone, setPhone] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [age, setAge] = useState(""); // manual
  const [allergiesCSV, setAllergiesCSV] = useState("");
  const [notes, setNotes] = useState("");

  const autoAge = useMemo(() => calcAgeFromBirthdate(birthdate), [birthdate]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("id", id)
        .single();

      if (!alive) return;

      if (error) {
        alert("No se pudo cargar el paciente: " + error.message);
        setLoading(false);
        return;
      }

      setPatient(data);

      setName(data.name || "");
      setSex(data.sex || "F");
      setCedula(data.cedula || "");
      setPhone(data.phone || "");
      setBirthdate(data.birthdate || "");
      setAge(data.age != null ? String(data.age) : "");
      setAllergiesCSV(arrToCSV(data.allergies));
      setNotes(data.notes || "");

      setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, [id]);

  const canSave = useMemo(() => {
    const hasName = name.trim().length >= 3;
    const hasCedula = cedula.trim().length >= 8;

    const ageNum = autoAge ?? (age ? Number(age) : null);
    const okAge = ageNum === null || (Number.isFinite(ageNum) && ageNum >= 0 && ageNum <= 130);

    return hasName && hasCedula && okAge;
  }, [name, cedula, age, autoAge]);

  async function onSave() {
    if (!canSave || saving) return;

    setSaving(true);
    const ageToSave = autoAge ?? (age ? Number(age) : null);

    const payload = {
      name: name.trim(),
      sex,
      cedula: cedula.trim(),
      phone: phone.trim() || null,
      birthdate: birthdate || null,
      age: Number.isFinite(ageToSave) ? ageToSave : null,
      allergies: toTextArray(allergiesCSV),
      notes: notes.trim() || null,
    };

    const { error } = await supabase.from("patients").update(payload).eq("id", id);

    setSaving(false);

    if (error) {
      alert("No se pudo guardar: " + error.message);
      return;
    }

    alert("Paciente actualizado ✅");
    nav("/patients");
  }

  async function onDelete() {
    if (!patient) return;
    const ok = confirm(`¿Eliminar a "${patient.name}"? Esta acción no se puede deshacer.`);
    if (!ok) return;

    setSaving(true);
    const { error } = await supabase.from("patients").delete().eq("id", id);
    setSaving(false);

    if (error) {
      alert("No se pudo eliminar: " + error.message);
      return;
    }

    alert("Paciente eliminado ✅");
    nav("/patients");
  }

  if (loading) return <div className="mm-empty">Cargando ficha...</div>;
  if (!patient) return <div className="mm-empty">Paciente no encontrado.</div>;

  return (
    <div className="mm-wrap">
      <div className="mm-card">
        <div className="mm-cardHead">
          <div className="mm-cardTitle">Ficha del paciente</div>
          <div className="mm-chip">{saving ? "Guardando..." : "MicMEDIC"}</div>
        </div>

        <div className="mm-form">
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
              placeholder="Edad"
              value={autoAge ?? age}
              onChange={(e) => setAge(e.target.value)}
              disabled={saving || autoAge !== null}
              title={autoAge !== null ? "Se calcula desde la fecha de nacimiento" : "Edad manual"}
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

            <select className="mm-input" value={sex} onChange={(e) => setSex(e.target.value)} disabled={saving}>
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

          <input
            className="mm-input"
            placeholder="Alergias (separa con comas). Ej: Penicilina, Mariscos"
            value={allergiesCSV}
            onChange={(e) => setAllergiesCSV(e.target.value)}
            disabled={saving}
          />

          <input
            className="mm-input"
            placeholder="Notas (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={saving}
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="mm-btn" onClick={onSave} disabled={!canSave || saving} type="button">
              Guardar cambios
            </button>

            <button className="mm-btn mm-btn--ghost" onClick={() => nav("/patients")} disabled={saving} type="button">
              Volver
            </button>

            <button
              className="mm-btn"
              onClick={onDelete}
              disabled={saving}
              type="button"
              style={{ background: "#b42318" }}
            >
              Eliminar
            </button>
          </div>

          <div className="mm-hint">
            Tip: Si pones fecha de nacimiento, la edad se calcula sola y también se guarda.
          </div>
        </div>
      </div>
    </div>
  );
}
