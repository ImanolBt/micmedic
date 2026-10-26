import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import PatientForm from "./PatientForm";

export default function PatientList() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    let q = supabase.from("patients").select("*").order("last_name");
    if (search.trim()) {
      const s = search.trim();
      q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,email.ilike.%${s}%`);
    }
    const { data } = await q;
    setPatients(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [search]);

  const calcAge = (dob) => {
    if (!dob) return "—";
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / 31557600000) + " años";
  };

  return (
    <div className="mm-page">
      <div className="mm-page-header">
        <div>
          <h1 className="mm-page-title">Pacientes</h1>
          <p className="mm-page-sub">{patients.length} registros</p>
        </div>
        <div className="mm-page-actions">
          <div className="mm-search-wrap" style={{ width: 260 }}>
            <input
              className="mm-search"
              placeholder="Buscar paciente…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="mm-btn" onClick={() => setShowForm(true)}>
            ＋ Nuevo paciente
          </button>
        </div>
      </div>

      <div className="mm-card" style={{ padding: 0 }}>
        <div className="mm-card-accent-bar" />
        <div className="mm-table-wrap">
          <table className="mm-table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Edad</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th>Tipo de sangre</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--c-muted)", padding: "40px 0" }}>Cargando…</td></tr>
              ) : patients.length === 0 ? (
                <tr><td colSpan={5}><div className="mm-empty">
                  {search ? `Sin resultados para "${search}"` : "No hay pacientes registrados"}
                </div></td></tr>
              ) : patients.map(p => (
                <tr
                  key={p.id}
                  className="mm-table-click"
                  onClick={() => navigate(`/patients/${p.id}`)}
                >
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="mm-avatar" style={{ width: 32, height: 32, fontSize: 11 }}>
                        {(p.first_name?.[0] ?? "") + (p.last_name?.[0] ?? "")}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</div>
                        {p.curp && <div style={{ fontSize: 11, color: "var(--c-muted)" }}>{p.curp}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ color: "var(--c-text-2)" }}>{calcAge(p.date_of_birth)}</td>
                  <td style={{ color: "var(--c-text-2)" }}>{p.phone || "—"}</td>
                  <td style={{ color: "var(--c-muted)", fontSize: 13 }}>{p.email || "—"}</td>
                  <td>
                    {p.blood_type
                      ? <span className="mm-chip mm-chip--green">{p.blood_type}</span>
                      : <span style={{ color: "var(--c-muted)", fontSize: 13 }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <PatientForm
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}
