import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import PatientForm from "../components/PatientForm";
import PatientList from "../components/PatientList";

export default function Patients() {
  const [patients, setPatients]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [q, setQ]                 = useState("");

  async function loadPatients() {
    setLoading(true);
    const { data, error } = await supabase
      .from("patients")
      .select("id, name, cedula, phone, sex, birthdate, notes, allergies, created_at")
      .order("created_at", { ascending: false });
    if (error) { alert(error.message); }
    setPatients(data || []);
    setLoading(false);
  }

  useEffect(() => { loadPatients(); }, []);

  const filtered = useMemo(() => {
    const s = (q || "").trim().toLowerCase();
    if (!s) return patients;
    return patients.filter(p =>
      (p.name||"").toLowerCase().includes(s) ||
      (p.cedula||"").toLowerCase().includes(s) ||
      (p.phone||"").toLowerCase().includes(s)
    );
  }, [q, patients]);

  async function addPatient(payload) {
    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const { error } = await supabase.from("patients").insert({ ...payload, created_by: authData?.user?.id });
    setSaving(false);
    if (error) { alert(error.message); return; }
    setShowForm(false);
    await loadPatients();
  }

  return (
    <div style={{ display:"grid", gap: 22 }}>
      {/* Header */}
      <div className="mm-header">
        <div>
          <h1 className="mm-title">Pacientes</h1>
          <div className="mm-subtitle">{patients.length} pacientes registrados</div>
        </div>
        <div style={{ display:"flex", gap: 10 }}>
          <button
            className={`mm-btn ${showForm ? "mm-btn--ghost" : "mm-btn--primary"}`}
            onClick={() => setShowForm(v => !v)}
          >
            {showForm ? "✕ Cancelar" : "+ Nuevo paciente"}
          </button>
        </div>
      </div>

      {/* Formulario (colapsable) */}
      {showForm && (
        <div className="mm-card">
          <div className="mm-cardHead">
            <div className="mm-cardTitle">Registrar nuevo paciente</div>
            <span className="mm-chip mm-chip--green">{saving ? "Guardando..." : "Nuevo"}</span>
          </div>
          <PatientForm onCreate={addPatient} disabled={saving} />
        </div>
      )}

      {/* List card */}
      <div className="mm-card">
        <div className="mm-cardHead">
          <div>
            <div className="mm-cardTitle">Lista de pacientes</div>
            <div style={{ fontSize:12, color:"var(--mm-muted)", marginTop:2 }}>
              {loading ? "Cargando..." : `${filtered.length} de ${patients.length} visibles`}
            </div>
          </div>
          {/* Search */}
          <div className="mm-search-wrap">
            <span className="mm-search-icon">🔍</span>
            <input
              className="mm-input"
              placeholder="Buscar nombre, cédula, teléfono..."
              value={q}
              onChange={e => setQ(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
        </div>

        <div className="mm-listArea">
          <PatientList loading={loading} patients={filtered} onRefresh={loadPatients} />
        </div>
      </div>
    </div>
  );
}
