<p style={{ color: "red", fontWeight: "bold" }}>
  DEPLOY TEST MICMEDIC
</p>


import { useNavigate } from "react-router-dom";

function toWaLink(phoneRaw) {
  const digits = (phoneRaw || "").replace(/\D/g, "");

  // Si ya viene con 593...
  if (digits.startsWith("593")) return `https://wa.me/${digits}`;

  // Si viene 09xxxxxxxx → convertir a 5939xxxxxxx
  if (digits.startsWith("0") && digits.length >= 9) {
    return `https://wa.me/593${digits.slice(1)}`;
  }

  // Fallback
  return digits ? `https://wa.me/${digits}` : "#";
}

export default function PatientList({ loading, patients, onRefresh }) {
  const nav = useNavigate();

  if (loading) {
    return (
      <div className="mm-empty">
        Cargando pacientes…
      </div>
    );
  }

  if (!patients?.length) {
    return (
      <div className="mm-empty">
        No hay pacientes con ese filtro.
        <button className="mm-btn mm-btnGhost" onClick={onRefresh} style={{ marginTop: 10 }}>
          Recargar
        </button>
      </div>
    );
  }

  return (
    <div className="mm-list">
      {patients.map((p) => {
        const allergiesArr = Array.isArray(p.allergies)
  ? p.allergies
  : (p.allergies ? String(p.allergies).split(",").map(x => x.trim()).filter(Boolean) : []);

const hasAllergies = allergiesArr.length > 0;


        return (
          <div className="mm-item" key={p.id}>
            <div className="mm-itemInfo">
              <div className="mm-itemName">
                {p.full_name}
                {hasAllergies ? <span className="mm-badgeWarn">Alergias</span> : null}
              </div>
              <div className="mm-itemMeta">
                {p.age ?? "—"} años · CI: {p.cedula || "—"} · Tel: {p.phone || "—"}
              </div>
              <div className="mm-itemMeta2">Última consulta: —</div>
            </div>

            <div className="mm-itemActions">
              <a
                className="mm-btn mm-btnGhost"
                href={toWaLink(p.phone)}
                target="_blank"
                rel="noreferrer"
                title="WhatsApp"
              >
                WhatsApp
              </a>

              <button
                className="mm-btn mm-btnPrimary"
                onClick={() => nav(`/patients/${p.id}`)}
              >
                Abrir
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
