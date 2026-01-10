import { useMemo, useState } from "react";

export default function Patients({ patients, onAddPatient, onSelect }) {
  const [form, setForm] = useState({
    name: "",
    age: "",
    cedula: "",
    phone: "",
    sex: "F",
    allergies: "",
    antecedentes: "",
  });

  const [q, setQ] = useState("");

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addPatient() {
    if (!form.name || !form.age || !form.cedula) {
      return alert("Completa al menos: Nombre, Edad y Cédula.");
    }

    const newPatient = {
      id: Date.now(),
      name: form.name.trim(),
      age: Number(form.age),
      cedula: form.cedula.trim(),
      phone: form.phone.trim(),
      sex: form.sex,
      allergies: form.allergies
        ? form.allergies.split(",").map((x) => x.trim()).filter(Boolean)
        : [],
      antecedentes: form.antecedentes
        ? form.antecedentes.split(",").map((x) => x.trim()).filter(Boolean)
        : [],
      history: [],
    };

    onAddPatient(newPatient);

    setForm({
      name: "",
      age: "",
      cedula: "",
      phone: "",
      sex: "F",
      allergies: "",
      antecedentes: "",
    });
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return patients;
    return patients.filter((p) => {
      const name = (p.name || "").toLowerCase();
      const ci = (p.cedula || "").toLowerCase();
      const tel = (p.phone || "").toLowerCase();
      return name.includes(s) || ci.includes(s) || tel.includes(s);
    });
  }, [patients, q]);

  return (
    <div className="grid2">
      {/* COLUMNA IZQUIERDA: REGISTRO */}
      <div className="card">
        <div className="row">
          <h3 style={{ margin: 0 }}>➕ Nuevo paciente</h3>
          <span className="badge blue">Demo</span>
        </div>

        <div style={{ height: 12 }} />

        <input
          className="input"
          placeholder="Nombre completo"
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
        />

        <div style={{ height: 10 }} />

        <div className="grid2">
          <input
            className="input"
            placeholder="Edad"
            value={form.age}
            onChange={(e) => setField("age", e.target.value)}
          />

          <select
            className="input"
            value={form.sex}
            onChange={(e) => setField("sex", e.target.value)}
          >
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
          </select>
        </div>

        <div style={{ height: 10 }} />

        <input
          className="input"
          placeholder="Cédula"
          value={form.cedula}
          onChange={(e) => setField("cedula", e.target.value)}
        />

        <div style={{ height: 10 }} />

        <input
          className="input"
          placeholder="Teléfono"
          value={form.phone}
          onChange={(e) => setField("phone", e.target.value)}
        />

        <div style={{ height: 10 }} />

        <input
          className="input"
          placeholder="Alergias (Ej: Penicilina, Mariscos)"
          value={form.allergies}
          onChange={(e) => setField("allergies", e.target.value)}
        />

        <div style={{ height: 10 }} />

        <input
          className="input"
          placeholder="Antecedentes (Ej: Asma, HTA)"
          value={form.antecedentes}
          onChange={(e) => setField("antecedentes", e.target.value)}
        />

        <div style={{ height: 14 }} />

        <button className="btn ok" onClick={addPatient}>
          Registrar paciente
        </button>
      </div>

      {/* COLUMNA DERECHA: LISTA */}
      <div className="card">
        <div className="row">
          <div>
            <h3 style={{ margin: 0 }}>👥 Pacientes</h3>
            <div style={{ opacity: 0.75, fontSize: 12 }}>
              Pacientes registrados: <b>{patients.length}</b>
            </div>
          </div>

          <input
            className="input"
            style={{ width: 280, maxWidth: "100%" }}
            placeholder="Buscar por nombre / cédula / teléfono…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="hr" />

       {filtered.length === 0 ? (
  <p style={{ opacity: 0.7 }}>No hay coincidencias.</p>
) : (
  <div className="patientListWrap">
    <div className="grid">
      {filtered.map((p) => (
        <div
          key={p.id}
          className="card"
          style={{
            background: "rgba(0,0,0,.15)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <b>{p.name}</b>

              {p.allergies?.length > 0 && (
                <span className="badge red">⚠ Alergias</span>
              )}
            </div>

            <div style={{ fontSize: 13, opacity: 0.85 }}>
              {p.age} años · CI: {p.cedula}
              {p.phone ? ` · Tel: ${p.phone}` : ""}
            </div>

            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
              Última consulta: <b>{p.history?.length ? p.history[0].fecha : "—"}</b>
            </div>
          </div>

          <button className="btn primary" onClick={() => onSelect(p.id)}>
            Abrir
          </button>
        </div>
      ))}
    </div>
  </div>
)}
      </div>  
    </div>
  );
}
