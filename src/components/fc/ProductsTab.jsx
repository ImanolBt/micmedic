import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { TYPES, typeInfo, fmtUSD, num, round2, pct, nextCode, SEED_PRODUCTS, TYPE_ICON } from "./fcUtils";
import { norm, useUI } from "../ui/kit";

const QUICK = [10, 20, 30, 50, 100];

function ProductForm({ product, products, onClose, onSaved }) {
  const { toast } = useUI();
  const isNew = !product?.id;
  const initCost = product?.cost ?? "";
  const initPrice = product?.price ?? "";
  const initMarkup = num(initCost) > 0 && initPrice !== "" ? round2(((num(initPrice) - num(initCost)) / num(initCost)) * 100) : "";
  const [form, setForm] = useState({ type: product?.type ?? "MEDICAMENTO", name: product?.name ?? "", cost: initCost, markup: initMarkup, price: initPrice });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setCost = (v) => setForm((f) => ({ ...f, cost: v, price: f.markup !== "" ? round2(num(v) * (1 + num(f.markup) / 100)) : f.price }));
  const setMarkup = (v) => setForm((f) => ({ ...f, markup: v, price: round2(num(f.cost) * (1 + num(v) / 100)) }));
  const setPrice = (v) => setForm((f) => ({ ...f, price: v, markup: num(f.cost) > 0 ? round2(((num(v) - num(f.cost)) / num(f.cost)) * 100) : f.markup }));

  const cost = num(form.cost), price = num(form.price), gain = price - cost;
  const dup = isNew && form.name.trim() && products.some((p) => norm(p.name) === norm(form.name));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError("Escribe el nombre del producto.");
    setSaving(true); setError("");
    const row = { type: form.type, name: form.name.trim(), cost: round2(cost), price: round2(price) };
    let res;
    if (isNew) res = await supabase.from("fc_products").insert({ ...row, code: nextCode(products, form.type) });
    else {
      if (product.type !== form.type) row.code = nextCode(products, form.type);
      res = await supabase.from("fc_products").update(row).eq("id", product.id);
    }
    setSaving(false);
    if (res.error) return setError(`No se pudo guardar. ${res.error.message}`);
    toast(isNew ? `${row.name} se agregó a la lista` : `${row.name} se actualizó`);
    onSaved();
  };

  return (
    <div className="mm-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mm-modal">
        <div className="mm-modal-head">
          <span className="mm-modal-title">{isNew ? "Nuevo producto" : `Editar · ${product.code ?? ""}`}</span>
          <button onClick={onClose} className="mm-icon-btn" aria-label="Cerrar">✕</button>
        </div>
        <form onSubmit={submit} className="mm-modal-body">
          <div className="mm-field">
            <label className="mm-label">Tipo</label>
            <div className="pf-types">
              {TYPES.map((t) => (
                <button type="button" key={t.id} className={`pf-type ${form.type === t.id ? "active" : ""}`} onClick={() => setForm({ ...form, type: t.id })}>
                  <span>{TYPE_ICON[t.id]}</span>{t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mm-field">
            <label className="mm-label" htmlFor="pf-name">Nombre del producto</label>
            <input id="pf-name" className="mm-input" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Ketorolaco 60 mg ampolla" />
            {dup && <span className="mm-hint fc-warn">Ya existe un producto con este nombre.</span>}
          </div>

          <div className="pf-price-flow">
            <div className="mm-field">
              <label className="mm-label">Te cuesta</label>
              <div className="cj-money cj-money--lg"><i>$</i><input inputMode="decimal" value={form.cost} onChange={(e) => setCost(e.target.value.replace(",", "."))} placeholder="0.00" /></div>
            </div>
            <div className="pf-arrow">+</div>
            <div className="mm-field">
              <label className="mm-label">Ganancia</label>
              <div className="cj-money cj-money--lg"><input inputMode="decimal" value={form.markup} onChange={(e) => setMarkup(e.target.value.replace(",", "."))} placeholder="0" /><i>%</i></div>
            </div>
            <div className="pf-arrow">=</div>
            <div className="mm-field">
              <label className="mm-label">Lo vendes a</label>
              <div className="cj-money cj-money--lg cj-money--accent"><i>$</i><input inputMode="decimal" value={form.price} onChange={(e) => setPrice(e.target.value.replace(",", "."))} placeholder="0.00" /></div>
            </div>
          </div>

          <div className="fc-quick">
            <span className="mm-text-muted mm-text-sm">Ganancia rápida:</span>
            {QUICK.map((q) => (
              <button type="button" key={q} className={`fc-pill ${num(form.markup) === q && form.markup !== "" ? "active" : ""}`} onClick={() => setMarkup(q)} disabled={cost <= 0}>+{q}%</button>
            ))}
          </div>

          <div className="fc-preview">
            <div><span>Ganas por unidad</span><b className={gain < 0 ? "fc-neg" : "fc-pos"}>{fmtUSD(gain)}</b></div>
            <div><span>Sobre el costo</span><b>{cost > 0 ? pct(gain / cost) : "—"}</b></div>
            <div><span>Margen sobre la venta</span><b>{price > 0 ? pct(gain / price) : "—"}</b></div>
          </div>

          {price > 0 && price < cost && <div className="mm-alert mm-alert--warn">El precio de venta es menor que el costo: perderías {fmtUSD(cost - price)} por unidad.</div>}
          {cost <= 0 && <div className="mm-hint">Ingresa el costo para calcular la ganancia automáticamente.</div>}
          {error && <div className="mm-alert mm-alert--error">{error}</div>}

          <div className="mm-flex" style={{ justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} className="mm-btn mm-btn--ghost">Cancelar</button>
            <button type="submit" className="mm-btn" disabled={saving}>{saving ? "Guardando…" : isNew ? "Agregar a la lista" : "Guardar cambios"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProductsTab() {
  const { toast, confirm } = useUI();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("ALL");
  const [view, setView] = useState("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [quick, setQuick] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const tableRef = useRef(null);

  const load = async () => {
    const { data, error } = await supabase.from("fc_products").select("*").eq("active", true).order("type").order("name");
    if (error) toast(`No se pudo cargar la lista. ${error.message}`, { kind: "error" });
    setProducts(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const priced = products.filter((p) => num(p.cost) > 0);
    return {
      total: products.length,
      avg: priced.length ? priced.reduce((s, p) => s + (num(p.price) - num(p.cost)) / num(p.cost), 0) / priced.length : NaN,
      noCost: products.filter((p) => num(p.cost) <= 0 || num(p.price) <= 0).length,
      loss: products.filter((p) => num(p.price) > 0 && num(p.price) < num(p.cost)).length,
    };
  }, [products]);

  const filtered = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    return products.filter((p) => {
      if (type !== "ALL" && p.type !== type) return false;
      if (view === "incomplete" && !(num(p.cost) <= 0 || num(p.price) <= 0)) return false;
      if (view === "loss" && !(num(p.price) > 0 && num(p.price) < num(p.cost))) return false;
      const h = norm(`${p.name} ${p.code}`);
      return words.every((w) => h.includes(w));
    });
  }, [products, type, view, q]);

  const saveInline = async (p, field, value) => {
    const v = round2(num(value));
    if (v === num(p[field])) return;
    setProducts((l) => l.map((x) => (x.id === p.id ? { ...x, [field]: v } : x)));
    const { error } = await supabase.from("fc_products").update({ [field]: v }).eq("id", p.id);
    if (error) toast(error.message, { kind: "error" });
    else toast(`${p.name}: ${field === "cost" ? "costo" : "precio"} ${fmtUSD(v)}`, { duration: 1600 });
  };

  const focusNext = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const inputs = [...tableRef.current.querySelectorAll("input[data-q]")];
    const i = inputs.indexOf(e.currentTarget);
    const col = e.currentTarget.dataset.q;
    const next = inputs.slice(i + 1).find((x) => x.dataset.q === col);
    e.currentTarget.blur();
    next?.focus(); next?.select();
  };

  const archive = async (p) => {
    const ok = await confirm({
      title: `¿Quitar “${p.name}” de la lista?`,
      message: "Ya no aparecerá para registrar en la caja ni en los paquetes. Lo que ya se registró en días anteriores se conserva.",
      confirmLabel: "Quitar producto", danger: true,
    });
    if (!ok) return;
    await supabase.from("fc_products").update({ active: false }).eq("id", p.id);
    setProducts((l) => l.filter((x) => x.id !== p.id));
    toast(`${p.name} se quitó de la lista`, {
      kind: "info",
      action: { label: "Deshacer", onClick: async () => { await supabase.from("fc_products").update({ active: true }).eq("id", p.id); load(); } },
    });
  };

  const seed = async () => {
    setSeeding(true);
    const counters = {};
    const rows = SEED_PRODUCTS.map(([t, name, cost = 0]) => {
      counters[t] = (counters[t] ?? 0) + 1;
      return { type: t, name, cost, price: 0, code: `${typeInfo(t).prefix}-${String(counters[t]).padStart(3, "0")}` };
    });
    const { error } = await supabase.from("fc_products").insert(rows);
    setSeeding(false);
    if (error) return toast(error.message, { kind: "error" });
    toast("Se cargaron 22 productos. Ahora completa costo y precio.");
    setQuick(true);
    load();
  };

  const STATS = [
    { id: "all", label: "Productos", value: stats.total, tone: "" },
    { id: "incomplete", label: "Sin costo o precio", value: stats.noCost, tone: stats.noCost ? "warn" : "" },
    { id: "loss", label: "Se venden a pérdida", value: stats.loss, tone: stats.loss ? "danger" : "" },
  ];

  return (
    <>
      <div className="fc-stats">
        {STATS.map((s) => (
          <button key={s.id} className={`fc-stat ${s.tone} ${view === s.id ? "active" : ""}`} onClick={() => setView(view === s.id && s.id !== "all" ? "all" : s.id)}>
            <b>{loading ? "…" : s.value}</b><span>{s.label}</span>
          </button>
        ))}
        <div className="fc-stat fc-stat--static">
          <b>{loading ? "…" : pct(stats.avg)}</b><span>Ganancia promedio sobre el costo</span>
        </div>
      </div>

      <div className="fc-toolbar">
        <div className="fc-seg" role="group" aria-label="Tipo">
          {[{ id: "ALL", label: "Todos" }, ...TYPES].map((t) => (
            <button key={t.id} className={type === t.id ? "active" : ""} onClick={() => setType(t.id)}>
              {t.id !== "ALL" && <span>{TYPE_ICON[t.id]} </span>}{t.label}
            </button>
          ))}
        </div>
        <div className="mm-flex fc-toolbar-right">
          <div className="pt-search fc-search"><span aria-hidden>⌕</span><input className="mm-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto o código" /></div>
          <button className={`mm-btn mm-btn--ghost ${quick ? "is-on" : ""}`} onClick={() => setQuick(!quick)} title="Edita costos y precios directamente en la tabla">
            {quick ? "✓ Edición rápida" : "✎ Edición rápida"}
          </button>
          <button className="mm-btn" onClick={() => setEditing({})}>+ Nuevo producto</button>
        </div>
      </div>

      {quick && <div className="fc-quickbar">Edición rápida activa: escribe el costo o el precio y presiona <kbd>Enter</kbd> para pasar al siguiente. Se guarda solo.</div>}

      <div className="mm-card" style={{ padding: 0 }}>
        <div className="mm-card-accent-bar" />
        <div className="mm-table-wrap" ref={tableRef}>
          <table className="mm-table fc-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th className="fc-r">Costo</th><th className="fc-r">Precio de venta</th>
                <th className="fc-r">Ganancia</th><th className="fc-r">Margen</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={6}><div className="ui-skel" style={{ width: `${45 + i * 8}%` }} /></td></tr>) :
                filtered.length === 0 ? (
                <tr><td colSpan={6}>
                  {products.length === 0 ? (
                    <div className="cj-empty">
                      <div className="cj-empty-ico">💊</div>
                      <b>La Lista Original está vacía</b>
                      <span>Aquí van todos los medicamentos, sueros e insumos con su costo y precio. Puedes cargar la lista base del consultorio y solo completar los precios.</span>
                      <div className="mm-flex" style={{ justifyContent: "center" }}>
                        <button className="mm-btn" onClick={seed} disabled={seeding}>{seeding ? "Cargando…" : "Cargar los 22 productos base"}</button>
                        <button className="mm-btn mm-btn--ghost" onClick={() => setEditing({})}>Agregar uno por uno</button>
                      </div>
                    </div>
                  ) : <div className="mm-empty">Ningún producto coincide con el filtro.</div>}
                </td></tr>
              ) : filtered.map((p) => {
                const c = num(p.cost), pr = num(p.price), g = pr - c;
                const t = typeInfo(p.type);
                const incomplete = c <= 0 || pr <= 0;
                return (
                  <tr key={p.id} className={`${quick ? "" : "mm-table-click"} ${incomplete ? "fc-row-warn" : ""}`} onClick={() => !quick && setEditing(p)}>
                    <td>
                      <div className="fc-prod">
                        <span className={`fc-prod-ico ${p.type.toLowerCase()}`}>{TYPE_ICON[p.type]}</span>
                        <div>
                          <div className="fc-prod-name">{p.name}</div>
                          <div className="fc-prod-meta"><span className="fc-code">{p.code}</span> · {t.label}</div>
                        </div>
                      </div>
                    </td>
                    {quick ? (
                      <>
                        <td className="fc-r" onClick={(e) => e.stopPropagation()}>
                          <div className="cj-money cj-money--sm"><i>$</i><input data-q="cost" defaultValue={c || ""} placeholder="0.00" inputMode="decimal" onKeyDown={focusNext} onBlur={(e) => saveInline(p, "cost", e.target.value)} /></div>
                        </td>
                        <td className="fc-r" onClick={(e) => e.stopPropagation()}>
                          <div className="cj-money cj-money--sm"><i>$</i><input data-q="price" defaultValue={pr || ""} placeholder="0.00" inputMode="decimal" onKeyDown={focusNext} onBlur={(e) => saveInline(p, "price", e.target.value)} /></div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="fc-r">{c > 0 ? fmtUSD(c) : <span className="mm-chip mm-chip--warn">Falta costo</span>}</td>
                        <td className="fc-r fc-strong">{pr > 0 ? fmtUSD(pr) : <span className="mm-chip mm-chip--warn">Falta precio</span>}</td>
                      </>
                    )}
                    <td className="fc-r">
                      {incomplete ? <span className="mm-text-muted">—</span> : <>
                        <div className={g < 0 ? "fc-neg" : "fc-pos"}>{fmtUSD(g)}</div>
                        <div className="fc-sub">{pct(g / c)} sobre costo</div>
                      </>}
                    </td>
                    <td className="fc-r">
                      {pr > 0 && c > 0 ? (
                        <div className="fc-margin">
                          <span>{pct(g / pr)}</span>
                          <div className="fc-bar"><div style={{ width: `${Math.max(0, Math.min(100, (g / pr) * 100))}%` }} /></div>
                        </div>
                      ) : "—"}
                    </td>
                    <td onClick={(e) => e.stopPropagation()} className="fc-actions">
                      <button className="mm-icon-btn" title="Editar" aria-label={`Editar ${p.name}`} onClick={() => setEditing(p)}>✎</button>
                      <button className="mm-icon-btn" title="Quitar de la lista" aria-label={`Quitar ${p.name}`} onClick={() => archive(p)}>🗑</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <ProductForm product={editing} products={products} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </>
  );
}
