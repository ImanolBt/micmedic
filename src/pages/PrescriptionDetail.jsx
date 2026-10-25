import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

const CLINIC_PHONE = "0984340286";

function fmtDateLong(dateISO) {
  if (!dateISO) return "-";
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const clean = typeof dateISO === "string" ? dateISO.slice(0, 10) : "";
  if (!clean.match(/^\d{4}-\d{2}-\d{2}$/)) return "-";
  const [year, month, day] = clean.split("-");
  return `${parseInt(day)} de ${meses[parseInt(month) - 1]} de ${year}`;
}

function fmtDateShort(dateISO) {
  const d = dateISO ? new Date(dateISO) : new Date();
  return d.toLocaleDateString("es-EC", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function initials(name) {
  return (name || "?").split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("");
}

export default function PrescriptionDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const printRef = useRef(null);

  const visitId = useMemo(() => { const n = Number(id); return Number.isFinite(n) ? n : null; }, [id]);

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
    const v = await supabase.from("medical_visits").select("id, patient_id, visit_date, reason, notes, created_at, prescription_notes").eq("id", visitId).single();
    if (v.error) { alert(v.error.message || "No se pudo cargar la consulta"); setLoading(false); return; }
    const diagRes = await supabase.from("medical_visit_diagnoses").select("cie10_code, cie10_name").eq("visit_id", visitId);
    const p = await supabase.from("patients").select("*").eq("id", v.data.patient_id).single();
    if (p.error) { alert(p.error.message || "No se pudo cargar el paciente"); setLoading(false); return; }
    setPatient(p.data);
    setVisit({ ...v.data, diagnoses: diagRes.data || [] });
    setRxNotes(v.data?.prescription_notes || "");
    const it = await supabase.from("prescription_items").select("id, encounter_id, med, instructions, sort_order").eq("encounter_id", visitId).order("sort_order", { ascending: true }).order("id", { ascending: true });
    setItems(it.error ? [] : it.data || []);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, [visitId]);

  function addItem() {
    setItems((prev) => [...prev, { id: `temp_${Date.now()}_${Math.random()}`, med: "", instructions: "", sort_order: prev.length + 1, isNew: true }]);
  }

  function updateItem(id, patch) {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((x) => x.id !== id).map((x, idx) => ({ ...x, sort_order: idx + 1 })));
  }

  async function savePrescription() {
    if (!visit || !patient) return;
    const cleaned = (items || []).map((x, idx) => ({ med: (x.med || "").trim(), instructions: (x.instructions || "").trim(), sort_order: idx + 1 })).filter((x) => x.med && x.instructions);
    try {
      const { error: notesErr } = await supabase.from("medical_visits").update({ prescription_notes: rxNotes?.trim() || null }).eq("id", visitId);
      if (notesErr) throw notesErr;
      const { error: rxErr } = await supabase.rpc("replace_prescription_items", { p_encounter_id: visitId, p_items: cleaned });
      if (rxErr) throw rxErr;
      alert("Receta guardada correctamente.");
      loadAll();
    } catch (e) {
      alert(e.message || "No se pudo guardar la receta");
    }
  }

  function printPDF() {
    const node = printRef.current;
    if (!node) return;
    const LOGO_WM = `${window.location.origin}/logo-watermark.png`;
    const html = node.innerHTML;
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Receta Médica</title><style>
      @page{size:A4;margin:10mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      body{font-family:Arial,sans-serif;color:#111;margin:0;padding:0}
      .paper{position:relative;max-width:210mm;margin:0 auto}
      .watermark{position:fixed;inset:0;background-image:url("${LOGO_WM}");background-repeat:no-repeat;background-position:center;background-size:500px auto;opacity:0.10;pointer-events:none;z-index:0}
      .content{position:relative;z-index:1}
      table{width:100%;border-collapse:collapse;margin:8px 0}
      th,td{border:1px solid #ddd;padding:7px;vertical-align:top;text-align:left}
      th{font-size:10px;font-weight:600;background:#f1f3f5}td{font-size:9.5px;white-space:pre-wrap;line-height:1.4}
      .signature-section{margin-top:25px;page-break-inside:avoid;break-inside:avoid;text-align:center}
      .signature-line{width:280px;margin:0 auto;border-bottom:1.5px solid #333;padding-top:50px}
      .force-new-page{page-break-before:always;break-before:page}
    </style></head><body>
      <div class="watermark"></div>
      <div class="paper"><div class="content">${html}
        <div id="sig" class="signature-section">
          <div class="signature-line"></div>
          <div style="font-size:11px;font-weight:700;margin-top:8px">ESP. ROMO PROCEL DANIELA JACKELINE</div>
          <div style="font-size:9px;color:#555">MEDICINA OCUPACIONAL - MEDICINA GENERAL<br/>CÉDULA: 050333534-1<br/>REG. MÉDICO: 0503335341 - 1027 - 2023 - 2599595</div>
          <div style="font-size:8.5px;color:#777">Cotopaxi - Salcedo Barrio La Tebaida<br/>Tel: 0984340286 | danitas0z@hotmail.com</div>
        </div>
      </div></div>
      <script>(function(){function run(){const sig=document.getElementById('sig');if(!sig)return;const rect=sig.getBoundingClientRect();if(rect.bottom>(window.innerHeight-100))sig.classList.add('force-new-page');setTimeout(()=>{window.focus();window.print();},250);}if(document.readyState==='complete')run();else window.addEventListener('load',run);})();</script>
    </body></html>`);
    w.document.close();
  }

  if (!visitId) return <div className="mm-empty">ID inválido.</div>;
  if (loading) return <div className="mm-empty">Cargando receta…</div>;
  if (!visit || !patient) return <div className="mm-empty">No se encontró la consulta.</div>;

  const diag = visit.diagnoses && visit.diagnoses.length > 0
    ? visit.diagnoses.map(d => d.cie10_code && d.cie10_name ? `${d.cie10_name} (${d.cie10_code})` : d.cie10_name || d.cie10_code || "").filter(Boolean).join(", ")
    : "-";

  const rxDateISO = visit.visit_date || new Date().toISOString();

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16, display: "grid", gap: 16 }}>

      {/* Header */}
      <div className="mm-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ height: 4, background: "linear-gradient(90deg,var(--mm-green),var(--mm-green2))" }} />
        <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="mm-avatar" style={{ width: 48, height: 48, fontSize: 16 }}>{initials(patient.name)}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{patient.name}</div>
              <div style={{ fontSize: 13, color: "var(--mm-muted)" }}>
                CI: <b>{patient.cedula || "-"}</b> · {new Date(rxDateISO).toLocaleString("es-EC")}
              </div>
              <div style={{ fontSize: 12, color: "var(--mm-muted)" }}>Motivo: {visit.reason || "-"} · {diag}</div>
            </div>
          </div>
          <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={() => nav(`/visits/${visit.id}`)}>← Volver a consulta</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Medicamentos editor */}
        <div className="mm-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "linear-gradient(90deg,var(--mm-green),var(--mm-green2))" }} />
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--mm-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Medicamentos</span>
            <span className="mm-chip">Consulta #{visit.id}</span>
          </div>
          <div style={{ padding: "14px 20px", display: "grid", gap: 12 }}>
            <div>
              <label className="mm-label">Notas (opcional)</label>
              <input className="mm-input" placeholder="Ej: No automedicarse" value={rxNotes} onChange={(e) => setRxNotes(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="mm-btn mm-btn--primary" onClick={addItem}>+ Añadir medicamento</button>
              <button className="mm-btn mm-btn--ghost" onClick={savePrescription}>Guardar receta</button>
              <button className="mm-btn mm-btn--ghost" onClick={printPDF}>🖨 PDF</button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {items.length === 0 && <div className="mm-empty" style={{ fontSize: 13 }}>Sin medicamentos. Clic en "+ Añadir".</div>}
              {items.map((it, idx) => (
                <div key={it.id} style={{ border: "1px solid var(--mm-border)", borderRadius: 10, padding: "12px 14px", background: "var(--mm-bg)", display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Medicamento #{idx + 1}</span>
                    <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={() => removeItem(it.id)}>✕ Quitar</button>
                  </div>
                  <input className="mm-input" placeholder="Ej: Amoxicilina 500mg" value={it.med || ""} onChange={(e) => updateItem(it.id, { med: e.target.value })} />
                  <textarea className="mm-input" style={{ minHeight: 70, paddingTop: 10 }} placeholder="Indicaciones (ej: 1 cápsula cada 8 horas por 7 días)" value={it.instructions || ""} onChange={(e) => updateItem(it.id, { instructions: e.target.value })} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Vista previa */}
        <div className="mm-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "linear-gradient(90deg,var(--mm-green),var(--mm-green2))" }} />
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--mm-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Vista previa · Receta</span>
            <span className="mm-chip">PDF</span>
          </div>
          <div style={{ padding: "20px 24px" }}>
            <div ref={printRef} style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "#111" }}>
              {/* Header receta */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ flexShrink: 0 }}>
                  <img src="/logo-top.png" alt="MicMEDIC" style={{ height: 50, width: "auto", objectFit: "contain", display: "block" }} />
                  <div style={{ fontSize: 9, color: "#555", marginTop: 4, lineHeight: 1.3 }}>
                    {doctor.place}, {fmtDateLong(rxDateISO)}<br/>
                    Tel: {CLINIC_PHONE}<br/>
                    {doctor.email}
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 8.5, color: "#333", lineHeight: 1.35, fontWeight: 600 }}>
                  <div>{doctor.fullName}</div>
                  <div>{doctor.specialty}</div>
                  <div>CÉDULA: {doctor.cedula}</div>
                  <div>REG. MÉDICO: {doctor.regMedico}</div>
                </div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, textAlign: "center", margin: "12px 0 10px", color: "#2c3e50", textTransform: "uppercase" }}>RECETA MÉDICA</div>
              <div style={{ fontSize: 11, lineHeight: 1.5, marginBottom: 12 }}>
                <div style={{ marginBottom: 3 }}><b>Paciente:</b> {patient.name}</div>
                <div style={{ marginBottom: 3 }}><b>CI:</b> {patient.cedula || "-"} &nbsp;&nbsp; <b>Tel:</b> {patient.phone || CLINIC_PHONE}</div>
                <div style={{ marginBottom: 3 }}><b>Fecha de atención:</b> {fmtDateShort(rxDateISO)}</div>
                <div><b>Diagnóstico (CIE10):</b> {diag}</div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", margin: "8px 0", fontSize: 10 }}>
                <thead>
                  <tr>
                    <th style={{ width: "40%", border: "1px solid #ddd", padding: 7, background: "#f1f3f5", fontWeight: 600 }}>Medicamento</th>
                    <th style={{ border: "1px solid #ddd", padding: 7, background: "#f1f3f5", fontWeight: 600 }}>Indicaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(items || []).filter(x => (x.med || "").trim() && (x.instructions || "").trim()).map((x, idx) => (
                    <tr key={x.id ?? idx}>
                      <td style={{ border: "1px solid #ddd", padding: 7, verticalAlign: "top", fontSize: "9.5px", lineHeight: 1.4 }}>{x.med}</td>
                      <td style={{ border: "1px solid #ddd", padding: 7, verticalAlign: "top", fontSize: "9.5px", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>{x.instructions}</td>
                    </tr>
                  ))}
                  {items.filter(x => (x.med || "").trim() && (x.instructions || "").trim()).length === 0 && (
                    <tr><td colSpan={2} style={{ border: "1px solid #ddd", padding: 7, textAlign: "center", opacity: 0.6, fontSize: "9.5px" }}>Aún no hay medicamentos válidos.</td></tr>
                  )}
                </tbody>
              </table>
              {rxNotes?.trim() ? (
                <div style={{ marginTop: 10, padding: 7, background: "#fffbf0", borderLeft: "2px solid #f39c12", fontSize: "9.5px", lineHeight: 1.4 }}>
                  <b style={{ color: "#e67e22" }}>Notas:</b> {rxNotes}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
