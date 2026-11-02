import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { TYPES, typeInfo, fmtUSD, num, round2, pct, nextCode, SEED_PRODUCTS } from "./fcUtils";

const QUICK = [10, 20, 30, 50, 100];

function ProductForm({ product, products, onClose, onSaved }) {
  const isNew = !product?.id;
  const initCost = product?.cost ?? "";
  const initPrice = product?.price ?? "";
  const initMarkup = num(initCost) > 0 && initPrice !== "" ? round2(((num(initPrice) - num(initCost)) / num(initCost)) * 100) : "";
  const [form, setForm] = useState({
    type: product?.type ?? "MEDICAMENTO",
    name: product?.name ?? "",
    cost: initCost,
    markup: initMarkup,
    price: initPrice,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setCost = (v) => setForm((f) => ({
    ...f, cost: v,
    price: f.markup !== "" ? round2(num(v) * (1 + num(f.markup) / 100)) : f.price,
  }));
  const setMarkup = (v) => setForm((f) => ({ ...f, markup: v, price: round2(num(f.cost) * (1 + num(v) / 100)) }));
  const setPrice = (v) => setForm((f) => ({
    ...f, price: v,
    markup: num(f.cost) > 0 ? round2(((num(v) - num(f.cost)) / num(f.cost)) * 100) : f.markup,
  }));

  const cost = num(form.cost), price = num(form.price), gain = price - cost;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError("Escribe el nombre del producto");
    if (price < cost) {
      if (!window.confirm("El precio de venta es menor que el costo. ¿Guardar de todas formas?")) return;
    }
    setSaving(true); setError("");
    const row = { type: form.type, name: form.name.trim(), cost: round2(cost), price: round2(price) };
    let res;
    if (isNew) res = await supabase.from("fc_products").insert({ ...row, code: nextCode(products, form.type) });
    else {
      if (product.type !== form.type) row.code = nextCode(products, form.type);
      res = await supabase.from("fc_products").update(row).eq("id", product.id);
    }
    setSaving(false);
    if (res.error) return setError(res.error.message);
    onSaved();
  };

  return (
    <div className="mm-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mm-modal">
        <div className="mm-modal-head">
          <span className="mm-modal-title">{isNew ? "💊 Nuevo producto" : "✏️ Editar producto"}</span>
          <button onClick={onClose} className="mm-icon-btn">✕</button>
        </div>
        <form onSubmit={submit} className="mm-modal-body">
          <div className="mm-row-2">
            <div className="mm-field">
              <label className="mm-label">Tipo *</label>
              <select className="mm-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div className="mm-field">
              <label className="mm-label">Producto *</label>
              <input className="mm-input" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Ketorolaco 60 mg" />
            </div>
          </div>

          <div className="mm-row-3">
            <div className="mm-field">
              <label className="mm-label">Costo unitario ($) *</label>
              <input className="mm-input" type="number" step="0.01" min="0" value={form.cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
            </div>
            <div className="mm-field">
              <label className="mm-label">% de ganancia</label>
              <input className="mm-input" type="number" step="0.1" value={form.markup} onChange={(e) => setMarkup(e.target.value)} placeholder="Ej: 20" />
            </div>
            <div className="mm-field">
              <label className="mm-label">Precio de venta ($) *</label>
              <input className="mm-input" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <div className="fc-quick">
            <span className="mm-text-muted mm-text-sm">Aplicar ganancia rápida:</span>
            {QUICK.map((q) => (
              <button type="button" key={q} className={`fc-pill ${num(form.markup) === q ? "active" : ""}`} onClick={() => setMarkup(q)}>
                +{q}%
              </button>
            ))}
          </div>

          <div className="fc-preview">
            <div><span>Ganancia por unidad</span><b className={gain < 0 ? "fc-neg" : "fc-pos"}>{fmtUSD(gain)}</b></div>
            <div><span>Ganancia sobre costo</span><b>{cost > 0 ? pct(gain / cost) : "—"}</b></div>
            <div><span>Margen sobre venta</span><b>{price > 0 ? pct(gain / price) : "—"}</b></div>
          </div>

          {error && <div className="mm-alert mm-alert--error">⚠️ {error}</div>}
          <div className="mm-flex" style={{ justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} className="mm-btn mm-btn--ghost">Cancelar</button>
            <button type="submit" className="mm-btn" disabled={saving}>{saving ? "Guardando…" : "Guardar producto"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProductsTab() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("ALL");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("fc_products").select("*").eq("active", true).order("type").order("name");
    if (error) setError(error.message);
    setProducts(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => products.filter((p) =>
    (type === "ALL" || p.type === type) &&
    (!q || p.name.toLowerCase().includes(q.toLowerCase()) || p.code?.toLowerCase().includes(q.toLowerCase()))
  ), [products, type, q]);

  const stats = useMemo(() => {
    const priced = products.filter((p) => num(p.cost) > 0);
    const avg = priced.length ? priced.reduce((s, p) => s + (num(p.price) - num(p.cost)) / num(p.cost), 0) / priced.length : NaN;
    return {
      total: products.length,
      avg,
      noCost: products.filter((p) => num(p.cost) <= 0).length,
      loss: products.filter((p) => num(p.price) < num(p.cost)).length,
    };
  }, [products]);

  const archive = async (p) => {
    if (!window.confirm(`¿Quitar "${p.name}" de la lista? (El historial de caja se conserva)`)) return;
    await supabase.from("fc_products").update({ active: false }).eq("id", p.id);
    load();
  };

  const seed = async () => {
    setSeeding(true);
    const counters = {};
    const rows = SEED_PRODUCTS.map(([t, name, cost = 0]) => {
      counters[t] = (counters[t] ?? 0) + 1;
      return { type: t, name, cost, price: 0, code: `${typeInfo(t).prefix}-${String(counters[t]).padStart(3, "0")}` };
    });
    const { error } = await supabase.from("fc_products").insert(rows);
    if (error) setError(error.message);
    setSeeding(false);
    load();
  };

  return (
    <>
      <div className="mm-kpi-grid" style={{ marginBottom: 20 }}>
        {[
          { icon: "📦", label: "Productos en lista", value: stats.total, badge: "Catálogo maestro" },
          { icon: "📈", label: "Ganancia promedio", value: pct(stats.avg), badge: "Sobre el costo" },
          { icon: "📝", label: "Sin costo cargado", value: stats.noCost, badge: "Por completar" },
          { icon: "⚠️", label: "Vendiendo a pérdida", value: stats.loss, badge: "Precio < costo" },
        ].map((k, i) => (
          <div key={i} className="mm-kpi">
            <div className="mm-kpi-icon">{k.icon}</div>
            <div className="mm-kpi-label">{k.label}</div>
            <div className="mm-kpi-value">{loading ? "…" : k.value}</div>
            <div className="mm-kpi-badge">● {k.badge}</div>
          </div>
        ))}
      </div>

      <div className="fc-toolbar">
        <div className="fc-seg">
          {[{ id: "ALL", label: "Todos" }, ...TYPES].map((t) => (
            <button key={t.id} className={type === t.id ? "active" : ""} onClick={() => setType(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className="mm-flex">
          <input className="mm-input fc-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Buscar producto o código…" />
          <button className="mm-btn" onClick={() => setEditing({})}>+ Nuevo producto</button>
        </div>
      </div>

      {error && <div className="mm-alert mm-alert--error" style={{ marginBottom: 12 }}>⚠️ {error}</div>}

      <div className="mm-card" style={{ padding: 0 }}>
        <div className="mm-card-accent-bar" />
        <div className="mm-table-wrap">
          <table className="mm-table">
            <thead>
              <tr>
                <th>Código</th><th>Tipo</th><th>Producto</th>
                <th className="fc-r">Costo</th><th className="fc-r">Precio venta</th><th className="fc-r">Ganancia</th>
                <th className="fc-r">Gan./costo</th><th className="fc-r">Margen</th><th className="fc-r">Precio +50%</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="fc-loading">Cargando…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10}>
                  <div className="mm-empty">
                    {products.length === 0 ? (
                      <>
                        <div style={{ marginBottom: 10 }}>Aún no hay productos en la Lista Original.</div>
                        <button className="mm-btn mm-btn--sm" onClick={seed} disabled={seeding}>
                          {seeding ? "Cargando…" : "⚡ Cargar lista base del consultorio (22 productos)"}
                        </button>
                        <div className="mm-hint" style={{ marginTop: 8 }}>Se cargan los nombres; luego completas costo y precio.</div>
                      </>
                    ) : "Ningún producto coincide con el filtro"}
                  </div>
                </td></tr>
              ) : filtered.map((p) => {
                const c = num(p.cost), pr = num(p.price), g = pr - c;
                const t = typeInfo(p.type);
                return (
                  <tr key={p.id} className="mm-table-click" onClick={() => setEditing(p)}>
                    <td className="fc-code">{p.code}</td>
                    <td><span className={`mm-chip ${t.chip}`}>{t.label}</span></td>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td className="fc-r">{c > 0 ? fmtUSD(c) : <span className="mm-chip mm-chip--warn">Sin costo</span>}</td>
                    <td className="fc-r fc-strong">{fmtUSD(pr)}</td>
                    <td className={`fc-r ${g < 0 ? "fc-neg" : "fc-pos"}`}>{fmtUSD(g)}</td>
                    <td className="fc-r">{c > 0 ? pct(g / c) : "—"}</td>
                    <td className="fc-r">{pr > 0 ? pct(g / pr) : "—"}</td>
                    <td className="fc-r mm-text-muted">{fmtUSD(c * 1.5)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="mm-icon-btn" title="Quitar de la lista" onClick={() => archive(p)}>🗑</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <ProductForm
          product={editing}
          products={products}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </>
  );
}
