import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { normalizeEs } from "../utils/normalize";

export default function Cie10MultiPicker({ selected = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const inputRef = useRef(null);

  const qNorm = useMemo(() => normalizeEs(q), [q]);

  const selectedSet = useMemo(() => {
    const s = new Set();
    (selected || []).forEach((x) => x?.code && s.add(x.code));
    return s;
  }, [selected]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const query = qNorm;
      if (!query) {
        setRows([]);
        return;
      }

      setLoading(true);

      // Busca por código o por nombre/keywords
      const raw = q.trim();
      const looksLikeCode =
        /^[a-z]\d{2}(\.\d+)?$/i.test(raw) || /^[a-z]\d{2}$/i.test(raw) || /^[a-z]\d{3,4}$/i.test(raw);

      let res;

      if (looksLikeCode) {
        res = await supabase
          .from("cie10")
          .select("code,name")
          .ilike("code", `${raw.toUpperCase()}%`)
          .limit(30);
      } else {
        // Si name_norm está NULL en tu tabla, esto NO encontrará bien.
        // Ideal: llenar name_norm y/o usar ilike("name", `%${raw}%`) como fallback.
        res = await supabase
          .from("cie10")
          .select("code,name")
          .or(`name_norm.ilike.%${query}%,name.ilike.%${raw}%`)
          .limit(30);
      }

      if (res.error) {
        console.error(res.error);
        setRows([]);
      } else {
        setRows(res.data || []);
      }

      setLoading(false);
    }, 250);

    return () => clearTimeout(t);
  }, [open, qNorm]); // eslint-disable-line

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  function addDiag(r) {
    const next = [...(selected || [])];

    if (!selectedSet.has(r.code)) {
      next.push({ code: r.code, name: r.name });
      onChange?.(next);
    }

    // deja el modal abierto para agregar varios rápido
    setQ("");
    setRows([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function removeDiag(code) {
    const next = (selected || []).filter((x) => x.code !== code);
    onChange?.(next);
  }

  function clearAll() {
    onChange?.([]);
  }

  return (
    <div className="mm-cie10">
      <div className="mm-input" style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ fontWeight: 900 }}>Diagnósticos (CIE10)</div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>
              {(selected || []).length ? `${selected.length} seleccionados` : "Sin diagnósticos"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {(selected || []).length > 0 && (
              <button type="button" className="mm-btn mm-btn--ghost" onClick={clearAll}>
                Limpiar
              </button>
            )}
            <button type="button" className="mm-btn" onClick={() => setOpen(true)}>
              Buscar
            </button>
          </div>
        </div>

        {(selected || []).length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {selected.map((d) => (
              <div
                key={d.code}
                className="mm-chip"
                style={{ display: "inline-flex", gap: 8, alignItems: "center" }}
                title={d.name}
              >
                <b>{d.code}</b>
                <span style={{ opacity: 0.9, fontSize: 13 }}>{d.name}</span>
                <button
                  type="button"
                  className="mm-btn mm-btn--ghost"
                  onClick={() => removeDiag(d.code)}
                  style={{ padding: "4px 8px" }}
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div className="mm-modalBackdrop" onMouseDown={() => setOpen(false)}>
          <div className="mm-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mm-modalTop">
              <div style={{ fontWeight: 900, fontSize: 16 }}>Buscar CIE10 (múltiple)</div>
              <button type="button" className="mm-btn mm-btn--ghost" onClick={() => setOpen(false)}>
                Cerrar
              </button>
            </div>

            <input
              ref={inputRef}
              className="mm-input"
              placeholder='Busca: "gripe", "diabetes", "amid" (amigdalitis), o código "J10"...'
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

              {rows.map((r) => {
                const already = selectedSet.has(r.code);
                return (
                  <button
                    key={r.code}
                    type="button"
                    className="mm-result"
                    onClick={() => addDiag(r)}
                    disabled={already}
                    style={{ opacity: already ? 0.5 : 1 }}
                    title={already ? "Ya agregado" : "Agregar"}
                  >
                    <div className="mm-resultCode">{r.code}</div>
                    <div className="mm-resultName">{r.name}</div>
                  </button>
                );
              })}
            </div>

            <div className="mm-hint" style={{ marginTop: 10 }}>
              Tip: puedes agregar varios sin cerrar (clic en cada resultado).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
