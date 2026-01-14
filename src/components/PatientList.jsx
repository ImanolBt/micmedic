import { useNavigate } from "react-router-dom";

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

function formatAllergies(a) {
  if (Array.isArray(a)) return a.filter(Boolean).join(", ");
  if (typeof a === "string") return a.trim();
  return "";
}

export default function PatientList({ loading, patients, onRefresh }) {
  const nav = useNavigate();

  if (loading) {
    return <div className="mm-empty">Cargando pacientes...</div>;
  }

  if (!patients || patients.length === 0) {
    return (
      <div
        className="mm-empty"
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <span>No hay pacientes con ese filtro.</span>
        <button className="mm-btn mm-btn--ghost" onClick={() => onRefresh?.()} type="button">
          Recargar
        </button>
      </div>
    );
  }

  return (
    <div className="mm-list">
      {patients.map((p) => {
        const age = calcAgeFromBirthdate(p.birthdate);
        const allergies = formatAllergies(p.allergies);

        return (
          <div
            key={p.id}
            className="mm-item"
            role="button"
            tabIndex={0}
            onClick={() => nav(`/patients/${p.id}`)}
            onKeyDown={(e) => e.key === "Enter" && nav(`/patients/${p.id}`)}
            style={{ cursor: "pointer" }}
            title="Abrir ficha del paciente"
          >
            <div className="mm-itemTop">
              <div className="mm-itemName">{p.name}</div>
              <div className="mm-chip">{p.sex === "M" ? "Masculino" : "Femenino"}</div>
            </div>

            <div className="mm-itemMeta">
              <div>
                <b>Cédula:</b> {p.cedula}
              </div>
              <div>
                <b>Tel:</b> {p.phone || "-"}
              </div>
              <div>
                <b>Edad:</b> {age !== null ? `${age} años` : "-"}
              </div>
              <div>
                <b>Nacimiento:</b> {p.birthdate || "-"}
              </div>
              <div>
                <b>Alergias:</b> {allergies || "-"}
              </div>
              <div>
                <b>Notas:</b> {p.notes || "-"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
