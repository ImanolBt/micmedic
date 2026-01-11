import { useEffect, useMemo, useState } from "react";
import PatientForm from "../components/PatientForm";
import PatientList from "../components/PatientList";
import { supabase } from "../lib/supabase";

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  async function loadPatients() {
    setLoading(true);
    setToast("");
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false });

    setLoading(false);
    if (error) {
      setToast("No se pudo cargar pacientes.");
      return;
    }
    setPatients(data || []);
  }

  useEffect(() => {
    loadPatients();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => {
      const name = (p.full_name || "").toLowerCase();
      const ci = (p.cedula || "").toLowerCase();
      const tel = (p.phone || "").toLowerCase();
      return name.includes(q) || ci.includes(q) || tel.includes(q);
    });
  }, [patients, query]);

  async function addPatient(payload) {
    setSaving(true);
    setToast("");

    // insert
    const { data, error } = await supabase
      .from("patients")
      .insert([payload])
      .select()
      .single();

    setSaving(false);

    if (error) {
      // Probable: cédula duplicada (si tienes unique)
      setToast(error.message || "Error al registrar paciente.");
      return;
    }

    setPatients((prev) => [data, ...prev]);
    setToast("Paciente registrado.");
    setTimeout(() => setToast(""), 1500);
  }

  return (
    <div className="mm-page">
      <div className="mm-header">
        <div>
          <h1 className="mm-title">Pacientes</h1>
          <div className="mm-subtitle">
            Pacientes registrados: <b>{patients.length}</b>
          </div>
        </div>

        <div className="mm-searchWrap">
          <input
            className="mm-input mm-search"
            placeholder="Buscar por nombre / cédula / teléfono…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {toast ? <div className="mm-toast">{toast}</div> : null}

      <div className="mm-grid">
        <section className="mm-card">
          <div className="mm-cardHead">
            <div className="mm-cardTitle">Nuevo paciente</div>
            <div className="mm-chip">{saving ? "Guardando…" : "MicMEDIC"}</div>
          </div>
          <PatientForm onCreate={addPatient} disabled={saving} />
        </section>

        <section className="mm-card">
          <div className="mm-cardHead">
            <div className="mm-cardTitle">Lista</div>
            <div className="mm-chip">
              {loading ? "Cargando…" : `${filtered.length} visibles`}
            </div>
          </div>

          <div className="mm-listArea">
            <PatientList
              loading={loading}
              patients={filtered}
              onRefresh={loadPatients}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
