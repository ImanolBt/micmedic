import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const STATUS = [
  { v: "scheduled", t: "Programada", cls: "mm-chip--green" },
  { v: "done", t: "Hecha", cls: "mm-chip" },
  { v: "cancelled", t: "Cancelada", cls: "mm-chip--red" },
];

function pad2(n) { return String(n).padStart(2, "0"); }
function toLocalDateInputValue(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function toLocalDateTimeInputValue(d) {
  return `${toLocalDateInputValue(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function localDateTimeToIso(dtLocal) {
  const d = new Date(dtLocal);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function formatLocalDateTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${toLocalDateInputValue(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function digitsOnly(phone) { return String(phone || "").replace(/\D/g, ""); }
function toE164Ecuador(phoneRaw) {
  const digits = digitsOnly(phoneRaw);
  if (!digits) return "";
  if (digits.startsWith("593")) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return "593" + digits.slice(1);
  if (digits.startsWith("9") && digits.length >= 9) return "593" + digits;
  return digits;
}
function openWhatsApp({ phone, text }) {
  const e164 = toE164Ecuador(phone);
  if (!e164 || e164.length < 11) { alert("Número inválido. Guarda el teléfono como 09xxxxxxxx."); return; }
  window.open(`https://wa.me/${e164}?text=${encodeURIComponent(text || "")}`, "_blank", "noopener,noreferrer");
}
function startOfWeekLocal(dateStr) {
  const d = new Date(`${dateStr}T00:00`);
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}
function endOfWeekLocal(dateStr) {
  const s = startOfWeekLocal(dateStr);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23,59,59,999);
  return e;
}
function buildCitaText({ patientName, whenLocal, reason }) {
  return `MicMEDIC — Cita agendada\n\nPaciente: ${patientName}\nFecha/Hora: ${whenLocal}\nMotivo: ${reason}\n\nPor favor confirmar asistencia.`;
}
function buildReminderText({ patientName, whenLocal, reason }) {
  return `MicMEDIC — Recordatorio\n\nPaciente: ${patientName}\nRecuerda tu cita:\nFecha/Hora: ${whenLocal}\nMotivo: ${reason}\n\nGracias.`;
}
function initials(name) {
  return (name || "?").split(" ").slice(0,2).map((w) => w[0]?.toUpperCase() || "").join("");
}

export default function Agenda() {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("day");
  const [day, setDay] = useState(() => toLocalDateInputValue(new Date()));
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [startAtLocal, setStartAtLocal] = useState(() => toLocalDateTimeInputValue(new Date()));
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editStartLocal, setEditStartLocal] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("scheduled");

  const selectedPatient = useMemo(() => {
    const n = Number(patientId);
    return patients.find((p) => p.id === n) || null;
  }, [patientId, patients]);

  const canCreate = useMemo(() => {
    return !!patientId && reason.trim().length >= 3 && !!localDateTimeToIso(startAtLocal) && !saving;
  }, [patientId, reason, startAtLocal, saving]);

  async function loadPatients() {
    const { data, error } = await supabase.from("patients").select("id, name, phone, cedula").order("name");
    if (error) throw error;
    setPatients(data || []);
    if (!patientId && data && data.length > 0) setPatientId(String(data[0].id));
  }

  async function loadAppointments() {
    let startIso, endIso;
    if (mode === "day") {
      startIso = new Date(`${day}T00:00`).toISOString();
      endIso = new Date(`${day}T23:59:59`).toISOString();
    } else {
      startIso = startOfWeekLocal(day).toISOString();
      endIso = endOfWeekLocal(day).toISOString();
    }
    const { data, error } = await supabase
      .from("appointments")
      .select("id, patient_id, start_at, end_at, reason, notes, status, patients(name, phone, cedula)")
      .gte("start_at", startIso).lte("start_at", endIso)
      .order("start_at", { ascending: true });
    if (error) throw error;
    setItems(data || []);
  }

  async function reloadAll() {
    setLoading(true);
    try { await loadPatients(); await loadAppointments(); }
    catch (e) { alert(e?.message || "Error cargando agenda"); }
    finally { setLoading(false); }
  }

  useEffect(() => { reloadAll(); }, []); // eslint-disable-line
  useEffect(() => {
    (async () => {
      try { setLoading(true); await loadAppointments(); }
      catch (e) { alert(e?.message || "Error"); }
      finally { setLoading(false); }
    })();
  }, [day, mode]); // eslint-disable-line

  async function createAppointment(e) {
    e.preventDefault();
    if (!canCreate) return;
    const startIso = localDateTimeToIso(startAtLocal);
    if (!startIso) return alert("Fecha/hora inválida");
    setSaving(true);
    try {
      const payload = { patient_id: Number(patientId), start_at: startIso, reason: reason.trim(), notes: notes.trim() || null, status: "scheduled" };
      const { error } = await supabase.from("appointments").insert(payload);
      if (error) throw error;
      setReason(""); setNotes("");
      await loadAppointments();
      if (selectedPatient?.phone) {
        openWhatsApp({ phone: selectedPatient.phone, text: buildCitaText({ patientName: selectedPatient.name, whenLocal: formatLocalDateTime(startIso), reason: payload.reason }) });
      } else {
        alert("Cita guardada. Paciente sin teléfono registrado.");
      }
    } catch (e2) { alert(e2?.message || "Error creando cita"); }
    finally { setSaving(false); }
  }

  async function deleteAppointment(id) {
    if (!confirm("¿Eliminar esta cita?")) return;
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    await loadAppointments();
  }

  async function markDone(id) {
    const { error } = await supabase.from("appointments").update({ status: "done" }).eq("id", id);
    if (error) { alert(error.message); return; }
    await loadAppointments();
  }

  function openEdit(item) {
    setEditing(item);
    setEditStartLocal(toLocalDateTimeInputValue(new Date(item.start_at)));
    setEditReason(item.reason || "");
    setEditNotes(item.notes || "");
    setEditStatus(item.status || "scheduled");
  }
  function closeEdit() { setEditing(null); }

  async function saveEdit() {
    if (!editing) return;
    const startIso = localDateTimeToIso(editStartLocal);
    if (!startIso) return alert("Fecha/hora inválida");
    if (editReason.trim().length < 3) return alert("Motivo muy corto");
    const { error } = await supabase.from("appointments")
      .update({ start_at: startIso, reason: editReason.trim(), notes: editNotes.trim() || null, status: editStatus })
      .eq("id", editing.id);
    if (error) { alert(error.message); return; }
    closeEdit();
    await loadAppointments();
  }

  const scheduled = items.filter((x) => x.status === "scheduled");
  const done = items.filter((x) => x.status === "done");
  const cancelled = items.filter((x) => x.status === "cancelled");

  return (
    <div style={{ display: "grid", gap: 20 }}>

      {/* ─── Header ─── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--mm-text)" }}>📅 Agenda</h1>
          <p style={{ margin: "4px 0 0", color: "var(--mm-muted)", fontSize: 13 }}>
            {mode === "day" ? `Día: ${day}` : `Semana: ${toLocalDateInputValue(startOfWeekLocal(day))} → ${toLocalDateInputValue(endOfWeekLocal(day))}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", border: "1px solid var(--mm-border)", borderRadius: 8, overflow: "hidden" }}>
            {["day","week"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                style={{
                  padding: "6px 16px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13,
                  background: mode === m ? "var(--mm-green)" : "var(--mm-bg)",
                  color: mode === m ? "#fff" : "var(--mm-text)",
                  transition: "all .15s",
                }}
              >
                {m === "day" ? "Día" : "Semana"}
              </button>
            ))}
          </div>
          <input
            className="mm-input"
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            style={{ minWidth: 160 }}
          />
          <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={reloadAll}>↻ Recargar</button>
          {scheduled.length > 0 && (
            <button
              className="mm-btn mm-btn--primary mm-btn--sm"
              onClick={() => {
                if (!confirm(`Se abrirán ${scheduled.length} chats de WhatsApp. ¿Continuar?`)) return;
                scheduled.forEach((it) => {
                  const p = it.patients || {};
                  if (p.phone) openWhatsApp({ phone: p.phone, text: buildReminderText({ patientName: p.name, whenLocal: formatLocalDateTime(it.start_at), reason: it.reason }) });
                });
              }}
            >
              📢 Recordatorio masivo ({scheduled.length})
            </button>
          )}
        </div>
      </div>

      {/* ─── KPIs ─── */}
      <div className="mm-kpi-grid">
        {[
          { label: "Total", val: items.length, icon: "📋" },
          { label: "Programadas", val: scheduled.length, icon: "🕐" },
          { label: "Completadas", val: done.length, icon: "✅" },
          { label: "Canceladas", val: cancelled.length, icon: "❌" },
        ].map((k) => (
          <div key={k.label} className="mm-kpi">
            <div className="mm-kpi-bar" />
            <div className="mm-kpi-icon">{k.icon}</div>
            <div className="mm-kpi-val">{k.val}</div>
            <div className="mm-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* ─── Grid: Form + Lista ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px,340px) 1fr", gap: 20, alignItems: "start" }}>

        {/* Nueva cita */}
        <div className="mm-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "linear-gradient(90deg,var(--mm-green),var(--mm-green2))" }} />
          <div style={{ padding: "16px 20px" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Nueva cita</h3>
            <form onSubmit={createAppointment} style={{ display: "grid", gap: 10 }}>
              <div>
                <label className="mm-label">Paciente</label>
                <select className="mm-input" value={patientId} onChange={(e) => setPatientId(e.target.value)} disabled={saving}>
                  {patients.length === 0 ? (
                    <option value="">No hay pacientes</option>
                  ) : patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} {p.cedula ? `· ${p.cedula}` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mm-label">Fecha y hora</label>
                <input className="mm-input" type="datetime-local" value={startAtLocal} onChange={(e) => setStartAtLocal(e.target.value)} disabled={saving} />
              </div>
              <div>
                <label className="mm-label">Motivo *</label>
                <input className="mm-input" placeholder="Ej: Chequeo general, control..." value={reason} onChange={(e) => setReason(e.target.value)} disabled={saving} />
              </div>
              <div>
                <label className="mm-label">Notas</label>
                <input className="mm-input" placeholder="Notas adicionales (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} />
              </div>
              <button className="mm-btn mm-btn--primary" disabled={!canCreate} style={{ marginTop: 4 }}>
                {saving ? "Guardando..." : "Agendar cita"}
              </button>
              <p className="mm-hint">Al agendar se abre WhatsApp si el paciente tiene teléfono.</p>
            </form>
          </div>
        </div>

        {/* Lista */}
        <div className="mm-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 4, background: "linear-gradient(90deg,var(--mm-green),var(--mm-green2))" }} />
          <div style={{ padding: "16px 20px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Citas</h3>
              <span className="mm-chip">{loading ? "Cargando..." : `${items.length} cita${items.length !== 1 ? "s" : ""}`}</span>
            </div>
          </div>

          {loading ? (
            <div className="mm-empty" style={{ padding: 40 }}>Cargando...</div>
          ) : items.length === 0 ? (
            <div className="mm-empty" style={{ padding: 40 }}>No hay citas en esta vista.</div>
          ) : (
            <table className="mm-table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Fecha / Hora</th>
                  <th>Motivo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const p = it.patients || {};
                  const statusInfo = STATUS.find((s) => s.v === it.status) || STATUS[0];
                  return (
                    <tr key={it.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div className="mm-avatar" style={{ width: 30, height: 30, fontSize: 11, flexShrink: 0 }}>
                            {initials(p.name)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500, fontSize: 13 }}>{p.name || "-"}</div>
                            {p.phone && <div style={{ fontSize: 11, color: "var(--mm-muted)" }}>{p.phone}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ whiteSpace: "nowrap", fontSize: 13, color: "var(--mm-muted)" }}>
                        {formatLocalDateTime(it.start_at)}
                      </td>
                      <td style={{ fontSize: 13 }}>{it.reason}</td>
                      <td>
                        <span className={`mm-chip ${statusInfo.cls}`} style={{ fontSize: 11 }}>
                          {statusInfo.t}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {p.phone && (
                            <>
                              <button className="mm-btn mm-btn--ghost mm-btn--sm" title="WhatsApp cita"
                                onClick={() => openWhatsApp({ phone: p.phone, text: buildCitaText({ patientName: p.name, whenLocal: formatLocalDateTime(it.start_at), reason: it.reason }) })}>
                                💬
                              </button>
                              <button className="mm-btn mm-btn--ghost mm-btn--sm" title="Recordatorio"
                                onClick={() => openWhatsApp({ phone: p.phone, text: buildReminderText({ patientName: p.name, whenLocal: formatLocalDateTime(it.start_at), reason: it.reason }) })}>
                                🔔
                              </button>
                            </>
                          )}
                          <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={() => openEdit(it)}>Editar</button>
                          {it.status !== "done" && (
                            <button className="mm-btn mm-btn--primary mm-btn--sm" onClick={() => markDone(it.id)}>✓</button>
                          )}
                          <button className="mm-btn mm-btn--danger mm-btn--sm" onClick={() => deleteAppointment(it.id)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ─── Modal editar ─── */}
      {editing && (
        <div onClick={closeEdit} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "grid", placeItems: "center", padding: 16, zIndex: 9999, backdropFilter: "blur(2px)" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--mm-surface)", borderRadius: 16, width: "min(520px, 100%)", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.25)", border: "1px solid var(--mm-border)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--mm-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Editar cita</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={closeEdit}>Cancelar</button>
                <button className="mm-btn mm-btn--primary mm-btn--sm" onClick={saveEdit}>Guardar</button>
              </div>
            </div>
            <div style={{ padding: 20, display: "grid", gap: 12 }}>
              <div>
                <label className="mm-label">Fecha y hora</label>
                <input className="mm-input" type="datetime-local" value={editStartLocal} onChange={(e) => setEditStartLocal(e.target.value)} />
              </div>
              <div>
                <label className="mm-label">Motivo</label>
                <input className="mm-input" value={editReason} onChange={(e) => setEditReason(e.target.value)} />
              </div>
              <div>
                <label className="mm-label">Notas</label>
                <input className="mm-input" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Opcional" />
              </div>
              <div>
                <label className="mm-label">Estado</label>
                <select className="mm-input" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                  {STATUS.map((s) => <option key={s.v} value={s.v}>{s.t}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
