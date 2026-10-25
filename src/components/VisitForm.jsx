import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import Cie10MultiPicker from "./Cie10MultiPicker";

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

function calcBMI(weightKg, heightCm) {
  const w = Number(weightKg);
  const hcm = Number(heightCm);
  if (!Number.isFinite(w) || !Number.isFinite(hcm) || w <= 0 || hcm <= 0) return null;
  const hm = hcm / 100;
  const bmi = w / (hm * hm);
  if (!Number.isFinite(bmi)) return null;
  return Math.round(bmi * 100) / 100;
}

export default function VisitForm({ patientId, onCreated }) {
  const [saving, setSaving] = useState(false);

  const [visitDate, setVisitDate] = useState(() => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });

  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [diags, setDiags] = useState([]);

  const [patient, setPatient] = useState(null);
  const [age, setAge] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadPatient() {
      if (!patientId) return;
      const p = await supabase.from("patients").select("id, birthdate, sex").eq("id", patientId).single();
      if (!p.error && mounted) {
        setPatient(p.data);
        setAge(calcAgeFromBirthdate(p.data.birthdate));
      } else if (mounted) {
        setPatient(null);
        setAge(null);
      }
    }
    loadPatient();
    return () => { mounted = false; };
  }, [patientId]);

  const [bpSys, setBpSys] = useState("");
  const [bpDia, setBpDia] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [spo2, setSpo2] = useState("");
  const [tempC, setTempC] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [growthPercentile, setGrowthPercentile] = useState("");
  const [growthNote, setGrowthNote] = useState("");

  const [omsOpen, setOmsOpen] = useState(false);
  const [omsSex, setOmsSex] = useState("M");
  const [omsAgeMonths, setOmsAgeMonths] = useState("");
  const [omsIndicator, setOmsIndicator] = useState("bmi_age");

  const liveBMI = useMemo(() => calcBMI(weightKg, heightCm), [weightKg, heightCm]);

  const canSave = useMemo(() => {
    return patientId && reason.trim().length >= 3 && diags.length > 0;
  }, [patientId, reason, diags]);

  function openOms() {
    setOmsSex(patient?.sex === "F" ? "F" : "M");
    setOmsOpen(true);
  }

  function applyOms() {
    const indLabel = omsIndicator === "bmi_age" ? "IMC/Edad" : omsIndicator === "weight_age" ? "Peso/Edad" : "Talla/Edad";
    const m = (omsAgeMonths || "").toString().trim();
    const noteParts = [];
    if (m) noteParts.push(`Edad: ${m} meses`);
    noteParts.push(`Sexo: ${omsSex === "F" ? "Niña" : "Niño"}`);
    noteParts.push(`Indicador: ${indLabel}`);
    const extra = growthNote?.trim();
    const base = noteParts.join(" · ");
    setGrowthNote(extra ? `${base} · ${extra}` : base);
    setOmsOpen(false);
  }

  function resetForm() {
    const d = new Date();
    setVisitDate(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    setReason(""); setNotes(""); setDiags([]);
    setBpSys(""); setBpDia(""); setHeartRate(""); setSpo2(""); setTempC("");
    setWeightKg(""); setHeightCm(""); setGrowthPercentile(""); setGrowthNote("");
  }

  async function createVisit(e) {
    e.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);

    const visitPayload = {
      patient_id: patientId,
      visit_date: visitDate ? new Date(visitDate).toISOString() : new Date().toISOString(),
      reason: reason.trim(),
      notes: notes.trim() || null,
      bp_systolic: bpSys !== "" ? Number(bpSys) : null,
      bp_diastolic: bpDia !== "" ? Number(bpDia) : null,
      heart_rate: heartRate !== "" ? Number(heartRate) : null,
      spo2: spo2 !== "" ? Number(spo2) : null,
      temp_c: tempC !== "" ? Number(tempC) : null,
      weight_kg: weightKg !== "" ? Number(weightKg) : null,
      height_cm: heightCm !== "" ? Number(heightCm) : null,
      bmi: age !== null && age >= 10 ? (liveBMI ?? null) : null,
      growth_percentile: growthPercentile !== "" ? Number(growthPercentile) : null,
      growth_note: (growthNote || "").trim() ? growthNote.trim() : null,
    };

    const { data: visitData, error: visitError } = await supabase
      .from("medical_visits").insert(visitPayload).select("id").single();

    if (visitError) {
      console.error(visitError);
      alert(visitError.message || "Error guardando consulta");
      setSaving(false);
      return;
    }

    const visitId = visitData.id;

    if (diags.length > 0) {
      const diagPayload = diags.map((d) => ({ visit_id: visitId, cie10_code: d.code, cie10_name: d.name }));
      const { error: diagError } = await supabase.from("medical_visit_diagnoses").insert(diagPayload);
      if (diagError) {
        console.error(diagError);
        alert("La consulta se creó, pero falló guardar algunos diagnósticos.");
      }
    }

    setSaving(false);
    resetForm();
    onCreated?.();
  }

  const inputLabel = { fontSize: 12, color: "var(--mm-muted)", marginBottom: 4, display: "block" };

  return (
    <>
      <form onSubmit={createVisit} style={{ display: "grid", gap: 16 }}>
        {/* Datos generales */}
        <div className="mm-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "linear-gradient(90deg,var(--mm-green),var(--mm-green2))" }} />
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--mm-border)" }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Nueva consulta</div>
            <div style={{ fontSize: 12, color: "var(--mm-muted)", marginTop: 2 }}>
              Requisito: motivo + al menos un diagnóstico CIE10
              {diags.length > 0 && ` · ${diags.length} diagnóstico${diags.length > 1 ? "s" : ""} seleccionado${diags.length > 1 ? "s" : ""}`}
            </div>
          </div>
          <div style={{ padding: "14px 16px", display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
              <div>
                <label style={inputLabel}>Fecha y hora</label>
                <input className="mm-input" type="datetime-local" value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)} disabled={saving} />
              </div>
              <div>
                <label style={inputLabel}>Motivo de consulta</label>
                <input className="mm-input" placeholder="Ej: dolor de garganta, fiebre..." value={reason}
                  onChange={(e) => setReason(e.target.value)} disabled={saving} />
              </div>
            </div>

            <div>
              <label style={inputLabel}>Diagnósticos CIE10</label>
              <Cie10MultiPicker selected={diags} onChange={setDiags} disabled={saving} />
            </div>

            <div>
              <label style={inputLabel}>Notas / evolución clínica (opcional)</label>
              <textarea className="mm-input" placeholder="Evolución, observaciones..." value={notes}
                onChange={(e) => setNotes(e.target.value)} disabled={saving}
                style={{ minHeight: 90, resize: "vertical", paddingTop: 10, lineHeight: 1.5 }} />
            </div>
          </div>
        </div>

        {/* Signos vitales */}
        <div className="mm-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--mm-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Signos vitales</div>
            <div className="mm-chip">Opcional</div>
          </div>
          <div style={{ padding: "14px 16px", display: "grid", gap: 12 }}>
            {/* Fila 1: PA + FC */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <div>
                <label style={inputLabel}>Presión arterial (mmHg)</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input className="mm-input" placeholder="Sistólica" value={bpSys}
                    onChange={(e) => setBpSys(e.target.value)} disabled={saving} />
                  <input className="mm-input" placeholder="Diastólica" value={bpDia}
                    onChange={(e) => setBpDia(e.target.value)} disabled={saving} />
                </div>
              </div>
              <div>
                <label style={inputLabel}>Frecuencia cardiaca (lpm)</label>
                <input className="mm-input" placeholder="Ej: 78" value={heartRate}
                  onChange={(e) => setHeartRate(e.target.value)} disabled={saving} />
              </div>
            </div>

            {/* Fila 2: SpO2 + Temp + Edad */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={inputLabel}>Saturación O₂ (%)</label>
                <input className="mm-input" placeholder="Ej: 98" value={spo2}
                  onChange={(e) => setSpo2(e.target.value)} disabled={saving} />
              </div>
              <div>
                <label style={inputLabel}>Temperatura (°C)</label>
                <input className="mm-input" placeholder="Ej: 36.7" value={tempC}
                  onChange={(e) => setTempC(e.target.value)} disabled={saving} />
              </div>
              <div>
                <label style={inputLabel}>Edad</label>
                <div className="mm-input" style={{ display: "flex", alignItems: "center", color: "var(--mm-muted)" }}>
                  {age === null ? "—" : `${age} años`}
                </div>
              </div>
            </div>

            {/* Fila 3: Peso + Talla + IMC/OMS */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={inputLabel}>Peso (kg)</label>
                <input className="mm-input" placeholder="Ej: 70" value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)} disabled={saving} />
              </div>
              <div>
                <label style={inputLabel}>Talla (cm)</label>
                <input className="mm-input" placeholder="Ej: 170" value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)} disabled={saving} />
              </div>
              <div>
                <label style={inputLabel}>{age !== null && age >= 10 ? "IMC (auto)" : "Curvas OMS"}</label>
                {age !== null && age >= 10 ? (
                  <div className="mm-input" style={{ display: "flex", alignItems: "center", fontWeight: 700 }}>
                    {liveBMI ?? "—"}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: 11, color: "var(--mm-muted)", lineHeight: 1.3 }}>
                      Menores de 10 años: registrar percentil OMS manualmente.
                    </div>
                    <button className="mm-btn mm-btn--ghost mm-btn--sm" type="button"
                      onClick={openOms} disabled={saving}>
                      📊 Ver tabla OMS
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Percentil OMS (solo si <10 años) */}
            {age !== null && age < 10 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
                <div>
                  <label style={inputLabel}>Percentil OMS (0–100)</label>
                  <input className="mm-input" placeholder="Ej: 50" value={growthPercentile}
                    onChange={(e) => setGrowthPercentile(e.target.value)} disabled={saving} />
                </div>
                <div>
                  <label style={inputLabel}>Nota OMS</label>
                  <input className="mm-input" placeholder="Ej: P10, riesgo bajo peso..." value={growthNote}
                    onChange={(e) => setGrowthNote(e.target.value)} disabled={saving} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Botón guardar */}
        <button className="mm-btn" disabled={!canSave || saving}>
          {saving ? "Guardando..." : "✓ Guardar consulta"}
        </button>
      </form>

      {/* MODAL OMS */}
      {omsOpen && (
        <div onClick={() => setOmsOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "grid",
            placeItems: "center", backdropFilter: "blur(2px)", zIndex: 9999, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--mm-surface)", borderRadius: 16, width: "min(640px, 100%)",
              maxHeight: "90vh", overflow: "auto", border: "1px solid var(--mm-border)",
              boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
            {/* Header */}
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--mm-border)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "var(--mm-bg)", position: "sticky", top: 0, zIndex: 1 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>📊 Curvas OMS</div>
                <div style={{ fontSize: 12, color: "var(--mm-muted)" }}>Registro manual de percentil</div>
              </div>
              <button className="mm-btn mm-btn--ghost mm-btn--sm" type="button" onClick={() => setOmsOpen(false)}>✕ Cerrar</button>
            </div>
            {/* Body */}
            <div style={{ padding: "16px 18px", display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={inputLabel}>Sexo</label>
                  <select className="mm-input" value={omsSex} onChange={(e) => setOmsSex(e.target.value)}>
                    <option value="M">Niño</option>
                    <option value="F">Niña</option>
                  </select>
                </div>
                <div>
                  <label style={inputLabel}>Edad (meses)</label>
                  <input className="mm-input" placeholder="Ej: 36" value={omsAgeMonths}
                    onChange={(e) => setOmsAgeMonths(e.target.value)} />
                </div>
                <div>
                  <label style={inputLabel}>Indicador</label>
                  <select className="mm-input" value={omsIndicator} onChange={(e) => setOmsIndicator(e.target.value)}>
                    <option value="bmi_age">IMC / Edad</option>
                    <option value="weight_age">Peso / Edad</option>
                    <option value="height_age">Talla / Edad</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
                <div>
                  <label style={inputLabel}>Percentil (0–100)</label>
                  <input className="mm-input" placeholder="Ej: 50" value={growthPercentile}
                    onChange={(e) => setGrowthPercentile(e.target.value)} />
                </div>
                <div>
                  <label style={inputLabel}>Nota clínica (opcional)</label>
                  <input className="mm-input" placeholder="Ej: P10, riesgo bajo peso..." value={growthNote}
                    onChange={(e) => setGrowthNote(e.target.value)} />
                </div>
              </div>

              <div style={{ background: "var(--mm-bg)", border: "1px solid var(--mm-border)",
                borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "var(--mm-muted)", lineHeight: 1.5 }}>
                Consulta la curva OMS correspondiente y registra el percentil manualmente para que quede guardado en la consulta.
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="mm-btn mm-btn--ghost" type="button" onClick={() => setOmsOpen(false)}>Cancelar</button>
                <button className="mm-btn" type="button" onClick={applyOms}>Guardar percentil</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
