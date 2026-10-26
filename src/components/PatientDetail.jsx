import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import PatientForm from "./PatientForm";
import VisitForm from "./VisitForm";
import AppointmentForm from "./AppointmentForm";
import AppointmentList from "./AppointmentList";

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient,  setPatient]  = useState(null);
  const [visits,   setVisits]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState("historial");
  const [editPt,   setEditPt]   = useState(false);
  const [newVisit, setNewVisit] = useState(false);
  const [newAppt,  setNewAppt]  = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: pt }, { data: vs }] = await Promise.all([
      supabase.from("patients").select("*").eq("id", id).single(),
      supabase.from("visits").select("*").eq("patient_id", id).order("visit_date", { ascending: false }),
    ]);
    setPatient(pt); setVisits(vs ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return (
    <div className="mm-page" style={{ display: "grid", placeItems: "center", minHeight: 300 }}>
      <div style={{ color: "var(--c-muted)" }}>Cargando expediente…</div>
    </div>
  );

  if (!patient) return (
    <div className="mm-page">
      <div className="mm-alert mm-alert--error">Paciente no encontrado.</div>
      <button className="mm-btn mm-btn--ghost" onClick={() => navigate("/patients")} style={{ marginTop: 16 }}>← Volver</button>
    </div>
  );

  const calcAge = (dob) => {
    if (!dob) return null;
    return Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000);
  };

  const fmt = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  };

  const age = calcAge(patient.date_of_birth);
  const initials = (patient.first_name?.[0] ?? "") + (patient.last_name?.[0] ?? "");

  const TABS = [
    { id: "historial",  label: "Historial de consultas" },
    { id: "citas",      label: "Citas" },
    { id: "info",       label: "Información" },
  ];

  return (
    <div className="mm-page">
      {/* Breadcrumb */}
      <button onClick={() => navigate("/patients")} className="mm-btn mm-btn--ghost mm-btn--sm" style={{ marginBottom: 20 }}>
        ← Pacientes
      </button>

      {/* Header card */}
      <div className="mm-card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div className="mm-avatar" style={{ width: 64, height: 64, fontSize: 22 }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.4px", marginBottom: 4 }}>
              {patient.first_name} {patient.last_name}
            </h1>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {age != null && <span className="mm-chip">{age} años</span>}
              {patient.blood_type && <span className="mm-chip mm-chip--red">🩸 {patient.blood_type}</span>}
              {patient.gender && <span className="mm-chip">{patient.gender === "F" ? "Femenino" : patient.gender === "M" ? "Masculino" : "Otro"}</span>}
              {patient.allergies && <span className="mm-chip mm-chip--warn">⚠ Alergias</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setNewAppt(true)} className="mm-btn mm-btn--ghost mm-btn--sm">📅 Nueva cita</button>
            <button onClick={() => setNewVisit(true)} className="mm-btn mm-btn--sm">🩺 Nueva consulta</button>
            <button onClick={() => setEditPt(true)}   className="mm-btn mm-btn--ghost mm-btn--sm">✏ Editar</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`mm-btn mm-btn--sm ${tab === t.id ? "" : "mm-btn--ghost"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Historial */}
      {tab === "historial" && (
        <div className="mm-card" style={{ padding: 0 }}>
          <div className="mm-card-accent-bar" />
          <div className="mm-section-head">
            <div className="mm-card-title">Consultas ({visits.length})</div>
          </div>
          <div className="mm-table-wrap">
            <table className="mm-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Motivo</th>
                  <th>Diagnóstico</th>
                  <th>Peso</th>
                  <th>T/A</th>
                </tr>
              </thead>
              <tbody>
                {visits.length === 0 ? (
                  <tr><td colSpan={5}><div className="mm-empty">Sin consultas registradas</div></td></tr>
                ) : visits.map(v => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{fmt(v.visit_date)}</td>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {v.chief_complaint || "—"}
                    </td>
                    <td style={{ color: "var(--c-text-2)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {v.diagnosis || "—"}
                    </td>
                    <td style={{ color: "var(--c-muted)" }}>{v.weight ? `${v.weight} kg` : "—"}</td>
                    <td style={{ color: "var(--c-muted)" }}>
                      {v.systolic_bp && v.diastolic_bp ? `${v.systolic_bp}/${v.diastolic_bp}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Citas */}
      {tab === "citas" && <AppointmentList patientId={id} />}

      {/* Tab: Información */}
      {tab === "info" && (
        <div className="mm-row-2" style={{ alignItems: "start" }}>
          <div className="mm-card">
            <div className="mm-card-head"><span className="mm-card-title">Datos personales</span></div>
            {[
              ["CURP",           patient.curp],
              ["Teléfono",       patient.phone],
              ["Correo",         patient.email],
              ["Dirección",      patient.address],
              ["Tipo de sangre", patient.blood_type],
              ["Fecha de nac.",  fmt(patient.date_of_birth)],
            ].map(([k, v]) => v ? (
              <div key={k} style={{ display: "flex", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--c-border)" }}>
                <span style={{ fontSize: 12, color: "var(--c-muted)", width: 110, flexShrink: 0 }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{v}</span>
              </div>
            ) : null)}
          </div>
          <div className="mm-card">
            <div className="mm-card-head"><span className="mm-card-title">Antecedentes</span></div>
            <div className="mm-field" style={{ marginBottom: 12 }}>
              <label className="mm-label">Alergias</label>
              <div style={{ fontSize: 13, color: patient.allergies ? "var(--c-text)" : "var(--c-muted)" }}>
                {patient.allergies || "Ninguna registrada"}
              </div>
            </div>
            <div className="mm-field">
              <label className="mm-label">Notas</label>
              <div style={{ fontSize: 13, color: patient.notes ? "var(--c-text)" : "var(--c-muted)" }}>
                {patient.notes || "Sin notas adicionales"}
              </div>
            </div>
          </div>
        </div>
      )}

      {editPt  && <PatientForm   patient={patient} onClose={() => setEditPt(false)}   onSaved={() => { setEditPt(false);   load(); }} />}
      {newVisit && <VisitForm    patientId={id}    onClose={() => setNewVisit(false)} onSaved={() => { setNewVisit(false); load(); }} />}
      {newAppt  && <AppointmentForm patientId={id} onClose={() => setNewAppt(false)}  onSaved={() => { setNewAppt(false);  load(); }} />}
    </div>
  );
}
