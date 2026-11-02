import { useMemo, useState } from "react";

function toISOFromDateTime(dateStr, timeStr) {
  // dateStr: YYYY-MM-DD, timeStr: HH:MM (local)
  // new Date("YYYY-MM-DDTHH:MM") se interpreta como hora LOCAL
  const d = new Date(`${dateStr}T${timeStr}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString(); // se guarda como UTC en timestamptz
}

export default function AppointmentForm({ patients, onCreate, disabled }) {
  const [patientId, setPatientId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10)); // hoy
  const [time, setTime] = useState("09:00");
  const [durationMin, setDurationMin] = useState(30);
  const [reason, setReason] = useState("");

  const canSubmit = useMemo(() => {
    const hasPatient = String(patientId).trim() !== "";
    const hasDate = date && date.length === 10;
    const hasTime = time && time.length >= 4;
    const hasReason = reason.trim().length >= 3;
    const okDur = Number(durationMin) >= 5 && Number(durationMin) <= 240;
    return hasPatient && hasDate && hasTime && hasReason && okDur;
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
    const endISO = endLocal.toISOString();

    onCreate({
      patient_id: Number(patientId),
      start_at: startISO,
      end_at: endISO,
      reason: reason.trim(),
      status: "scheduled",
    });

    reset();
  }

  return (
    <form className="mm-form" onSubmit={submit}>
      <select
        className="mm-input"
        value={patientId}
        onChange={(e) => setPatientId(e.target.value)}
        disabled={disabled}
      >
        <option value="">Selecciona un paciente…</option>
        {patients?.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} — {p.cedula}
          </option>
        ))}
      </select>

      <div className="mm-row">
        <input
          className="mm-input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={disabled}
          title="Fecha"
        />
        <input
          className="mm-input"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          disabled={disabled}
          title="Hora"
        />
      </div>

      <div className="mm-row">
        <input
          className="mm-input"
          type="number"
          min={5}
          max={240}
          value={durationMin}
          onChange={(e) => setDurationMin(e.target.value)}
          disabled={disabled}
          placeholder="Duración (min)"
          title="Duración (minutos)"
        />
        <input
          className="mm-input"
          placeholder="Motivo (ej: Control / Dolor / Consulta general)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={disabled}
        />
      </div>

      <button className="mm-btn" disabled={!canSubmit || disabled}>
        Crear cita
      </button>

      <div className="mm-hint">
        Consejo: usa duración 20–30 min para mantener el día ordenado.
      </div>
    </form>
  );
}
