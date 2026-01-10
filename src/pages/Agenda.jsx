import React, { useMemo, useState } from "react";

function startOfWeek(date = new Date()) {
  // Semana LUNES → DOMINGO
  const d = new Date(date);
  const day = d.getDay(); // 0 domingo ... 6 sábado
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function ymd(date) {
  const d = new Date(date);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function niceDay(date) {
  const d = new Date(date);
  return d.toLocaleDateString("es-EC", { weekday: "short", day: "2-digit", month: "short" });
}

const HOURS = ["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00"];

const STATUS = [
  { v: "Agendada", chip: "chip" },
  { v: "Atendida", chip: "chip" },
  { v: "No asistió", chip: "chip warn" },
];

export default function Agenda({ patients, appointments, onAddAppointment, onUpdateAppointment }) {
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()));
  const [showForm, setShowForm] = useState(false);

  // formulario
  const [form, setForm] = useState({
    date: ymd(new Date()),
    time: "09:00",
    patientId: patients?.[0]?.id ?? "",
    reason: "Consulta",
    status: "Agendada",
  });

  const days = useMemo(() => {
    const base = startOfWeek(weekAnchor);
    return Array.from({ length: 7 }, (_, i) => addDays(base, i));
  }, [weekAnchor]);

  const weekLabel = useMemo(() => {
    const a = days[0];
    const b = days[6];
    return `${a.toLocaleDateString("es-EC")}  →  ${b.toLocaleDateString("es-EC")}`;
  }, [days]);

  const byDay = useMemo(() => {
    const map = {};
    for (const d of days) map[ymd(d)] = [];
    for (const ap of appointments) {
      if (map[ap.date]) map[ap.date].push(ap);
    }
    // ordenar por hora
    for (const k of Object.keys(map)) {
      map[k].sort((x, y) => x.time.localeCompare(y.time));
    }
    return map;
  }, [appointments, days]);

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function add() {
    if (!form.patientId) return alert("Selecciona un paciente.");
    if (!form.date || !form.time) return alert("Selecciona fecha y hora.");

    const exists = appointments.some((a) => a.date === form.date && a.time === form.time);
    if (exists) return alert("Ya hay una cita en esa fecha y hora (demo).");

    onAddAppointment({
      id: Date.now(),
      date: form.date,
      time: form.time,
      patientId: Number(form.patientId),
      reason: form.reason.trim() || "Consulta",
      status: form.status,
    });

    setShowForm(false);
  }

  function patientName(id) {
    const p = patients.find((x) => x.id === id);
    return p ? p.name : "Paciente";
  }

  async function copyWhatsapp(ap) {
    const name = patientName(ap.patientId);
    const msg =
      `Hola ${name}, le recordamos su cita médica con la doctora.\n` +
      `📅 Fecha: ${ap.date}\n⏰ Hora: ${ap.time}\n🩺 Motivo: ${ap.reason}\n\n` +
      `MedGo • Recordatorio`;
    try {
      await navigator.clipboard.writeText(msg);
      alert("Mensaje copiado. Pégalo en WhatsApp ✅");
    } catch {
      alert("No se pudo copiar automático. Copia manualmente:\n\n" + msg);
    }
  }

  return (
    <div className="grid">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0 }}>Agenda semanal</h2>
          <div style={{ opacity: 0.75, fontSize: 12 }}>{weekLabel}</div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn" onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}>← Semana</button>
          <button className="btn" onClick={() => setWeekAnchor(new Date())}>Hoy</button>
          <button className="btn" onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}>Semana →</button>
          <button className="btn primary" onClick={() => setShowForm((s) => !s)}>
            + Nueva cita
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Nueva cita (demo)</h3>

          <div className="grid2">
            <div>
              <label style={{ opacity: 0.8 }}>Fecha</label>
              <input className="input" type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} />
            </div>
            <div>
              <label style={{ opacity: 0.8 }}>Hora</label>
              <select className="input" value={form.time} onChange={(e) => setField("time", e.target.value)}>
                {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div>
              <label style={{ opacity: 0.8 }}>Paciente</label>
              <select className="input" value={form.patientId} onChange={(e) => setField("patientId", e.target.value)}>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.name} (CI: {p.cedula})</option>)}
              </select>
            </div>

            <div>
              <label style={{ opacity: 0.8 }}>Estado</label>
              <select className="input" value={form.status} onChange={(e) => setField("status", e.target.value)}>
                {STATUS.map((s) => <option key={s.v} value={s.v}>{s.v}</option>)}
              </select>
            </div>
          </div>

          <div style={{ height: 10 }} />

          <label style={{ opacity: 0.8 }}>Motivo</label>
          <input className="input" value={form.reason} onChange={(e) => setField("reason", e.target.value)} />

          <div style={{ height: 12 }} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn ok" onClick={add}>Guardar cita</button>
            <button className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Calendario semanal */}
      <div className="grid2">
        {days.map((d) => {
          const key = ymd(d);
          const list = byDay[key] || [];
          return (
            <div key={key} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <b>{niceDay(d)}</b>
                <span style={{ opacity: 0.75, fontSize: 12 }}>{list.length} citas</span>
              </div>

              <div className="hr" />

              {list.length === 0 ? (
                <div style={{ opacity: 0.75 }}>Sin citas</div>
              ) : (
                <div className="grid">
                  {list.map((ap) => (
                    <div key={ap.id} className="card" style={{ background: "rgba(0,0,0,.12)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <b>{ap.time} • {patientName(ap.patientId)}</b>
                        <span className={ap.status === "No asistió" ? "chip warn" : "chip"}>{ap.status}</span>
                      </div>

                      <div style={{ marginTop: 8, opacity: 0.85 }}>
                        <b>Motivo:</b> {ap.reason}
                      </div>

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                        <button className="btn" onClick={() => copyWhatsapp(ap)}>Copiar WhatsApp</button>

                        <select
                          className="input"
                          style={{ width: 170 }}
                          value={ap.status}
                          onChange={(e) => onUpdateAppointment({ ...ap, status: e.target.value })}
                        >
                          {STATUS.map((s) => <option key={s.v} value={s.v}>{s.v}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ opacity: 0.75, fontSize: 12 }}>
        Nota demo: el botón WhatsApp copia un mensaje listo para pegar. En la versión final se integra envío automático.
      </div>
    </div>
  );
}
