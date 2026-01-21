import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

/**
 * VisitDetail.jsx
 * Ruta: /visits/:id
 * Tablas:
 * - medical_visits (incluye signos vitales)
 * - patients
 * - certificates
 */

function fmtDateLong(dateISO) {
  const d = dateISO ? new Date(dateISO) : new Date();
  return d.toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "2-digit" });
}
function fmtDateShort(dateISO) {
  const d = dateISO ? new Date(dateISO) : new Date();
  return d.toLocaleDateString("es-EC", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

// Semáforo rápido (simple, útil y sin complicar)
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

  // ===== Signos vitales (inputs) =====
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

  // ===== Certificate data =====
  const [certId, setCertId] = useState(null);
  const [certDate, setCertDate] = useState(() => new Date().toISOString());

  const [daysRest, setDaysRest] = useState(0);
  const [entity, setEntity] = useState("");
  const [position, setPosition] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");

  const [includeNotes, setIncludeNotes] = useState(false);
  const [notes, setNotes] = useState("");

  // Campos fijos
  const clinicName = "Consultorio médico MIC MEDIC";
  const contingency = "Enfermedad general";
  const attentionType = "Medicina general";
  const treatment = "Farmacológico";

  // Datos del médico
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

    // 1) Visit (incluye signos vitales)
    const v = await supabase
      .from("medical_visits")
      .select(
        "id, patient_id, visit_date, reason, cie10_code, cie10_name, notes, created_at, user_id, bp_sys, bp_dia, hr, spo2, temp_c, weight_kg, height_cm, bmi, pediatric_percentile"
      )
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

    // cargar inputs de signos vitales
    setBpSys(v.data.bp_sys ?? "");
    setBpDia(v.data.bp_dia ?? "");
    setHr(v.data.hr ?? "");
    setSpo2(v.data.spo2 ?? "");
    setTempC(v.data.temp_c ?? "");
    setWeightKg(v.data.weight_kg ?? "");
    setHeightCm(v.data.height_cm ?? "");
    setPediatricPercentile(v.data.pediatric_percentile ?? "");

    // 3) Certificate (si existe)
    const c = await supabase
      .from("certificates")
      .select("id, date, days_rest, entity, position, address, email, include_notes, notes, title, body, visit_id, patient_id")
      .eq("visit_id", visitId)
      .maybeSingle();

    if (c.error) {
      console.error(c.error);
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

  async function saveVitals() {
    if (!visit || !patient) return;
    if (savingVitals) return;

    const age = calcAge(patient.birthdate) ?? patient.age ?? null;
    const isChild = age !== null ? Number(age) < 10 : false;

    const bmi = isChild ? null : calcBMI(weightKg, heightCm);

    const payload = {
      bp_sys: bpSys === "" ? null : Number(bpSys),
      bp_dia: bpDia === "" ? null : Number(bpDia),
      hr: hr === "" ? null : Number(hr),
      spo2: spo2 === "" ? null : Number(spo2),
      temp_c: tempC === "" ? null : Number(tempC),
      weight_kg: weightKg === "" ? null : Number(weightKg),
      height_cm: heightCm === "" ? null : Number(heightCm),
      bmi: bmi === null ? null : Number(bmi.toFixed(2)),
      pediatric_percentile: isChild ? (pediatricPercentile?.trim() ? pediatricPercentile.trim() : null) : null,
    };

    setSavingVitals(true);
    const { error } = await supabase.from("medical_visits").update(payload).eq("id", visit.id);
    setSavingVitals(false);

    if (error) {
      console.error(error);
      alert(error.message || "No se pudo guardar signos vitales");
      return;
    }

    alert("Signos vitales guardados.");
    loadAll();
  }

  async function saveCertificate() {
    if (!visit || !patient) return;

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
      `Reposo absoluto: ${Number(daysRest || 0)} DIAS, DESDE EL ${fmtDateShort(visit.visit_date)} hasta el ${fmtDateShort(
        new Date(new Date(visit.visit_date).getTime() + Number(daysRest || 0) * 86400000).toISOString()
      )}`,
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
    visit.cie10_code && visit.cie10_name
      ? `${visit.cie10_name} (${visit.cie10_code})`
      : visit.cie10_name || visit.cie10_code || "-";

  const age = calcAge(patient.birthdate) ?? patient.age ?? null;
  const isChild = age !== null ? Number(age) < 10 : false;

  const bmiLive = isChild ? null : calcBMI(weightKg, heightCm);
  const status = classifyVitals({
    bp_sys: bpSys,
    bp_dia: bpDia,
    hr,
    spo2,
    temp_c: tempC,
  });

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 14, display: "grid", gap: 14 }}>
      {/* Header consulta */}
      <div className="mm-card">
        <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="mm-cardTitle">Consulta</div>
            <div style={{ opacity: 0.85, fontSize: 13 }}>
              Paciente: <b>{patient.name}</b> · CI: <b>{patient.cedula}</b> · Fecha:{" "}
              <b>{new Date(visit.visit_date).toLocaleString("es-EC")}</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div className="mm-chip" title="Estado signos vitales">
              {status.emoji} {status.text}
            </div>

            <button className="mm-btn mm-btn--ghost" type="button" onClick={() => nav(`/patients/${patient.id}`)}>
              Volver a ficha
            </button>
          </div>
        </div>

        <div className="mm-itemMeta" style={{ padding: 14 }}>
          <div><b>Motivo:</b> {visit.reason || "-"}</div>
          <div><b>Diagnóstico (CIE10):</b> {diagLabel}</div>
          <div><b>Notas de consulta:</b> {visit.notes || "-"}</div>
          <div><b>Signos vitales:</b> {vitalsSummary({ bp_sys: bpSys, bp_dia: bpDia, hr, spo2, temp_c: tempC, weight_kg: weightKg, height_cm: heightCm, bmi: bmiLive, pediatric_percentile: pediatricPercentile }, isChild)}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Izquierda: Signos vitales + Certificado */}
        <div style={{ display: "grid", gap: 14 }}>
          {/* Signos vitales */}
          <div className="mm-card">
            <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
              <div className="mm-cardTitle">Signos vitales</div>
              <div className="mm-chip">{savingVitals ? "Guardando..." : "MicMEDIC"}</div>
            </div>

            <div style={{ padding: 14, display: "grid", gap: 12 }}>
              <div className="mm-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>PA Sistólica (mmHg)</div>
                  <input className="mm-input" placeholder="Ej: 120" value={bpSys} onChange={(e) => setBpSys(e.target.value)} />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>PA Diastólica (mmHg)</div>
                  <input className="mm-input" placeholder="Ej: 80" value={bpDia} onChange={(e) => setBpDia(e.target.value)} />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Frecuencia cardiaca (lpm)</div>
                  <input className="mm-input" placeholder="Ej: 78" value={hr} onChange={(e) => setHr(e.target.value)} />
                </div>
              </div>

              <div className="mm-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Saturación O₂ (%)</div>
                  <input className="mm-input" placeholder="Ej: 98" value={spo2} onChange={(e) => setSpo2(e.target.value)} />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Temperatura (°C)</div>
                  <input className="mm-input" placeholder="Ej: 36.7" value={tempC} onChange={(e) => setTempC(e.target.value)} />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Edad</div>
                  <input className="mm-input" value={age !== null ? `${age} años` : "-"} disabled />
                </div>
              </div>

              <div className="mm-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Peso (kg)</div>
                  <input className="mm-input" placeholder="Ej: 70" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Talla (cm)</div>
                  <input className="mm-input" placeholder="Ej: 170" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{isChild ? "Curvas OMS (percentil)" : "IMC"}</div>

                  {isChild ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      <input
                        className="mm-input"
                        placeholder="Ej: P50, P85, P97"
                        value={pediatricPercentile}
                        onChange={(e) => setPediatricPercentile(e.target.value)}
                      />
                      <button className="mm-btn mm-btn--ghost" type="button" onClick={() => setShowOmsModal(true)}>
                        Ver tabla (guía)
                      </button>
                    </div>
                  ) : (
                    <input className="mm-input" value={bmiLive !== null ? bmiLive.toFixed(1) : "-"} disabled />
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button className="mm-btn" type="button" onClick={saveVitals} disabled={savingVitals}>
                  Guardar signos vitales
                </button>

                <div className="mm-hint" style={{ margin: 0 }}>
                  {isChild
                    ? "Menores de 10: registra percentil OMS manual (P50, P85, etc.)."
                    : "Desde 10+: el sistema calcula IMC automáticamente con peso y talla."}
                </div>
              </div>
            </div>
          </div>

          {/* Certificado */}
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

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="mm-btn" type="button" onClick={saveCertificate}>
                  Guardar certificado
                </button>

                <button className="mm-btn mm-btn--ghost" type="button" onClick={printPDF}>
                  Imprimir / Guardar PDF
                </button>

                <button className="mm-btn mm-btn--ghost" type="button" onClick={() => nav(`/visits/${visit.id}/prescription`)}>
                  Receta
                </button>
              </div>

              <div className="mm-hint">
                Consejo: primero guarda, luego imprime. Así queda todo persistido por consulta.
              </div>
            </div>
          </div>
        </div>

        {/* Derecha: Vista previa imprimible */}
        <div className="mm-card">
          <div className="mm-cardHead">
            <div className="mm-cardTitle">Vista previa</div>
            <div className="mm-chip">PDF</div>
          </div>

          <div style={{ padding: 14 }}>
            <div ref={printRef}>
              <div className="head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 34, letterSpacing: ".5px" }}>MicMEDIC</div>
                </div>
                <div style={{ color: "#333", fontSize: 12, lineHeight: 1.25, textAlign: "right" }}>
                  <div style={{ fontWeight: 900 }}>{doctor.headerLine1}</div>
                  <div>{doctor.headerLine2}</div>
                  <div>{doctor.headerLine3}</div>
                  <div style={{ fontWeight: 900 }}>{doctor.headerLine4}</div>
                  <div style={{ marginTop: 6 }}>
                    Salcedo, {fmtDateLong(certDate)}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: "center", fontWeight: 900, margin: "18px 0 16px" }}>CERTIFICADO MEDICO</div>

              <div style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
{`A quien interese,

Por medio de la presente CERTIFICO que el paciente ${patient.name} con CI. ${patient.cedula}, fue atendido por:

Diagnostico: ${visit.cie10_name ? visit.cie10_name : "-"} CIE10 (${visit.cie10_code ? visit.cie10_code : "-"})

Numero de historia clinica: ${patient.cedula}

Lugar de atencion: ${clinicName}

Contingencia: ${contingency}

Tipo de atencion: ${attentionType}

Fecha de atencion: ${fmtDateShort(visit.visit_date)}

Tratamiento: ${treatment}

Reposo absoluto: ${Number(daysRest || 0)} DIAS

Entidad: ${entity || "-"}

Cargo: ${position || "-"}

Domicilio: ${address || "-"}

Correo electronico: ${email || "-"}

Es todo en cuanto puedo certificar en honor a la verdad, autorizando al interesado hacer uso del presente certificado en tramites pertinentes.`}
              </div>

              <div style={{ marginTop: 22, textAlign: "center" }}>
                <div style={{ marginTop: 18 }}>Atentamente</div>
                <div style={{ margin: "18px 0", borderTop: "1px solid #ddd" }}></div>
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

      {/* Modal guía OMS (manual) */}
      {showOmsModal && (
        <div
          onClick={() => setShowOmsModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.35)",
            display: "grid",
            placeItems: "center",
            padding: 14,
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="mm-card"
            style={{ width: "min(760px, 100%)" }}
          >
            <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
              <div className="mm-cardTitle">Curvas OMS (guía rápida)</div>
              <button className="mm-btn mm-btn--ghost" type="button" onClick={() => setShowOmsModal(false)}>
                Cerrar
              </button>
            </div>

            <div style={{ padding: 14, display: "grid", gap: 10 }}>
              <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.5 }}>
                Aquí se registra el percentil manualmente (ej: <b>P50</b>, <b>P85</b>, <b>P97</b>).
                <br />
                Recomendación: usa la tabla OMS según <b>sexo</b> y <b>edad</b> del paciente, y guarda el percentil final.
              </div>

              <div className="mm-item">
                <div className="mm-itemTop" style={{ alignItems: "center" }}>
                  <div className="mm-itemName">Percentil OMS</div>
                  <div className="mm-chip">Manual</div>
                </div>

                <div className="mm-itemMeta" style={{ display: "grid", gap: 10 }}>
                  <input
                    className="mm-input"
                    placeholder="Ej: P50"
                    value={pediatricPercentile}
                    onChange={(e) => setPediatricPercentile(e.target.value)}
                  />
                  <div className="mm-hint" style={{ margin: 0 }}>
                    Tip rápido: P50 = promedio, P85 = sobrepeso (según caso), P97 = muy alto. (Solo guía visual).
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="mm-btn" type="button" onClick={() => setShowOmsModal(false)}>
                  Listo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
