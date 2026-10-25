import { useNavigate } from "react-router-dom";

function ageLabelFromBirthdate(birthdate) {
  if (!birthdate) return "-";
  const b = new Date(birthdate);
  if (isNaN(b.getTime())) return "-";
  const today = new Date();
  let years = today.getFullYear() - b.getFullYear();
  let months = today.getMonth() - b.getMonth();
  let days = today.getDate() - b.getDate();
  if (days < 0) months--;
  if (months < 0) { years--; months += 12; }
  if (years <= 0) return `${Math.max(months,0)} mes(es)`;
  return `${years} año(s)`;
}

function formatAllergies(a) {
  if (Array.isArray(a)) return a.filter(Boolean).join(", ");
  if (typeof a === "string") return a.trim();
  return "";
}

function initials(name = "") {
  return name.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase() || "?";
}

export default function PatientList({ loading, patients, onRefresh }) {
  const nav = useNavigate();

  if (loading) return <div className="mm-empty">Cargando pacientes...</div>;

  if (!patients || patients.length === 0) {
    return (
      <div className="mm-empty" style={{ display:"flex", gap:12, alignItems:"center", justifyContent:"center", flexWrap:"wrap" }}>
        <span>No hay pacientes con ese filtro.</span>
        <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={() => onRefresh?.()} type="button">
          ↺ Recargar
        </button>
      </div>
    );
  }

  return (
    <table className="mm-table">
      <thead>
        <tr>
          <th>Paciente</th>
          <th>Cédula</th>
          <th>Edad</th>
          <th>Teléfono</th>
          <th>Sexo</th>
          <th>Alergias</th>
        </tr>
      </thead>
      <tbody>
        {patients.map(p => {
          const allergies = formatAllergies(p.allergies);
          return (
            <tr
              key={p.id}
              className="mm-table-click"
              onClick={() => nav(`/patients/${p.id}`)}
              title="Abrir ficha del paciente"
            >
              <td>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div className="mm-avatar" style={{ width:34, height:34, fontSize:13 }}>
                    {initials(p.name)}
                  </div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14 }}>{p.name}</div>
                    {p.notes && <div style={{ fontSize:11, color:"var(--mm-muted)" }}>{p.notes.substring(0,40)}{p.notes.length>40?"…":""}</div>}
                  </div>
                </div>
              </td>
              <td style={{ fontFamily:"monospace", fontSize:13 }}>{p.cedula || "—"}</td>
              <td style={{ fontSize:13 }}>{ageLabelFromBirthdate(p.birthdate)}</td>
              <td style={{ fontSize:13, color:"var(--mm-muted)" }}>{p.phone || "—"}</td>
              <td>
                <span className={`mm-chip ${p.sex==="M" ? "mm-chip--green" : ""}`}>
                  {p.sex === "M" ? "Masc." : p.sex === "F" ? "Fem." : "—"}
                </span>
              </td>
              <td>
                {allergies
                  ? <span className="mm-chip mm-chip--warn">⚠ {allergies.substring(0,24)}{allergies.length>24?"…":""}</span>
                  : <span style={{ fontSize:12, color:"var(--mm-muted)" }}>—</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
