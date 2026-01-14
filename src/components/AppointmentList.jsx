function fmtTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function AppointmentList({ loading, items, onDelete }) {
  if (loading) return <div className="mm-empty">Cargando citas...</div>;

  if (!items || items.length === 0) {
    return <div className="mm-empty">No hay citas para ese día.</div>;
  }

  return (
    <div className="mm-list">
      {items.map((a) => {
        const patientName = a.patients?.name || "Paciente";
        const patientPhone = a.patients?.phone || null;

        return (
          <div key={a.id} className="mm-item">
            <div className="mm-itemTop">
              <div className="mm-itemName">
                {fmtTime(a.start_at)} – {fmtTime(a.end_at)} · {patientName}
              </div>
              <div className="mm-chip">{a.status}</div>
            </div>

            <div className="mm-itemMeta">
              <div>
                <b>Motivo:</b> {a.reason}
              </div>
              <div>
                <b>Tel:</b> {patientPhone || "-"}
              </div>
              <div>
                <b>Notas:</b> {a.notes || "-"}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="mm-btn mm-btn--ghost" onClick={() => onDelete(a.id)} type="button">
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
