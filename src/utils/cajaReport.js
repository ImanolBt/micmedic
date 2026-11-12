import jsPDF from "jspdf";
import { supabase } from "../lib/supabase";
import { summarizeDay, num, typeInfo } from "../components/fc/fcUtils";

/* ─── Estilo ─────────────────────────────────────────────────── */
const C = {
  brand: [111, 168, 50], dark: [61, 96, 27], light: [238, 245, 228], text: [26, 32, 16],
  text2: [74, 86, 64], muted: [138, 152, 130], border: [220, 226, 212], zebra: [249, 250, 247],
  warn: [196, 112, 20], red: [200, 45, 60], blue: [41, 128, 185], hero: [27, 44, 12],
};
const W = 210, H = 297, M = 14, CW = W - M * 2;

const money = (n) => { const v = Number(n) || 0; return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
const pctTxt = (a, b) => (b > 0 ? ((a / b) * 100).toFixed(1) + "%" : "-");
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const dayLabel = (iso, opts = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) =>
  cap(new Date(iso + "T12:00:00").toLocaleDateString("es-EC", opts));
const lastDay = (y, m) => new Date(y, m, 0).getDate();

export const PERIODS = { dia: "Diario", mes: "Mensual", anio: "Anual" };
export const TYPES = { dinero: "Dinero", control: "Control de actividad", completo: "Completo" };

/* ─── Rango del período ──────────────────────────────────────── */
export function periodRange(period, value) {
  if (period === "dia") return { from: value, to: value, label: dayLabel(value), file: value };
  if (period === "mes") {
    const [y, m] = value.split("-").map(Number);
    return { from: `${value}-01`, to: `${value}-${String(lastDay(y, m)).padStart(2, "0")}`, label: `${cap(MONTHS[m - 1])} ${y}`, file: value, months: 1 };
  }
  return { from: `${value}-01-01`, to: `${value}-12-31`, label: `Año ${value}`, file: value, months: 12 };
}

/* ─── Datos ──────────────────────────────────────────────────── */
async function loadData(range) {
  const [cash, exp] = await Promise.all([
    supabase.from("fc_daily_cash")
      .select("*, fc_daily_procedures(name, qty, unit_cost, unit_price, note, created_at), fc_daily_products(name, type, qty, unit_cost, unit_price, created_at)")
      .gte("date", range.from).lte("date", range.to).order("date"),
    supabase.from("fc_expenses").select("name, period, amount"),
  ]);
  if (cash.error) throw new Error(cash.error.message);
  return { days: cash.data ?? [], expenses: exp.data ?? [] };
}

function aggregate(days) {
  const t = { consults: 0, consultIncome: 0, reserve: 0, procIncome: 0, procCost: 0, prodIncome: 0, medIncome: 0, hidIncome: 0, insIncome: 0, repMed: 0, repHid: 0, repIns: 0, total: 0, costs: 0, toSave: 0, profit: 0, procQty: 0, prodQty: 0 };
  const procs = {}, prods = {}, perDay = [], log = [];
  days.forEach((d) => {
    const P = d.fc_daily_procedures ?? [], R = d.fc_daily_products ?? [];
    const s = summarizeDay(d, P, R);
    Object.keys(s).forEach((k) => { if (k in t) t[k] += s[k]; });
    t.consults += num(d.consult_count);
    const pq = P.reduce((a, r) => a + num(r.qty), 0), rq = R.reduce((a, r) => a + num(r.qty), 0);
    t.procQty += pq; t.prodQty += rq;
    perDay.push({ date: d.date, consults: num(d.consult_count), procQty: pq, prodQty: rq, ...s });
    P.forEach((r) => {
      const a = (procs[r.name] ??= { name: r.name, qty: 0, total: 0, cost: 0 });
      a.qty += num(r.qty); a.total += num(r.qty) * num(r.unit_price); a.cost += num(r.qty) * num(r.unit_cost);
      log.push({ at: r.created_at, kind: "Procedimiento", name: r.name + (r.note ? ` (${r.note})` : ""), qty: num(r.qty), total: num(r.qty) * num(r.unit_price), cost: num(r.qty) * num(r.unit_cost) });
    });
    R.forEach((r) => {
      const a = (prods[r.name] ??= { name: r.name, type: r.type, qty: 0, total: 0, cost: 0 });
      a.qty += num(r.qty); a.total += num(r.qty) * num(r.unit_price); a.cost += num(r.qty) * num(r.unit_cost);
      log.push({ at: r.created_at, kind: typeInfo(r.type).label, name: r.name, qty: num(r.qty), total: num(r.qty) * num(r.unit_price), cost: num(r.qty) * num(r.unit_cost) });
    });
  });
  const ORDER = { MEDICAMENTO: 0, HIDRATACION: 1, INSUMO: 2 };
  return {
    t, perDay,
    procs: Object.values(procs).sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, "es")),
    prods: Object.values(prods).sort((a, b) => (ORDER[a.type] - ORDER[b.type]) || b.qty - a.qty || a.name.localeCompare(b.name, "es")),
    log: log.sort((a, b) => String(a.at).localeCompare(String(b.at))),
  };
}

function groupByMonth(perDay) {
  const map = {};
  perDay.forEach((d) => {
    const k = d.date.slice(0, 7);
    const a = (map[k] ??= { key: k, days: 0, consults: 0, procQty: 0, prodQty: 0, consultIncome: 0, procIncome: 0, prodIncome: 0, total: 0, toSave: 0, profit: 0 });
    a.days++;
    ["consults", "procQty", "prodQty", "consultIncome", "procIncome", "prodIncome", "total", "toSave", "profit"].forEach((f) => (a[f] += d[f]));
  });
  return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
}

/* ─── Utilidades de dibujo ───────────────────────────────────── */
async function loadLogo() {
  try {
    const blob = await fetch("/logo-top.png").then((r) => { if (!r.ok) throw 0; return r.blob(); });
    const url = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
    const im = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
    if (!im) return null;
    // Reducir y pasar a JPEG sobre blanco: el PDF pasa de ~2 MB a pocos KB
    const w = 520, h = Math.round((im.naturalHeight / im.naturalWidth) * w);
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(im, 0, 0, w, h);
    return { url: cv.toDataURL("image/jpeg", 0.9), w, h, fmt: "JPEG" };
  } catch { return null; }
}

function makePdf(logo, meta) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ctx = { doc, y: 0 };

  const header = (first) => {
    if (first) {
      if (logo) { const h = 16, w = (logo.w / logo.h) * h; doc.addImage(logo.url, logo.fmt ?? "PNG", M, 12, w, h); }
      else { doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...C.text); doc.text("MicMEDIC", M, 22); }
      doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...C.text);
      doc.text(meta.title, W - M, 18, { align: "right" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...C.text2);
      doc.text(meta.period, W - M, 24, { align: "right" });
      doc.setFontSize(8); doc.setTextColor(...C.muted);
      doc.text(`Generado el ${meta.generated}`, W - M, 29, { align: "right" });
      doc.setDrawColor(...C.brand); doc.setLineWidth(0.8); doc.line(M, 34, W - M, 34);
      ctx.y = 42;
    } else {
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...C.text2);
      doc.text(`MicMEDIC - ${meta.title}`, M, 12);
      doc.setFont("helvetica", "normal"); doc.text(meta.period, W - M, 12, { align: "right" });
      doc.setDrawColor(...C.border); doc.setLineWidth(0.3); doc.line(M, 15, W - M, 15);
      ctx.y = 22;
    }
  };

  ctx.ensure = (h) => { if (ctx.y + h > H - 18) { doc.addPage(); header(false); return true; } return false; };

  ctx.section = (title, sub) => {
    ctx.ensure(46);
    ctx.y += 3;
    doc.setFillColor(...C.brand); doc.rect(M, ctx.y - 4, 1.4, 6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...C.text);
    doc.text(title, M + 4, ctx.y + 0.5);
    if (sub) { doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...C.muted); doc.text(sub, M + 4, ctx.y + 5.5); ctx.y += 5; }
    ctx.y += 7;
  };

  ctx.part = (title) => {
    ctx.ensure(30);
    doc.setFillColor(...C.hero); doc.roundedRect(M, ctx.y, CW, 11, 2, 2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
    doc.text(title, M + 5, ctx.y + 7.2);
    ctx.y += 17;
  };

  /* Tarjetas de indicadores: [{label, value, tone}] */
  ctx.kpis = (items, cols = items.length) => {
    const gap = 3, w = (CW - gap * (cols - 1)) / cols, h = 19;
    for (let i = 0; i < items.length; i += cols) {
      ctx.ensure(h + 4);
      items.slice(i, i + cols).forEach((k, j) => {
        const x = M + j * (w + gap);
        const hero = k.tone === "hero";
        doc.setFillColor(...(hero ? C.light : C.zebra)); doc.setDrawColor(...(hero ? C.brand : C.border)); doc.setLineWidth(hero ? 0.5 : 0.25);
        doc.roundedRect(x, ctx.y, w, h, 2, 2, "FD");
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...C.muted);
        doc.text(k.label.toUpperCase(), x + 4, ctx.y + 6);
        doc.setFont("helvetica", "bold"); doc.setFontSize(13.5);
        doc.setTextColor(...(k.tone === "neg" ? C.red : hero ? C.dark : k.tone === "warn" ? C.warn : C.text));
        doc.text(String(k.value), x + 4, ctx.y + 14.5);
      });
      ctx.y += h + 4;
    }
    ctx.y += 2;
  };

  /* Tabla: cols [{label, w (fracción), align}], rows [[...]], opts {total:[...], empty} */
  ctx.table = (cols, rows, opts = {}) => {
    const rowH = 7, headH = 8;
    const widths = cols.map((c) => c.w * CW);
    const drawHead = () => {
      doc.setFillColor(...C.light); doc.rect(M, ctx.y, CW, headH, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...C.dark);
      let x = M;
      cols.forEach((c, i) => {
        const tx = c.align === "right" ? x + widths[i] - 2.5 : x + 2.5;
        doc.text(c.label.toUpperCase(), tx, ctx.y + 5.3, { align: c.align === "right" ? "right" : "left" });
        x += widths[i];
      });
      ctx.y += headH;
    };
    ctx.ensure(headH + rowH * Math.min(3, Math.max(rows.length, 1)) + 2);
    drawHead();
    if (!rows.length) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(...C.muted);
      doc.text(opts.empty ?? "Sin registros en este período.", M + 2.5, ctx.y + 5);
      ctx.y += rowH + 4; return;
    }
    const drawRow = (r, idx, bold) => {
      if (ctx.ensure(rowH)) drawHead();
      if (bold) { doc.setFillColor(...C.light); doc.rect(M, ctx.y, CW, rowH, "F"); }
      else if (idx % 2 === 1) { doc.setFillColor(...C.zebra); doc.rect(M, ctx.y, CW, rowH, "F"); }
      doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(8.5);
      let x = M;
      r.forEach((cell, i) => {
        const c = cols[i];
        const txt = doc.splitTextToSize(String(cell ?? ""), widths[i] - 4)[0] ?? "";
        doc.setTextColor(...(c.color?.(cell, r) ?? C.text));
        doc.text(txt, c.align === "right" ? x + widths[i] - 2.5 : x + 2.5, ctx.y + 4.8, { align: c.align === "right" ? "right" : "left" });
        x += widths[i];
      });
      doc.setDrawColor(...C.border); doc.setLineWidth(0.15); doc.line(M, ctx.y + rowH, W - M, ctx.y + rowH);
      ctx.y += rowH;
    };
    rows.forEach((r, i) => drawRow(r, i, false));
    if (opts.total) drawRow(opts.total, 0, true);
    ctx.y += 6;
  };

  ctx.note = (text) => {
    const lines = doc.splitTextToSize(text, CW - 8);
    const h = lines.length * 4.2 + 6;
    ctx.ensure(h + 2);
    doc.setFillColor(255, 248, 238); doc.setDrawColor(246, 220, 191); doc.setLineWidth(0.3);
    doc.roundedRect(M, ctx.y, CW, h, 2, 2, "FD");
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...C.text2);
    doc.text(lines, M + 4, ctx.y + 5.2);
    ctx.y += h + 5;
  };

  ctx.finish = () => {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setDrawColor(...C.border); doc.setLineWidth(0.3); doc.line(M, H - 12, W - M, H - 12);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...C.muted);
      doc.text("MicMEDIC - Consultorio médico - Documento de uso interno", M, H - 7.5);
      doc.text(`Página ${i} de ${n}`, W - M, H - 7.5, { align: "right" });
    }
  };

  header(true);
  return ctx;
}

/* ─── Secciones ──────────────────────────────────────────────── */
function moneySection(ctx, A, range, period, fixed) {
  const { t } = A;
  const net = t.total - t.costs - fixed;
  ctx.kpis([
    { label: "Total cobrado", value: money(t.total) },
    { label: "Para reponer", value: money(t.costs), tone: "warn" },
    { label: "Para el consultorio", value: money(t.reserve), tone: "warn" },
    { label: "Ganancia real", value: money(t.profit), tone: t.profit < 0 ? "neg" : "hero" },
  ]);
  if (period !== "dia") {
    ctx.kpis([
      { label: "Gastos fijos del período", value: money(fixed) },
      { label: "Utilidad neta", value: money(net), tone: net < 0 ? "neg" : "hero" },
      { label: "Margen neto", value: pctTxt(net, t.total) },
    ], 3);
  }

  ctx.section("Ingresos por fuente");
  ctx.table(
    [{ label: "Concepto", w: 0.55 }, { label: "Monto", w: 0.25, align: "right" }, { label: "% del total", w: 0.2, align: "right" }],
    [
      [`Consultas (${t.consults})`, money(t.consultIncome), pctTxt(t.consultIncome, t.total)],
      ["Procedimientos", money(t.procIncome), pctTxt(t.procIncome, t.total)],
      ["Medicamentos", money(t.medIncome), pctTxt(t.medIncome, t.total)],
      ["Hidratación", money(t.hidIncome), pctTxt(t.hidIncome, t.total)],
      ["Insumos", money(t.insIncome), pctTxt(t.insIncome, t.total)],
    ],
    { total: ["Total cobrado", money(t.total), t.total > 0 ? "100%" : "-"] }
  );

  ctx.section("Dinero que no es ganancia", "Lo que hay que guardar para reponer y sostener el consultorio");
  ctx.table(
    [{ label: "Concepto", w: 0.7 }, { label: "Monto", w: 0.3, align: "right" }],
    [
      ["Separado para el consultorio (sostenimiento)", money(t.reserve)],
      ["Reposición de medicamentos", money(t.repMed)],
      ["Reposición de hidratación", money(t.repHid)],
      ["Reposición de insumos", money(t.repIns)],
      ["Insumos usados en procedimientos", money(t.procCost)],
    ],
    { total: ["Total a guardar", money(t.toSave)] }
  );

  const gain = (v) => (String(v).startsWith("-") ? C.red : C.dark);
  if (period === "mes") {
    ctx.section("Detalle por día");
    ctx.table(
      [{ label: "Fecha", w: 0.22 }, { label: "Consultas", w: 0.13, align: "right" }, { label: "Procedim.", w: 0.13, align: "right" }, { label: "Productos", w: 0.13, align: "right" }, { label: "Total", w: 0.13, align: "right" }, { label: "A guardar", w: 0.13, align: "right" }, { label: "Ganancia", w: 0.13, align: "right", color: gain }],
      A.perDay.map((d) => [dayLabel(d.date, { weekday: "short", day: "2-digit", month: "short" }), money(d.consultIncome), money(d.procIncome), money(d.prodIncome), money(d.total), money(d.toSave), money(d.profit)]),
      { total: ["Total", money(t.consultIncome), money(t.procIncome), money(t.prodIncome), money(t.total), money(t.toSave), money(t.profit)], empty: "No hay días con caja registrada en este mes." }
    );
  }
  if (period === "anio") {
    ctx.section("Detalle por mes");
    ctx.table(
      [{ label: "Mes", w: 0.19 }, { label: "Días", w: 0.08, align: "right" }, { label: "Consultas", w: 0.13, align: "right" }, { label: "Procedim.", w: 0.12, align: "right" }, { label: "Productos", w: 0.12, align: "right" }, { label: "Total", w: 0.12, align: "right" }, { label: "A guardar", w: 0.12, align: "right" }, { label: "Ganancia", w: 0.12, align: "right", color: gain }],
      groupByMonth(A.perDay).map((m) => [cap(MONTHS[Number(m.key.slice(5)) - 1]), m.days, money(m.consultIncome), money(m.procIncome), money(m.prodIncome), money(m.total), money(m.toSave), money(m.profit)]),
      { total: ["Total", A.perDay.length, money(t.consultIncome), money(t.procIncome), money(t.prodIncome), money(t.total), money(t.toSave), money(t.profit)], empty: "No hay meses con caja registrada en este año." }
    );
  }
}

function controlSection(ctx, A, period, withMoney) {
  const { t } = A;
  const k = [
    { label: "Consultas", value: t.consults },
    { label: "Procedimientos", value: t.procQty },
    { label: "Productos entregados", value: t.prodQty },
  ];
  if (period !== "dia") k.push({ label: "Días con caja", value: A.perDay.length });
  ctx.kpis(k);

  ctx.section("Procedimientos realizados");
  ctx.table(
    withMoney
      ? [{ label: "Procedimiento", w: 0.46 }, { label: "Cantidad", w: 0.12, align: "right" }, { label: "Cobrado", w: 0.14, align: "right" }, { label: "Insumos", w: 0.14, align: "right" }, { label: "Ganancia", w: 0.14, align: "right" }]
      : [{ label: "Procedimiento", w: 0.8 }, { label: "Cantidad", w: 0.2, align: "right" }],
    A.procs.map((p) => withMoney ? [p.name, p.qty, money(p.total), money(p.cost), money(p.total - p.cost)] : [p.name, p.qty]),
    {
      total: withMoney ? ["Total", t.procQty, money(t.procIncome), money(t.procCost), money(t.procIncome - t.procCost)] : ["Total", t.procQty],
      empty: "No se registraron procedimientos.",
    }
  );

  ctx.section("Medicamentos, hidratación e insumos", "Útil para saber qué reponer");
  ctx.table(
    withMoney
      ? [{ label: "Producto", w: 0.36 }, { label: "Tipo", w: 0.15 }, { label: "Cantidad", w: 0.1, align: "right" }, { label: "Cobrado", w: 0.13, align: "right" }, { label: "Para reponer", w: 0.13, align: "right" }, { label: "Ganancia", w: 0.13, align: "right" }]
      : [{ label: "Producto", w: 0.5 }, { label: "Tipo", w: 0.2 }, { label: "Cantidad", w: 0.12, align: "right" }, { label: "Para reponer", w: 0.18, align: "right" }],
    A.prods.map((p) => withMoney
      ? [p.name, typeInfo(p.type).label, p.qty, money(p.total), money(p.cost), money(p.total - p.cost)]
      : [p.name, typeInfo(p.type).label, p.qty, money(p.cost)]),
    {
      total: withMoney ? ["Total", "", t.prodQty, money(t.prodIncome), money(t.repMed + t.repHid + t.repIns), money(t.prodIncome - t.repMed - t.repHid - t.repIns)]
        : ["Total", "", t.prodQty, money(t.repMed + t.repHid + t.repIns)],
      empty: "No se registraron medicamentos ni insumos.",
    }
  );

  if (period === "dia") {
    ctx.section("Registro del día", "En el orden en que se registró");
    ctx.table(
      withMoney
        ? [{ label: "Hora", w: 0.11 }, { label: "Tipo", w: 0.17 }, { label: "Detalle", w: 0.42 }, { label: "Cant.", w: 0.1, align: "right" }, { label: "Cobrado", w: 0.2, align: "right" }]
        : [{ label: "Hora", w: 0.12 }, { label: "Tipo", w: 0.2 }, { label: "Detalle", w: 0.53 }, { label: "Cantidad", w: 0.15, align: "right" }],
      A.log.map((l) => {
        const h = l.at ? new Date(l.at).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
        return withMoney ? [h, l.kind, l.name, l.qty, money(l.total)] : [h, l.kind, l.name, l.qty];
      }),
      { empty: "No hay movimientos registrados este día." }
    );
  } else {
    const rows = period === "mes"
      ? A.perDay.map((d) => [dayLabel(d.date, { weekday: "short", day: "2-digit", month: "short" }), d.consults, d.procQty, d.prodQty])
      : groupByMonth(A.perDay).map((m) => [cap(MONTHS[Number(m.key.slice(5)) - 1]) + ` (${m.days} días)`, m.consults, m.procQty, m.prodQty]);
    ctx.section(period === "mes" ? "Actividad por día" : "Actividad por mes");
    ctx.table(
      [{ label: period === "mes" ? "Fecha" : "Mes", w: 0.4 }, { label: "Consultas", w: 0.2, align: "right" }, { label: "Procedimientos", w: 0.2, align: "right" }, { label: "Productos", w: 0.2, align: "right" }],
      rows,
      { total: ["Total", t.consults, t.procQty, t.prodQty], empty: "Sin actividad registrada en este período." }
    );
  }
}

/* ─── Punto de entrada ───────────────────────────────────────── */
export async function downloadCajaReport({ period, value, type }) {
  const range = periodRange(period, value);
  const [{ days, expenses }, logo] = await Promise.all([loadData(range), loadLogo()]);
  const A = aggregate(days);
  const monthlyFixed = expenses.reduce((s, e) => s + (e.period === "ANUAL" ? num(e.amount) / 12 : num(e.amount)), 0);
  // Año: gastos fijos solo de los meses que tienen caja registrada (no de meses sin usar el sistema)
  const monthsWithData = new Set(days.map((d) => d.date.slice(0, 7))).size;
  const fixedMonths = period === "mes" ? 1 : period === "anio" ? monthsWithData : 0;
  const fixed = monthlyFixed * fixedMonths;

  const title = `Reporte ${PERIODS[period].toLowerCase()} de caja`;
  const ctx = makePdf(logo, {
    title,
    period: `${range.label} - ${TYPES[type]}`,
    generated: new Date().toLocaleString("es-EC", { dateStyle: "long", timeStyle: "short" }),
  });

  if (!days.length) ctx.note("No hay movimientos de caja registrados en este período. Los valores aparecen cuando se registra algo en Caja diaria.");

  if (type === "dinero") moneySection(ctx, A, range, period, fixed);
  if (type === "control") controlSection(ctx, A, period, false);
  if (type === "completo") {
    ctx.part("1. Resumen de dinero");
    moneySection(ctx, A, range, period, fixed);
    ctx.part("2. Control de actividad");
    controlSection(ctx, A, period, true);
  }
  if (type !== "control" && period !== "dia" && fixed > 0) {
    ctx.note(`Gastos fijos: ${money(monthlyFixed)} al mes (los anuales se dividen para 12)${period === "anio" ? ` x ${fixedMonths} ${fixedMonths === 1 ? "mes" : "meses"} con caja registrada` : ""}. Utilidad neta = total cobrado - reposición - gastos fijos.`);
  }

  ctx.finish();
  const name = `Caja_${PERIODS[period]}_${TYPES[type].split(" ")[0]}_${range.file}.pdf`;
  ctx.doc.save(name);
  return name;
}
