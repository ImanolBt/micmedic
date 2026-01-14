import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

/** ===== Helpers ===== */
const STATUS = [
  { v: "scheduled", t: "Programada" },
  { v: "done", t: "Hecha" },
  { v: "cancelled", t: "Cancelada" },
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toLocalDateInputValue(d) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function toLocalDateTimeInputValue(d) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

// "YYYY-MM-DDTHH:mm" (local) -> ISO UTC
function localDateTimeToIso(dtLocal) {
  const d = new Date(dtLocal);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatLocalDateTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function digitsOnlyPhone(phone) {
  if (!phone) return "";
  return String(phone).replace(/[^\d]/g, "");
}

function openWhatsApp({ phone, text }) {
  const msg = encodeURIComponent(text || "");
  const digits = digitsOnlyPhone(phone);
  const url = digits
    ? `https://wa.me/${digits}?text=${msg}`
    : `https://wa.me/?text=${msg}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function startOfWeekLocal(dateStr) {
  // dateStr YYYY-MM-DD
  const d = new Date(`${dateStr}T00:00`);
  const day = d.getDay(); // 0=Dom .. 6=Sab
  const diff = (day === 0 ? -6 : 1 - day); // Lunes como inicio
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeekLocal(dateStr) {
  const s = startOfWeekLocal(dateStr);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

function buildCitaText({ patientName, whenLocal, reason }) {
  return `MicMEDIC - Cita agendada\n\nPaciente: ${patientName}\nFecha/Hora: ${whenLocal}\nMotivo: ${reason}\n\nPor favor confirmar asistencia.`;
}

function buildReminderText({ patientName, whenLocal, reason }) {
  return `MicMEDIC - Recordatorio\n\nPaciente: ${patientName}\nRecuerda tu cita:\nFecha/Hora: ${whenLocal}\nMotivo: ${reason}\n\nGracias.`;
}

/** ===== Page ===== */
export default function Agenda() {
  const [loading, setLoading] = useState(true);

  // modo: "day" | "week"
  const [mode, setMode] = useState("day");

  // fecha base (para día o semana)
  const [day, setDay] = useState(() => toLocalDateInputValue(new Date()));

  // pacientes
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState("");

  // form create
  const [startAtLocal, setStartAtLocal] = useState(() =>
    toLocalDateTimeInputValue(new Date())
  );
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  // list
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  // editar
  const [editing, setEditing] = useState(null); // item seleccionado
  const [editStartLocal, setEditStartLocal] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("scheduled");

  const selectedPatient = useMemo(() => {
    const idNum = Number(patientId);
    return patients.find((p) => p.id === idNum) || null;
  }, [patientId, patients]);

  const canCreate = useMemo(() => {
    const okPatient = !!patientId;
    const okReason = reason.trim().length >= 3;
    const iso = localDateTimeToIso(startAtLocal);
    return okPatient && okReason && !!iso && !saving;
  }, [patientId, reason, startAtLocal, saving]);

  async function loadPatients() {
    const { data, error } = await supabase
      .from("patients")
      .select("id, name, phone, cedula")
      .order("name", { ascending: true });

    if (error) throw error;
    setPatients(data || []);
    if (!patientId && data && data.length > 0) setPatientId(String(data[0].id));
  }

  async function loadAppointments() {
    if (mode === "day") {
      const startLocal = new Date(`${day}T00:00`);
      const endLocal = new Date(`${day}T23:59:59`);
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, patient_id, start_at, end_at, reason, notes, status, patients(name, phone, cedula)"
        )
        .gte("start_at", startLocal.toISOString())
        .lte("start_at", endLocal.toISOString())
        .order("start_at", { ascending: true });

      if (error) throw error;
      setItems(data || []);
      return;
    }

    // week
    const ws = startOfWeekLocal(day);
    const we = endOfWeekLocal(day);

    const { data, error } = await supabase
      .from("appointments")
      .select(
        "id, patient_id, start_at, end_at, reason, notes, status, patients(name, phone, cedula)"
      )
      .gte("start_at", ws.toISOString())
      .lte("start_at", we.toISOString())
      .order("start_at", { ascending: true });

    if (error) throw error;
    setItems(data || []);
  }

  async function reloadAll() {
    setLoading(true);
    try {
      await loadPatients();
      await loadAppointments();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Error cargando agenda");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadAppointments();
      } catch (e) {
        console.error(e);
        alert(e?.message || "Error cargando citas");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, mode]);

  async function createAppointment(e) {
    e.preventDefault();
    if (!canCreate) return;

    const startIso = localDateTimeToIso(startAtLocal);
    if (!startIso) return alert("Fecha/hora inválida");

    setSaving(true);
    try {
      const payload = {
        patient_id: Number(patientId),
        start_at: startIso,
        reason: reason.trim(),
        notes: notes.trim() || null,
        status: "scheduled",
      };

      const { error } = await supabase.from("appointments").insert(payload);
      if (error) throw error;

      setReason("");
      setNotes("");

      await loadAppointments();

      // Abre WhatsApp con mensaje listo (si hay teléfono)
      if (selectedPatient) {
        const msg = buildCitaText({
          patientName: selectedPatient.name,
          whenLocal: formatLocalDateTime(startIso),
          reason: payload.reason,
        });
        openWhatsApp({ phone: selectedPatient.phone, text: msg });
      }
    } catch (e2) {
      console.error(e2);
      alert(e2?.message || "Error creando cita");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAppointment(id) {
    if (!confirm("¿Eliminar esta cita?")) return;
    try {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
      await loadAppointments();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Error eliminando cita");
    }
  }

  async function markDone(id) {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "done" })
        .eq("id", id);
      if (error) throw error;
      await loadAppointments();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Error marcando como hecha");
    }
  }

  function openEdit(item) {
    setEditing(item);
    setEditStartLocal(toLocalDateTimeInputValue(new Date(item.start_at)));
    setEditReason(item.reason || "");
    setEditNotes(item.notes || "");
    setEditStatus(item.status || "scheduled");
  }

  function closeEdit() {
    setEditing(null);
    setEditStartLocal("");
    setEditReason("");
    setEditNotes("");
    setEditStatus("scheduled");
  }

  async function saveEdit() {
    if (!editing) return;

    const startIso = localDateTimeToIso(editStartLocal);
    if (!startIso) return alert("Fecha/hora inválida");
    if (editReason.trim().length < 3) return alert("Motivo muy corto");

    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          start_at: startIso,
          reason: editReason.trim(),
          notes: editNotes.trim() || null,
          status: editStatus,
        })
        .eq("id", editing.id);

      if (error) throw error;

      closeEdit();
      await loadAppointments();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Error guardando cambios");
    }
  }

  function sendCitaWhatsApp(item) {
    const p = item?.patients || {};
    const msg = buildCitaText({
      patientName: p.name || "Paciente",
      whenLocal: formatLocalDateTime(item.start_at),
      reason: item.reason,
    });
    openWhatsApp({ phone: p.phone, text: msg });
  }

  function sendReminderWhatsApp(item) {
    const p = item?.patients || {};
    const msg = buildReminderText({
      patientName: p.name || "Paciente",
      whenLocal: formatLocalDateTime(item.start_at),
      reason: item.reason,
    });
    openWhatsApp({ phone: p.phone, text: msg });
  }

  function bulkReminder() {
    const onlyScheduled = items.filter((x) => x.status === "scheduled");
    if (onlyScheduled.length === 0) {
      alert("No hay citas programadas para recordar.");
      return;
    }

    const ok = confirm(
      `Se abrirán ${onlyScheduled.length} pestañas de WhatsApp (una por cita programada). ¿Continuar?`
    );
    if (!ok) return;

    onlyScheduled.forEach((it) => sendReminderWhatsApp(it));
  }

  const headerRange = useMemo(() => {
    if (mode === "day") return day;
    const ws = startOfWeekLocal(day);
    const we = endOfWeekLocal(day);
    return `${toLocalDateInputValue(ws)} → ${toLocalDateInputValue(we)}`;
  }, [mode, day]);

  if (loading) return <div className="mm-empty">Cargando agenda...</div>;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 14 }}>
      <div className="mm-titleRow">
        <div>
          <h1 style={{ margin: 0 }}>Agenda</h1>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            Vista: <b>{mode === "day" ? "Día" : "Semana"}</b> — <b>{headerRange}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className={`mm-btn mm-btn--ghost ${mode === "day" ? "mm-btn--active" : ""}`}
              onClick={() => setMode("day")}
            >
              Día
            </button>
            <button
              type="button"
              className={`mm-btn mm-btn--ghost ${mode === "week" ? "mm-btn--active" : ""}`}
              onClick={() => setMode("week")}
            >
              Semana
            </button>
          </div>

          <input
            className="mm-input"
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            style={{ minWidth: 170 }}
          />

          <button className="mm-btn mm-btn--ghost" onClick={reloadAll} type="button">
            Recargar
          </button>

          <button className="mm-btn" onClick={bulkReminder} type="button">
            Recordatorio masivo
          </button>
        </div>
      </div>

      <div className="mm-grid" style={{ marginTop: 14 }}>
        {/* Form */}
        <section className="mm-card">
          <div className="mm-cardHead">
            <div className="mm-cardTitle">Nueva cita</div>
            <div className="mm-chip">{saving ? "Guardando..." : "MicMEDIC"}</div>
          </div>

          <form className="mm-form" onSubmit={createAppointment}>
            <select
              className="mm-input"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              disabled={saving}
            >
              {patients.length === 0 ? (
                <option value="">No hay pacientes</option>
              ) : (
                patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.cedula ? `- ${p.cedula}` : ""}
                  </option>
                ))
              )}
            </select>

            <input
              className="mm-input"
              type="datetime-local"
              value={startAtLocal}
              onChange={(e) => setStartAtLocal(e.target.value)}
              disabled={saving}
              title="Fecha y hora"
            />

            <input
              className="mm-input"
              placeholder="Motivo (ej: chequeo general)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={saving}
            />

            <input
              className="mm-input"
              placeholder="Notas (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
            />

            <button className="mm-btn" disabled={!canCreate}>
              Agendar cita
            </button>

            <div className="mm-hint">
              Al agendar, se abre WhatsApp con el mensaje listo (si el paciente tiene teléfono).
            </div>
          </form>
        </section>

        {/* List */}
        <section className="mm-card">
          <div className="mm-cardHead">
            <div className="mm-cardTitle">Citas</div>
            <div className="mm-chip">{items.length} registros</div>
          </div>

          {items.length === 0 ? (
            <div className="mm-empty">No hay citas en esta vista.</div>
          ) : (
            <div className="mm-list">
              {items.map((it) => {
                const p = it.patients || {};
                const statusText =
                  STATUS.find((s) => s.v === it.status)?.t || it.status;

                return (
                  <div key={it.id} className="mm-item">
                    <div className="mm-itemTop" style={{ alignItems: "center" }}>
                      <div className="mm-itemName">
                        {formatLocalDateTime(it.start_at)} — {p.name || "Paciente"}
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <div className="mm-chip">{statusText}</div>

                        <button
                          className="mm-btn mm-btn--ghost"
                          type="button"
                          onClick={() => sendCitaWhatsApp(it)}
                          title="Abrir WhatsApp con mensaje de cita"
                        >
                          WhatsApp (cita)
                        </button>

                        <button
                          className="mm-btn mm-btn--ghost"
                          type="button"
                          onClick={() => sendReminderWhatsApp(it)}
                          title="Abrir WhatsApp con recordatorio"
                        >
                          Recordatorio
                        </button>

                        <button
                          className="mm-btn mm-btn--ghost"
                          type="button"
                          onClick={() => openEdit(it)}
                        >
                          Editar
                        </button>

                        <button
                          className="mm-btn"
                          type="button"
                          onClick={() => markDone(it.id)}
                          disabled={it.status === "done"}
                          title="Marcar como hecha"
                        >
                          Hecha
                        </button>

                        <button
                          className="mm-btn mm-btn--danger"
                          type="button"
                          onClick={() => deleteAppointment(it.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>

                    <div className="mm-itemMeta">
                      <div><b>Motivo:</b> {it.reason}</div>
                      <div><b>Tel:</b> {p.phone || "-"}</div>
                      <div><b>Notas:</b> {it.notes || "-"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ===== Modal editar ===== */}
      {editing && (
        <div
          onClick={closeEdit}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="mm-card"
            style={{ width: "min(720px, 100%)" }}
          >
            <div className="mm-cardHead">
              <div className="mm-cardTitle">Editar cita</div>
              <div className="mm-chip">MicMEDIC</div>
            </div>

            <div className="mm-form">
              <input
                className="mm-input"
                type="datetime-local"
                value={editStartLocal}
                onChange={(e) => setEditStartLocal(e.target.value)}
              />

              <input
                className="mm-input"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Motivo"
              />

              <input
                className="mm-input"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Notas (opcional)"
              />

              <select
                className="mm-input"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
              >
                {STATUS.map((s) => (
                  <option key={s.v} value={s.v}>
                    {s.t}
                  </option>
                ))}
              </select>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="mm-btn mm-btn--ghost" type="button" onClick={closeEdit}>
                  Cancelar
                </button>
                <button className="mm-btn" type="button" onClick={saveEdit}>
                  Guardar cambios
                </button>
              </div>

              <div className="mm-hint">
                Tip: si cambias estado a “Cancelada”, igual queda en historial.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
