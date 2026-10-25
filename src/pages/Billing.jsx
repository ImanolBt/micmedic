import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

function clean(s) { return (s || "").toString().trim(); }

function initials(name) {
  return (name || "?").split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("");
}

export default function Billing() {
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState([]);
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return patients;
    return patients.filter((p) => {
      return (p.name || "").toLowerCase().includes(t) || (p.cedula || "").toLowerCase().includes(t);
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
      setPatients(res.error ? [] : (res.data || []));
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, []);

  function openSRI() {
    window.open("https://facturadorsri.sri.gob.ec/portal-facturadorsri-internet/pages/inicio.html", "_blank", "noopener,noreferrer");
  }

  async function copy(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      alert("No se pudo copiar.");
    }
  }

  const list = filtered.slice(0, 50);

  return (
    <div style={{ display: "grid", gap: 20 }}>

      {/* ─── Header ─── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--mm-text)" }}>🧾 Facturación</h1>
          <p style={{ margin: "4px 0 0", color: "var(--mm-muted)", fontSize: 13 }}>
            Copia los datos del paciente y emite la factura en el portal del SRI.
          </p>
        </div>
        <button className="mm-btn mm-btn--primary" onClick={openSRI}>
          Ir al SRI →
        </button>
      </div>

      {/* ─── Toast de copiado ─── */}
      {copied && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: "var(--mm-green)", color: "#fff",
          padding: "10px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14,
          boxShadow: "0 4px 20px rgba(0,0,0,.2)",
        }}>
          ✓ Copiado: {copied}
        </div>
      )}

      {/* ─── Búsqueda ─── */}
      <div className="mm-search-wrap">
        <span>🔍</span>
        <input
          className="mm-search"
          placeholder="Buscar por nombre o cédula..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mm-muted)", fontSize: 16 }} onClick={() => setQ("")}>✕</button>}
      </div>

      {/* ─── Tabla ─── */}
      <div className="mm-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ height: 4, background: "linear-gradient(90deg,var(--mm-green),var(--mm-green2))" }} />

        {loading ? (
          <div className="mm-empty" style={{ padding: 48 }}>Cargando pacientes...</div>
        ) : list.length === 0 ? (
          <div className="mm-empty" style={{ padding: 48 }}>No hay resultados para "{q}".</div>
        ) : (
          <table className="mm-table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>CI / RUC</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th>Dirección</th>
                <th>Copiar</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const block = [
                  `Nombre: ${clean(p.name)}`,
                  `Identificación: ${clean(p.cedula)}`,
                  `Teléfono: ${clean(p.phone) || "-"}`,
                  `Correo: ${clean(p.email) || "-"}`,
                  `Dirección: ${clean(p.address) || "-"}`,
                ].join("\n");

                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="mm-avatar" style={{ width: 32, height: 32, fontSize: 12, flexShrink: 0 }}>
                          {initials(p.name)}
                        </div>
                        <span style={{ fontWeight: 500 }}>{p.name}</span>
                      </div>
                    </td>
                    <td>
                      <code style={{ fontFamily: "var(--mm-mono)", fontSize: 13, background: "var(--mm-bg)", padding: "2px 6px", borderRadius: 4 }}>
                        {p.cedula || "-"}
                      </code>
                    </td>
                    <td style={{ color: "var(--mm-muted)", fontSize: 13 }}>{p.phone || "-"}</td>
                    <td style={{ color: "var(--mm-muted)", fontSize: 13 }}>{p.email || "-"}</td>
                    <td style={{ color: "var(--mm-muted)", fontSize: 13, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.address || "-"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={() => copy(p.cedula || "", "CI/RUC")}>
                          CI
                        </button>
                        <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={() => copy(p.name || "", "Nombre")}>
                          Nombre
                        </button>
                        <button className="mm-btn mm-btn--primary mm-btn--sm" onClick={() => copy(block, "Datos completos")}>
                          Todo
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!loading && filtered.length > 50 && (
          <div style={{ padding: "10px 20px", borderTop: "1px solid var(--mm-border)" }}>
            <p className="mm-hint" style={{ margin: 0 }}>
              Mostrando 50 de {filtered.length} resultados. Refina la búsqueda para ver más.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
