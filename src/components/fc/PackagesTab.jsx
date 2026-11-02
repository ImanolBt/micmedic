import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  fmtUSD, num, round2, procedureCost, procedureSuggested, procedurePrice,
  SEED_PROCEDURES, TYPE_ICON, productPickItems,
} from "./fcUtils";
import { SearchPick, Stepper, norm, useUI } from "../ui/kit";

const PROC_SELECT = "*, fc_procedure_items(id, qty, product_id, fc_products(id, name, type, cost, price))";
const MARGINS = [0, 10, 20, 30, 50];

function PackageForm({ proc, products, onClose, onSaved }) {
  const { toast } = useUI();
  const isNew = !proc?.id;
  const [form, setForm] = useState({
    name: proc?.name ?? "",
    professional_fee: proc?.professional_fee ?? 0,
    margin_pct: proc?.margin_pct ?? 0,
    price: proc?.price ?? "",
    notes: proc?.notes ?? "",
  });
  const [auto, setAuto] = useState(proc?.price == null);
  const [items, setItems] = useState((proc?.fc_procedure_items ?? []).map((it) => ({ product_id: it.product_id, qty: it.qty })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const cost = items.reduce((s, it) => s + num(it.qty) * num(byId[it.product_id]?.cost), 0);
  const suggested = round2((cost + num(form.professional_fee)) * (1 + num(form.margin_pct) / 100));
  const finalPrice = auto ? suggested : num(form.price);
  const profit = finalPrice - cost;
  const pickItems = useMemo(() => productPickItems(products, { showPrice: false }), [products]);

  const addItem = (it) => setItems((list) => {
    const ex = list.find((i) => i.product_id === it.id);
    if (ex) return list.map((i) => (i.product_id === it.id ? { ...i, qty: num(i.qty) + 1 } : i));
    return [...list, { product_id: it.id, qty: 1 }];
  });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError("Escribe el nombre del procedimiento.");
    setSaving(true); setError("");
    const row = {
      name: form.name.trim(),
      professional_fee: round2(num(form.professional_fee)),
      margin_pct: num(form.margin_pct),
      price: auto ? null : round2(num(form.price)),
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
    const valid = items.filter((it) => num(it.qty) > 0);
    if (valid.length) {
      const { error } = await supabase.from("fc_procedure_items").insert(valid.map((it) => ({ procedure_id: id, product_id: it.product_id, qty: num(it.qty) })));
      if (error) { setSaving(false); return setError(error.message); }
    }
    setSaving(false);
    toast(isNew ? `Paquete “${row.name}” creado` : `Paquete “${row.name}” actualizado`);
    onSaved();
  };

  return (
    <div className="mm-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mm-modal mm-modal--wide">
        <div className="mm-modal-head">
          <span className="mm-modal-title">{isNew ? "Nuevo paquete de procedimiento" : "Editar paquete"}</span>
          <button onClick={onClose} className="mm-icon-btn" aria-label="Cerrar">✕</button>
        </div>
        <form onSubmit={submit} className="mm-modal-body pk-form">
          <div className="mm-field">
            <label className="mm-label" htmlFor="pk-name">Nombre del procedimiento</label>
            <input id="pk-name" className="mm-input" autoFocus={isNew} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Curación pequeña" />
          </div>

          <div className="pk-cols">
            <div className="pk-col">
              <div className="pk-step"><span>1</span>¿Qué insumos usas?</div>
              <SearchPick items={pickItems} onPick={addItem} placeholder="Busca y agrega insumos o medicamentos" emptyText="No está en la Lista Original" />
              <div className="pk-items">
                {items.length === 0 ? (
                  <div className="pk-items-empty">Agrega los insumos de este procedimiento. Su costo se toma de la Lista Original.</div>
                ) : items.map((it) => {
                  const p = byId[it.product_id];
                  return (
                    <div key={it.product_id} className="pk-item">
                      <span className="pk-item-ico">{TYPE_ICON[p?.type] ?? "•"}</span>
                      <div className="pk-item-main">
                        <div className="pk-item-name">{p?.name ?? "Producto que ya no está en la lista"}</div>
                        <div className="fc-sub">{fmtUSD(p?.cost)} c/u{num(p?.cost) <= 0 && <span className="fc-warn"> · sin costo cargado</span>}</div>
                      </div>
                      <Stepper value={it.qty} min={0} step={1} onChange={(v) => setItems((l) => l.map((x) => (x.product_id === it.product_id ? { ...x, qty: v } : x)))} label={p?.name} />
                      <b className="pk-item-sub">{fmtUSD(num(it.qty) * num(p?.cost))}</b>
                      <button type="button" className="cj-remove" aria-label="Quitar insumo" onClick={() => setItems((l) => l.filter((x) => x.product_id !== it.product_id))}>✕</button>
                    </div>
                  );
                })}
              </div>
              <div className="pk-cost-total"><span>Costo de insumos</span><b>{fmtUSD(cost)}</b></div>
            </div>

            <div className="pk-col">
              <div className="pk-step"><span>2</span>¿Cuánto cobras?</div>
              <div className="mm-row-2">
                <div className="mm-field">
                  <label className="mm-label">Honorario profesional</label>
                  <div className="cj-money"><i>$</i><input inputMode="decimal" value={form.professional_fee} onChange={(e) => setForm({ ...form, professional_fee: e.target.value.replace(",", ".") })} /></div>
                </div>
                <div className="mm-field">
                  <label className="mm-label">Margen extra</label>
                  <div className="cj-money"><input inputMode="decimal" value={form.margin_pct} onChange={(e) => setForm({ ...form, margin_pct: e.target.value.replace(",", ".") })} /><i>%</i></div>
                </div>
              </div>
              <div className="fc-quick">
                {MARGINS.map((m) => <button type="button" key={m} className={`fc-pill ${num(form.margin_pct) === m ? "active" : ""}`} onClick={() => setForm({ ...form, margin_pct: m })}>{m}%</button>)}
              </div>

              <div className="pk-price-mode">
                <button type="button" className={auto ? "active" : ""} onClick={() => setAuto(true)}>
                  <b>Precio automático</b><span>{fmtUSD(suggested)} · cambia si sube un insumo</span>
                </button>
                <button type="button" className={!auto ? "active" : ""} onClick={() => { setAuto(false); if (form.price === "" || form.price == null) setForm((f) => ({ ...f, price: suggested })); }}>
                  <b>Precio fijo</b><span>Tú decides el valor</span>
                </button>
              </div>
              {!auto && (
                <div className="mm-field">
                  <label className="mm-label">Precio a cobrar</label>
                  <div className="cj-money cj-money--lg cj-money--accent"><i>$</i><input inputMode="decimal" value={form.price ?? ""} onChange={(e) => setForm({ ...form, price: e.target.value.replace(",", ".") })} /></div>
                  {num(form.price) < suggested && <span className="mm-hint fc-warn">Está por debajo del precio mínimo sugerido ({fmtUSD(suggested)}).</span>}
                </div>
              )}

              <div className="pk-result">
                <div><span>Insumos</span><b>{fmtUSD(cost)}</b></div>
                <div><span>Se cobra</span><b>{fmtUSD(finalPrice)}</b></div>
                <div className={profit < 0 ? "neg" : ""}><span>Ganancia</span><b>{fmtUSD(profit)}</b></div>
              </div>

              <div className="mm-field">
                <label className="mm-label">Notas (opcional)</label>
                <input className="mm-input" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ej: incluye material de curación" />
              </div>
            </div>
          </div>

          {error && <div className="mm-alert mm-alert--error">{error}</div>}
          <div className="mm-flex" style={{ justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} className="mm-btn mm-btn--ghost">Cancelar</button>
            <button type="submit" className="mm-btn" disabled={saving}>{saving ? "Guardando…" : isNew ? "Crear paquete" : "Guardar cambios"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PackagesTab() {
  const { toast, confirm } = useUI();
  const [procs, setProcs] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [q, setQ] = useState("");

  const load = async () => {
    const [a, b] = await Promise.all([
      supabase.from("fc_procedures").select(PROC_SELECT).eq("active", true).order("name"),
      supabase.from("fc_products").select("*").eq("active", true).order("name"),
    ]);
    if (a.error) toast(a.error.message, { kind: "error" });
    setProcs(a.data ?? []); setProducts(b.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => procs.filter((p) => norm(p.name).includes(norm(q))), [procs, q]);

  const archive = async (p) => {
    const ok = await confirm({ title: `¿Quitar el paquete “${p.name}”?`, message: "Ya no aparecerá en la caja. El historial se conserva.", confirmLabel: "Quitar paquete", danger: true });
    if (!ok) return;
    await supabase.from("fc_procedures").update({ active: false }).eq("id", p.id);
    setProcs((l) => l.filter((x) => x.id !== p.id));
    toast(`Se quitó “${p.name}”`, { kind: "info", action: { label: "Deshacer", onClick: async () => { await supabase.from("fc_procedures").update({ active: true }).eq("id", p.id); load(); } } });
  };

  const seed = async () => {
    setSeeding(true);
    const byName = Object.fromEntries(products.map((p) => [norm(p.name), p.id]));
    for (const [name, itemNames] of SEED_PROCEDURES) {
      const { data, error } = await supabase.from("fc_procedures").insert({ name }).select("id").single();
      if (error) { toast(error.message, { kind: "error" }); break; }
      const items = itemNames.map((n) => byName[norm(n)]).filter(Boolean).map((pid) => ({ procedure_id: data.id, product_id: pid, qty: 1 }));
      if (items.length) await supabase.from("fc_procedure_items").insert(items);
    }
    setSeeding(false);
    toast("Se cargaron los 13 procedimientos. Revisa los insumos de cada uno.");
    load();
  };

  return (
    <>
      <div className="fc-toolbar">
        <div className="fc-info">
          <span>💡</span>
          <span>El costo de cada paquete sale de la <b>Lista Original</b>. Si cambias el precio de un insumo, todos los paquetes que lo usan se actualizan solos.</span>
        </div>
        <div className="mm-flex fc-toolbar-right">
          <div className="pt-search fc-search"><span aria-hidden>⌕</span><input className="mm-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar procedimiento" /></div>
          <button className="mm-btn" onClick={() => setEditing({})}>+ Nuevo paquete</button>
        </div>
      </div>

      {loading ? <div className="pk-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="pk-card"><div className="ui-skel" style={{ width: "70%", height: 18 }} /><div className="ui-skel" style={{ width: "90%", marginTop: 14 }} /><div className="ui-skel" style={{ width: "50%", marginTop: 8 }} /></div>)}</div> :
        procs.length === 0 ? (
          <div className="mm-card">
            <div className="cj-empty">
              <div className="cj-empty-ico">🩹</div>
              <b>Todavía no hay paquetes</b>
              <span>Un paquete junta los insumos de un procedimiento (por ejemplo, curación pequeña) para saber cuánto cuesta y cuánto cobrar.</span>
              {products.length === 0 && <span className="fc-warn">Primero carga la Lista Original para que los insumos se enlacen solos.</span>}
              <div className="mm-flex" style={{ justifyContent: "center" }}>
                <button className="mm-btn" onClick={seed} disabled={seeding}>{seeding ? "Cargando…" : "Cargar los 13 procedimientos del consultorio"}</button>
                <button className="mm-btn mm-btn--ghost" onClick={() => setEditing({})}>Crear uno nuevo</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="pk-grid">
            {filtered.map((p) => {
              const cost = procedureCost(p), price = procedurePrice(p), gain = price - cost;
              const items = p.fc_procedure_items ?? [];
              const noCost = items.some((it) => num(it.fc_products?.cost) <= 0);
              return (
                <article key={p.id} className="pk-card" onClick={() => setEditing(p)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setEditing(p)}>
                  <div className="pk-card-top">
                    <h3>{p.name}</h3>
                    <button className="mm-icon-btn pk-del" aria-label={`Quitar ${p.name}`} onClick={(e) => { e.stopPropagation(); archive(p); }}>🗑</button>
                  </div>
                  <div className="pk-tags">
                    {items.length === 0 ? <span className="mm-chip mm-chip--warn">Sin insumos — tócalo para agregar</span> :
                      <>
                        {items.slice(0, 4).map((it) => <span key={it.id} className="pk-tag">{num(it.qty) !== 1 && <b>{num(it.qty)}×</b>}{it.fc_products?.name ?? "?"}</span>)}
                        {items.length > 4 && <span className="pk-tag pk-tag--more">+{items.length - 4} más</span>}
                      </>}
                  </div>
                  <div className="pk-card-badges">
                    {p.price == null ? <span className="mm-chip mm-chip--green">Precio automático</span> : <span className="mm-chip">Precio fijo</span>}
                    {noCost && <span className="mm-chip mm-chip--warn">Hay insumos sin costo</span>}
                    {price > 0 && price < procedureSuggested(p) && p.price != null && <span className="mm-chip mm-chip--red">Bajo el mínimo</span>}
                  </div>
                  <div className="pk-card-nums">
                    <div><span>Costo</span><b>{fmtUSD(cost)}</b></div>
                    <div><span>Se cobra</span><b className="pk-price">{fmtUSD(price)}</b></div>
                    <div><span>Ganancia</span><b className={gain < 0 ? "fc-neg" : "fc-pos"}>{fmtUSD(gain)}</b></div>
                  </div>
                </article>
              );
            })}
            <button className="pk-card pk-card--new" onClick={() => setEditing({})}>
              <span>+</span>Nuevo paquete
            </button>
          </div>
        )}

      {editing && <PackageForm proc={editing} products={products} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </>
  );
}
