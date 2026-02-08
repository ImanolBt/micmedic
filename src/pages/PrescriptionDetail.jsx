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
  const { id } = useParams();
  const nav = useNavigate();
  const printRef = useRef(null);

  const visitId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  const [loading, setLoading] = useState(true);

  const [visit, setVisit] = useState(null);
  const [patient, setPatient] = useState(null);

  const [rxNotes, setRxNotes] = useState("");
  const [items, setItems] = useState([]);

  const doctor = {
    clinic: "MicMEDIC",
    fullName: "ESP. ROMO PROCEL DANIELA JACKELINE",
    specialty: "MEDICINA OCUPACIONAL - MEDICINA GENERAL",
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

    // ✅ Cargar visita
    const v = await supabase
      .from("medical_visits")
      .select("id, patient_id, visit_date, reason, notes, created_at, prescription_notes")
      .eq("id", visitId)
      .single();

    if (v.error) {
      console.error(v.error);
      alert(v.error.message || "No se pudo cargar la consulta");
      setLoading(false);
      return;
    }

    // ✅ Cargar TODOS los diagnósticos desde tabla separada
    const diagRes = await supabase
      .from("medical_visit_diagnoses")
      .select("cie10_code, cie10_name")
      .eq("visit_id", visitId);

    const diagnoses = diagRes.data || [];

    // ✅ Cargar paciente
    const p = await supabase.from("patients").select("*").eq("id", v.data.patient_id).single();
    if (p.error) {
      console.error(p.error);
      alert(p.error.message || "No se pudo cargar el paciente");
      setLoading(false);
      return;
    }
    setPatient(p.data);

    // ✅ Guardar visita con diagnósticos incluidos
    setVisit({ ...v.data, diagnoses });
    setRxNotes(v.data?.prescription_notes || "");

    // ✅ Cargar items de prescripción
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
        id: `temp_${Date.now()}_${Math.random()}`,
        med: "",
        instructions: "",
        sort_order: prev.length + 1,
        isNew: true,
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

    const cleaned = (items || [])
      .map((x, idx) => ({
        med: (x.med || "").trim(),
        instructions: (x.instructions || "").trim(),
        sort_order: idx + 1,
      }))
      .filter((x) => x.med && x.instructions);

    try {
      const { error: notesErr } = await supabase
        .from("medical_visits")
        .update({ prescription_notes: rxNotes?.trim() || null })
        .eq("id", visitId);

      if (notesErr) throw notesErr;

      const { error: rxErr } = await supabase.rpc("replace_prescription_items", {
        p_encounter_id: visitId,
        p_items: cleaned,
      });

      if (rxErr) throw rxErr;

      alert("Receta guardada correctamente.");
      loadAll();
    } catch (e) {
      console.error(e);
      alert(e.message || "No se pudo guardar la receta");
    }
  }

  function printPDF() {
    const node = printRef.current;
    if (!node) return;

    const LOGO_TOP = `${window.location.origin}/logo-top.png`;
    const LOGO_WM = `${window.location.origin}/logo-watermark.png`;

    const html = node.innerHTML;

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
    @page { size: A4; margin: 12mm; }

    body { font-family: Arial, sans-serif; color: #111; margin: 0; }
    .paper { position: relative; }

    /* Marca de agua */
    .watermark {
      position: fixed;
      inset: 0;
      background-image: url("${LOGO_WM}");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 520px auto;
      opacity: 0.12;
      pointer-events: none;
      z-index: 0;
    }
    .content { position: relative; z-index: 1; }

    /* Header compacto */
    .headerRow {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 8px;
    }
    .logoTop { height: 68px; object-fit: contain; }
    .muted { font-size: 11px; color:#333; line-height: 1.25; text-align: right; }

    /* Tabla */
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; }
    th { font-size: 11px; text-align: left; }
    td { font-size: 11px; white-space: pre-wrap; }

    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr { page-break-inside: avoid; break-inside: avoid; }

    /* Firma */
    .signature-section {
      margin-top: 14mm;
      page-break-inside: avoid;
      break-inside: avoid;
      text-align: center;
    }
    .signature-line {
      width: 300px;
      margin: 0 auto 10px;
      border-bottom: 1px solid #000;
      height: 1px;
    }
    .doctor-name { font-size: 12px; font-weight: 700; margin-bottom: 2px; }
    .doctor-details, .doctor-contact { font-size: 10.5px; color: #333; line-height: 1.25; }

    .force-new-page {
      page-break-before: always;
      break-before: page;
    }

    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
  </style>
</head>
<body>
  <div class="watermark"></div>

  <div class="paper">
    <div class="content">
      ${html}

      <div id="sig" class="signature-section">
        <div class="signature-line"></div>
        <div class="doctor-name">ESP. ROMO PROCEL DANIELA JACKELINE</div>
        <div class="doctor-details">
          MEDICINA OCUPACIONAL - MEDICINA GENERAL<br/>
          CÉDULA: 050333534-1<br/>
          REG. MÉDICO: 0503335341 - 1027 - 2023 - 2599595
        </div>
        <div class="doctor-contact">
          Cotopaxi - Salcedo Barrio La Tebaida (Calle Laguna Quilota y pasaje sin nombre)<br/>
          Teléfono: 0984340286 &nbsp;|&nbsp; Email: danitas0z@hotmail.com
        </div>
      </div>
    </div>
  </div>

  <script>
    (function () {
      function run() {
        const sig = document.getElementById('sig');
        if (!sig) return;

        const rect = sig.getBoundingClientRect();
        const pageH = window.innerHeight;
        const SAFE = 160;

        if (rect.bottom > (pageH - SAFE)) {
          sig.classList.add('force-new-page');
        }

        setTimeout(() => {
          window.focus();
          window.print();
        }, 250);
      }

      if (document.readyState === 'complete') run();
      else window.addEventListener('load', run);
    })();
  </script>
</body>
</html>
    `);
    w.document.close();
  }

  if (!visitId) return <div className="mm-empty">ID inválido.</div>;
  if (loading) return <div className="mm-empty">Cargando receta...</div>;
  if (!visit || !patient) return <div className="mm-empty">No se encontró la consulta.</div>;

  // ✅ FORMATEAR MÚLTIPLES DIAGNÓSTICOS
  const diag = visit.diagnoses && visit.diagnoses.length > 0
    ? visit.diagnoses
        .map(d => {
          if (d.cie10_code && d.cie10_name) {
            return `${d.cie10_name} (${d.cie10_code})`;
          }
          return d.cie10_name || d.cie10_code || "";
        })
        .filter(Boolean)
        .join(", ")
    : "-";

  const rxDateISO = visit.visit_date || new Date().toISOString();

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 14, display: "grid", gap: 14 }}>
      <div className="mm-card">
        <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="mm-cardTitle">Receta</div>
            <div style={{ opacity: 0.85, fontSize: 13 }}>
              Paciente: <b>{patient.name}</b> · CI: <b>{patient.cedula || "-"}</b> · Fecha:{" "}
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
          <div><b>Diagnóstico(s) CIE10:</b> {diag}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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

              {items.map((it, idx) => (
                <div key={it.id} className="mm-item" style={{ cursor: "default" }}>
                  <div className="mm-itemTop" style={{ alignItems: "center" }}>
                    <div className="mm-itemName">Medicamento #{idx + 1}</div>
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

        <div className="mm-card">
          <div className="mm-cardHead">
            <div className="mm-cardTitle">Vista previa (Receta)</div>
            <div className="mm-chip">PDF</div>
          </div>

          <div style={{ padding: 14 }}>
            <div ref={printRef}>
              <div className="muted" style={{ textAlign: "right" }}>
                <div>{doctor.place}, {fmtDateLong(rxDateISO)}</div>
                <div>Tel: {CLINIC_PHONE}</div>
                <div>{doctor.email}</div>
              </div>

              <div className="title">RECETA MÉDICA</div>

              <div className="info">
                <div><b>Paciente:</b> {patient.name}</div>
                <div><b>CI:</b> {patient.cedula || "-"} &nbsp;&nbsp; <b>Tel:</b> {CLINIC_PHONE}</div>
                <div><b>Fecha de atención:</b> {fmtDateShort(rxDateISO)}</div>
                <div><b>Diagnóstico(s) CIE10:</b> {diag}</div>
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
                <div className="footer" style={{ marginTop: 12, fontSize: 12 }}>
                  <b>Notas:</b> {rxNotes}
                </div>
              ) : null}

              <div style={{ marginTop: "60px" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}