import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import VisitForm from "../components/VisitForm";
import PatientEditModal from "../components/PatientEditModal";

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

function fmtNum(n, digits = 1) {
  if (n === null || n === undefined || n === "") return null;
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return x.toFixed(digits);
}

function classifyVitals(v) {
  let level = "ok";
  const setLevel = (next) => {
    const rank = { ok: 0, warn: 1, bad: 2 };
    if (rank[next] > rank[level]) level = next;
  };
  const bpSys = Number(v.bp_sys), bpDia = Number(v.bp_dia);
  if (Number.isFinite(bpSys) && Number.isFinite(bpDia)) {
    if (bpSys >= 140 || bpDia >= 90) setLevel("bad");
    else if (bpSys >= 130 || bpDia >= 85) setLevel("warn");
  }
  const hr = Number(v.hr);
  if (Number.isFinite(hr)) { if (hr > 120 || hr < 50) setLevel("warn"); }
  const spo2 = Number(v.spo2);
  if (Number.isFinite(spo2)) { if (spo2 < 92) setLevel("bad"); else if (spo2 < 95) setLevel("warn"); }
  const temp = Number(v.temp_c);
  if (Number.isFinite(temp)) { if (temp >= 38) setLevel("bad"); else if (temp >= 37.5) setLevel("warn"); }
  const map = { ok: "🟢 Normal", warn: "🟡 Atención", bad: "🔴 Alerta" };
  return map[level];
}

function vitalsSummary(v) {
  const parts = [];
  if (v.bp_sys && v.bp_dia) parts.push(`PA ${v.bp_sys}/${v.bp_dia}`);
  if (v.hr) parts.push(`FC ${v.hr}`);
  if (v.spo2) parts.push(`SpO₂ ${v.spo2}%`);
  if (v.temp_c !== null && v.temp_c !== undefined && v.temp_c !== "") parts.push(`T° ${fmtNum(v.temp_c, 1)}°C`);
  if (v.weight_kg !== null && v.weight_kg !== undefined && v.weight_kg !== "") parts.push(`Peso ${fmtNum(v.weight_kg, 1)}kg`);
  if (v.height_cm !== null && v.height_cm !== undefined && v.height_cm !== "") parts.push(`Talla ${fmtNum(v.height_cm, 0)}cm`);
  if (v.bmi !== null && v.bmi !== undefined && v.bmi !== "") parts.push(`IMC ${fmtNum(v.bmi, 1)}`);
  return parts.length ? parts.join(" · ") : "Sin signos vitales";
}

function initials(name) {
  return (name || "?").split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("");
}

function fmtDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PatientDetail() {
  const { id } = useParams();
  const nav = useNavigate();

  const patientId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loadingVisits, setLoadingVisits] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  async function loadAll() {
    if (!patientId) return;
    setLoading(true);
    setLoadingVisits(true);

    const p = await supabase.from("patients").select("*").eq("id", patientId).single();
    if (p.error) { alert("No se pudo cargar el paciente"); setLoading(false); setLoadingVisits(false); return; }
    setPatient(p.data);

    const v = await supabase
      .from("medical_visits")
      .select(`id, visit_date, reason, notes, created_at,
        bp_sys, bp_dia, hr, spo2, temp_c, weight_kg, height_cm, bmi, pediatric_percentile,
        medical_visit_diagnoses:medical_visit_diagnoses ( cie10_code, cie10_name )`)
      .eq("patient_id", patientId)
      .order("visit_date", { ascending: false });

    setVisits(v.error ? [] : (v.data || []));
    setLoading(false);
    setLoadingVisits(false);
  }

  useEffect(() => { loadAll(); }, [patientId]); // eslint-disable-line

  async function deleteVisit(visitId) {
    if (!confirm("¿Eliminar esta consulta?")) return;
    const { error } = await supabase.from("medical_visits").delete().eq("id", visitId);
    if (error) { alert(error.message || "No se pudo eliminar"); return; }
    loadAll();
  }

  if (!patientId) return <div className="mm-empty">ID inválido.</div>;
  if (loading) return <div className="mm-empty">Cargando ficha...</div>;
  if (!patient) return <div className="mm-empty">Paciente no encontrado.</div>;

  const allergies = Array.isArray(patient.allergies) ? patient.allergies : [];

  return (
    <div style={{ display: "grid", gap: 20 }}>

      {/* ─── Header del paciente ─── */}
      <div className="mm-card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Barra de acento */}
        <div style={{ height: 4, background: "linear-gradient(90deg,var(--mm-green),var(--mm-green2))" }} />
        <div style={{ padding: "20px 24px", display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Avatar grande */}
          <div className="mm-avatar" style={{ width: 56, height: 56, fontSize: 20, flexShrink: 0 }}>
            {initials(patient.name)}
          </div>

          {/* Info principal */}
          <div style={{ flex: 1, minWidth: 220 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--mm-text)" }}>
              {patient.name}
            </h2>
            <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 13, color: "var(--mm-muted)" }}>
              {patient.cedula && <span>CI: <strong style={{ color: "var(--mm-text)" }}>{patient.cedula}</strong></span>}
              <span>{patient.sex === "M" ? "Masculino" : "Femenino"}</span>
              <span>Edad: <strong style={{ color: "var(--mm-text)" }}>{ageLabelFromBirthdate(patient.birthdate)}</strong></span>
              {patient.phone && <span>📞 {patient.phone}</span>}
            </div>
            {allergies.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {allergies.map((a) => (
                  <span key={a} className="mm-chip mm-chip--warn" style={{ fontSize: 11 }}>⚠ {a}</span>
                ))}
              </div>
            )}
            {patient.notes && (
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--mm-muted)", lineHeight: 1.4 }}>
                {patient.notes}
              </p>
            )}
          </div>

          {/* Acciones */}
          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
            <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={() => nav("/patients")}>
              ← Volver
            </button>
            <button className="mm-btn mm-btn--primary mm-btn--sm" onClick={() => setEditOpen(true)}>
              ✏ Editar
            </button>
          </div>
        </div>
      </div>

      {/* ─── Grid: Formulario nueva consulta + Historial ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px,420px) 1fr", gap: 20, alignItems: "start" }}>

        {/* Nueva consulta */}
        <div className="mm-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "linear-gradient(90deg,var(--mm-green),var(--mm-green2))" }} />
          <div style={{ padding: "16px 20px" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "var(--mm-text)" }}>
              Nueva consulta
            </h3>
            <VisitForm patientId={patientId} onCreated={loadAll} />
          </div>
        </div>

        {/* Historial */}
        <div className="mm-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "linear-gradient(90deg,var(--mm-green),var(--mm-green2))" }} />
          <div style={{ padding: "16px 20px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--mm-text)" }}>
                Historial de consultas
              </h3>
              <span className="mm-chip">
                {loadingVisits ? "Cargando..." : `${visits.length} registro${visits.length !== 1 ? "s" : ""}`}
              </span>
            </div>
          </div>

          {loadingVisits ? (
            <div className="mm-empty" style={{ padding: 40 }}>Cargando...</div>
          ) : visits.length === 0 ? (
            <div className="mm-empty" style={{ padding: 40 }}>Sin consultas registradas.</div>
          ) : (
            <table className="mm-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Motivo</th>
                  <th>Diagnósticos</th>
                  <th>Vitales</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => {
                  const diags = Array.isArray(v.medical_visit_diagnoses) ? v.medical_visit_diagnoses : [];
                  return (
                    <tr
                      key={v.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => nav(`/visits/${v.id}`)}
                    >
                      <td style={{ whiteSpace: "nowrap", color: "var(--mm-muted)", fontSize: 13 }}>
                        {fmtDate(v.visit_date)}
                      </td>
                      <td>
                        <span style={{ fontWeight: 500 }}>{v.reason}</span>
                        {v.notes && (
                          <div style={{ fontSize: 12, color: "var(--mm-muted)", marginTop: 2, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {v.notes}
                          </div>
                        )}
                      </td>
                      <td>
                        {diags.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {diags.slice(0, 2).map((d) => (
                              <span key={d.cie10_code} style={{ fontSize: 12, color: "var(--mm-muted)" }}>
                                <strong style={{ color: "var(--mm-text)" }}>{d.cie10_code}</strong> {d.cie10_name}
                              </span>
                            ))}
                            {diags.length > 2 && <span style={{ fontSize: 11, color: "var(--mm-muted)" }}>+{diags.length - 2} más</span>}
                          </div>
                        ) : (
                          <span style={{ color: "var(--mm-muted)", fontSize: 12 }}>-</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--mm-muted)" }}>{vitalsSummary(v)}</td>
                      <td><span className="mm-chip mm-chip--green" style={{ fontSize: 11 }}>{classifyVitals(v)}</span></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          className="mm-btn mm-btn--danger mm-btn--sm"
                          onClick={() => deleteVisit(v.id)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <PatientEditModal
        open={editOpen}
        patient={patient}
        onClose={() => setEditOpen(false)}
        onSaved={loadAll}
      />
    </div>
  );
}
