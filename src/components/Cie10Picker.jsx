import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { normalizeEs } from "../utils/normalize";

export default function Cie10Picker({ value, onPick, onClear }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const inputRef = useRef(null);

  const qNorm = useMemo(() => normalizeEs(q), [q]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const query = qNorm;
      if (!query) {
        setRows([]);
        return;
      }

      setLoading(true);

      // Si escribe algo tipo "J10" o "A00" => buscar por code
      const looksLikeCode = /^[a-z]\d{2}(\.\d+)?$/i.test(q.trim()) || /^[a-z]\d{2}$/i.test(q.trim());

      let res;
      if (looksLikeCode) {
        res = await supabase
          .from("cie10")
          .select("code,name")
          .ilike("code", `${q.trim().toUpperCase()}%`)
          .limit(30);
      } else {
        // Buscar por nombre normalizado (rápido si ya pusiste pg_trgm index)
        res = await supabase
          .from("cie10")
          .select("code,name")
          .ilike("name_norm", `%${query}%`)
          .limit(30);
      }

      if (res.error) {
        console.error(res.error);
        setRows([]);
      } else {
        setRows(res.data || []);
      }
      setLoading(false);
    }, 250); // debounce

    return () => clearTimeout(t);
  }, [open, qNorm]); // eslint-disable-line

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  function pickRow(r) {
    onPick?.({ code: r.code, name: r.name });
    setOpen(false);
    setQ("");
    setRows([]);
  }

  return (
    <div className="mm-cie10">
      <div className="mm-row" style={{ gap: 10 }}>
        <div className="mm-input" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontWeight: 900 }}>CIE10</div>
            {value?.code ? (
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                <b>{value.code}</b> — {value.name}
              </div>
            ) : (
              <div style={{ fontSize: 13, opacity: 0.7 }}>Sin diagnóstico seleccionado</div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {value?.code && (
              <button type="button" className="mm-btn mm-btn--ghost" onClick={onClear}>
                Quitar
              </button>
            )}
            <button type="button" className="mm-btn" onClick={() => setOpen(true)}>
              Buscar
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="mm-modalBackdrop" onMouseDown={() => setOpen(false)}>
          <div className="mm-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mm-modalTop">
              <div style={{ fontWeight: 900, fontSize: 16 }}>Buscar CIE10</div>
              <button type="button" className="mm-btn mm-btn--ghost" onClick={() => setOpen(false)}>
                Cerrar
              </button>
            </div>

            <input
              ref={inputRef}
              className="mm-input"
              placeholder='Busca por "gripe", "diabetes", "hipertension" o por código "J10", "E11"...'
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <div className="mm-modalMeta">
              {loading ? "Buscando..." : `${rows.length} resultados`}
            </div>

            <div className="mm-results">
              {!loading && q.trim() && rows.length === 0 && (
                <div className="mm-empty">No se encontraron coincidencias.</div>
              )}

              {rows.map((r) => (
                <button
                  key={r.code}
                  type="button"
                  className="mm-result"
                  onClick={() => pickRow(r)}
                >
                  <div className="mm-resultCode">{r.code}</div>
                  <div className="mm-resultName">{r.name}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
