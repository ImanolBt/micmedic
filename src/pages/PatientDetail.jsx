import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import VisitForm from "../components/VisitForm";

function formatVisitDate(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

export default function PatientDetail() {
  const { id } = useParams(); // /patients/:id
  const nav = useNavigate();

  const patientId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null; // patients.id es bigint
  }, [id]);

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);

  const [visits, setVisits] = useState([]);
  const [loadingVisits, setLoadingVisits] = useState(true);

  async function loadAll() {
    if (!patientId) return;

    setLoading(true);
    setLoadingVisits(true);

    const p = await supabase.from("patients").select("*").eq("id", patientId).single();
    if (p.error) {
      console.error(p.error);
      alert("No se pudo cargar el paciente");
      setLoading(false);
      setLoadingVisits(false);
      return;
    }
    setPatient(p.data);

    const v = await supabase
      .from("medical_visits")
      .select("id, visit_date, reason, cie10_code, cie10_name, notes, created_at")
      .eq("patient_id", patientId)
      .order("visit_date", { ascending: false });

    if (v.error) {
      console.error(v.error);
      setVisits([]);
    } else {
      setVisits(v.data || []);
    }

    setLoading(false);
    setLoadingVisits(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line
  }, [patientId]);

  async function deleteVisit(visitId) {
    const ok = confirm("¿Eliminar esta consulta?");
    if (!ok) return;

    const { error } = await supabase.from("medical_visits").delete().eq("id", visitId);
    if (error) {
      console.error(error);
      alert(error.message || "No se pudo eliminar");
      return;
    }
    loadAll();
  }

  if (!patientId) return <div className="mm-empty">ID inválido.</div>;
  if (loading) return <div className="mm-empty">Cargando ficha...</div>;
  if (!patient) return <div className="mm-empty">Paciente no encontrado.</div>;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 14, display: "grid", gap: 14 }}>
      {/* Header paciente */}
      <div className="mm-card">
        <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="mm-cardTitle">{patient.name}</div>
            <div style={{ opacity: 0.85, fontSize: 13 }}>
              Cédula: <b>{patient.cedula}</b> · Tel: <b>{patient.phone || "-"}</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="mm-btn mm-btn--ghost" type="button" onClick={() => nav("/patients")}>
              Volver
            </button>
          </div>
        </div>

        <div className="mm-itemMeta" style={{ padding: 14 }}>
          <div>
            <b>Sexo:</b> {patient.sex === "M" ? "Masculino" : "Femenino"}
          </div>
          <div>
            <b>Nacimiento:</b> {patient.birthdate || "-"}
          </div>
          <div>
            <b>Edad:</b> {patient.age ?? "-"}
          </div>
          <div>
            <b>Alergias:</b>{" "}
            {Array.isArray(patient.allergies)
              ? patient.allergies.join(", ")
              : patient.allergies || "-"}
          </div>
          <div>
            <b>Notas:</b> {patient.notes || "-"}
          </div>
        </div>
      </div>

      {/* Grid: Nueva consulta + Historial */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <VisitForm patientId={patientId} onCreated={loadAll} />

        <div className="mm-card">
          <div className="mm-cardHead">
            <div className="mm-cardTitle">Historial de consultas</div>
            <div className="mm-chip">{loadingVisits ? "Cargando..." : `${visits.length} registros`}</div>
          </div>

          <div style={{ padding: 14, display: "grid", gap: 10 }}>
            {loadingVisits && <div className="mm-empty">Cargando...</div>}

            {!loadingVisits && visits.length === 0 && (
              <div className="mm-empty">No hay consultas registradas.</div>
            )}

            {!loadingVisits &&
              visits.map((v) => {
                const go = () => nav(`/visits/${v.id}`);

                return (
                  <div
                    key={v.id}
                    className="mm-item"
                    role="button"
                    tabIndex={0}
                    onClick={go}
                    onKeyDown={(e) => e.key === "Enter" && go()}
                    style={{ cursor: "pointer" }}
                    title="Abrir detalle de consulta"
                  >
                    <div className="mm-itemTop" style={{ alignItems: "flex-start" }}>
                      <div style={{ display: "grid", gap: 2 }}>
                        <div className="mm-itemName">{v.reason || "Consulta"}</div>
                        <div style={{ fontSize: 13, opacity: 0.85 }}>{formatVisitDate(v.visit_date)}</div>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div className="mm-chip">{v.cie10_code ? v.cie10_code : "CIE10"}</div>

                        {/* Ver */}
                        <button
                          type="button"
                          className="mm-btn mm-btn--ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            go();
                          }}
                        >
                          Ver
                        </button>

                        {/* Eliminar (no debe abrir la consulta) */}
                        <button
                          type="button"
                          className="mm-btn mm-btn--ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteVisit(v.id);
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>

                    <div className="mm-itemMeta">
                      <div>
                        <b>Diagnóstico:</b> {v.cie10_name || "-"}
                      </div>
                      <div>
                        <b>Notas:</b> {v.notes || "-"}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
