import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Cie10MultiPicker from "../components/Cie10MultiPicker";

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

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function calcisoDateOnly(dateISO) {
  if (!dateISO) return "";
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function toLocalDatetimeValue(dateISO) {
  if (!dateISO) return "";
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetimeValue(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function calcAge(birthdate) {
  if (!birthdate) return null;
  const b = new Date(birthdate);
  if (Number.isNaN(b.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age >= 0 ? age : null;
}

function calcBMI(weightKg, heightCm) {
  const w = toNum(weightKg);
  const h = toNum(heightCm);
  if (!w || !h || h <= 0) return null;
  const m = h / 100;
  const bmi = w / (m * m);
  return Number.isFinite(bmi) ? bmi : null;
}

function classifyVitals(v) {
  let level = "ok";
  const setLevel = (next) => {
    const rank = { ok: 0, warn: 1, bad: 2 };
    if (rank[next] > rank[level]) level = next;
  };
  const bpSys = toNum(v.bp_sys);
  const bpDia = toNum(v.bp_dia);
  if (bpSys !== null && bpDia !== null) {
    if (bpSys >= 140 || bpDia >= 90) setLevel("bad");
    else if (bpSys >= 130 || bpDia >= 85) setLevel("warn");
  }
  const hr = toNum(v.hr);
  if (hr !== null) {
    if (hr > 120 || hr < 50) setLevel("warn");
  }
  const spo2 = toNum(v.spo2);
  if (spo2 !== null) {
    if (spo2 < 92) setLevel("bad");
    else if (spo2 < 95) setLevel("warn");
  }
  const temp = toNum(v.temp_c);
  if (temp !== null) {
    if (temp >= 38) setLevel("bad");
    else if (temp >= 37.5) setLevel("warn");
  }
  const map = {
    ok: { emoji: "🟢", text: "Normal" },
    warn: { emoji: "🟡", text: "Atención" },
    bad: { emoji: "🔴", text: "Alerta" },
  };
  return { level, ...map[level] };
}

function vitalsSummary(v, isChild) {
  const parts = [];
  if (v.bp_sys && v.bp_dia) parts.push(`PA ${v.bp_sys}/${v.bp_dia}`);
  if (v.hr) parts.push(`FC ${v.hr}`);
  if (v.spo2) parts.push(`SpO₂ ${v.spo2}%`);
  if (v.temp_c !== null && v.temp_c !== undefined && v.temp_c !== "") parts.push(`T° ${v.temp_c}°C`);
  if (v.weight_kg !== null && v.weight_kg !== undefined && v.weight_kg !== "") parts.push(`Peso ${v.weight_kg}kg`);
  if (v.height_cm !== null && v.height_cm !== undefined && v.height_cm !== "") parts.push(`Talla ${v.height_cm}cm`);
  if (isChild) {
    if (v.pediatric_percentile) parts.push(`OMS ${v.pediatric_percentile}`);
  } else {
    if (v.bmi !== null && v.bmi !== undefined && v.bmi !== "") parts.push(`IMC ${v.bmi}`);
  }
  return parts.length ? parts.join(" · ") : "Sin signos vitales registrados";
}

const MONTHS_ES = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];

function pad2(n) { return String(n).padStart(2, "0"); }

function fmtDateShortDMY(dateISO) {
  if (!dateISO) {
    const d = new Date();
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
  if (typeof dateISO === "string" && dateISO.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateISO.split("-").map(Number);
    return `${pad2(day)}/${pad2(month)}/${year}`;
  }
  const d = new Date(dateISO);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function numToWordsEs(n) {
  n = Number(n);
  if (!Number.isFinite(n)) return "";
  if (n < 0) return `MENOS ${numToWordsEs(Math.abs(n))}`;
  if (n === 0) return "CERO";
  const U = ["","UNO","DOS","TRES","CUATRO","CINCO","SEIS","SIETE","OCHO","NUEVE"];
  const TENS = ["","","VEINTE","TREINTA","CUARENTA","CINCUENTA","SESENTA","SETENTA","OCHENTA","NOVENTA"];
  const H = ["","CIENTO","DOSCIENTOS","TRESCIENTOS","CUATROCIENTOS","QUINIENTOS","SEISCIENTOS","SETECIENTOS","OCHOCIENTOS","NOVECIENTOS"];
  const SPECIAL_1_29 = {
    1:"UNO",2:"DOS",3:"TRES",4:"CUATRO",5:"CINCO",6:"SEIS",7:"SIETE",8:"OCHO",9:"NUEVE",
    10:"DIEZ",11:"ONCE",12:"DOCE",13:"TRECE",14:"CATORCE",15:"QUINCE",
    16:"DIECISEIS",17:"DIECISIETE",18:"DIECIOCHO",19:"DIECINUEVE",
    20:"VEINTE",21:"VEINTIUNO",22:"VEINTIDOS",23:"VEINTITRES",24:"VEINTIFICUATRO",
    25:"VEINTICINCO",26:"VEINTISEIS",27:"VEINTISIETE",28:"VEINTIOCHO",29:"VEINTINUEVE"
  };
  if (n <= 29) return SPECIAL_1_29[n];
  if (n < 100) { const t = Math.floor(n/10); const u = n%10; return u === 0 ? TENS[t] : `${TENS[t]} Y ${U[u]}`; }
  if (n === 100) return "CIEN";
  if (n < 1000) { const c = Math.floor(n/100); const r = n%100; return `${H[c]}${r ? " " + numToWordsEs(r) : ""}`.trim(); }
  const miles = Math.floor(n/1000); const r = n%1000;
  const milesTxt = miles === 1 ? "MIL" : `${numToWordsEs(miles)} MIL`;
  return `${milesTxt}${r ? " " + numToWordsEs(r) : ""}`.trim();
}

function dateToWordsEs(dateISO) {
  if (!dateISO) {
    const d = new Date();
    return `${numToWordsEs(d.getDate())} DE ${MONTHS_ES[d.getMonth()]} DEL ${numToWordsEs(d.getFullYear())}`;
  }
  if (typeof dateISO === "string" && dateISO.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateISO.split("-").map(Number);
    return `${numToWordsEs(day)} DE ${MONTHS_ES[month - 1]} DEL ${numToWordsEs(year)}`;
  }
  const d = new Date(dateISO);
  return `${numToWordsEs(d.getDate())} DE ${MONTHS_ES[d.getMonth()]} DEL ${numToWordsEs(d.getFullYear())}`;
}

function calcEndDateInclusive(startISO, days) {
  const start = new Date(startISO);
  const n = Number(days || 0);
  if (!Number.isFinite(start.getTime())) return null;
  if (!Number.isFinite(n) || n <= 0) return start.toISOString();
  const end = new Date(start.getTime() + (n - 1) * 86400000);
  return end.toISOString();
}

function initials(name) {
  return (name || "?").split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("");
}

export default function VisitDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const printRef = useRef(null);

  const visitId = useMemo(() => { const n = Number(id); return Number.isFinite(n) ? n : null; }, [id]);

  const [loading, setLoading] = useState(true);
  const [visit, setVisit] = useState(null);
  const [patient, setPatient] = useState(null);

  const [editVisit, setEditVisit] = useState(false);
  const [savingVisit, setSavingVisit] = useState(false);
  const [visitDateEdit, setVisitDateEdit] = useState("");
  const [reasonEdit, setReasonEdit] = useState("");
  const [visitNotesEdit, setVisitNotesEdit] = useState("");

  const [bpSys, setBpSys] = useState("");
  const [bpDia, setBpDia] = useState("");
  const [hr, setHr] = useState("");
  const [spo2, setSpo2] = useState("");
  const [tempC, setTempC] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [pediatricPercentile, setPediatricPercentile] = useState("");
  const [showOmsModal, setShowOmsModal] = useState(false);
  const [savingVitals, setSavingVitals] = useState(false);

  const [diags, setDiags] = useState([]);
  const [savingDiags, setSavingDiags] = useState(false);

  const [certId, setCertId] = useState(null);
  const [certDate, setCertDate] = useState(() => new Date().toISOString());
  const [restFrom, setRestFrom] = useState("");
  const [restTo, setRestTo] = useState("");
  const [entity, setEntity] = useState("");
  const [position, setPosition] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [includeNotes, setIncludeNotes] = useState(false);
  const [notes, setNotes] = useState("");

  const clinicName = "Consultorio médico MIC MEDIC";
  const contingency = "Enfermedad general";
  const attentionType = "Medicina Ocupacional - Medicina general";
  const treatment = "Farmacológico";

  const doctor = {
    fullName: "ESP. ROMO PROCEL DANIELA JACKELINE",
    specialty: "MEDICINA OCUPACIONAL - MEDICINA GENERAL",
    cedula: "050333534-1",
    regMedico: "0503335341 - 1027 - 2023 - 2599595",
    phone: "0984340286",
    email: "danitas0z@hotmail.com",
    address: "Cotopaxi - Salcedo Barrio La Tebaida (Calle Laguna Quilota y pasaje sin nombre)",
    headerLine1: "Esp. Daniela Romo",
    headerLine2: "Especialista en Medicina Ocupacional",
    headerLine3: "Msc. en Prevención de Riesgos Laborales",
    headerLine4: "MEDICINA OCUPACIONAL - MEDICINA GENERAL",
  };

  const daysRestComputed = useMemo(() => {
    if (!restFrom || !restTo) return 0;
    const a = new Date(restFrom);
    const b = new Date(restTo);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
    const diff = Math.floor((b.getTime() - a.getTime()) / 86400000);
    return diff >= 0 ? diff + 1 : 0;
  }, [restFrom, restTo]);

  function formatDiagnosesForDisplay(diagnosesArray) {
    if (!diagnosesArray || diagnosesArray.length === 0) return "-";
    return diagnosesArray.map(d => d.name ? `${d.name} (${d.code})` : d.code).join("; ");
  }

  async function loadAll() {
    if (!visitId) return;
    setLoading(true);
    try {
      const v = await supabase.from("medical_visits").select("id, patient_id, visit_date, reason, cie10_code, cie10_name, notes, created_at, user_id, bp_sys, bp_dia, hr, spo2, temp_c, weight_kg, height_cm, bmi, pediatric_percentile").eq("id", visitId).single();
      if (v.error) throw new Error(`Error cargando consulta: ${v.error.message}`);
      const p = await supabase.from("patients").select("*").eq("id", v.data.patient_id).single();
      if (p.error) throw new Error(`Error cargando paciente: ${p.error.message}`);
      setVisit(v.data);
      setPatient(p.data);
      setVisitDateEdit(toLocalDatetimeValue(v.data.visit_date));
      setReasonEdit(v.data.reason ?? "");
      setVisitNotesEdit(v.data.notes ?? "");
      setBpSys(v.data.bp_sys ?? "");
      setBpDia(v.data.bp_dia ?? "");
      setHr(v.data.hr ?? "");
      setSpo2(v.data.spo2 ?? "");
      setTempC(v.data.temp_c ?? "");
      setWeightKg(v.data.weight_kg ?? "");
      setHeightCm(v.data.height_cm ?? "");
      setPediatricPercentile(v.data.pediatric_percentile ?? "");
      const d = await supabase.from("medical_visit_diagnoses").select("cie10_code, cie10_name").eq("visit_id", visitId).order("id", { ascending: true });
      setDiags(d.error ? [] : (d.data || []).map((x) => ({ code: x.cie10_code, name: x.cie10_name })));
      const c = await supabase.from("certificates").select("*").eq("visit_id", visitId).maybeSingle();
      if (!c.error && c.data) {
        setCertId(c.data.id);
        setCertDate(c.data.date || new Date().toISOString());
        setRestFrom(c.data.rest_from || "");
        setRestTo(c.data.rest_to || "");
        setEntity(c.data.entity || "");
        setPosition(c.data.position || "");
        setAddress(c.data.address || "");
        setEmail(c.data.email || "");
        setContactPhone(c.data.contact_phone || "");
        setIncludeNotes(c.data.include_notes ?? false);
        setNotes(c.data.notes || "");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, [visitId]);

  async function saveVisitEdits() {
    if (!visit) return;
    setSavingVisit(true);
    try {
      const newDate = fromLocalDatetimeValue(visitDateEdit) || visit.visit_date;
      const { error } = await supabase.from("medical_visits").update({ visit_date: newDate, reason: reasonEdit, notes: visitNotesEdit }).eq("id", visit.id);
      if (error) throw error;
      setVisit((prev) => ({ ...prev, visit_date: newDate, reason: reasonEdit, notes: visitNotesEdit }));
      setEditVisit(false);
    } catch (err) {
      alert("Error al guardar: " + err.message);
    } finally {
      setSavingVisit(false);
    }
  }

  function cancelVisitEdits() {
    if (!visit) return;
    setVisitDateEdit(toLocalDatetimeValue(visit.visit_date));
    setReasonEdit(visit.reason ?? "");
    setVisitNotesEdit(visit.notes ?? "");
    setEditVisit(false);
  }

  async function saveDiagnoses() {
    if (!visitId) return;
    setSavingDiags(true);
    try {
      await supabase.from("medical_visit_diagnoses").delete().eq("visit_id", visitId);
      if (diags.length > 0) {
        const rows = diags.map((d) => ({ visit_id: visitId, cie10_code: d.code, cie10_name: d.name || "" }));
        const { error } = await supabase.from("medical_visit_diagnoses").insert(rows);
        if (error) throw error;
      }
    } catch (err) {
      alert("Error al guardar diagnósticos: " + err.message);
    } finally {
      setSavingDiags(false);
    }
  }

  async function saveVitals() {
    if (!visit) return;
    setSavingVitals(true);
    try {
      const bmiVal = isChild ? null : calcBMI(weightKg, heightCm);
      const payload = {
        bp_sys: toNum(bpSys),
        bp_dia: toNum(bpDia),
        hr: toNum(hr),
        spo2: toNum(spo2),
        temp_c: toNum(tempC),
        weight_kg: toNum(weightKg),
        height_cm: toNum(heightCm),
        bmi: bmiVal,
        pediatric_percentile: isChild ? (pediatricPercentile || null) : null,
      };
      const { error } = await supabase.from("medical_visits").update(payload).eq("id", visit.id);
      if (error) throw error;
    } catch (err) {
      alert("Error al guardar vitales: " + err.message);
    } finally {
      setSavingVitals(false);
    }
  }

  async function saveCertificate() {
    if (!visitId || !patient) return;
    try {
      const payload = {
        visit_id: visitId,
        patient_id: patient.id,
        date: certDate,
        rest_from: restFrom || null,
        rest_to: restTo || null,
        entity: entity || null,
        position: position || null,
        address: address || null,
        email: email || null,
        contact_phone: contactPhone || null,
        include_notes: includeNotes,
        notes: includeNotes ? notes : null,
      };
      if (certId) {
        const { error } = await supabase.from("certificates").update(payload).eq("id", certId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("certificates").insert(payload).select("id").single();
        if (error) throw error;
        setCertId(data.id);
      }
      alert("Certificado guardado.");
    } catch (err) {
      alert("Error al guardar certificado: " + err.message);
    }
  }

  const LOGO_WM = (() => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1; canvas.height = 1;
      return canvas.toDataURL();
    } catch { return ""; }
  })();

  async function printPDF() {
    const certDateISO = certDate.slice(0, 10);
    const html = `
      <div class="pdfHeader">
        <img src="${window.location.origin}/logo-top.png" alt="Logo" />
        <div style="color:#333;font-size:8.5pt;line-height:1.15;text-align:right;">
          <div style="font-weight:900">${doctor.headerLine1}</div>
          <div>${doctor.headerLine2}</div>
          <div>${doctor.headerLine3}</div>
          <div style="font-weight:900">${doctor.headerLine4}</div>
          <div style="margin-top:6px">Salcedo, ${fmtDateLong(certDateISO)}</div>
        </div>
      </div>
      <div style="text-align:center;font-weight:900;margin:12px 0 10px;font-size:14pt;">CERTIFICADO MEDICO</div>
      <div style="font-size:11pt;line-height:1.5;white-space:pre-wrap;">${`A quien interese,

Por medio de la presente CERTIFICO que el paciente ${patient.name} con CI. ${patient.cedula || "-"}, fue atendido por:

Diagnostico: ${diags.length > 0 ? diags.map(d => `${d.name || d.code} (${d.code})`).join("; ") : (visit.cie10_code && visit.cie10_name) ? `${visit.cie10_name} CIE10 (${visit.cie10_code})` : visit.cie10_name || visit.cie10_code || "-"}

Numero de historia clinica: ${patient.cedula || "-"}

Lugar de atencion: ${clinicName}

Contingencia: ${contingency}

Tipo de atencion: ${attentionType}

Fecha de atencion: ${fmtDateShortDMY(certDateISO)}

Tratamiento: ${treatment}

Reposo absoluto: ${Number(daysRestComputed || 0)} (${numToWordsEs(Number(daysRestComputed || 0))}) DIAS, DESDE EL ${fmtDateShortDMY(restFrom)} (${dateToWordsEs(restFrom)}) HASTA EL ${fmtDateShortDMY(restTo)} (${dateToWordsEs(restTo)})

Entidad: ${entity || "-"}

Cargo: ${position || "-"}

Domicilio: ${address || "-"}

Correo electronico: ${email || "-"}

Telefono de contacto: ${contactPhone || "-"}${includeNotes && notes?.trim() ? `\n\nNOTAS ADICIONALES:\n${notes.trim()}` : ""}

Es todo en cuanto puedo certificar en honor a la verdad, autorizando al interesado hacer uso del presente certificado en tramites pertinentes.`}</div>
      <div style="margin-top:16px;text-align:center;">
        <div style="margin-top:12px">Atentamente</div>
        <br/>
        <div style="margin:12px 0;border-top:1px solid #ddd"></div>
        <div style="font-weight:900">${doctor.fullName}</div>
        <div style="font-weight:900">${doctor.specialty}</div>
        <div>CEDULA: ${doctor.cedula}</div>
        <div>REG. MEDICO: ${doctor.regMedico}</div>
        <div>CELULAR: ${doctor.phone}</div>
        <div>CORREO: ${doctor.email}</div>
        <div style="margin-top:8px">Direccion: ${doctor.address}</div>
      </div>`;

    const w = window.open("", "_blank");
    if (!w) { alert("Permite ventanas emergentes para imprimir."); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Certificado Médico</title><style>
      * { box-sizing: border-box; font-family: 'Times New Roman', serif; }
      body { margin: 0; padding: 0; background: #fff; }
      .paper { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 15mm; position: relative; background: #fff; }
      @media print { @page { margin: 0; } body { padding: 0; } .paper { width: auto; margin: 0; padding: 8mm; } }
      .watermark { position: absolute; inset: 0; background-image: url("${LOGO_WM}"); background-repeat: no-repeat; background-position: center; background-size: 500px auto; opacity: 0.3; pointer-events: none; z-index: 0; }
      .content { position: relative; z-index: 1; }
      .pdfHeader { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin: 0 0 4mm 0; }
      .pdfHeader img { height: 16mm; object-fit: contain; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    </style></head><body>
      <div class="paper"><div class="watermark"></div><div class="content">${html}</div></div>
    </body></html>`);
    w.document.close();
    const images = w.document.querySelectorAll("img");
    let loaded = 0;
    const total = images.length;
    function checkAndPrint() { loaded++; if (loaded >= total) setTimeout(() => { w.focus(); w.print(); }, 500); }
    if (total === 0) { setTimeout(() => { w.focus(); w.print(); }, 300); }
    else { images.forEach(img => { if (img.complete) checkAndPrint(); else { img.onload = checkAndPrint; img.onerror = () => checkAndPrint(); } }); }
  }

  if (!visitId) return <div className="mm-empty">ID inválido.</div>;
  if (loading) return <div className="mm-empty">Cargando consulta…</div>;
  if (!visit || !patient) return <div className="mm-empty">No se encontró la consulta.</div>;

  const age = calcAge(patient.birthdate) ?? patient.age ?? null;
  const isChild = age !== null ? Number(age) < 10 : false;
  const bmiLive = isChild ? null : calcBMI(weightKg, heightCm);
  const status = classifyVitals({ bp_sys: bpSys, bp_dia: bpDia, hr, spo2, temp_c: tempC });

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16, display: "grid", gap: 16 }}>

      {/* ── Header card ── */}
      <div className="mm-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ height: 4, background: "linear-gradient(90deg,var(--mm-green),var(--mm-green2))" }} />
        <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="mm-avatar" style={{ width: 48, height: 48, fontSize: 16 }}>{initials(patient.name)}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{patient.name}</div>
              <div style={{ fontSize: 13, color: "var(--mm-muted)" }}>
                CI: <b>{patient.cedula || "-"}</b> · {new Date(visit.visit_date).toLocaleString("es-EC")}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className={`mm-chip mm-chip--${status.level === "ok" ? "green" : status.level === "warn" ? "" : "red"}`}>
              {status.emoji} {status.text}
            </span>
            {!editVisit ? (
              <button className="mm-btn mm-btn--primary mm-btn--sm" onClick={() => setEditVisit(true)}>✏ Editar</button>
            ) : (
              <>
                <button className="mm-btn mm-btn--primary mm-btn--sm" onClick={saveVisitEdits} disabled={savingVisit}>
                  {savingVisit ? "Guardando…" : "✓ Guardar"}
                </button>
                <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={cancelVisitEdits} disabled={savingVisit}>Cancelar</button>
              </>
            )}
            <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={() => nav(`/patients/${patient.id}`)}>← Volver</button>
          </div>
        </div>
      </div>

      {/* ── Consulta info ── */}
      <div className="mm-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ height: 4, background: "linear-gradient(90deg,var(--mm-green),var(--mm-green2))" }} />
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--mm-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Datos de la consulta</span>
        </div>
        <div style={{ padding: "14px 20px" }}>
          {!editVisit ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--mm-muted)", marginBottom: 3 }}>MOTIVO</div>
                <div style={{ fontSize: 14 }}>{visit.reason || "-"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--mm-muted)", marginBottom: 3 }}>DIAGNÓSTICO</div>
                <div style={{ fontSize: 14 }}>{formatDiagnosesForDisplay(diags)}</div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 11, color: "var(--mm-muted)", marginBottom: 3 }}>NOTAS</div>
                <div style={{ fontSize: 14 }}>{visit.notes || "-"}</div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 11, color: "var(--mm-muted)", marginBottom: 3 }}>SIGNOS VITALES</div>
                <div style={{ fontSize: 14 }}>{vitalsSummary({ bp_sys: bpSys, bp_dia: bpDia, hr, spo2, temp_c: tempC, weight_kg: weightKg, height_cm: heightCm, bmi: bmiLive, pediatric_percentile: pediatricPercentile }, isChild)}</div>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label className="mm-label">Fecha y hora</label>
                  <input className="mm-input" type="datetime-local" value={visitDateEdit} onChange={(e) => setVisitDateEdit(e.target.value)} disabled={savingVisit} />
                </div>
                <div>
                  <label className="mm-label">Motivo</label>
                  <input className="mm-input" value={reasonEdit} onChange={(e) => setReasonEdit(e.target.value)} disabled={savingVisit} />
                </div>
              </div>
              <div>
                <label className="mm-label">Notas de consulta</label>
                <textarea className="mm-input" style={{ minHeight: 80, paddingTop: 10 }} value={visitNotesEdit} onChange={(e) => setVisitNotesEdit(e.target.value)} disabled={savingVisit} placeholder="Notas…" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Diagnósticos CIE10 ── */}
      <div className="mm-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ height: 4, background: "linear-gradient(90deg,var(--mm-green),var(--mm-green2))" }} />
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--mm-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Diagnósticos CIE-10</span>
          <span className="mm-chip">{savingDiags ? "Guardando…" : `${diags.length} seleccionados`}</span>
        </div>
        <div style={{ padding: "14px 20px", display: "grid", gap: 12 }}>
          <Cie10MultiPicker selected={diags} onChange={setDiags} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="mm-btn mm-btn--primary" onClick={saveDiagnoses} disabled={savingDiags}>
              {savingDiags ? "Guardando…" : "Guardar diagnósticos"}
            </button>
            <span style={{ fontSize: 12, color: "var(--mm-muted)" }}>Hasta 5 diagnósticos · tabla medical_visit_diagnoses</span>
          </div>
        </div>
      </div>

      {/* ── 2-col: Vitales + Certificado ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Signos vitales */}
        <div className="mm-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "linear-gradient(90deg,var(--mm-green),var(--mm-green2))" }} />
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--mm-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Signos vitales</span>
            <span className="mm-chip">{savingVitals ? "Guardando…" : "MicMEDIC"}</span>
          </div>
          <div style={{ padding: "14px 20px", display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label className="mm-label">PA Sistólica</label>
                <input className="mm-input" placeholder="120" value={bpSys} onChange={(e) => setBpSys(e.target.value)} />
              </div>
              <div>
                <label className="mm-label">PA Diastólica</label>
                <input className="mm-input" placeholder="80" value={bpDia} onChange={(e) => setBpDia(e.target.value)} />
              </div>
              <div>
                <label className="mm-label">FC (lpm)</label>
                <input className="mm-input" placeholder="78" value={hr} onChange={(e) => setHr(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label className="mm-label">SpO₂ (%)</label>
                <input className="mm-input" placeholder="98" value={spo2} onChange={(e) => setSpo2(e.target.value)} />
              </div>
              <div>
                <label className="mm-label">Temperatura (°C)</label>
                <input className="mm-input" placeholder="36.7" value={tempC} onChange={(e) => setTempC(e.target.value)} />
              </div>
              <div>
                <label className="mm-label">Edad</label>
                <input className="mm-input" value={age !== null ? `${age} años` : "-"} disabled />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label className="mm-label">Peso (kg)</label>
                <input className="mm-input" placeholder="70" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
              </div>
              <div>
                <label className="mm-label">Talla (cm)</label>
                <input className="mm-input" placeholder="170" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
              </div>
              <div>
                <label className="mm-label">{isChild ? "Percentil OMS" : "IMC"}</label>
                {isChild ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <input className="mm-input" placeholder="P50, P85…" value={pediatricPercentile} onChange={(e) => setPediatricPercentile(e.target.value)} />
                    <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={() => setShowOmsModal(true)}>Ver tabla OMS</button>
                  </div>
                ) : (
                  <input className="mm-input" value={bmiLive !== null ? bmiLive.toFixed(1) : "-"} disabled />
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button className="mm-btn mm-btn--primary" onClick={saveVitals} disabled={savingVitals}>
                {savingVitals ? "Guardando…" : "Guardar vitales"}
              </button>
              <span style={{ fontSize: 12, color: "var(--mm-muted)" }}>
                {isChild ? "< 10 años: registrar percentil OMS manual." : "10+ años: IMC calculado automáticamente."}
              </span>
            </div>
          </div>
        </div>

        {/* Certificado médico */}
        <div className="mm-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "linear-gradient(90deg,var(--mm-green),var(--mm-green2))" }} />
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--mm-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Certificado médico</span>
            <span className="mm-chip">{certId ? `ID ${certId}` : "Nuevo"}</span>
          </div>
          <div style={{ padding: "14px 20px", display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="mm-label">Fecha del certificado</label>
                <input className="mm-input" type="date" value={new Date(certDate).toISOString().slice(0, 10)} onChange={(e) => setCertDate(new Date(e.target.value).toISOString())} />
              </div>
              <div>
                <label className="mm-label">Días de reposo</label>
                <input className="mm-input" value={daysRestComputed ? `${daysRestComputed} día(s)` : "-"} disabled />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="mm-label">Reposo desde</label>
                <input className="mm-input" type="date" value={restFrom} onChange={(e) => setRestFrom(e.target.value)} />
              </div>
              <div>
                <label className="mm-label">Reposo hasta</label>
                <input className="mm-input" type="date" value={restTo} min={restFrom || undefined} onChange={(e) => setRestTo(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mm-label">Entidad</label>
              <input className="mm-input" placeholder="Ej: Unidad Educativa …" value={entity} onChange={(e) => setEntity(e.target.value)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="mm-label">Cargo</label>
                <input className="mm-input" placeholder="Ej: Docente" value={position} onChange={(e) => setPosition(e.target.value)} />
              </div>
              <div>
                <label className="mm-label">Teléfono de contacto</label>
                <input className="mm-input" placeholder="0999…" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mm-label">Domicilio</label>
              <input className="mm-input" placeholder="Dirección…" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div>
              <label className="mm-label">Correo electrónico</label>
              <input className="mm-input" placeholder="correo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={includeNotes} onChange={(e) => setIncludeNotes(e.target.checked)} />
              Incluir notas adicionales en el certificado
            </label>
            {includeNotes && (
              <textarea className="mm-input" style={{ minHeight: 70, paddingTop: 10 }} placeholder="Notas adicionales…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="mm-btn mm-btn--primary" onClick={saveCertificate}>Guardar certificado</button>
              <button className="mm-btn mm-btn--ghost" onClick={printPDF}>🖨 Imprimir / PDF</button>
              <button className="mm-btn mm-btn--ghost" onClick={() => nav(`/visits/${visit.id}/prescription`)}>Receta</button>
            </div>
            <p style={{ fontSize: 12, color: "var(--mm-muted)", margin: 0 }}>Consejo: primero guarda, luego imprime.</p>
          </div>
        </div>
      </div>

      {/* ── Vista previa PDF ── */}
      <div className="mm-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ height: 4, background: "linear-gradient(90deg,var(--mm-green),var(--mm-green2))" }} />
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--mm-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Vista previa · Certificado</span>
          <span className="mm-chip">PDF</span>
        </div>
        <div style={{ padding: "20px 24px" }}>
          <div ref={printRef} style={{ fontFamily: "'Times New Roman', serif", fontSize: 13, lineHeight: 1.5, color: "#222" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
              <img src="/logo-top.png" alt="Logo" style={{ height: 55, objectFit: "contain" }} />
              <div style={{ color: "#333", fontSize: 8.5, lineHeight: 1.15, textAlign: "right" }}>
                <div style={{ fontWeight: 900 }}>{doctor.headerLine1}</div>
                <div>{doctor.headerLine2}</div>
                <div>{doctor.headerLine3}</div>
                <div style={{ fontWeight: 900 }}>{doctor.headerLine4}</div>
                <div style={{ marginTop: 6 }}>Salcedo, {fmtDateLong(certDate)}</div>
              </div>
            </div>
            <div style={{ textAlign: "center", fontWeight: 900, margin: "12px 0 10px" }}>CERTIFICADO MEDICO</div>
            <div style={{ fontSize: 13, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
{`A quien interese,

Por medio de la presente CERTIFICO que el paciente ${patient.name} con CI. ${patient.cedula || "-"}, fue atendido por:

Diagnostico: ${diags.length > 0 ? diags.map(d => `${d.name || d.code} (${d.code})`).join("; ") : (visit.cie10_code && visit.cie10_name) ? `${visit.cie10_name} CIE10 (${visit.cie10_code})` : visit.cie10_name || visit.cie10_code || "-"}

Numero de historia clinica: ${patient.cedula || "-"}

Lugar de atencion: ${clinicName}

Contingencia: ${contingency}

Tipo de atencion: ${attentionType}

Fecha de atencion: ${fmtDateShortDMY(certDate.slice(0, 10))}

Tratamiento: ${treatment}

Reposo absoluto: ${Number(daysRestComputed || 0)} (${numToWordsEs(Number(daysRestComputed || 0))}) DIAS, DESDE EL ${fmtDateShortDMY(restFrom)} (${dateToWordsEs(restFrom)}) HASTA EL ${fmtDateShortDMY(restTo)} (${dateToWordsEs(restTo)})

Entidad: ${entity || "-"}

Cargo: ${position || "-"}

Domicilio: ${address || "-"}

Correo electronico: ${email || "-"}

Telefono de contacto: ${contactPhone || "-"}${includeNotes && notes?.trim() ? `

NOTAS ADICIONALES:
${notes.trim()}` : ""}

Es todo en cuanto puedo certificar en honor a la verdad, autorizando al interesado hacer uso del presente certificado en tramites pertinentes.`}
            </div>
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <div style={{ marginTop: 12 }}>Atentamente</div>
              <br />
              <div style={{ margin: "12px 0", borderTop: "1px solid #ddd" }}></div>
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

      {/* ── Modal OMS ── */}
      {showOmsModal && (
        <div onClick={() => setShowOmsModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "grid", placeItems: "center", backdropFilter: "blur(2px)", zIndex: 9999 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--mm-surface)", borderRadius: 16, width: "min(600px, 90vw)", border: "1px solid var(--mm-border)", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--mm-border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--mm-bg)" }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Curvas OMS — guía rápida</span>
              <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={() => setShowOmsModal(false)}>✕ Cerrar</button>
            </div>
            <div style={{ padding: "16px 20px", display: "grid", gap: 12 }}>
              <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                Registra el percentil de forma manual (ej: <b>P50</b>, <b>P85</b>, <b>P97</b>).
                Usa la tabla OMS según <b>sexo</b> y <b>edad</b> del paciente.
              </p>
              <div>
                <label className="mm-label">Percentil OMS</label>
                <input className="mm-input" placeholder="Ej: P50" value={pediatricPercentile} onChange={(e) => setPediatricPercentile(e.target.value)} />
              </div>
              <p style={{ fontSize: 12, color: "var(--mm-muted)", margin: 0 }}>P50 = promedio · P85 = sobrepeso (según caso) · P97 = muy alto</p>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="mm-btn mm-btn--primary" onClick={() => setShowOmsModal(false)}>✓ Listo</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
