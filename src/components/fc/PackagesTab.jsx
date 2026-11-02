import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  fmtUSD, num, round2, procedureCost, procedureSuggested, procedurePrice,
  ProductOptions, SEED_PROCEDURES, typeInfo,
} from "./fcUtils";

const PROC_SELECT = "*, fc_procedure_items(id, qty, product_id, fc_products(id, name, type, cost, price))";

function PackageForm({ proc, products, onClose, onSaved }) {
  const isNew = !proc?.id;
  const [form, setForm] = useState({
    name: proc?.name ?? "",
    professional_fee: proc?.professional_fee ?? 0,
    margin_pct: proc?.margin_pct ?? 0,
    price: proc?.price ?? "",
    notes: proc?.notes ?? "",
  });
  const [items, setItems] = useState(
    (proc?.fc_procedure_items ?? []).map((it) => ({ product_id: it.product_id, qty: it.qty }))
  );
  const [pick, setPick] = useState("");
  const [pickQty, setPickQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const cost = items.reduce((s, it) => s + num(it.qty) * num(byId[it.product_id]?.cost), 0);
  const suggested = round2((cost + num(form.professional_fee)) * (1 + num(form.margin_pct) / 100));
  const finalPrice = form.price === "" || form.price == null ? suggested : num(form.price);
  const profit = finalPrice - cost;

  const addItem = () => {
    if (!pick) return;
    setItems((list) => {
      const ex = list.find((i) => i.product_id === pick);
      if (ex) return list.map((i) => (i.product_id === pick ? { ...i, qty: num(i.qty) + num(pickQty) } : i));
      return [...list, { product_id: pick, qty: num(pickQty) || 1 }];
    });
    setPick(""); setPickQty(1);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError("Escribe el nombre del procedimiento");
    setSaving(true); setError("");
    const row = {
      name: form.name.trim(),
      professional_fee: round2(num(form.professional_fee)),
      margin_pct: num(form.margin_pct),
      price: form.price === "" || form.price == null ? null : round2(num(form.price)),
      notes: form.notes || null,
    };
    let id = proc?.id;
    if (isNew) {
      const { data, error } = await supabase.from("fc_procedures").insert(row).select("id").single();
      if (error) { setSaving(false); return setError(error.message); }
      id = data.id;
    } else {
      const { error } = await supabase.from("fc_procedures").update(row).eq("id", id);
      if (error) { setSaving(false); return setError(error.message); }
      await supabase.from("fc_procedure_items").delete().eq("procedure_id", id);
    }
    if (items.length) {
      const { error } = await supabase.from("fc_procedure_items").insert(
        items.map((it) => ({ procedure_id: id, product_id: it.product_id, qty: num(it.qty) }))
      );
      if (error) { setSaving(false); return setError(error.message); }
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="mm-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mm-modal mm-modal--wide">
        <div className="mm-modal-head">
          <span className="mm-modal-title">{isNew ? "🩹 Nuevo paquete de procedimiento" : "🩹 " + proc.name}</span>
          <button onClick={onClose} className="mm-icon-btn">✕</button>
        </div>
        <form onSubmit={submit} className="mm-modal-body">
          <div className="mm-field">
            <label className="mm-label">Procedimiento *</label>
            <input className="mm-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Curación pequeña" />
          </div>

          <div>
            <div className="mm-label" style={{ marginBottom: 8 }}>Insumos del paquete (costos tomados de la Lista Original)</div>
            <div className="fc-add-row">
              <select className="mm-input" value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">— Elegir producto de la lista —</option>
                <ProductOptions products={products} />
              </select>
              <input className="mm-input fc-qty" type="number" step="0.5" min="0.5" value={pickQty} onChange={(e) => setPickQty(e.target.value)} />
              <button type="button" className="mm-btn" onClick={addItem} disabled={!pick}>+ Agregar</button>
            </div>

            <div className="fc-mini-table">
              <table className="mm-table">
                <thead><tr><th>Insumo</th><th className="fc-r">Cant.</th><th className="fc-r">Costo unit.</th><th className="fc-r">Subtotal</th><th></th></tr></thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={5} className="fc-loading">Agrega los insumos que usas en este procedimiento</td></tr>
                  ) : items.map((it) => {
                    const p = byId[it.product_id];
                    return (
                      <tr key={it.product_id}>
                        <td>
                          <b>{p?.name ?? "Producto eliminado"}</b>{" "}
                          {p && <span className={`mm-chip ${typeInfo(p.type).chip}`} style={{ marginLeft: 6 }}>{typeInfo(p.type).label}</span>}
                        </td>
                        <td className="fc-r">
                          <input className="mm-input fc-qty" type="number" step="0.5" min="0" value={it.qty}
                            onChange={(e) => setItems((l) => l.map((x) => (x.product_id === it.product_id ? { ...x, qty: e.target.value } : x)))} />
                        </td>
                        <td className="fc-r">{fmtUSD(p?.cost)}</td>
                        <td className="fc-r fc-strong">{fmtUSD(num(it.qty) * num(p?.cost))}</td>
                        <td><button type="button" className="mm-icon-btn" onClick={() => setItems((l) => l.filter((x) => x.product_id !== it.product_id))}>✕</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mm-row-3">
            <div className="mm-field">
              <label className="mm-label">Honorario profesional ($)</label>
              <input className="mm-input" type="number" step="0.01" min="0" value={form.professional_fee} onChange={(e) => setForm({ ...form, professional_fee: e.target.value })} />
            </div>
            <div className="mm-field">
              <label className="mm-label">Margen (%)</label>
              <input className="mm-input" type="number" step="0.1" value={form.margin_pct} onChange={(e) => setForm({ ...form, margin_pct: e.target.value })} />
            </div>
            <div className="mm-field">
              <label className="mm-label">Precio a cobrar ($)</label>
              <input className="mm-input" type="number" step="0.01" min="0" value={form.price ?? ""} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder={`Sugerido ${fmtUSD(suggested)}`} />
              <span className="mm-hint">Déjalo vacío para usar siempre el precio sugerido.</span>
            </div>
          </div>

          <div className="fc-preview">
            <div><span>Costo de insumos</span><b>{fmtUSD(cost)}</b></div>
            <div><span>Precio mínimo sugerido</span><b>{fmtUSD(suggested)}</b></div>
            <div><span>Se cobra</span><b className="fc-strong">{fmtUSD(finalPrice)}</b></div>
            <div><span>Ganancia</span><b className={profit < 0 ? "fc-neg" : "fc-pos"}>{fmtUSD(profit)}</b></div>
          </div>

          <div className="mm-field">
            <label className="mm-label">Notas</label>
            <input className="mm-input" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          {error && <div className="mm-alert mm-alert--error">⚠️ {error}</div>}
          <div className="mm-flex" style={{ justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} className="mm-btn mm-btn--ghost">Cancelar</button>
            <button type="submit" className="mm-btn" disabled={saving}>{saving ? "Guardando…" : "Guardar paquete"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PackagesTab() {
  const [procs, setProcs] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const [a, b] = await Promise.all([
      supabase.from("fc_procedures").select(PROC_SELECT).eq("active", true).order("name"),
      supabase.from("fc_products").select("*").eq("active", true).order("name"),
    ]);
    if (a.error) setError(a.error.message);
    setProcs(a.data ?? []);
    setProducts(b.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const archive = async (p) => {
    if (!window.confirm(`¿Quitar el paquete "${p.name}"?`)) return;
    await supabase.from("fc_procedures").update({ active: false }).eq("id", p.id);
    load();
  };

  const seed = async () => {
    setSeeding(true); setError("");
    const byName = Object.fromEntries(products.map((p) => [p.name.toLowerCase(), p.id]));
    for (const [name, itemNames] of SEED_PROCEDURES) {
      const { data, error } = await supabase.from("fc_procedures").insert({ name }).select("id").single();
      if (error) { setError(error.message); break; }
      const items = itemNames.map((n) => byName[n.toLowerCase()]).filter(Boolean)
        .map((pid) => ({ procedure_id: data.id, product_id: pid, qty: 1 }));
      if (items.length) await supabase.from("fc_procedure_items").insert(items);
    }
    setSeeding(false);
    load();
  };

  return (
    <>
      <div className="fc-toolbar">
        <div className="mm-text-muted mm-text-sm" style={{ maxWidth: 560 }}>
          El costo de cada paquete se calcula <b>automáticamente</b> con los costos de la Lista Original.
          Si cambias el precio de un insumo, todos los paquetes que lo usan se actualizan solos.
        </div>
        <button className="mm-btn" onClick={() => setEditing({})}>+ Nuevo paquete</button>
      </div>

      {error && <div className="mm-alert mm-alert--error" style={{ marginBottom: 12 }}>⚠️ {error}</div>}

      <div className="mm-card" style={{ padding: 0 }}>
        <div className="mm-card-accent-bar" />
        <div className="mm-table-wrap">
          <table className="mm-table">
            <thead>
              <tr>
                <th>Procedimiento</th><th>Insumos considerados</th>
                <th className="fc-r">Costo insumos</th><th className="fc-r">Honorario</th><th className="fc-r">Margen</th>
                <th className="fc-r">Precio mínimo</th><th className="fc-r">Se cobra</th><th className="fc-r">Ganancia</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="fc-loading">Cargando…</td></tr>
              ) : procs.length === 0 ? (
                <tr><td colSpan={9}>
                  <div className="mm-empty">
                    <div style={{ marginBottom: 10 }}>Aún no hay paquetes de procedimientos.</div>
                    <button className="mm-btn mm-btn--sm" onClick={seed} disabled={seeding}>
                      {seeding ? "Cargando…" : "⚡ Cargar los 13 procedimientos del consultorio"}
                    </button>
                    <div className="mm-hint" style={{ marginTop: 8 }}>Primero carga la Lista Original para que se enlacen los insumos.</div>
                  </div>
                </td></tr>
              ) : procs.map((p) => {
                const cost = procedureCost(p), price = procedurePrice(p);
                const items = p.fc_procedure_items ?? [];
                return (
                  <tr key={p.id} className="mm-table-click" onClick={() => setEditing(p)}>
                    <td style={{ fontWeight: 700 }}>{p.name}</td>
                    <td className="fc-items-cell">
                      {items.length === 0 ? <span className="mm-chip mm-chip--warn">Sin insumos</span> :
                        items.map((it) => `${num(it.qty) !== 1 ? num(it.qty) + "× " : ""}${it.fc_products?.name ?? "?"}`).join(", ")}
                    </td>
                    <td className="fc-r">{fmtUSD(cost)}</td>
                    <td className="fc-r">{fmtUSD(p.professional_fee)}</td>
                    <td className="fc-r">{num(p.margin_pct)}%</td>
                    <td className="fc-r mm-text-muted">{fmtUSD(procedureSuggested(p))}</td>
                    <td className="fc-r fc-strong">{fmtUSD(price)}</td>
                    <td className={`fc-r ${price - cost < 0 ? "fc-neg" : "fc-pos"}`}>{fmtUSD(price - cost)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="mm-icon-btn" title="Quitar" onClick={() => archive(p)}>🗑</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <PackageForm
          proc={editing}
          products={products}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </>
  );
}
