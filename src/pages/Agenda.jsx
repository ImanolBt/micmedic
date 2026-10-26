import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import AppointmentForm from "../components/AppointmentForm";

const STATUS_CHIP = {
  scheduled: { label: "Programada", cls: "mm-chip--blue" },
  completed:  { label: "Completada", cls: "mm-chip--green" },
  cancelled:  { label: "Cancelada",  cls: "mm-chip--red" },
  no_show:    { label: "No asistió", cls: "mm-chip--warn" },
};

export default function Agenda() {
  const [appts,     setAppts]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("upcoming");
  const [showForm,  setShowForm]  = useState(false);

  const load = async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    let q = supabase
      .from("appointments")
      .select("*, patients(first_name, last_name)")
      .order("date")
      .order("time");

    if (filter === "upcoming") q = q.gte("date", today).eq("status", "scheduled");
    else if (filter === "today") q = q.eq("date", today);
    else if (filter === "past") q = q.lt("date", today);

    const { data } = await q.limit(100);
    setAppts(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (id, status) => {
    await supabase.from("appointments").update({ status }).eq("id", id);
    load();
  };

  const fmt = (d, t) => {
    if (!d) return "—";
    const dateStr = new Date(d + "T12:00:00").toLocaleDateString("es-MX", { weekday: "short", day: "2-digit", month: "short" });
    return t ? `${dateStr} · ${t.slice(0, 5)}` : dateStr;
  };

  const todayCount = appts.filter(a => a.date === new Date().toISOString().slice(0, 10)).length;

  return (
    <div className="mm-page">
      <div className="mm-page-header">
        <div>
          <h1 className="mm-page-title">Agenda</h1>
          <p className="mm-page-sub">Gestión de citas médicas</p>
        </div>
        <button onClick={() => setShowForm(true)} className="mm-btn">
          ＋ Nueva cita
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {[
          { id: "upcoming", label: "Próximas" },
          { id: "today",    label: `Hoy${todayCount > 0 ? ` (${todayCount})` : ""}` },
          { id: "past",     label: "Pasadas" },
          { id: "all",      label: "Todas" },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`mm-btn mm-btn--sm ${filter === f.id ? "" : "mm-btn--ghost"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mm-card" style={{ padding: 0 }}>
        <div className="mm-card-accent-bar" />
        <div className="mm-table-wrap">
          <table className="mm-table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Fecha / Hora</th>
                <th>Duración</th>
                <th>Motivo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--c-muted)", padding: "40px 0" }}>Cargando…</td></tr>
              ) : appts.length === 0 ? (
                <tr><td colSpan={6}><div className="mm-empty">
                  {filter === "upcoming" ? "No hay citas próximas" :
                   filter === "today"    ? "No hay citas hoy" :
                   "Sin citas en este período"}
                </div></td></tr>
              ) : appts.map(a => {
                const chip = STATUS_CHIP[a.status] ?? { label: a.status, cls: "" };
                const isToday = a.date === new Date().toISOString().slice(0, 10);
                return (
                  <tr key={a.id} style={{ background: isToday ? "rgba(111,168,50,.04)" : undefined }}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div className="mm-avatar" style={{ width: 28, height: 28, fontSize: 10 }}>
                          {(a.patients?.first_name?.[0] ?? "") + (a.patients?.last_name?.[0] ?? "")}
                        </div>
                        <span style={{ fontWeight: 600 }}>{a.patients?.first_name} {a.patients?.last_name}</span>
                      </div>
                    </td>
                    <td style={{ whiteSpace: "nowrap", fontWeight: isToday ? 700 : 500 }}>
                      {isToday && <span className="mm-chip mm-chip--green" style={{ fontSize: 10, marginRight: 6 }}>HOY</span>}
                      {fmt(a.date, a.time)}
                    </td>
                    <td style={{ color: "var(--c-muted)" }}>{a.duration ? `${a.duration} min` : "—"}</td>
                    <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--c-text-2)" }}>
                      {a.reason || "—"}
                    </td>
                    <td><span className={`mm-chip ${chip.cls}`}>{chip.label}</span></td>
                    <td>
                      {a.status === "scheduled" && (
                        <div style={{ display: "flex", gap: 5 }}>
                          <button onClick={() => updateStatus(a.id, "completed")} className="mm-btn mm-btn--sm" style={{ padding: "4px 10px", fontSize: 11 }}>✓ Completar</button>
                          <button onClick={() => updateStatus(a.id, "cancelled")} className="mm-btn mm-btn--danger mm-btn--sm" style={{ padding: "4px 9px", fontSize: 11 }}>✕</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <AppointmentForm
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}
