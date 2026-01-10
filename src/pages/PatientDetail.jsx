import React, { useMemo, useState } from "react";
import { generarRecetaPDF } from "../utils/pdf";

export default function PatientDetail({ patient, onBack, onUpdatePatient }) {
  const [diagnostico, setDiagnostico] = useState("");
  const [tratamiento, setTratamiento] = useState("");

  const [editMode, setEditMode] = useState(false);
  const [edit, setEdit] = useState({
    phone: patient?.phone || "",
    allergies: (patient?.allergies || []).join(", "),
    antecedentes: (patient?.antecedentes || []).join(", "),
  });

  const chips = useMemo(() => {
    return {
      allergies: patient?.allergies?.length ? patient.allergies.join(", ") : "Ninguna",
      antecedentes: patient?.antecedentes?.length ? patient.antecedentes.join(", ") : "—",
    };
  }, [patient]);

  if (!patient) return <div className="card">No hay paciente seleccionado.</div>;

  function hoy() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  function guardarConsulta() {
    if (!diagnostico.trim() || !tratamiento.trim()) {
      return alert("Completa diagnóstico y tratamiento.");
    }

    const nuevaConsulta = {
      id: Date.now(),
      fecha: hoy(),
      diagnostico: diagnostico.trim(),
      tratamiento: tratamiento.trim(),
    };

    const updated = {
      ...patient,
      history: [nuevaConsulta, ...(patient.history || [])],
    };

    onUpdatePatient(updated);
    setDiagnostico("");
    setTratamiento("");
  }

  function pdfDeConsulta(c) {
    generarRecetaPDF({
      doctor: "Dra. Andrea",
      paciente: `${patient.name} (CI: ${patient.cedula})`,
      diagnostico: c.diagnostico,
      tratamiento: c.tratamiento,
    });
  }

  function pdfActual() {
    generarRecetaPDF({
      doctor: "Dra. Andrea",
      paciente: `${patient.name} (CI: ${patient.cedula})`,
      diagnostico,
      tratamiento,
    });
  }

  function guardarEdicion() {
    const allergiesArr = edit.allergies
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    const antArr = edit.antecedentes
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    const updated = {
      ...patient,
      phone: edit.phone.trim(),
      allergies: allergiesArr,
      antecedentes: antArr,
    };

    onUpdatePatient(updated);
    setEditMode(false);
  }

  return (
    <div className="grid">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <button className="btn" onClick={onBack}>← Volver</button>

        {!editMode ? (
          <button className="btn primary" onClick={() => { setEditMode(true); }}>
            Editar paciente
          </button>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn ok" onClick={guardarEdicion}>Guardar cambios</button>
            <button className="btn" onClick={() => setEditMode(false)}>Cancelar</button>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ margin: 0 }}>{patient.name}</h2>
        <div style={{ opacity: 0.8, marginTop: 6 }}>
          <b>Edad:</b> {patient.age} — <b>Sexo:</b> {patient.sex} <br />
          <b>CI:</b> {patient.cedula} — <b>Tel:</b> {patient.phone || "—"}
        </div>

        <div className="hr" />

        {!editMode ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span className="chip warn"><b>Alergias:</b>&nbsp;{chips.allergies}</span>
            <span className="chip"><b>Antecedentes:</b>&nbsp;{chips.antecedentes}</span>
          </div>
        ) : (
          <div className="grid" style={{ marginTop: 10 }}>
            <label style={{ opacity: 0.8 }}>Teléfono</label>
            <input className="input" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />

            <label style={{ opacity: 0.8 }}>Alergias (separadas por comas)</label>
            <input className="input" value={edit.allergies} onChange={(e) => setEdit({ ...edit, allergies: e.target.value })} />

            <label style={{ opacity: 0.8 }}>Antecedentes (separados por comas)</label>
            <input className="input" value={edit.antecedentes} onChange={(e) => setEdit({ ...edit, antecedentes: e.target.value })} />
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Nueva consulta</h3>

        <input
          className="input"
          placeholder="Diagnóstico"
          value={diagnostico}
          onChange={(e) => setDiagnostico(e.target.value)}
        />

        <div style={{ height: 10 }} />

        <textarea
          className="input"
          placeholder="Tratamiento / Indicaciones"
          value={tratamiento}
          onChange={(e) => setTratamiento(e.target.value)}
          rows={5}
        />

        <div style={{ height: 12 }} />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn ok" onClick={guardarConsulta}>Guardar consulta</button>
          <button className="btn primary" onClick={pdfActual}>PDF de esta consulta</button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Historial clínico</h3>

        {(!patient.history || patient.history.length === 0) ? (
          <div style={{ opacity: 0.75 }}>Aún no hay consultas registradas.</div>
        ) : (
          <div className="grid">
            {patient.history.map((c) => (
              <div key={c.id} className="card" style={{ background: "rgba(0,0,0,.12)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <b>{c.fecha}</b>
                  <button className="btn" onClick={() => pdfDeConsulta(c)}>PDF</button>
                </div>

                <div style={{ marginTop: 8 }}>
                  <div><b>Diagnóstico:</b> {c.diagnostico}</div>
                  <div><b>Tratamiento:</b> {c.tratamiento}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
