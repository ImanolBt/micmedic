import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/* ─── Texto sin tildes para búsquedas ─────────────────────────── */
export const norm = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/* ─── Avisos (toasts) y confirmaciones ────────────────────────── */
const UICtx = createContext(null);

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const toast = useCallback((msg, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    const kind = opts.kind ?? "success";
    setToasts((l) => [...l, { id, msg, kind, action: opts.action }]);
    setTimeout(() => setToasts((l) => l.filter((t) => t.id !== id)), opts.duration ?? (kind === "error" ? 6000 : 3200));
  }, []);

  const confirm = useCallback((o) => new Promise((resolve) => setConfirmState({ ...o, resolve })), []);

  const close = (v) => { confirmState?.resolve(v); setConfirmState(null); };

  useEffect(() => {
    if (!confirmState) return;
    const onKey = (e) => { if (e.key === "Escape") close(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <UICtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="ui-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`ui-toast ui-toast--${t.kind}`}>
            <span className="ui-toast-icon">{t.kind === "error" ? "!" : t.kind === "info" ? "i" : "✓"}</span>
            <span className="ui-toast-msg">{t.msg}</span>
            {t.action && (
              <button className="ui-toast-action" onClick={() => { t.action.onClick(); setToasts((l) => l.filter((x) => x.id !== t.id)); }}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
      {confirmState && (
        <div className="mm-modal-backdrop" onClick={(e) => e.target === e.currentTarget && close(false)}>
          <div className="mm-modal ui-confirm" role="alertdialog" aria-modal="true" aria-labelledby="ui-confirm-title">
            <div className="ui-confirm-body">
              <div className={`ui-confirm-icon ${confirmState.danger ? "danger" : ""}`}>{confirmState.danger ? "🗑" : "?"}</div>
              <div>
                <div id="ui-confirm-title" className="ui-confirm-title">{confirmState.title}</div>
                {confirmState.message && <div className="ui-confirm-msg">{confirmState.message}</div>}
              </div>
            </div>
            <div className="ui-confirm-actions">
              <button className="mm-btn mm-btn--ghost" onClick={() => close(false)}>{confirmState.cancelLabel ?? "Cancelar"}</button>
              <button autoFocus className={`mm-btn ${confirmState.danger ? "mm-btn--danger" : ""}`} onClick={() => close(true)}>
                {confirmState.confirmLabel ?? "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </UICtx.Provider>
  );
}

export const useUI = () => useContext(UICtx) ?? { toast: () => {}, confirm: async () => window.confirm("¿Continuar?") };

/* ─── Buscador con autocompletar ──────────────────────────────── */
/* items: [{ id, label, sub?, right?, group?, data? }] */
export function SearchPick({ items, onPick, placeholder = "Buscar…", autoFocus, emptyText = "Sin coincidencias", inputRef, size }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const boxRef = useRef(null);
  const ownRef = useRef(null);
  const ref = inputRef ?? ownRef;
  const listRef = useRef(null);

  const results = useMemo(() => {
    const nq = norm(q);
    const words = nq.split(/\s+/).filter(Boolean);
    const list = words.length
      ? items.filter((it) => { const h = norm(it.label + " " + (it.keywords ?? "")); return words.every((w) => h.includes(w)); })
      : items;
    return list.slice(0, 60);
  }, [items, q]);

  useEffect(() => { setHi(0); }, [q]);
  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hi]);

  const pick = (it) => { onPick(it); setQ(""); setOpen(false); setTimeout(() => ref.current?.focus(), 0); };

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { if (open && results[hi]) { e.preventDefault(); pick(results[hi]); } }
    else if (e.key === "Escape") { setOpen(false); }
  };

  let lastGroup = null;
  return (
    <div className={`ui-pick ${size === "lg" ? "ui-pick--lg" : ""}`} ref={boxRef}>
      <span className="ui-pick-icon" aria-hidden>⌕</span>
      <input
        ref={ref}
        className="mm-input ui-pick-input"
        value={q}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && (
        <div className="ui-pick-menu" ref={listRef} role="listbox">
          {results.length === 0 ? (
            <div className="ui-pick-empty">{emptyText}</div>
          ) : results.map((it, i) => {
            const header = it.group && it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <div key={it.id}>
                {header && <div className="ui-pick-group">{header}</div>}
                <div
                  data-i={i}
                  role="option"
                  aria-selected={i === hi}
                  className={`ui-pick-opt ${i === hi ? "hi" : ""}`}
                  onMouseEnter={() => setHi(i)}
                  onMouseDown={(e) => { e.preventDefault(); pick(it); }}
                >
                  <div className="ui-pick-main">
                    <div className="ui-pick-label">{it.label}</div>
                    {it.sub && <div className="ui-pick-sub">{it.sub}</div>}
                  </div>
                  {it.right && <div className="ui-pick-right">{it.right}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Contador − / + ──────────────────────────────────────────── */
export function Stepper({ value, onChange, min = 0, step = 1, size, label = "Cantidad" }) {
  const v = Number(value) || 0;
  const set = (n) => onChange(Math.max(min, Math.round(n * 100) / 100));
  return (
    <div className={`ui-stepper ${size === "lg" ? "ui-stepper--lg" : ""}`}>
      <button type="button" aria-label={`Restar ${label}`} onClick={() => set(v - step)} disabled={v <= min}>−</button>
      <input
        aria-label={label}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(",", "."))}
        onBlur={(e) => set(parseFloat(e.target.value) || min)}
      />
      <button type="button" aria-label={`Sumar ${label}`} onClick={() => set(v + step)}>+</button>
    </div>
  );
}

/* ─── Punto "en vivo" ─────────────────────────────────────────── */
export function LiveDot({ live, label }) {
  return (
    <span className={`ui-live ${live ? "on" : ""}`}>
      <span className="ui-live-dot" />{label ?? (live ? "En vivo" : "Sin conexión en vivo")}
    </span>
  );
}

/* ─── Hace cuánto ─────────────────────────────────────────────── */
export function useAgo(date) {
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force((x) => x + 1), 15000); return () => clearInterval(t); }, []);
  if (!date) return "";
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 20) return "hace un momento";
  if (s < 60) return `hace ${s} s`;
  const m = Math.round(s / 60);
  return m < 60 ? `hace ${m} min` : `a las ${date.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}`;
}
