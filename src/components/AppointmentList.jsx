function fmtTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABELS = {
  scheduled: { label: "Programada", cls: "mm-chip" },
  completed:  { label: "Completada", cls: "mm-chip mm-chip--green" },
  cancelled:  { label: "Cancelada",  cls: "mm-chip mm-chip--red" },
};

export default function AppointmentList({ loading, items, onDelete }) {
  if (loading) {
    return (
      <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--mm-muted)", fontSize: 14 }}>
        Cargando citas...
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--mm-muted)", fontSize: 14 }}>
        No hay citas para ese día.
      </div>
    );
  }

  return (
    <table className="mm-table">
      <thead>
        <tr>
          <th>Hora</th>
          <th>Paciente</th>
          <th>Motivo</th>
          <th>Teléfono</th>
          <th>Estado</th>
          <th style={{ textAlign: "right" }}></th>
        </tr>
      </thead>
      <tbody>
        {items.map((a) => {
          const patientName = a.patients?.name || "Paciente";
          const patientPhone = a.patients?.phone || null;
          const status = STATUS_LABELS[a.status] || { label: a.status, cls: "mm-chip" };

          return (
            <tr key={a.id}>
              <td style={{ whiteSpace: "nowrap", fontWeight: 600, fontSize: 13 }}>
                {fmtTime(a.start_at)} – {fmtTime(a.end_at)}
              </td>
              <td style={{ fontWeight: 500 }}>{patientName}</td>
              <td style={{ color: "var(--mm-muted)", fontSize: 13 }}>{a.reason}</td>
              <td style={{ color: "var(--mm-muted)", fontSize: 13 }}>{patientPhone || "—"}</td>
              <td><span className={status.cls}>{status.label}</span></td>
              <td style={{ textAlign: "right" }}>
                <button className="mm-btn mm-btn--ghost mm-btn--sm"
                  onClick={() => onDelete(a.id)} type="button">
                  Eliminar
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
