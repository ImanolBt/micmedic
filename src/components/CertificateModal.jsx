import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

function formatDateES(d) {
  if (!d) return "";
  if (typeof d === "string" && d.length === 10 && d.includes("-")) {
    const [year, month, day] = d.split("-").map(Number);
    const dt = new Date(year, month - 1, day);
    return dt.toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "2-digit" });
  }
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "2-digit" });
}

function openPrintWindow(html) {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) { alert("Permite ventanas emergentes para imprimir el certificado."); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 200);
}

function certificateHTML({ cert, patient, visit }) {
  const diag = `${visit?.cie10_name || ""} CIE10 (${visit?.cie10_code || ""})`.trim();
  const issue = cert.issue_date || new Date().toISOString().slice(0, 10);
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Certificado médico</title><style>
    *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:0;color:#111}
    .page{width:210mm;min-height:297mm;padding:18mm;margin:0 auto}
    .top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
    .brand{font-weight:900;font-size:28px;letter-spacing:.5px}.doc{text-align:right;font-size:12.5px;line-height:1.4}
    .title{text-align:center;font-weight:900;margin:18px 0 14px}.p{font-size:13.5px;line-height:1.6;margin:8px 0}
    .label{font-weight:700}.sigWrap{margin-top:30px;text-align:center}
    .sigLine{margin:28px auto 8px;width:260px;border-top:1px solid #222}.muted{color:#555;font-size:12px}
    @media print{.page{padding:14mm}}
  </style></head><body><div class="page">
    <div class="top">
      <div><div class="brand">MicMEDIC</div><div class="muted">${cert.clinic_name || ""}</div></div>
      <div class="doc">
        <div><b>${cert.doctor_name || ""}</b></div><div>${cert.doctor_specialty || ""}</div>
        ${cert.doctor_reg ? `<div>Reg. Médico: ${cert.doctor_reg}</div>` : ""}
        ${cert.doctor_cedula ? `<div>Cédula: ${cert.doctor_cedula}</div>` : ""}
        ${cert.doctor_phone ? `<div>Celular: ${cert.doctor_phone}</div>` : ""}
        ${cert.doctor_email ? `<div>Correo: ${cert.doctor_email}</div>` : ""}
        <div style="margin-top:6px">${cert.clinic_city || ""}, ${formatDateES(issue)}</div>
      </div>
    </div>
    <div class="title">CERTIFICADO MÉDICO</div>
    <div class="p">A quien interese,</div>
    <div class="p">Por medio de la presente CERTIFICO que el paciente <b>${patient?.name || ""}</b> con CI. <b>${patient?.cedula || ""}</b>, fue atendido por:</div>
    <div class="p"><span class="label">Diagnóstico:</span> ${diag || "-"}</div>
    <div class="p"><span class="label">Número de historia clínica:</span> ${patient?.cedula || "-"}</div>
    <div class="p"><span class="label">Lugar de atención:</span> ${cert.clinic_name || "-"}</div>
    <div class="p"><span class="label">Contingencia:</span> ${cert.contingency || "-"}</div>
    <div class="p"><span class="label">Tipo de atención:</span> ${cert.care_type || "-"}</div>
    <div class="p"><span class="label">Fecha de atención:</span> ${formatDateES(visit?.visit_date || visit?.created_at || issue)}</div>
    <div class="p"><span class="label">Tratamiento:</span> ${cert.treatment || "-"}</div>
    ${cert.rest_days ? `<div class="p"><span class="label">Reposo absoluto:</span> ${cert.rest_days} DÍAS, DESDE EL ${formatDateES(cert.rest_from)} HASTA EL ${formatDateES(cert.rest_to)}.</div>` : ""}
    ${cert.entity ? `<div class="p"><span class="label">Entidad:</span> ${cert.entity}</div>` : ""}
    ${cert.position ? `<div class="p"><span class="label">Cargo:</span> ${cert.position}</div>` : ""}
    ${cert.patient_address ? `<div class="p"><span class="label">Domicilio:</span> ${cert.patient_address}</div>` : ""}
    ${patient?.email ? `<div class="p"><span class="label">Correo electrónico:</span> ${patient.email}</div>` : ""}
    <div class="p"><span class="label">Teléfono de contacto:</span> ${patient?.phone || "-"}</div>
    ${cert.extra_notes ? `<div class="p">${cert.extra_notes}</div>` : ""}
    <div class="p">Es todo en cuanto puedo certificar en honor a la verdad, autorizando al interesado hacer uso del presente certificado en trámites pertinentes.</div>
    <div class="sigWrap"><div>Atentamente</div><div class="sigLine"></div><div><b>${cert.doctor_name || ""}</b></div><div class="muted">${cert.doctor_specialty || ""}</div></div>
  </div></body></html>`;
}

export default function CertificateModal({ open, onClose, visit, patient }) {
  const [saving, setSaving] = useState(false);

  const diag = useMemo(() => {
    const c = (visit?.cie10_code || "").trim();
    const n = (visit?.cie10_name || "").trim();
    if (c && n) return `${n} (${c})`;
    return c || n || "-";
  }, [visit]);

  const [form, setForm] = useState(() => ({
    issue_date: new Date().toISOString().slice(0, 10),
    clinic_name: "Consultorio médico MIC MEDIC",
    clinic_city: "Salcedo - ECUADOR",
    doctor_name: "MED. ____________",
    doctor_specialty: "MEDICINA OCUPACIONAL - MEDICINA GENERAL",
    doctor_cedula: "",
    doctor_reg: "",
    doctor_phone: "",
    doctor_email: "",
    entity: "",
    position: "",
    patient_address: "",
    contingency: "Enfermedad general",
    care_type: "Medicina Ocupacional - Medicina general",
    treatment: "Farmacológico",
    rest_days: "",
    rest_from: new Date().toISOString().slice(0, 10),
    rest_to: "",
    extra_notes: "",
  }));

  function setField(k, v) { setForm((prev) => ({ ...prev, [k]: v })); }

  async function saveAndPrint() {
    if (!visit?.id || !patient?.id) return;
    setSaving(true);
    const payload = {
      visit_id: visit.id, patient_id: patient.id,
      issue_date: form.issue_date || null, clinic_name: form.clinic_name || null, clinic_city: form.clinic_city || null,
      doctor_name: form.doctor_name || null, doctor_specialty: form.doctor_specialty || null, doctor_cedula: form.doctor_cedula || null,
      doctor_reg: form.doctor_reg || null, doctor_phone: form.doctor_phone || null, doctor_email: form.doctor_email || null,
      entity: form.entity || null, position: form.position || null, patient_address: form.patient_address || null,
      contingency: form.contingency || null, care_type: form.care_type || null, treatment: form.treatment || null,
      rest_days: form.rest_days ? Number(form.rest_days) : null, rest_from: form.rest_from || null, rest_to: form.rest_to || null,
      extra_notes: form.extra_notes || null,
    };
    const { data, error } = await supabase.from("certificates").upsert(payload, { onConflict: "visit_id" }).select("*").single();
    setSaving(false);
    if (error) { alert("No se pudo guardar el certificado."); return; }
    const html = certificateHTML({ cert: data, patient, visit });
    openPrintWindow(html);
    onClose?.();
  }

  if (!open) return null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "grid", placeItems: "center", backdropFilter: "blur(2px)", zIndex: 9999, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--mm-surface)", borderRadius: 16, width: "min(820px, 100%)", maxHeight: "90vh", overflow: "auto", border: "1px solid var(--mm-border)", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--mm-border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--mm-bg)", position: "sticky", top: 0, zIndex: 1 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>📄 Certificado médico</div>
            <div style={{ fontSize: 12, color: "var(--mm-muted)" }}>Diagnóstico: {diag}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="mm-btn mm-btn--primary mm-btn--sm" onClick={saveAndPrint} disabled={saving}>
              {saving ? "Guardando…" : "Guardar + 🖨 PDF"}
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px", display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

            {/* Datos del certificado */}
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 13, borderBottom: "1px solid var(--mm-border)", paddingBottom: 6 }}>Datos del certificado</div>
              <div>
                <label className="mm-label">Fecha de emisión</label>
                <input className="mm-input" type="date" value={form.issue_date} onChange={(e) => setField("issue_date", e.target.value)} />
              </div>
              <div>
                <label className="mm-label">Lugar de atención</label>
                <input className="mm-input" value={form.clinic_name} onChange={(e) => setField("clinic_name", e.target.value)} />
              </div>
              <div>
                <label className="mm-label">Ciudad</label>
                <input className="mm-input" value={form.clinic_city} onChange={(e) => setField("clinic_city", e.target.value)} />
              </div>
              <div>
                <label className="mm-label">Contingencia</label>
                <input className="mm-input" value={form.contingency} onChange={(e) => setField("contingency", e.target.value)} />
              </div>
              <div>
                <label className="mm-label">Tipo de atención</label>
                <input className="mm-input" value={form.care_type} onChange={(e) => setField("care_type", e.target.value)} />
              </div>
              <div>
                <label className="mm-label">Tratamiento</label>
                <input className="mm-input" value={form.treatment} onChange={(e) => setField("treatment", e.target.value)} />
              </div>
            </div>

            {/* Reposo + extra */}
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 13, borderBottom: "1px solid var(--mm-border)", paddingBottom: 6 }}>Reposo + datos adicionales</div>
              <div>
                <label className="mm-label">Días de reposo</label>
                <input className="mm-input" type="number" placeholder="Ej: 3" value={form.rest_days} onChange={(e) => setField("rest_days", e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="mm-label">Desde</label>
                  <input className="mm-input" type="date" value={form.rest_from} onChange={(e) => setField("rest_from", e.target.value)} />
                </div>
                <div>
                  <label className="mm-label">Hasta</label>
                  <input className="mm-input" type="date" value={form.rest_to} onChange={(e) => setField("rest_to", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="mm-label">Entidad</label>
                <input className="mm-input" placeholder="Ej: Unidad Educativa …" value={form.entity} onChange={(e) => setField("entity", e.target.value)} />
              </div>
              <div>
                <label className="mm-label">Cargo</label>
                <input className="mm-input" placeholder="Ej: Docente" value={form.position} onChange={(e) => setField("position", e.target.value)} />
              </div>
              <div>
                <label className="mm-label">Domicilio del paciente</label>
                <input className="mm-input" placeholder="Dirección…" value={form.patient_address} onChange={(e) => setField("patient_address", e.target.value)} />
              </div>
              <div>
                <label className="mm-label">Texto extra (opcional)</label>
                <textarea className="mm-input" rows={3} value={form.extra_notes} onChange={(e) => setField("extra_notes", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Datos del médico */}
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 13, borderBottom: "1px solid var(--mm-border)", paddingBottom: 6 }}>Datos del médico</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="mm-label">Nombre</label>
                <input className="mm-input" placeholder="Nombre del médico" value={form.doctor_name} onChange={(e) => setField("doctor_name", e.target.value)} />
              </div>
              <div>
                <label className="mm-label">Especialidad</label>
                <input className="mm-input" placeholder="Especialidad" value={form.doctor_specialty} onChange={(e) => setField("doctor_specialty", e.target.value)} />
              </div>
              <div>
                <label className="mm-label">Cédula</label>
                <input className="mm-input" placeholder="Cédula" value={form.doctor_cedula} onChange={(e) => setField("doctor_cedula", e.target.value)} />
              </div>
              <div>
                <label className="mm-label">Reg. Médico</label>
                <input className="mm-input" placeholder="Reg. Médico" value={form.doctor_reg} onChange={(e) => setField("doctor_reg", e.target.value)} />
              </div>
              <div>
                <label className="mm-label">Celular</label>
                <input className="mm-input" placeholder="Celular" value={form.doctor_phone} onChange={(e) => setField("doctor_phone", e.target.value)} />
              </div>
              <div>
                <label className="mm-label">Correo</label>
                <input className="mm-input" placeholder="Correo" value={form.doctor_email} onChange={(e) => setField("doctor_email", e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
