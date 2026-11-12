import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtUSD, num, round2, pct, loadSettings, saveSettings, SEED_EXPENSES, DEFAULT_SETTINGS } from "./fcUtils";
import { summarizeDay } from "./fcUtils";
import { useUI } from "../ui/kit";
import ReportModal from "./ReportModal";

const monthNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (m) =>
  new Date(m + "-15T12:00:00").toLocaleDateString("es-EC", { month: "long", year: "numeric" });
const lastDay = (m) => {
  const [y, mo] = m.split("-").map(Number);
  return `${m}-${String(new Date(y, mo, 0).getDate()).padStart(2, "0")}`;
};

const DIST = [
  { key: "dist_salary",   label: "Sueldo personal", color: "#6fa832" },
  { key: "dist_debt",     label: "Pago de deudas",  color: "#e67e22" },
  { key: "dist_savings",  label: "Ahorro",          color: "#2980b9" },
  { key: "dist_reinvest", label: "Reinversión",     color: "#8e44ad" },
];

const shiftMonth = (m, n) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function BalanceTab() {
  const { toast, confirm } = useUI();
  const [month, setMonth] = useState(monthNow());
  const [days, setDays] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newExp, setNewExp] = useState({ name: "", period: "MENSUAL", amount: "" });
  const flash = (m) => toast(m, { duration: 1600 });
  const [showReport, setShowReport] = useState(false);

  const loadMonth = async (m) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("fc_daily_cash")
      .select("*, fc_daily_procedures(qty, unit_cost, unit_price), fc_daily_products(type, qty, unit_cost, unit_price)")
      .gte("date", `${m}-01`).lte("date", lastDay(m)).order("date");
    if (error) setError(error.message);
    setDays((data ?? []).map((d) => ({ date: d.date, ...summarizeDay(d, d.fc_daily_procedures, d.fc_daily_products), consults: d.consult_count })));
    setLoading(false);
  };
  const loadExpenses = async () => {
    const { data } = await supabase.from("fc_expenses").select("*").order("period").order("created_at");
    setExpenses(data ?? []);
  };

  useEffect(() => { loadMonth(month); }, [month]);
  useEffect(() => { loadExpenses(); loadSettings().then(setSettings); }, []);

  const fixedMonthly = expenses.reduce((s, e) => s + (e.period === "ANUAL" ? num(e.amount) / 12 : num(e.amount)), 0);

  const t = useMemo(() => {
    const s = (k) => days.reduce((a, d) => a + num(d[k]), 0);
    const income = s("total"), costs = s("costs");
    const net = income - costs - fixedMonthly;
    return {
      income, costs, net,
      consult: s("consultIncome"), proc: s("procIncome"), prod: s("prodIncome"),
      reserve: s("reserve"), consults: s("consults"), dailyProfit: s("profit"),
      margin: income > 0 ? net / income : NaN,
    };
  }, [days, fixedMonthly]);

  /* Proyección / punto de equilibrio */
  const proj = useMemo(() => {
    const ppm = num(settings.patients_per_day) * num(settings.days_worked);
    const income = ppm * num(settings.consult_price);
    const variable = ppm * num(settings.variable_per_consult);
    const total = fixedMonthly + variable;
    const util = income - total;
    const unitMargin = num(settings.consult_price) - num(settings.variable_per_consult);
    return {
      ppm, income, variable, total, util,
      margin: income > 0 ? util / income : NaN,
      breakeven: unitMargin > 0 ? Math.ceil(fixedMonthly / unitMargin) : NaN,
      suggestedReserve: ppm > 0 ? round2(fixedMonthly / ppm) : 0,
    };
  }, [settings, fixedMonthly]);

  const setS = (k) => (e) => setSettings((s) => ({ ...s, [k]: e.target.value }));
  const persistSettings = async () => {
    const patch = Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map((k) => [k, num(settings[k])]));
    const err = await saveSettings(patch);
    if (err) setError(err.message); else flash("Configuración guardada");
  };

  const addExpense = async () => {
    if (!newExp.name.trim()) return;
    const { error } = await supabase.from("fc_expenses").insert({ name: newExp.name.trim(), period: newExp.period, amount: round2(num(newExp.amount)) });
    if (error) return setError(error.message);
    setNewExp({ name: "", period: "MENSUAL", amount: "" });
    loadExpenses();
  };
  const updateExpense = async (e) => {
    await supabase.from("fc_expenses").update({ amount: round2(num(e.amount)) }).eq("id", e.id);
    flash("Gasto actualizado");
  };
  const removeExpense = async (id) => {
    const e = expenses.find((x) => x.id === id);
    const ok = await confirm({ title: `¿Eliminar el gasto “${e?.name}”?`, message: "Dejará de contarse en los gastos fijos de todos los meses.", confirmLabel: "Eliminar gasto", danger: true });
    if (!ok) return;
    await supabase.from("fc_expenses").delete().eq("id", id);
    loadExpenses();
  };
  const seedExpenses = async () => {
    await supabase.from("fc_expenses").insert(SEED_EXPENSES.map(([name, period]) => ({ name, period, amount: 0 })));
    loadExpenses();
  };

  const distTotal = DIST.reduce((s, d) => s + num(settings[d.key]), 0);
  const maxDay = Math.max(1, ...days.map((d) => d.total));

  return (
    <>
      <div className="fc-toolbar">
        <div className="cj-daynav">
          <button className="cj-arrow" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mes anterior">‹</button>
          <label className="cj-date">
            <span className="cj-date-text" style={{ textTransform: "capitalize" }}>{month === monthNow() && <span className="cj-today">Este mes</span>}{monthLabel(month)}</span>
            <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Elegir mes" />
          </label>
          <button className="cj-arrow" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Mes siguiente">›</button>
          {month !== monthNow() && <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={() => setMonth(monthNow())}>Volver a este mes</button>}
        </div>
        <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={() => setShowReport(true)}>⬇ Descargar PDF</button>
        {showReport && <ReportModal initialDate={`${month}-01`} initialPeriod="mes" onClose={() => setShowReport(false)} />}
      </div>

      {error && <div className="mm-alert mm-alert--error" style={{ marginBottom: 12 }}>⚠️ {error}</div>}

      <div className="mm-kpi-grid" style={{ marginBottom: 16 }}>
        {[
          { icon: "💰", label: "Ingresos del mes", value: fmtUSD(t.income), badge: `${days.length} ${days.length === 1 ? "día" : "días"} con caja` },
          { icon: "📦", label: "Para reponer", value: fmtUSD(t.costs), badge: "Lo que cuesta volver a comprar" },
          { icon: "🏠", label: "Gastos fijos del mes", value: fmtUSD(fixedMonthly), badge: "Anuales divididos para 12" },
          { icon: t.net >= 0 ? "📈" : "📉", label: "Utilidad neta", value: fmtUSD(t.net), badge: `Margen neto ${pct(t.margin)}` },
        ].map((k, i) => (
          <div key={i} className="mm-kpi">
            <div className="mm-kpi-icon">{k.icon}</div>
            <div className="mm-kpi-label">{k.label}</div>
            <div className="mm-kpi-value" style={{ fontSize: 22 }}>{loading ? "…" : k.value}</div>
            <div className="mm-kpi-badge">● {k.badge}</div>
          </div>
        ))}
      </div>

      <div className="fc-split">
        <div className="mm-card">
          <div className="mm-card-title" style={{ marginBottom: 12 }}>¿De dónde vino el dinero?</div>
          {[
            { label: "Consultas", v: t.consult, extra: `${t.consults} consultas`, color: "#6fa832" },
            { label: "Procedimientos", v: t.proc, color: "#2980b9" },
            { label: "Medicamentos e insumos", v: t.prod, color: "#e67e22" },
          ].map((r) => (
            <div key={r.label} className="fc-barrow">
              <div className="fc-barrow-top"><span>{r.label} {r.extra && <span className="mm-text-muted">· {r.extra}</span>}</span><b>{fmtUSD(r.v)}</b></div>
              <div className="fc-bar"><div style={{ width: `${t.income > 0 ? (r.v / t.income) * 100 : 0}%`, background: r.color }} /></div>
            </div>
          ))}
          <div className="fc-lines" style={{ marginTop: 14 }}>
            <div><span>Separado para el consultorio</span><b>{fmtUSD(t.reserve)}</b></div>
            <div><span>Gastos fijos a cubrir</span><b>{fmtUSD(fixedMonthly)}</b></div>
            <div className="fc-line-total">
              <span>{t.reserve >= fixedMonthly ? "✓ Lo separado alcanza para los gastos fijos" : "Falta separar para cubrir los gastos fijos"}</span>
              <b className={t.reserve >= fixedMonthly ? "fc-pos" : "fc-neg"}>{fmtUSD(t.reserve - fixedMonthly)}</b>
            </div>
          </div>
        </div>

        <div className="mm-card">
          <div className="mm-card-title" style={{ marginBottom: 4 }}>Distribución de la utilidad</div>
          <div className="mm-card-sub" style={{ marginBottom: 12 }}>Sobre la utilidad neta del mes ({fmtUSD(Math.max(t.net, 0))})</div>
          {DIST.map((d) => (
            <div key={d.key} className="fc-dist-row">
              <span className="fc-dot" style={{ background: d.color }} />
              <span className="fc-dist-label">{d.label}</span>
              <input className="mm-input fc-qty" type="number" min="0" max="100" value={settings[d.key]} onChange={setS(d.key)} onBlur={persistSettings} />
              <span className="mm-text-muted">%</span>
              <b className="fc-dist-val">{fmtUSD((Math.max(t.net, 0) * num(settings[d.key])) / 100)}</b>
            </div>
          ))}
          <div className="fc-stack">
            {DIST.map((d) => <div key={d.key} style={{ flex: num(settings[d.key]) || 0, background: d.color }} />)}
          </div>
          {distTotal !== 100 && <div className="mm-alert mm-alert--warn" style={{ marginTop: 10 }}>Los porcentajes suman {distTotal}%. Ajústalos para que sumen 100%.</div>}
        </div>
      </div>

      {/* Día a día */}
      <div className="mm-card" style={{ padding: 0, marginTop: 16 }}>
        <div className="mm-card-accent-bar" />
        <div style={{ padding: "16px 20px 8px" }} className="mm-card-title">Detalle día a día</div>
        <div className="mm-table-wrap">
          <table className="mm-table">
            <thead><tr><th>Fecha</th><th className="fc-r">Consultas</th><th className="fc-r">Procedimientos</th><th className="fc-r">Productos</th><th className="fc-r">Total cobrado</th><th className="fc-r">A guardar</th><th className="fc-r">Ganancia</th><th style={{ width: 140 }}></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="fc-loading">Cargando…</td></tr> :
                days.length === 0 ? <tr><td colSpan={8}><div className="mm-empty">No hay días con caja registrada en este mes. Los días aparecen aquí cuando registras algo en Caja diaria.</div></td></tr> :
                days.map((d) => (
                  <tr key={d.date}>
                    <td style={{ fontWeight: 600, textTransform: "capitalize" }}>{new Date(d.date + "T12:00:00").toLocaleDateString("es-EC", { weekday: "short", day: "2-digit", month: "short" })}</td>
                    <td className="fc-r">{fmtUSD(d.consultIncome)}</td>
                    <td className="fc-r">{fmtUSD(d.procIncome)}</td>
                    <td className="fc-r">{fmtUSD(d.prodIncome)}</td>
                    <td className="fc-r fc-strong">{fmtUSD(d.total)}</td>
                    <td className="fc-r fc-warn">{fmtUSD(d.toSave)}</td>
                    <td className={`fc-r ${d.profit < 0 ? "fc-neg" : "fc-pos"}`}>{fmtUSD(d.profit)}</td>
                    <td><div className="fc-bar"><div style={{ width: `${(d.total / maxDay) * 100}%` }} /></div></td>
                  </tr>
                ))}
              {days.length > 0 && (
                <tr className="fc-total-row">
                  <td>Total</td>
                  <td className="fc-r">{fmtUSD(t.consult)}</td><td className="fc-r">{fmtUSD(t.proc)}</td><td className="fc-r">{fmtUSD(t.prod)}</td>
                  <td className="fc-r">{fmtUSD(t.income)}</td><td className="fc-r">{fmtUSD(t.costs + t.reserve)}</td><td className="fc-r">{fmtUSD(t.dailyProfit)}</td><td></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="fc-split" style={{ marginTop: 16 }}>
        {/* Gastos fijos */}
        <div className="mm-card">
          <div className="mm-card-title" style={{ marginBottom: 4 }}>Gastos fijos del consultorio</div>
          <div className="mm-card-sub" style={{ marginBottom: 12 }}>Los anuales se dividen para 12 automáticamente</div>
          {expenses.length === 0 && (
            <div className="mm-empty" style={{ padding: 16 }}>
              <button className="mm-btn mm-btn--sm" onClick={seedExpenses}>Cargar gastos base: arriendo, enfermera, luz, agua…</button>
            </div>
          )}
          {expenses.map((e) => (
            <div key={e.id} className="fc-exp-row">
              <span className="fc-dist-label">{e.name}</span>
              <span className={`mm-chip ${e.period === "ANUAL" ? "mm-chip--blue" : ""}`}>{e.period === "ANUAL" ? "Anual" : "Mensual"}</span>
              <input className="mm-input fc-price" type="number" step="0.01" min="0" value={e.amount}
                onChange={(ev) => setExpenses((l) => l.map((x) => (x.id === e.id ? { ...x, amount: ev.target.value } : x)))}
                onBlur={() => updateExpense(e)} />
              <button className="mm-icon-btn" onClick={() => removeExpense(e.id)}>✕</button>
            </div>
          ))}
          <div className="fc-add-row" style={{ marginTop: 12 }}>
            <input className="mm-input" placeholder="Nuevo gasto" value={newExp.name} onChange={(e) => setNewExp({ ...newExp, name: e.target.value })} />
            <select className="mm-input" style={{ maxWidth: 120 }} value={newExp.period} onChange={(e) => setNewExp({ ...newExp, period: e.target.value })}>
              <option value="MENSUAL">Mensual</option><option value="ANUAL">Anual</option>
            </select>
            <input className="mm-input fc-price" type="number" step="0.01" placeholder="$" value={newExp.amount} onChange={(e) => setNewExp({ ...newExp, amount: e.target.value })} />
            <button className="mm-btn" onClick={addExpense}>+</button>
          </div>
          <div className="fc-lines" style={{ marginTop: 12 }}>
            <div className="fc-line-total"><span>Gastos fijos mensualizados</span><b>{fmtUSD(fixedMonthly)}</b></div>
          </div>
        </div>

        {/* Proyección */}
        <div className="mm-card">
          <div className="mm-card-title" style={{ marginBottom: 4 }}>Proyección y punto de equilibrio</div>
          <div className="mm-card-sub" style={{ marginBottom: 12 }}>¿Cuántos pacientes necesitas al mes para no perder?</div>
          <div className="mm-row-2">
            <div className="mm-field"><label className="mm-label">Pacientes por día</label><input className="mm-input" type="number" min="0" value={settings.patients_per_day} onChange={setS("patients_per_day")} onBlur={persistSettings} /></div>
            <div className="mm-field"><label className="mm-label">Días trabajados al mes</label><input className="mm-input" type="number" min="0" value={settings.days_worked} onChange={setS("days_worked")} onBlur={persistSettings} /></div>
            <div className="mm-field"><label className="mm-label">Precio de consulta ($)</label><input className="mm-input" type="number" step="0.01" min="0" value={settings.consult_price} onChange={setS("consult_price")} onBlur={persistSettings} /></div>
            <div className="mm-field"><label className="mm-label">Gasto variable por consulta ($)</label><input className="mm-input" type="number" step="0.01" min="0" value={settings.variable_per_consult} onChange={setS("variable_per_consult")} onBlur={persistSettings} /></div>
          </div>
          <div className="fc-lines" style={{ marginTop: 12 }}>
            <div><span>Pacientes al mes</span><b>{proj.ppm}</b></div>
            <div><span>Ingresos por consultas</span><b>{fmtUSD(proj.income)}</b></div>
            <div><span>Gastos totales (fijos + variables)</span><b>{fmtUSD(proj.total)}</b></div>
            <div><span>Utilidad proyectada</span><b className={proj.util < 0 ? "fc-neg" : "fc-pos"}>{fmtUSD(proj.util)}</b></div>
            <div><span>Margen neto</span><b>{pct(proj.margin)}</b></div>
            <div className="fc-line-total"><span>Punto de equilibrio</span><b>{isNaN(proj.breakeven) ? "—" : `${proj.breakeven} pacientes/mes`}</b></div>
          </div>
          <div className="fc-reserve-box">
            <div>
              <div className="mm-label">Separar por consulta</div>
              <div className="mm-hint">Sugerida: {fmtUSD(proj.suggestedReserve)} (gastos fijos ÷ pacientes al mes)</div>
            </div>
            <div className="mm-flex">
              <input className="mm-input fc-price" type="number" step="0.01" min="0" value={settings.reserve_per_consult} onChange={setS("reserve_per_consult")} onBlur={persistSettings} />
              <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={async () => {
                const v = proj.suggestedReserve;
                setSettings((s) => ({ ...s, reserve_per_consult: v }));
                const err = await saveSettings({ reserve_per_consult: v });
                if (!err) flash("Reserva actualizada");
              }}>Usar sugerida</button>
            </div>
          </div>
          <div className="mm-hint" style={{ marginTop: 8 }}>El precio de consulta y lo que se separa por consulta se usan al abrir la caja de un día nuevo.</div>
        </div>
      </div>
    </>
  );
}
