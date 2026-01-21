import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

function clean(s) {
  return (s || "").toString().trim();
}

export default function Billing() {
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState([]);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return patients;
    return patients.filter((p) => {
      const name = (p.name || "").toLowerCase();
      const ced = (p.cedula || "").toLowerCase();
      return name.includes(t) || ced.includes(t);
    });
  }, [patients, q]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const res = await supabase
        .from("patients")
        .select("id, name, cedula, phone, email, address")
        .order("id", { ascending: false })
        .limit(300);

      if (!mounted) return;

      if (res.error) {
        console.error(res.error);
        alert(res.error.message || "No se pudo cargar pacientes");
        setPatients([]);
      } else {
        setPatients(res.data || []);
      }
      setLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  function openSRI() {
    // Nota: no pongo URL específica porque puede variar. Abre el portal principal.
    window.open("https://facturadorsri.sri.gob.ec/portal-facturadorsri-internet/pages/inicio.html", "_blank", "noopener,noreferrer");
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copiado.");
    } catch {
      alert("No se pudo copiar. Copia manualmente.");
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 14, display: "grid", gap: 14 }}>
      <div className="mm-card">
        <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="mm-cardTitle">Facturación (SRI)</div>
            <div style={{ opacity: 0.85, fontSize: 13 }}>
              Opción simple: abre el SRI y copia los datos del paciente desde aquí.
            </div>
          </div>
          <button className="mm-btn" type="button" onClick={openSRI}>
            Ir al SRI
          </button>
        </div>

        <div style={{ padding: 14, display: "grid", gap: 10 }}>
          <input
            className="mm-input"
            placeholder="Buscar por nombre o cédula..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          {loading && <div className="mm-empty">Cargando pacientes...</div>}

          {!loading && filtered.length === 0 && (
            <div className="mm-empty">No hay coincidencias.</div>
          )}

          {!loading && filtered.slice(0, 50).map((p) => {
            const block = [
              `Nombre: ${clean(p.name)}`,
              `Identificación: ${clean(p.cedula)}`,
              `Teléfono: ${clean(p.phone) || "-"}`,
              `Correo: ${clean(p.email) || "-"}`,
              `Dirección: ${clean(p.address) || "-"}`,
            ].join("\n");

            return (
              <div key={p.id} className="mm-item" style={{ cursor: "default" }}>
                <div className="mm-itemTop" style={{ alignItems: "flex-start" }}>
                  <div style={{ display: "grid", gap: 2 }}>
                    <div className="mm-itemName">{p.name}</div>
                    <div style={{ fontSize: 13, opacity: 0.85 }}>
                      CI/RUC: <b>{p.cedula}</b>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="mm-btn mm-btn--ghost" type="button" onClick={() => copy(p.cedula || "")}>
                      Copiar CI
                    </button>
                    <button className="mm-btn mm-btn--ghost" type="button" onClick={() => copy(p.name || "")}>
                      Copiar nombre
                    </button>
                    <button className="mm-btn mm-btn--ghost" type="button" onClick={() => copy(block)}>
                      Copiar todo
                    </button>
                  </div>
                </div>

                <div className="mm-itemMeta">
                  <div><b>Correo:</b> {p.email || "-"}</div>
                  <div><b>Dirección:</b> {p.address || "-"}</div>
                  <div><b>Tel:</b> {p.phone || "-"}</div>
                </div>
              </div>
            );
          })}

          {!loading && filtered.length > 50 && (
            <div className="mm-hint">
              Mostrando 50 resultados (filtra más para encontrar rápido).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
