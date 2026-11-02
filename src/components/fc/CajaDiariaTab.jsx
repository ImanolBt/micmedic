import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  fmtUSD, num, round2, todayISO, shiftDate, fmtDateLong, typeInfo,
  procedureCost, procedurePrice, ProductOptions, loadSettings,
} from "./fcUtils";

const PROC_SELECT = "*, fc_procedure_items(qty, fc_products(cost))";

export function summarizeDay(cash, procs = [], prods = []) {
  const consultIncome = num(cash?.consult_count) * num(cash?.consult_price);
  const reserve = Math.min(num(cash?.consult_count) * num(cash?.reserve_per_consult), consultIncome);
  const procIncome = procs.reduce((s, r) => s + num(r.qty) * num(r.unit_price), 0);
  const procCost = procs.reduce((s, r) => s + num(r.qty) * num(r.unit_cost), 0);
  const by = (t) => prods.filter((r) => r.type === t);
  const inc = (l) => l.reduce((s, r) => s + num(r.qty) * num(r.unit_price), 0);
  const cst = (l) => l.reduce((s, r) => s + num(r.qty) * num(r.unit_cost), 0);
  const med = by("MEDICAMENTO"), hid = by("HIDRATACION"), ins = by("INSUMO");
  const prodIncome = inc(prods);
  const repMed = cst(med), repHid = cst(hid), repIns = cst(ins);
  const total = consultIncome + procIncome + prodIncome;
  const toSave = reserve + repMed + repHid + repIns + procCost;
  return {
    consultIncome, reserve, procIncome, procCost, prodIncome,
    medIncome: inc(med), hidIncome: inc(hid), insIncome: inc(ins),
    repMed, repHid, repIns, total, toSave, profit: total - toSave,
    costs: repMed + repHid + repIns + procCost,
  };
}

export default function CajaDiariaTab() {
  const [date, setDate] = useState(todayISO());
  const [cash, setCash] = useState(null);
  const [consult, setConsult] = useState({ consult_count: 0, consult_price: 0, reserve_per_consult: 0 });
  const [dProcs, setDProcs] = useState([]);
  const [dProds, setDProds] = useState([]);
  const [catalogProcs, setCatalogProcs] = useState([]);
  const [catalogProds, setCatalogProds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  const [pickProc, setPickProc] = useState(""); const [procQty, setProcQty] = useState(1);
  const [pickProd, setPickProd] = useState(""); const [prodQty, setProdQty] = useState(1);

  useEffect(() => {
    Promise.all([
      supabase.from("fc_procedures").select(PROC_SELECT).eq("active", true).order("name"),
      supabase.from("fc_products").select("*").eq("active", true).order("name"),
    ]).then(([a, b]) => { setCatalogProcs(a.data ?? []); setCatalogProds(b.data ?? []); });
  }, []);

  const loadDay = async (d) => {
    setLoading(true); setError("");
    const { data, error } = await supabase.from("fc_daily_cash").select("*").eq("date", d).maybeSingle();
    if (error) { setError(error.message); setLoading(false); return; }
    setCash(data);
    if (data) {
      setConsult({ consult_count: data.consult_count, consult_price: data.consult_price, reserve_per_consult: data.reserve_per_consult });
      const [p1, p2] = await Promise.all([
        supabase.from("fc_daily_procedures").select("*").eq("cash_id", data.id).order("created_at"),
        supabase.from("fc_daily_products").select("*").eq("cash_id", data.id).order("created_at"),
      ]);
      setDProcs(p1.data ?? []); setDProds(p2.data ?? []);
    } else {
      const s = await loadSettings();
      setConsult({ consult_count: 0, consult_price: s.consult_price, reserve_per_consult: s.reserve_per_consult });
      setDProcs([]); setDProds([]);
    }
    setLoading(false);
  };
  useEffect(() => { loadDay(date); }, [date]);

  const ensureCash = async () => {
    if (cash) return cash;
    const { data, error } = await supabase.from("fc_daily_cash").insert({
      date,
      consult_count: Math.round(num(consult.consult_count)),
      consult_price: round2(num(consult.consult_price)),
      reserve_per_consult: round2(num(consult.reserve_per_consult)),
    }).select().single();
    if (error) { setError(error.message); return null; }
    setCash(data);
    return data;
  };

  const flash = (m) => { setSavedMsg(m); setTimeout(() => setSavedMsg(""), 1800); };

  const saveConsult = async () => {
    const row = {
      consult_count: Math.round(num(consult.consult_count)),
      consult_price: round2(num(consult.consult_price)),
      reserve_per_consult: round2(num(consult.reserve_per_consult)),
    };
    if (!cash) { if (row.consult_count === 0) return; await ensureCash(); flash("Consultas guardadas"); return; }
    const { error } = await supabase.from("fc_daily_cash").update(row).eq("id", cash.id);
    if (error) setError(error.message); else flash("Consultas guardadas");
  };

  const addProc = async () => {
    const p = catalogProcs.find((x) => x.id === pickProc);
    if (!p) return;
    const c = await ensureCash(); if (!c) return;
    const { data, error } = await supabase.from("fc_daily_procedures").insert({
      cash_id: c.id, procedure_id: p.id, name: p.name, qty: num(procQty) || 1,
      unit_cost: round2(procedureCost(p)), unit_price: round2(procedurePrice(p)),
    }).select().single();
    if (error) return setError(error.message);
    setDProcs((l) => [...l, data]); setPickProc(""); setProcQty(1);
  };

  const addProd = async () => {
    const p = catalogProds.find((x) => x.id === pickProd);
    if (!p) return;
    const c = await ensureCash(); if (!c) return;
    const { data, error } = await supabase.from("fc_daily_products").insert({
      cash_id: c.id, product_id: p.id, name: p.name, type: p.type, qty: num(prodQty) || 1,
      unit_cost: num(p.cost), unit_price: num(p.price),
    }).select().single();
    if (error) return setError(error.message);
    setDProds((l) => [...l, data]); setPickProd(""); setProdQty(1);
  };

  const updateLine = async (table, setter, id, field, value) => {
    setter((l) => l.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };
  const persistLine = async (table, row, field) => {
    const v = field === "note" ? row[field] : num(row[field]);
    const { error } = await supabase.from(table).update({ [field]: v }).eq("id", row.id);
    if (error) setError(error.message);
  };
  const removeLine = async (table, setter, id) => {
    await supabase.from(table).delete().eq("id", id);
    setter((l) => l.filter((r) => r.id !== id));
  };

  const sum = useMemo(() => summarizeDay(consult, dProcs, dProds), [consult, dProcs, dProds]);
  const isToday = date === todayISO();

  return (
    <>
      {/* Selector de fecha */}
      <div className="fc-toolbar">
        <div className="fc-datebar">
          <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={() => setDate(shiftDate(date, -1))}>‹</button>
          <input className="mm-input" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={() => setDate(shiftDate(date, 1))}>›</button>
          {!isToday && <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={() => setDate(todayISO())}>Hoy</button>}
        </div>
        <div className="fc-date-label">
          {isToday && <span className="mm-chip mm-chip--green" style={{ marginRight: 8 }}>HOY</span>}
          {fmtDateLong(date)}
          {savedMsg && <span className="fc-saved">✓ {savedMsg}</span>}
        </div>
      </div>

      {error && <div className="mm-alert mm-alert--error" style={{ marginBottom: 12 }}>⚠️ {error}</div>}

      {loading ? <div className="mm-card fc-loading">Cargando caja…</div> : (
        <div className="fc-caja-grid">
          <div className="fc-caja-main">
            {/* 1. CONSULTAS */}
            <div className="mm-card">
              <div className="fc-sec-head"><span className="fc-sec-num">1</span><div><div className="mm-card-title">Consultas del día</div><div className="mm-card-sub">Se separa una reserva por consulta para sostener el consultorio</div></div></div>
              <div className="mm-row-3">
                <div className="mm-field">
                  <label className="mm-label">N° de consultas</label>
                  <input className="mm-input" type="number" min="0" value={consult.consult_count}
                    onChange={(e) => setConsult({ ...consult, consult_count: e.target.value })} onBlur={saveConsult} />
                </div>
                <div className="mm-field">
                  <label className="mm-label">Precio por consulta ($)</label>
                  <input className="mm-input" type="number" step="0.01" min="0" value={consult.consult_price}
                    onChange={(e) => setConsult({ ...consult, consult_price: e.target.value })} onBlur={saveConsult} />
                </div>
                <div className="mm-field">
                  <label className="mm-label">Reserva sostenimiento / consulta ($)</label>
                  <input className="mm-input" type="number" step="0.01" min="0" value={consult.reserve_per_consult}
                    onChange={(e) => setConsult({ ...consult, reserve_per_consult: e.target.value })} onBlur={saveConsult} />
                </div>
              </div>
              <div className="fc-preview" style={{ marginTop: 14 }}>
                <div><span>Ingreso por consultas</span><b>{fmtUSD(sum.consultIncome)}</b></div>
                <div><span>Reserva sostenimiento</span><b className="fc-warn">{fmtUSD(sum.reserve)}</b></div>
                <div><span>Disponible de consultas</span><b className="fc-pos">{fmtUSD(sum.consultIncome - sum.reserve)}</b></div>
              </div>
            </div>

            {/* 2. PROCEDIMIENTOS */}
            <div className="mm-card" style={{ padding: 0 }}>
              <div style={{ padding: "18px 20px 12px" }}>
                <div className="fc-sec-head"><span className="fc-sec-num">2</span><div><div className="mm-card-title">Procedimientos del día</div><div className="mm-card-sub">Desde los Paquetes de procedimientos</div></div></div>
                <div className="fc-add-row">
                  <select className="mm-input" value={pickProc} onChange={(e) => setPickProc(e.target.value)}>
                    <option value="">— Elegir procedimiento —</option>
                    {catalogProcs.map((p) => <option key={p.id} value={p.id}>{p.name} — {fmtUSD(procedurePrice(p))}</option>)}
                  </select>
                  <input className="mm-input fc-qty" type="number" min="1" value={procQty} onChange={(e) => setProcQty(e.target.value)} />
                  <button className="mm-btn" onClick={addProc} disabled={!pickProc}>+ Agregar</button>
                </div>
              </div>
              <div className="mm-table-wrap">
                <table className="mm-table">
                  <thead><tr><th>Procedimiento</th><th className="fc-r">Cant.</th><th className="fc-r">Costo base</th><th className="fc-r">Precio</th><th className="fc-r">Total cobrado</th><th className="fc-r">Reposición</th><th className="fc-r">Ganancia</th><th>Nota</th><th></th></tr></thead>
                  <tbody>
                    {dProcs.length === 0 ? <tr><td colSpan={9} className="fc-loading">Sin procedimientos registrados</td></tr> :
                      dProcs.map((r) => {
                        const t = num(r.qty) * num(r.unit_price), c = num(r.qty) * num(r.unit_cost);
                        return (
                          <tr key={r.id}>
                            <td style={{ fontWeight: 600 }}>{r.name}</td>
                            <td className="fc-r"><input className="mm-input fc-qty" type="number" min="0" value={r.qty} onChange={(e) => updateLine("fc_daily_procedures", setDProcs, r.id, "qty", e.target.value)} onBlur={() => persistLine("fc_daily_procedures", r, "qty")} /></td>
                            <td className="fc-r">{fmtUSD(r.unit_cost)}</td>
                            <td className="fc-r"><input className="mm-input fc-price" type="number" step="0.01" min="0" value={r.unit_price} onChange={(e) => updateLine("fc_daily_procedures", setDProcs, r.id, "unit_price", e.target.value)} onBlur={() => persistLine("fc_daily_procedures", r, "unit_price")} /></td>
                            <td className="fc-r fc-strong">{fmtUSD(t)}</td>
                            <td className="fc-r fc-warn">{fmtUSD(c)}</td>
                            <td className={`fc-r ${t - c < 0 ? "fc-neg" : "fc-pos"}`}>{fmtUSD(t - c)}</td>
                            <td><input className="mm-input fc-note" value={r.note ?? ""} placeholder="—" onChange={(e) => updateLine("fc_daily_procedures", setDProcs, r.id, "note", e.target.value)} onBlur={() => persistLine("fc_daily_procedures", r, "note")} /></td>
                            <td><button className="mm-icon-btn" onClick={() => removeLine("fc_daily_procedures", setDProcs, r.id)}>✕</button></td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. PRODUCTOS */}
            <div className="mm-card" style={{ padding: 0 }}>
              <div style={{ padding: "18px 20px 12px" }}>
                <div className="fc-sec-head"><span className="fc-sec-num">3</span><div><div className="mm-card-title">Productos del día</div><div className="mm-card-sub">Desde la Lista Original — medicamentos, hidratación e insumos</div></div></div>
                <div className="fc-add-row">
                  <select className="mm-input" value={pickProd} onChange={(e) => setPickProd(e.target.value)}>
                    <option value="">— Elegir producto —</option>
                    <ProductOptions products={catalogProds} />
                  </select>
                  <input className="mm-input fc-qty" type="number" min="1" value={prodQty} onChange={(e) => setProdQty(e.target.value)} />
                  <button className="mm-btn" onClick={addProd} disabled={!pickProd}>+ Agregar</button>
                </div>
              </div>
              <div className="mm-table-wrap">
                <table className="mm-table">
                  <thead><tr><th>Producto</th><th>Tipo</th><th className="fc-r">Cant.</th><th className="fc-r">Costo unit.</th><th className="fc-r">Precio venta</th><th className="fc-r">Total cobrado</th><th className="fc-r">Guardar reposición</th><th className="fc-r">Ganancia</th><th></th></tr></thead>
                  <tbody>
                    {dProds.length === 0 ? <tr><td colSpan={9} className="fc-loading">Sin productos registrados</td></tr> :
                      dProds.map((r) => {
                        const t = num(r.qty) * num(r.unit_price), c = num(r.qty) * num(r.unit_cost);
                        const ti = typeInfo(r.type);
                        return (
                          <tr key={r.id}>
                            <td style={{ fontWeight: 600 }}>{r.name}</td>
                            <td><span className={`mm-chip ${ti.chip}`}>{ti.label}</span></td>
                            <td className="fc-r"><input className="mm-input fc-qty" type="number" min="0" value={r.qty} onChange={(e) => updateLine("fc_daily_products", setDProds, r.id, "qty", e.target.value)} onBlur={() => persistLine("fc_daily_products", r, "qty")} /></td>
                            <td className="fc-r">{fmtUSD(r.unit_cost)}</td>
                            <td className="fc-r">{fmtUSD(r.unit_price)}</td>
                            <td className="fc-r fc-strong">{fmtUSD(t)}</td>
                            <td className="fc-r fc-warn">{fmtUSD(c)}</td>
                            <td className={`fc-r ${t - c < 0 ? "fc-neg" : "fc-pos"}`}>{fmtUSD(t - c)}</td>
                            <td><button className="mm-icon-btn" onClick={() => removeLine("fc_daily_products", setDProds, r.id)}>✕</button></td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* CIERRE DE CAJA */}
          <aside className="fc-cierre">
            <div className="fc-cierre-card">
              <div className="fc-cierre-title">🧾 Cierre de caja</div>
              <div className="fc-cierre-big">
                <span>Total cobrado</span>
                <b>{fmtUSD(sum.total)}</b>
              </div>
              <div className="fc-lines">
                <div><span>Consultas</span><b>{fmtUSD(sum.consultIncome)}</b></div>
                <div><span>Procedimientos</span><b>{fmtUSD(sum.procIncome)}</b></div>
                <div><span>Medicamentos e insumos</span><b>{fmtUSD(sum.prodIncome)}</b></div>
              </div>
              <div className="fc-cierre-sub">💼 Dinero a guardar</div>
              <div className="fc-lines">
                <div><span>Reserva sostenimiento</span><b>{fmtUSD(sum.reserve)}</b></div>
                <div><span>Reposición medicamentos</span><b>{fmtUSD(sum.repMed)}</b></div>
                <div><span>Reposición hidratación</span><b>{fmtUSD(sum.repHid)}</b></div>
                <div><span>Reposición insumos</span><b>{fmtUSD(sum.repIns)}</b></div>
                <div><span>Costo procedimientos</span><b>{fmtUSD(sum.procCost)}</b></div>
                <div className="fc-line-total"><span>Total a guardar</span><b>{fmtUSD(sum.toSave)}</b></div>
              </div>
              <div className={`fc-profit ${sum.profit < 0 ? "neg" : ""}`}>
                <span>Ganancia real del día</span>
                <b>{fmtUSD(sum.profit)}</b>
              </div>
              <div className="fc-cierre-note">Total cobrado ≠ ganancia: primero se separa reposición y sostenimiento.</div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
