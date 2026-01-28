import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
const CLINIC_PHONE = "0984340286";

function fmtDateLong(dateISO) {
  const d = dateISO ? new Date(dateISO) : new Date();
  return d.toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "2-digit" });
}
function fmtDateShort(dateISO) {
  const d = dateISO ? new Date(dateISO) : new Date();
  return d.toLocaleDateString("es-EC", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function PrescriptionDetail() {
  const { id } = useParams(); // /visits/:id/prescription
  const nav = useNavigate();
  const printRef = useRef(null);

  const visitId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  const [loading, setLoading] = useState(true);

  const [visit, setVisit] = useState(null);
  const [patient, setPatient] = useState(null);

  // Nota general opcional (solo UI, si quieres guardarla en DB luego te creo columna en medical_visits o tabla nueva)
  const [rxNotes, setRxNotes] = useState("");

  const [items, setItems] = useState([]);

  const doctor = {
    clinic: "MicMEDIC",
    fullName: "ESP. ROMO PROCEL DANIELA JACKELINE",
    specialty: "MÉDICO GENERAL",
    cedula: "050333534-1",
    regMedico: "0503335341 - 1027 - 2023 - 2599595",
    phone: "0984340286",
    email: "danitas0z@hotmail.com",
    address: "Cotopaxi - Salcedo Barrio La Tebaida (Calle Laguna Quilota y pasaje sin nombre)",
    place: "Salcedo",
  };

  async function loadAll() {
    if (!visitId) return;
    setLoading(true);

    // Visit
    const v = await supabase
      .from("medical_visits")
      .select("id, patient_id, visit_date, reason, cie10_code, cie10_name, notes, created_at")
      .eq("id", visitId)
      .single();

    if (v.error) {
      console.error(v.error);
      alert(v.error.message || "No se pudo cargar la consulta");
      setLoading(false);
      return;
    }
    setVisit(v.data);

    // Patient
    const p = await supabase.from("patients").select("*").eq("id", v.data.patient_id).single();
    if (p.error) {
      console.error(p.error);
      alert(p.error.message || "No se pudo cargar el paciente");
      setLoading(false);
      return;
    }
    setPatient(p.data);

    // Items (tu esquema real: encounter_id + med + instructions)
    const it = await supabase
      .from("prescription_items")
      .select("id, encounter_id, med, instructions, sort_order")
      .eq("encounter_id", visitId)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    if (it.error) {
      console.error(it.error);
      setItems([]);
    } else {
      setItems(it.data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line
  }, [visitId]);

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        id: `tmp_${crypto.randomUUID()}`,
        med: "",
        instructions: "",
        sort_order: prev.length + 1,
      },
    ]);
  }

  function updateItem(id, patch) {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function removeItem(id) {
    setItems((prev) =>
      prev
        .filter((x) => x.id !== id)
        .map((x, idx) => ({ ...x, sort_order: idx + 1 }))
    );
  }

  async function savePrescription() {
    if (!visit || !patient) return;

    // Limpieza y validación
    const cleaned = (items || [])
      .map((x, idx) => ({
        ...x,
        sort_order: idx + 1,
        med: (x.med || "").trim(),
        instructions: (x.instructions || "").trim(),
      }))
      .filter((x) => x.med && x.instructions);

    if (cleaned.length === 0) {
      alert("Agrega al menos 1 medicamento con indicaciones.");
      return;
    }

    // Estrategia simple: borrar lo anterior (solo de ESTE visitId) y reinsertar
    const del = await supabase.from("prescription_items").delete().eq("encounter_id", visitId);
    if (del.error) {
      console.error(del.error);
      alert(del.error.message || "No se pudo actualizar la receta (delete)");
      return;
    }

    const insertPayload = cleaned.map((x) => ({
      encounter_id: visitId,
      med: x.med,
      instructions: x.instructions,
      sort_order: x.sort_order,
    }));

    const ins = await supabase
      .from("prescription_items")
      .insert(insertPayload)
      .select("id, encounter_id, med, instructions, sort_order");

    if (ins.error) {
      console.error(ins.error);
      alert(ins.error.message || "No se pudo guardar la receta");
      return;
    }

    setItems(ins.data || []);
    alert("Receta guardada.");
  }

  function printPDF() {
    const node = printRef.current;
    if (!node) return;

    const LOGO_TOP = "/logo-top.png";
    const LOGO_WM = "/logo-watermark.png";

    // Obtener solo el contenido principal SIN la línea de firma
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = node.innerHTML;
    
    // Eliminar cualquier elemento de firma que pueda estar en el printRef
    const signatureElements = tempDiv.querySelectorAll('[style*="border-bottom"], [class*="signature"], [class*="line"]');
    signatureElements.forEach(el => el.remove());
    
    const contentWithoutSignature = tempDiv.innerHTML;

    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;

    w.document.open();
    w.document.write(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receta</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
    .paper { width: 820px; margin: 0 auto; position: relative; }

    /* Marca de agua */
    .watermark {
      position: absolute;
      inset: 0;
      background-image: url("${LOGO_WM}");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 560px auto;
      opacity: 0.35;
      pointer-events: none;
      z-index: 0;
    }

    /* Contenido por encima */
    .content { position: relative; z-index: 1; }

    /* Header con logo */
    .headerRow {
      display:flex;
      justify-content: space-between;
      align-items:flex-start;
      gap: 16px;
      margin-bottom: 8px;
    }
    .logoTop { height: 85px; object-fit: contain; }

    /* Estilos originales */
    .top { display:flex; justify-content: space-between; gap: 12px; align-items:flex-start; }
    .brand { font-weight: 900; font-size: 28px; }
    .muted { font-size: 12px; color:#333; line-height: 1.3; }
    .title { text-align:center; font-weight: 900; margin: 12px 0 14px; letter-spacing: .5px; }
    .info { font-size: 12px; line-height: 1.5; margin-bottom: 12px; }
    table { width:100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 10px; vertical-align: top; }
    th { font-size: 12px; text-align: left; }
    td { font-size: 12px; white-space: pre-wrap; }
    .footer { margin-top: 18px; font-size: 12px; }
    
    /* ÚNICA SECCIÓN DE FIRMA */
    .signature-section {
      margin-top: 40px;
      padding-top: 20px;
      text-align: center;
    }
    .signature-line {
      width: 300px;
      margin: 0 auto 15px;
      border-bottom: 1px solid #000;
      padding-bottom: 5px;
    }
    .doctor-name {
      font-size: 13px;
      font-weight: bold;
      margin-bottom: 3px;
    }
    .doctor-details {
      font-size: 11px;
      color: #555;
      line-height: 1.3;
      margin-bottom: 3px;
    }
    .doctor-contact {
      font-size: 11px;
      color: #333;
      line-height: 1.3;
    }
    
    /* Imprimir fondos */
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    @media print { 
      body { padding: 0; } 
      .paper { width: auto; margin: 0; }
      .signature-section {
        margin-top: 50px;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="paper">
    <div class="watermark"></div>

    <div class="content">
      <div class="headerRow">
        <img class="logoTop" src="${LOGO_TOP}" alt="Logo" />
        <div class="muted" style="text-align:right;">
          <div style="font-weight:900;">${doctor.fullName}</div>
          <div>${doctor.specialty}</div>
          <div>CEDULA: ${doctor.cedula}</div>
          <div>REG. MEDICO: ${doctor.regMedico}</div>
        </div>
      </div>

      ${contentWithoutSignature}

      <!-- ÚNICA SECCIÓN DE FIRMA (se añade aquí, no está duplicada) -->
      <div class="signature-section">
        <div class="signature-line"></div>
        <div class="doctor-name">${doctor.fullName}</div>
        <div class="doctor-details">
          ${doctor.specialty}<br>
          Cédula Profesional: ${doctor.cedula}<br>
          Registro Médico: ${doctor.regMedico}
        </div>
        <div class="doctor-contact">
          ${doctor.address}<br>
          Teléfono: ${CLINIC_PHONE} | Email: ${doctor.email}
        </div>
      </div>
    </div>
  </div>
</body>
</html>
    `);
    w.document.close();
    w.focus();
    w.print();
  }

  if (!visitId) return <div className="mm-empty">ID inválido.</div>;
  if (loading) return <div className="mm-empty">Cargando receta...</div>;
  if (!visit || !patient) return <div className="mm-empty">No se encontró la consulta.</div>;

  const diag =
    visit.cie10_code && visit.cie10_name
      ? `${visit.cie10_name} (${visit.cie10_code})`
      : visit.cie10_name || visit.cie10_code || "-";

  const rxDateISO = visit.visit_date || new Date().toISOString();

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 14, display: "grid", gap: 14 }}>
      <div className="mm-card">
        <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="mm-cardTitle">Receta</div>
            <div style={{ opacity: 0.85, fontSize: 13 }}>
              Paciente: <b>{patient.name}</b> · CI: <b>{patient.cedula}</b> · Fecha:{" "}
              <b>{new Date(rxDateISO).toLocaleString("es-EC")}</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="mm-btn mm-btn--ghost" type="button" onClick={() => nav(`/visits/${visit.id}`)}>
              Volver a consulta
            </button>
          </div>
        </div>

        <div className="mm-itemMeta" style={{ padding: 14 }}>
          <div><b>Motivo:</b> {visit.reason || "-"}</div>
          <div><b>Diagnóstico (CIE10):</b> {diag}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Editor */}
        <div className="mm-card">
          <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
            <div className="mm-cardTitle">Medicamentos</div>
            <div className="mm-chip">Consulta #{visit.id}</div>
          </div>

          <div style={{ padding: 14, display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Notas (opcional)</div>
              <input
                className="mm-input"
                placeholder="Ej: No automedicarse"
                value={rxNotes}
                onChange={(e) => setRxNotes(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button className="mm-btn" type="button" onClick={addItem}>
                + Añadir medicamento
              </button>

              <button className="mm-btn mm-btn--ghost" type="button" onClick={savePrescription}>
                Guardar receta
              </button>

              <button className="mm-btn mm-btn--ghost" type="button" onClick={printPDF}>
                Imprimir / Guardar PDF
              </button>
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 6 }}>
              {items.length === 0 && <div className="mm-empty">Aún no hay medicamentos. Clic en "Añadir medicamento".</div>}

              {items.map((it) => (
                <div key={it.id} className="mm-item" style={{ cursor: "default" }}>
                  <div className="mm-itemTop" style={{ alignItems: "center" }}>
                    <div className="mm-itemName">Medicamento #{(it.sort_order ?? 1)}</div>
                    <button className="mm-btn mm-btn--ghost" type="button" onClick={() => removeItem(it.id)}>
                      Quitar
                    </button>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    <input
                      className="mm-input"
                      placeholder="Medicamento (ej: Amoxicilina 500mg)"
                      value={it.med || ""}
                      onChange={(e) => updateItem(it.id, { med: e.target.value })}
                    />

                    <textarea
                      className="mm-input"
                      style={{ minHeight: 80, paddingTop: 10 }}
                      placeholder="Indicaciones (ej: 1 cápsula cada 8 horas por 7 días)"
                      value={it.instructions || ""}
                      onChange={(e) => updateItem(it.id, { instructions: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Preview imprimible */}
        <div className="mm-card">
          <div className="mm-cardHead">
            <div className="mm-cardTitle">Vista previa (Receta)</div>
            <div className="mm-chip">PDF</div>
          </div>

          <div style={{ padding: 14 }}>
            <div ref={printRef}>
              <div className="top">
                <div className="muted" style={{ textAlign: "right" }}>
                  <div>{doctor.place}, {fmtDateLong(rxDateISO)}</div>
                  <div>Tel: {CLINIC_PHONE}</div>
                  <div>{doctor.email}</div>
                </div>
              </div>

              <div className="title">RECETA MÉDICA</div>

              <div className="info">
                <div><b>Paciente:</b> {patient.name}</div>
                <div><b>CI:</b> {patient.cedula} &nbsp;&nbsp; <b>Tel:</b> {patient.phone || "-"}</div>
                <div><b>Fecha de atención:</b> {fmtDateShort(rxDateISO)}</div>
                <div><b>Diagnóstico (CIE10):</b> {diag}</div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style={{ width: "40%" }}>Medicamento</th>
                    <th>Indicaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(items || [])
                    .filter((x) => (x.med || "").trim() && (x.instructions || "").trim())
                    .map((x, idx) => (
                      <tr key={x.id ?? idx}>
                        <td>{x.med}</td>
                        <td>{x.instructions}</td>
                      </tr>
                    ))}

                  {items.filter((x) => (x.med || "").trim() && (x.instructions || "").trim()).length === 0 && (
                    <tr>
                      <td colSpan={2} style={{ textAlign: "center", opacity: 0.7 }}>
                        Aún no hay medicamentos válidos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {rxNotes?.trim() ? (
                <div className="footer">
                  <b>Notas:</b> {rxNotes}
                </div>
              ) : null}

              {/* NOTA: No agregamos línea de firma aquí, solo espacio para ella */}
              <div style={{ marginTop: "80px" }}>
                {/* Solo espacio vacío donde irá la firma */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}