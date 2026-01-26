import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { normalizeEs } from "../utils/normalize";

export default function Cie10Picker({ value, onPick, onClear }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const inputRef = useRef(null);

  const qTrim = useMemo(() => (q || "").trim(), [q]);
  const qUpper = useMemo(() => qTrim.toUpperCase(), [qTrim]);
  const qNorm = useMemo(() => normalizeEs(qTrim), [qTrim]);

  // Detecta si parece código: J10, E11, A00.1
  const looksLikeCode = useMemo(() => {
    return /^[a-z]\d{2}(\.\d+)?$/i.test(qTrim) || /^[a-z]\d{2}$/i.test(qTrim);
  }, [qTrim]);

  useEffect(() => {
    if (!open) return;

    const t = setTimeout(async () => {
      if (!qTrim) {
        setRows([]);
        return;
      }

      setLoading(true);

      try {
        let data = [];

        if (looksLikeCode) {
          // ✅ CÓDIGO: J10 -> J10%
          const res = await supabase
            .from("cie10")
            .select("code,name")
            .ilike("code", `${qUpper}%`)
            .limit(30);

          if (res.error) throw res.error;
          data = res.data || [];
        } else {
          // ✅ TEXTO: "gripe", "amid", "dolor garganta"
          // Hacemos 2 búsquedas y luego mezclamos:
          // 1) contains (subcadena) en name_norm: %amid%
          // 2) también por code por si escriben algo mixto

          const [r1, r2] = await Promise.all([
            supabase
              .from("cie10")
              .select("code,name,name_norm")
              .ilike("name_norm", `%${qNorm}%`)
              .limit(40),

            supabase
              .from("cie10")
              .select("code,name,name_norm")
              .ilike("code", `%${qUpper}%`)
              .limit(20),
          ]);

          if (r1.error) throw r1.error;
          if (r2.error) throw r2.error;

          const map = new Map();
          [...(r1.data || []), ...(r2.data || [])].forEach((it) => {
            map.set(it.code, it);
          });

          data = Array.from(map.values());

          // ✅ Ordenar por relevancia:
          // - si empieza por lo escrito (más top)
          // - si contiene lo escrito
          // - si coincide por código
          const s = qNorm.toLowerCase();
          const sc = (x) => {
            const nn = (x.name_norm || "").toLowerCase();
            const code = (x.code || "").toLowerCase();
            let p = 0;

            if (nn.startsWith(s)) p += 120;       // "gripe" al inicio
            if (nn.includes(s)) p += 80;          // "amid" dentro de "amigdalitis"
            if (code.startsWith(qTrim.toLowerCase())) p += 100;
            if (code.includes(qTrim.toLowerCase())) p += 20;

            // Bonus si la coincidencia es corta y exacta
            if (s.length <= 4 && nn.includes(s)) p += 15;

            return p;
          };

          data.sort((a, b) => sc(b) - sc(a));

          // Limpiar antes de mostrar
          data = data.slice(0, 30).map(({ code, name }) => ({ code, name }));
        }

        setRows(data);
      } catch (err) {
        console.error(err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [open, qTrim, qUpper, qNorm, looksLikeCode]);

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
              placeholder='Busca por "gripe", "amigdalitis", "amid", o por código "J10", "E11"...'
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <div className="mm-modalMeta">
              {loading ? "Buscando..." : `${rows.length} resultados`}
            </div>

            <div className="mm-results">
              {!loading && qTrim && rows.length === 0 && (
                <div className="mm-empty">No se encontraron coincidencias.</div>
              )}

              {rows.map((r) => (
                <button key={r.code} type="button" className="mm-result" onClick={() => pickRow(r)}>
                  <div className="mm-resultCode">{r.code}</div>
                  <div className="mm-resultName">{r.name}</div>
                </button>
              ))}
            </div>

            <div className="mm-hint" style={{ marginTop: 10 }}>
              Puedes escribir solo una parte: "amid" → "amigdalitis".
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
