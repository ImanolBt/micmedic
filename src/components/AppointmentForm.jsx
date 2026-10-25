import { useMemo, useState } from "react";

function toISOFromDateTime(dateStr, timeStr) {
  const d = new Date(`${dateStr}T${timeStr}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function AppointmentForm({ patients, onCreate, disabled }) {
  const [patientId, setPatientId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("09:00");
  const [durationMin, setDurationMin] = useState(30);
  const [reason, setReason] = useState("");

  const canSubmit = useMemo(() => {
    return (
      String(patientId).trim() !== "" &&
      date && date.length === 10 &&
      time && time.length >= 4 &&
      reason.trim().length >= 3 &&
      Number(durationMin) >= 5 && Number(durationMin) <= 240
    );
  }, [patientId, date, time, reason, durationMin]);

  function reset() {
    setPatientId("");
    setTime("09:00");
    setDurationMin(30);
    setReason("");
  }

  function submit(e) {
    e.preventDefault();
    if (!canSubmit || disabled) return;
    const startISO = toISOFromDateTime(date, time);
    if (!startISO) return alert("Fecha/hora inválida.");
    const startLocal = new Date(`${date}T${time}:00`);
    const endLocal = new Date(startLocal.getTime() + Number(durationMin) * 60000);
    onCreate({
      patient_id: Number(patientId),
      start_at: startISO,
      end_at: endLocal.toISOString(),
      reason: reason.trim(),
      status: "scheduled",
    });
    reset();
  }

  const inputLabel = { fontSize: 12, color: "var(--mm-muted)", marginBottom: 4, display: "block" };

  return (
    <div className="mm-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ height: 4, background: "linear-gradient(90deg,var(--mm-green),var(--mm-green2))" }} />
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--mm-border)" }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Nueva cita</div>
        <div style={{ fontSize: 12, color: "var(--mm-muted)", marginTop: 2 }}>
          Consejo: usa 20–30 min para mantener el día ordenado
        </div>
      </div>
      <form onSubmit={submit} style={{ padding: "14px 16px", display: "grid", gap: 12 }}>
        <div>
          <label style={inputLabel}>Paciente</label>
          <select className="mm-input" value={patientId}
            onChange={(e) => setPatientId(e.target.value)} disabled={disabled}>
            <option value="">Selecciona un paciente…</option>
            {patients?.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {p.cedula}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label style={inputLabel}>Fecha</label>
            <input className="mm-input" type="date" value={date}
              onChange={(e) => setDate(e.target.value)} disabled={disabled} />
          </div>
          <div>
            <label style={inputLabel}>Hora</label>
            <input className="mm-input" type="time" value={time}
              onChange={(e) => setTime(e.target.value)} disabled={disabled} />
          </div>
          <div>
            <label style={inputLabel}>Duración (min)</label>
            <input className="mm-input" type="number" min={5} max={240}
              value={durationMin} onChange={(e) => setDurationMin(e.target.value)}
              disabled={disabled} placeholder="Ej: 30" />
          </div>
        </div>

        <div>
          <label style={inputLabel}>Motivo</label>
          <input className="mm-input" placeholder="Ej: Control, Dolor, Consulta general…"
            value={reason} onChange={(e) => setReason(e.target.value)} disabled={disabled} />
        </div>

        <button className="mm-btn" disabled={!canSubmit || disabled}>
          ✓ Crear cita
        </button>
      </form>
    </div>
  );
}
