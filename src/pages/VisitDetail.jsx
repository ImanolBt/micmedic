import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

/**
 * VisitDetail.jsx
 * Ruta sugerida: /visits/:id
 * Requiere tablas:
 * - medical_visits (id bigint, patient_id bigint, visit_date timestamptz, reason text, cie10_code text, cie10_name text, notes text, user_id uuid)
 * - patients (id bigint, name, cedula, phone, birthdate, age, allergies, notes)
 * - certificates (según el CREATE TABLE que pegaste)
 */

function fmtDateLong(dateISO) {
  const d = dateISO ? new Date(dateISO) : new Date();
  return d.toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "2-digit" });
}
function fmtDateShort(dateISO) {
  const d = dateISO ? new Date(dateISO) : new Date();
  return d.toLocaleDateString("es-EC", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function VisitDetail() {
  const { id } = useParams(); // /visits/:id
  const nav = useNavigate();
  const printRef = useRef(null);

  const visitId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null; // medical_visits.id es bigint
  }, [id]);

  const [loading, setLoading] = useState(true);

  const [visit, setVisit] = useState(null);
  const [patient, setPatient] = useState(null);

  // Certificate data
  const [certId, setCertId] = useState(null);
  const [certDate, setCertDate] = useState(() => new Date().toISOString());

  const [daysRest, setDaysRest] = useState(0);
  const [entity, setEntity] = useState("");
  const [position, setPosition] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");

  const [includeNotes, setIncludeNotes] = useState(false);
  const [notes, setNotes] = useState("");

  // Campos que tú quieres fijos (editables en código)
  const clinicName = "Consultorio médico MIC MEDIC";
  const contingency = "Enfermedad general";
  const attentionType = "Medicina general";
  const treatment = "Farmacológico";

  // Datos del médico (pon los reales)
  const doctor = {
    fullName: "MED. ROMO PROCEL DANIELA JACKELINE",
    specialty: "MÉDICO GENERAL",
    cedula: "050333534-1",
    regMedico: "0503335341 - 1027 - 2023 - 2599595",
    phone: "0979344305",
    email: "danitas0z@hotmail.com",
    address: "Cotopaxi - Salcedo Barrio La Tebaida (Calle Laguna Quilota y pasaje sin nombre)",
    headerLine1: "Med. Daniela Romo",
    headerLine2: "Especialista en Medicina Ocupacional",
    headerLine3: "Msc. en Prevención de Riesgos Laborales",
    headerLine4: "MEDICINA GENERAL",
  };

  async function loadAll() {
    if (!visitId) return;
    setLoading(true);

    // 1) Visit
    const v = await supabase
      .from("medical_visits")
      .select("id, patient_id, visit_date, reason, cie10_code, cie10_name, notes, created_at, user_id")
      .eq("id", visitId)
      .single();

    if (v.error) {
      console.error(v.error);
      alert(v.error.message || "No se pudo cargar la consulta");
      setLoading(false);
      return;
    }

    // 2) Patient
    const p = await supabase.from("patients").select("*").eq("id", v.data.patient_id).single();
    if (p.error) {
      console.error(p.error);
      alert(p.error.message || "No se pudo cargar el paciente");
      setLoading(false);
      return;
    }

    setVisit(v.data);
    setPatient(p.data);

    // 3) Certificate (si existe)
    const c = await supabase
      .from("certificates")
      .select(
        "id, date, days_rest, entity, position, address, email, include_notes, notes, title, body, visit_id, patient_id"
      )
      .eq("visit_id", visitId)
      .maybeSingle();

    if (c.error) {
      console.error(c.error);
      // OJO: si aquí te vuelve a salir "schema cache", ejecuta:
      // notify pgrst, 'reload schema';
    } else if (c.data) {
      setCertId(c.data.id);
      setCertDate(c.data.date || new Date().toISOString());
      setDaysRest(c.data.days_rest ?? 0);
      setEntity(c.data.entity ?? "");
      setPosition(c.data.position ?? "");
      setAddress(c.data.address ?? "");
      setEmail(c.data.email ?? "");
      setIncludeNotes(!!c.data.include_notes);
      setNotes(c.data.notes ?? "");
    } else {
      // Defaults para crear rápido
      setCertId(null);
      setCertDate(v.data.visit_date || new Date().toISOString());
      setDaysRest(0);
      setEntity("");
      setPosition("");
      setAddress("");
      setEmail("");
      setIncludeNotes(false);
      setNotes("");
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line
  }, [visitId]);

  async function saveCertificate() {
    if (!visit || !patient) return;

    // Body del certificado (texto base). Puedes ajustarlo si quieres más “idéntico” al formato.
    const diag =
      visit.cie10_code && visit.cie10_name
        ? `${visit.cie10_name} CIE10 (${visit.cie10_code})`
        : visit.cie10_name || visit.cie10_code || "-";

    const baseBody = [
      "A quien interese,",
      "",
      `Por medio de la presente CERTIFICO que el paciente ${patient.name} con CI. ${patient.cedula}, fue atendido por:`,
      "",
      `Diagnóstico: ${diag}`,
      `Numero de historia clínica: ${patient.cedula}`,
      `Lugar de atención: ${clinicName}`,
      `Contingencia: ${contingency}`,
      `Tipo de atención: ${attentionType}`,
      `Fecha de atención: ${fmtDateShort(visit.visit_date)}`,
      `Tratamiento: ${treatment}`,
      `Reposo absoluto: ${Number(daysRest || 0)} (TRES) DIAS, DESDE EL ${fmtDateShort(
        visit.visit_date
      )} hasta el ${fmtDateShort(new Date(new Date(visit.visit_date).getTime() + Number(daysRest || 0) * 86400000).toISOString())}`,
      "",
      `Entidad: ${entity || "-"}`,
      `Cargo: ${position || "-"}`,
      `Domicilio: ${address || "-"}`,
      `Correo electrónico: ${email || "-"}`,
      "",
      "Es todo en cuanto puedo certificar en honor a la verdad, autorizando al interesado hacer uso del presente certificado en trámites pertinentes.",
    ].join("\n");

    const payload = {
      visit_id: visit.id,
      patient_id: patient.id,
      date: certDate ? new Date(certDate).toISOString() : new Date().toISOString(),
      title: "CERTIFICADO MÉDICO",
      body: baseBody,
      days_rest: Number(daysRest || 0),
      notes: notes || null,
      include_notes: !!includeNotes,
      entity: entity || null,
      position: position || null,
      address: address || null,
      email: email || null,
    };

    // Upsert por unique(visit_id)
    const up = await supabase
      .from("certificates")
      .upsert(payload, { onConflict: "visit_id" })
      .select("id")
      .single();

    if (up.error) {
      console.error(up.error);
      alert(up.error.message || "No se pudo guardar el certificado");
      return;
    }

    setCertId(up.data.id);
    alert("Certificado guardado.");
    loadAll();
  }

  function printPDF() {
    // Imprime SOLO la sección del certificado
    const node = printRef.current;
    if (!node) return;

    const html = node.innerHTML;
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;

    w.document.open();
    w.document.write(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Certificado</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
    .paper { width: 800px; margin: 0 auto; }
    .head { display:flex; justify-content: space-between; align-items:flex-start; gap: 16px; }
    .brand { font-weight: 900; font-size: 34px; letter-spacing: .5px; }
    .muted { color:#333; font-size: 12px; line-height: 1.25; }
    .title { text-align:center; font-weight: 900; margin: 18px 0 16px; }
    .body { font-size: 13px; line-height: 1.55; white-space: pre-wrap; }
    .sign { margin-top: 22px; text-align: center; }
    .foot { margin-top: 10px; text-align:center; font-size: 12px; }
    .line { margin: 18px 0; border-top: 1px solid #ddd; }
    @media print {
      body { padding: 0; }
      .paper { width: auto; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="paper">${html}</div>
</body>
</html>
    `);
    w.document.close();
    w.focus();
    w.print();
  }

  if (!visitId) return <div className="mm-empty">ID inválido.</div>;
  if (loading) return <div className="mm-empty">Cargando consulta...</div>;
  if (!visit || !patient) return <div className="mm-empty">No se encontró la consulta.</div>;

  const diagLabel =
    visit.cie10_code && visit.cie10_name ? `${visit.cie10_name} (${visit.cie10_code})` : visit.cie10_name || visit.cie10_code || "-";

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 14, display: "grid", gap: 14 }}>
      <div className="mm-card">
        <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="mm-cardTitle">Consulta</div>
            <div style={{ opacity: 0.85, fontSize: 13 }}>
              Paciente: <b>{patient.name}</b> · CI: <b>{patient.cedula}</b> · Fecha:{" "}
              <b>{new Date(visit.visit_date).toLocaleString("es-EC")}</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="mm-btn mm-btn--ghost" type="button" onClick={() => nav(`/patients/${patient.id}`)}>
              Volver a ficha
            </button>
          </div>
        </div>

        <div className="mm-itemMeta" style={{ padding: 14 }}>
          <div><b>Motivo:</b> {visit.reason || "-"}</div>
          <div><b>Diagnóstico (CIE10):</b> {diagLabel}</div>
          <div><b>Notas de consulta:</b> {visit.notes || "-"}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Panel de edición */}
        <div className="mm-card">
          <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
            <div className="mm-cardTitle">Certificado médico</div>
            <div className="mm-chip">{certId ? `ID ${certId}` : "Nuevo"}</div>
          </div>

          <div style={{ padding: 14, display: "grid", gap: 10 }}>
            <div className="mm-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Fecha del certificado</div>
                <input
                  className="mm-input"
                  type="date"
                  value={new Date(certDate).toISOString().slice(0, 10)}
                  onChange={(e) => setCertDate(new Date(e.target.value).toISOString())}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Días de reposo</div>
                <input
                  className="mm-input"
                  type="number"
                  min={0}
                  max={30}
                  value={daysRest}
                  onChange={(e) => setDaysRest(e.target.value)}
                />
              </div>
            </div>

            <input className="mm-input" placeholder="Entidad (ej: Unidad Educativa ...)" value={entity} onChange={(e) => setEntity(e.target.value)} />
            <input className="mm-input" placeholder="Cargo (ej: Docente)" value={position} onChange={(e) => setPosition(e.target.value)} />
            <input className="mm-input" placeholder="Domicilio" value={address} onChange={(e) => setAddress(e.target.value)} />
            <input className="mm-input" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} />

            <div style={{ display: "flex", gap: 10, alignItems: "center", paddingTop: 4 }}>
              <input
                id="includeNotes"
                type="checkbox"
                checked={includeNotes}
                onChange={(e) => setIncludeNotes(e.target.checked)}
              />
              <label htmlFor="includeNotes" style={{ fontSize: 13 }}>
                Incluir notas adicionales en el certificado
              </label>
            </div>

            {includeNotes && (
              <textarea
                className="mm-input"
                style={{ minHeight: 90, paddingTop: 10 }}
                placeholder="Notas adicionales (opcional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            )}
<button
  className="mm-btn mm-btn--ghost"
  type="button"
  onClick={() => nav(`/visits/${visit.id}/prescription`)}
>
  Receta
</button>

            <div style={{ display: "flex", gap: 10 }}>
              <button className="mm-btn" type="button" onClick={saveCertificate}>
                Guardar certificado
              </button>

              <button className="mm-btn mm-btn--ghost" type="button" onClick={printPDF}>
                Imprimir / Guardar PDF
              </button>
            </div>

            <div className="mm-hint">
              Consejo: primero guarda, luego imprime. Así queda todo persistido por consulta.
            </div>
          </div>
        </div>

        {/* Vista previa imprimible */}
        <div className="mm-card">
          <div className="mm-cardHead">
            <div className="mm-cardTitle">Vista previa</div>
            <div className="mm-chip">PDF</div>
          </div>

          <div style={{ padding: 14 }}>
            <div ref={printRef}>
              <div className="head">
                <div>
                  <div className="brand">MicMEDIC</div>
                </div>
                <div className="muted" style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 900 }}>{doctor.headerLine1}</div>
                  <div>{doctor.headerLine2}</div>
                  <div>{doctor.headerLine3}</div>
                  <div style={{ fontWeight: 900 }}>{doctor.headerLine4}</div>
                  <div style={{ marginTop: 6 }}>
                    Salcedo, {fmtDateLong(certDate)}
                  </div>
                </div>
              </div>

              <div className="title">CERTIFICADO MEDICO</div>

              <div className="body">
                {`A quien interese,

Por medio de la presente CERTIFICO que el paciente ${patient.name} con CI. ${patient.cedula}, fue atendido por:

Diagnostico: ${visit.cie10_name ? visit.cie10_name : "-"} CIE10 (${visit.cie10_code ? visit.cie10_code : "-"})

Numero de historia clinica: ${patient.cedula}

Lugar de atencion: ${clinicName}

Contingencia: ${contingency}

Tipo de atencion: ${attentionType}

Fecha de atencion: ${fmtDateShort(visit.visit_date)}

Tratamiento: ${treatment}

Reposo absoluto: ${Number(daysRest || 0)} (TRES) DIAS

Entidad: ${entity || "-"}

Cargo: ${position || "-"}

Domicilio: ${address || "-"}

Correo electronico: ${email || "-"}

Es todo en cuanto puedo certificar en honor a la verdad, autorizando al interesado hacer uso del presente certificado en tramites pertinentes.`}
              </div>

              <div className="sign">
                <div style={{ marginTop: 18 }}>Atentamente</div>
                <div className="line"></div>
                <div style={{ fontWeight: 900 }}>{doctor.fullName}</div>
                <div style={{ fontWeight: 900 }}>{doctor.specialty}</div>
                <div>CEDULA: {doctor.cedula}</div>
                <div>REG. MEDICO: {doctor.regMedico}</div>
                <div>CELULAR: {doctor.phone}</div>
                <div>CORREO: {doctor.email}</div>
                <div style={{ marginTop: 8 }}>Direccion: {doctor.address}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
