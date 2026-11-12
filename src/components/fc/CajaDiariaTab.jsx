import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import {
  fmtUSD, num, round2, todayISO, shiftDate, fmtDateLong, typeInfo, TYPE_ICON,
  procedureCost, procedurePrice, loadSettings, summarizeDay, productPickItems, procedurePickItems,
} from "./fcUtils";
import { SearchPick, Stepper, useUI } from "../ui/kit";
import ReportModal from "./ReportModal";

export { summarizeDay };

const PROC_SELECT = "*, fc_procedure_items(qty, fc_products(cost))";
const TABLE = { procedure: "fc_daily_procedures", product: "fc_daily_products" };

export default function CajaDiariaTab() {
  const { toast } = useUI();
  const [date, setDate] = useState(todayISO());
  const [cash, setCash] = useState(null);
  const cashRef = useRef(null);
  const ensuring = useRef(null);
  const [consult, setConsult] = useState({ consult_count: 0, consult_price: 0, reserve_per_consult: 0 });
  const consultDirty = useRef(false);
  const [lines, setLines] = useState([]);
  const linesRef = useRef([]);
  linesRef.current = lines;
  const lineTimers = useRef({});
  const [procs, setProcs] = useState([]);
  const [prods, setProds] = useState([]);
  const [freq, setFreq] = useState([]);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState("idle");
  const [flashId, setFlashId] = useState(null);
  const searchRef = useRef(null);
  const [showReport, setShowReport] = useState(false);

  /* Catálogo + más usados */
  useEffect(() => {
    (async () => {
      const [a, b, fp, fr] = await Promise.all([
        supabase.from("fc_procedures").select(PROC_SELECT).eq("active", true).order("name"),
        supabase.from("fc_products").select("*").eq("active", true).order("name"),
        supabase.from("fc_daily_products").select("product_id").order("created_at", { ascending: false }).limit(300),
        supabase.from("fc_daily_procedures").select("procedure_id").order("created_at", { ascending: false }).limit(300),
      ]);
      const P = a.data ?? [], R = b.data ?? [];
      setProcs(P); setProds(R);
      const count = {};
      (fp.data ?? []).forEach((x) => x.product_id && (count[x.product_id] = (count[x.product_id] ?? 0) + 1));
      (fr.data ?? []).forEach((x) => x.procedure_id && (count["proc-" + x.procedure_id] = (count["proc-" + x.procedure_id] ?? 0) + 1));
      const all = [...procedurePickItems(P), ...productPickItems(R)];
      const top = all.filter((i) => count[i.id]).sort((x, y) => count[y.id] - count[x.id]).slice(0, 8);
      setFreq(top);
    })();
  }, []);

  /* Cargar el día */
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      cashRef.current = null; consultDirty.current = false;
      const { data } = await supabase.from("fc_daily_cash").select("*").eq("date", date).maybeSingle();
      if (!alive) return;
      setCash(data); cashRef.current = data;
      if (data) {
        setConsult({ consult_count: data.consult_count, consult_price: data.consult_price, reserve_per_consult: data.reserve_per_consult });
        const [p1, p2] = await Promise.all([
          supabase.from("fc_daily_procedures").select("*").eq("cash_id", data.id),
          supabase.from("fc_daily_products").select("*").eq("cash_id", data.id),
        ]);
        if (!alive) return;
        setLines([
          ...(p1.data ?? []).map((r) => ({ ...r, kind: "procedure" })),
          ...(p2.data ?? []).map((r) => ({ ...r, kind: "product" })),
        ].sort((x, y) => x.created_at.localeCompare(y.created_at)));
      } else {
        const s = await loadSettings();
        if (!alive) return;
        setConsult({ consult_count: 0, consult_price: s.consult_price, reserve_per_consult: s.reserve_per_consult });
        setLines([]);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [date]);

  const ensureCash = async () => {
    if (cashRef.current) return cashRef.current;
    if (!ensuring.current) {
      ensuring.current = (async () => {
        const { data, error } = await supabase.from("fc_daily_cash").insert({
          date,
          consult_count: Math.round(num(consult.consult_count)),
          consult_price: round2(num(consult.consult_price)),
          reserve_per_consult: round2(num(consult.reserve_per_consult)),
        }).select().single();
        if (error) { toast(`No se pudo abrir la caja del día: ${error.message}`, { kind: "error" }); return null; }
        cashRef.current = data; setCash(data);
        return data;
      })().finally(() => { ensuring.current = null; });
    }
    return ensuring.current;
  };

  const markSaving = () => setSaveState("saving");
  const markSaved = () => { setSaveState("saved"); setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 2000); };

  /* Consultas: guardado automático */
  useEffect(() => {
    if (!consultDirty.current) return;
    markSaving();
    const t = setTimeout(async () => {
      consultDirty.current = false;
      const row = {
        consult_count: Math.round(num(consult.consult_count)),
        consult_price: round2(num(consult.consult_price)),
        reserve_per_consult: round2(num(consult.reserve_per_consult)),
      };
      if (!cashRef.current) {
        if (row.consult_count === 0) { setSaveState("idle"); return; }
        if (await ensureCash()) markSaved();
        return;
      }
      const { error } = await supabase.from("fc_daily_cash").update(row).eq("id", cashRef.current.id);
      if (error) { setSaveState("idle"); toast(`No se guardaron las consultas: ${error.message}`, { kind: "error" }); }
      else markSaved();
    }, 700);
    return () => clearTimeout(t);
  }, [consult]);

  const editConsult = (patch) => { consultDirty.current = true; setConsult((c) => ({ ...c, ...patch })); };

  /* Agregar a la caja */
  const addItem = async (item, q = qty) => {
    const n = num(q) || 1;
    const c = await ensureCash(); if (!c) return;
    const isProc = item.kind === "procedure";
    const src = item.data;
    const unit_cost = round2(isProc ? procedureCost(src) : num(src.cost));
    const unit_price = round2(isProc ? procedurePrice(src) : num(src.price));
    const same = linesRef.current.find((r) => r.kind === item.kind &&
      (isProc ? r.procedure_id === src.id : r.product_id === src.id) && num(r.unit_price) === unit_price);
    markSaving();
    if (same) {
      const newQty = num(same.qty) + n;
      setLines((l) => l.map((r) => (r.id === same.id ? { ...r, qty: newQty } : r)));
      const { error } = await supabase.from(TABLE[item.kind]).update({ qty: newQty }).eq("id", same.id);
      if (error) return toast(error.message, { kind: "error" });
      setFlashId(same.id);
    } else {
      const row = isProc
        ? { cash_id: c.id, procedure_id: src.id, name: src.name, qty: n, unit_cost, unit_price }
        : { cash_id: c.id, product_id: src.id, name: src.name, type: src.type, qty: n, unit_cost, unit_price };
      const { data, error } = await supabase.from(TABLE[item.kind]).insert(row).select().single();
      if (error) { setSaveState("idle"); return toast(`No se pudo agregar: ${error.message}`, { kind: "error" }); }
      setLines((l) => [...l, { ...data, kind: item.kind }]);
      setFlashId(data.id);
    }
    markSaved();
    setQty(1);
    setTimeout(() => setFlashId(null), 1200);
  };

  /* Editar cantidad / precio de una línea (guardado automático) */
  const editLine = (row, patch) => {
    setLines((l) => l.map((r) => (r.id === row.id ? { ...r, ...patch } : r)));
    markSaving();
    clearTimeout(lineTimers.current[row.id]);
    lineTimers.current[row.id] = setTimeout(async () => {
      const cur = linesRef.current.find((r) => r.id === row.id);
      if (!cur) return;
      const { error } = await supabase.from(TABLE[cur.kind])
        .update({ qty: num(cur.qty), unit_price: round2(num(cur.unit_price)) }).eq("id", cur.id);
      if (error) toast(error.message, { kind: "error" }); else markSaved();
    }, 600);
  };

  const removeLine = async (row) => {
    clearTimeout(lineTimers.current[row.id]);
    setLines((l) => l.filter((r) => r.id !== row.id));
    await supabase.from(TABLE[row.kind]).delete().eq("id", row.id);
    toast(`Quitaste ${row.name}`, {
      kind: "info", duration: 6000,
      action: {
        label: "Deshacer",
        onClick: async () => {
          const { id, kind, created_at, ...rest } = row;
          const { data, error } = await supabase.from(TABLE[kind]).insert(rest).select().single();
          if (!error) setLines((l) => [...l, { ...data, kind }].sort((x, y) => x.created_at.localeCompare(y.created_at)));
        },
      },
    });
  };

  const pickItems = useMemo(() => [...procedurePickItems(procs), ...productPickItems(prods)], [procs, prods]);
  const sum = useMemo(() => summarizeDay(consult, lines.filter((l) => l.kind === "procedure"), lines.filter((l) => l.kind === "product")), [consult, lines]);
  const isToday = date === todayISO();

  const copySummary = async () => {
    const t = [
      `🧾 Caja — ${fmtDateLong(date)}`,
      `Total cobrado: ${fmtUSD(sum.total)}`,
      `• Consultas (${num(consult.consult_count)}): ${fmtUSD(sum.consultIncome)}`,
      `• Procedimientos: ${fmtUSD(sum.procIncome)}`,
      `• Medicamentos e insumos: ${fmtUSD(sum.prodIncome)}`,
      `Guardar: ${fmtUSD(sum.toSave)} (reposición ${fmtUSD(sum.costs)} + sostenimiento ${fmtUSD(sum.reserve)})`,
      `Ganancia real: ${fmtUSD(sum.profit)}`,
    ].join("\n");
    try { await navigator.clipboard.writeText(t); toast("Resumen copiado. Puedes pegarlo en WhatsApp."); }
    catch { toast("No se pudo copiar el resumen", { kind: "error" }); }
  };

  return (
    <>
      <div className="cj-daybar">
        <div className="cj-daynav">
          <button className="cj-arrow" onClick={() => setDate(shiftDate(date, -1))} aria-label="Día anterior">‹</button>
          <label className="cj-date">
            <span className="cj-date-text">{isToday && <span className="cj-today">Hoy</span>}{fmtDateLong(date)}</span>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Elegir fecha" />
          </label>
          <button className="cj-arrow" onClick={() => setDate(shiftDate(date, 1))} aria-label="Día siguiente">›</button>
          {!isToday && <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={() => setDate(todayISO())}>Volver a hoy</button>}
        </div>
        <div className="cj-daybar-right">
          <span className={`cj-save ${saveState}`}>
            {saveState === "saving" ? "Guardando…" : saveState === "saved" ? "✓ Guardado" : cash ? "Todo guardado" : "Caja sin movimientos"}
          </span>
          <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={() => setShowReport(true)}>⬇ Descargar PDF</button>
        </div>
      </div>
      {showReport && <ReportModal initialDate={date} onClose={() => setShowReport(false)} />}

      {loading ? <div className="mm-card fc-loading">Abriendo la caja…</div> : (
        <div className="fc-caja-grid">
          <div className="fc-caja-main">
            {/* Registrar */}
            <section className="cj-add">
              <div className="cj-add-head">
                <div>
                  <div className="cj-add-title">Registrar en la caja</div>
                  <div className="cj-add-sub">Busca un procedimiento, medicamento o insumo y presiona <kbd>Enter</kbd></div>
                </div>
              </div>
              <div className="cj-add-row">
                <SearchPick
                  inputRef={searchRef}
                  size="lg"
                  items={pickItems}
                  onPick={(it) => addItem(it)}
                  placeholder="Ej: curación, ketorolaco, guantes…"
                  emptyText={pickItems.length ? "No está en la lista. Agrégalo primero en Lista Original o Paquetes." : "Todavía no hay productos. Empieza por la pestaña Lista Original."}
                />
                <div className="cj-qty">
                  <span>Cantidad</span>
                  <Stepper value={qty} onChange={setQty} min={1} size="lg" />
                </div>
              </div>
              {freq.length > 0 && (
                <div className="cj-freq">
                  <span className="cj-freq-label">Más usados</span>
                  {freq.map((it) => (
                    <button key={it.id} className="cj-chip" onClick={() => addItem(it, 1)} title={`Agregar 1 · ${it.right}`}>
                      <span>{it.kind === "procedure" ? TYPE_ICON.PROCEDIMIENTO : TYPE_ICON[it.data.type]}</span>{it.label}
                      <b>{it.right}</b>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Consultas */}
            <section className="mm-card cj-consult">
              <div className="cj-sec-title"><span className="cj-ico">🩺</span>Consultas del día</div>
              <div className="cj-consult-grid">
                <div className="cj-field">
                  <span>N.º de consultas</span>
                  <Stepper value={consult.consult_count} onChange={(v) => editConsult({ consult_count: v })} min={0} size="lg" label="consultas" />
                </div>
                <div className="cj-field">
                  <span>Precio por consulta</span>
                  <div className="cj-money"><i>$</i><input inputMode="decimal" value={consult.consult_price} onChange={(e) => editConsult({ consult_price: e.target.value.replace(",", ".") })} /></div>
                </div>
                <div className="cj-field">
                  <span title="Parte de cada consulta que se separa para arriendo, luz, enfermera, etc.">Separar por consulta ⓘ</span>
                  <div className="cj-money"><i>$</i><input inputMode="decimal" value={consult.reserve_per_consult} onChange={(e) => editConsult({ reserve_per_consult: e.target.value.replace(",", ".") })} /></div>
                </div>
              </div>
              <div className="cj-consult-sum">
                <span>{num(consult.consult_count)} × {fmtUSD(consult.consult_price)} = <b>{fmtUSD(sum.consultIncome)}</b></span>
                <span>Separar para el consultorio: <b className="fc-warn">{fmtUSD(sum.reserve)}</b></span>
                <span>Queda: <b className="fc-pos">{fmtUSD(sum.consultIncome - sum.reserve)}</b></span>
              </div>
            </section>

            {/* Movimientos */}
            <section className="mm-card" style={{ padding: 0 }}>
              <div className="cj-list-head">
                <div className="cj-sec-title" style={{ margin: 0 }}><span className="cj-ico">📋</span>Movimientos del día</div>
                <span className="mm-text-muted mm-text-sm">{lines.length} {lines.length === 1 ? "registro" : "registros"}</span>
              </div>
              {lines.length === 0 ? (
                <div className="cj-empty">
                  <div className="cj-empty-ico">🧾</div>
                  <b>Aún no hay procedimientos ni productos hoy</b>
                  <span>Usa el buscador de arriba para registrar lo que se usó o vendió.</span>
                  <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={() => searchRef.current?.focus()}>Empezar a registrar</button>
                </div>
              ) : (
                <ul className="cj-lines">
                  {lines.map((r) => {
                    const total = num(r.qty) * num(r.unit_price), cost = num(r.qty) * num(r.unit_cost), gain = total - cost;
                    const icon = r.kind === "procedure" ? TYPE_ICON.PROCEDIMIENTO : TYPE_ICON[r.type];
                    const tag = r.kind === "procedure" ? "Procedimiento" : typeInfo(r.type).label;
                    return (
                      <li key={r.id} className={`cj-line ${flashId === r.id ? "flash" : ""}`}>
                        <div className={`cj-line-ico ${r.kind === "procedure" ? "proc" : (r.type ?? "").toLowerCase()}`}>{icon}</div>
                        <div className="cj-line-main">
                          <div className="cj-line-name">{r.name}</div>
                          <div className="cj-line-sub">
                            <span>{tag}</span>·
                            <label className="cj-inline-price">
                              <i>$</i>
                              <input inputMode="decimal" style={{ width: `${Math.max(3, String(r.unit_price ?? "").length + 1)}ch` }} value={r.unit_price} onChange={(e) => editLine(r, { unit_price: e.target.value.replace(",", ".") })} aria-label="Precio por unidad" />
                              <em>c/u</em>
                            </label>·
                            <span>costo {fmtUSD(r.unit_cost)}</span>
                            {r.note && <span className="cj-note">“{r.note}”</span>}
                          </div>
                        </div>
                        <Stepper value={r.qty} onChange={(v) => editLine(r, { qty: v })} min={0} label={r.name} />
                        <div className="cj-line-total">
                          <b>{fmtUSD(total)}</b>
                          <span className={gain < 0 ? "fc-neg" : "fc-pos"}>{gain < 0 ? "" : "+"}{fmtUSD(gain)} ganancia</span>
                        </div>
                        <button className="cj-remove" onClick={() => removeLine(r)} aria-label={`Quitar ${r.name}`} title="Quitar">✕</button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* Cierre de caja */}
          <aside className="fc-cierre">
            <div className="fc-cierre-card">
              <div className="fc-cierre-title">Cierre de caja</div>
              <div className="fc-cierre-big">
                <span>Total cobrado</span>
                <b>{fmtUSD(sum.total)}</b>
              </div>
              <div className="cj-split">
                {[
                  { label: "Consultas", v: sum.consultIncome, c: "var(--c-brand)" },
                  { label: "Procedimientos", v: sum.procIncome, c: "#2980b9" },
                  { label: "Productos", v: sum.prodIncome, c: "#e67e22" },
                ].map((x) => <div key={x.label} style={{ flex: x.v || 0, background: x.c }} title={`${x.label}: ${fmtUSD(x.v)}`} />)}
              </div>
              <div className="fc-lines">
                <div><span><i className="cj-dot" style={{ background: "var(--c-brand)" }} />Consultas</span><b>{fmtUSD(sum.consultIncome)}</b></div>
                <div><span><i className="cj-dot" style={{ background: "#2980b9" }} />Procedimientos</span><b>{fmtUSD(sum.procIncome)}</b></div>
                <div><span><i className="cj-dot" style={{ background: "#e67e22" }} />Medicamentos e insumos</span><b>{fmtUSD(sum.prodIncome)}</b></div>
              </div>

              <div className="fc-cierre-sub">Dinero que no es ganancia</div>
              <div className="fc-lines">
                <div><span>Para el consultorio</span><b>{fmtUSD(sum.reserve)}</b></div>
                <div><span>Reponer medicamentos</span><b>{fmtUSD(sum.repMed)}</b></div>
                <div><span>Reponer hidratación</span><b>{fmtUSD(sum.repHid)}</b></div>
                <div><span>Reponer insumos</span><b>{fmtUSD(sum.repIns)}</b></div>
                <div><span>Insumos de procedimientos</span><b>{fmtUSD(sum.procCost)}</b></div>
                <div className="fc-line-total"><span>Total a guardar</span><b>{fmtUSD(sum.toSave)}</b></div>
              </div>

              <div className={`fc-profit ${sum.profit < 0 ? "neg" : ""}`}>
                <span>Ganancia real del día</span>
                <b>{fmtUSD(sum.profit)}</b>
              </div>
              <button className="mm-btn mm-btn--ghost mm-btn--full" style={{ marginTop: 12 }} onClick={copySummary} disabled={sum.total === 0}>
                Copiar resumen para WhatsApp
              </button>
              <div className="fc-cierre-note">Lo cobrado no es todo ganancia: primero se separa lo que cuesta reponer y lo que necesita el consultorio. <Link to="/caja?tab=balance">Ver el mes</Link></div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
