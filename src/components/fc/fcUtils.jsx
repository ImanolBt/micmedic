import { supabase } from "../../lib/supabase";

export const fmtUSD = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n) || 0);

export const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const pct = (n) => (isFinite(n) && !isNaN(n) ? (n * 100).toFixed(1) + "%" : "—");

export const TYPES = [
  { id: "MEDICAMENTO", label: "Medicamento", chip: "mm-chip--blue",  prefix: "MED" },
  { id: "HIDRATACION", label: "Hidratación", chip: "mm-chip--green", prefix: "HID" },
  { id: "INSUMO",      label: "Insumo",      chip: "mm-chip--warn",  prefix: "INS" },
];
export const typeInfo = (id) => TYPES.find((t) => t.id === id) ?? { id, label: id, chip: "", prefix: "PRD" };

export const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export const shiftDate = (iso, days) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const fmtDateLong = (iso) =>
  new Date(iso + "T12:00:00").toLocaleDateString("es-EC", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

/* Siguiente código MED-001 / HID-001 / INS-001 */
export const nextCode = (products, type) => {
  const prefix = typeInfo(type).prefix;
  const max = products
    .filter((p) => p.code?.startsWith(prefix + "-"))
    .reduce((m, p) => Math.max(m, parseInt(p.code.split("-")[1]) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
};

/* Costo de un paquete calculado desde Lista Original */
export const procedureCost = (proc) =>
  (proc?.fc_procedure_items ?? []).reduce(
    (s, it) => s + num(it.qty) * num(it.fc_products?.cost), 0);

export const procedureSuggested = (proc) =>
  round2((procedureCost(proc) + num(proc?.professional_fee)) * (1 + num(proc?.margin_pct) / 100));

export const procedurePrice = (proc) =>
  proc?.price != null ? num(proc.price) : procedureSuggested(proc);

/* Configuración */
export const DEFAULT_SETTINGS = {
  consult_price: 0, reserve_per_consult: 0, patients_per_day: 0, days_worked: 22,
  variable_per_consult: 0, dist_salary: 50, dist_debt: 20, dist_savings: 15, dist_reinvest: 15,
};

export async function loadSettings() {
  const { data } = await supabase.from("fc_settings").select("*").maybeSingle();
  return { ...DEFAULT_SETTINGS, ...(data ?? {}) };
}

export async function saveSettings(patch) {
  const { data: { user } } = await supabase.auth.getUser();
  const current = await loadSettings();
  const row = { ...current, ...patch, user_id: user.id };
  const { error } = await supabase.from("fc_settings").upsert(row, { onConflict: "user_id" });
  return error;
}

/* Datos base tomados del archivo de la doctora (costos en 0 para completar) */
export const SEED_PRODUCTS = [
  ["MEDICAMENTO", "Ácido zoledrónico"], ["MEDICAMENTO", "Ceftriaxona"], ["MEDICAMENTO", "Ciprofloxacina"],
  ["MEDICAMENTO", "Dexametasona"], ["MEDICAMENTO", "Diclofenaco"], ["MEDICAMENTO", "Ketorolaco"],
  ["MEDICAMENTO", "Omeprazol"], ["MEDICAMENTO", "Tramadol"], ["MEDICAMENTO", "Venofer"],
  ["HIDRATACION", "Cloruro de sodio 1000 mL"], ["HIDRATACION", "Cloruro de sodio 500 mL"],
  ["HIDRATACION", "Cloruro de sodio 250 mL"], ["HIDRATACION", "Cloruro de sodio 100 mL"],
  ["INSUMO", "Bajalenguas"], ["INSUMO", "Vasocan"], ["INSUMO", "Equipo de venoclisis", 0.42],
  ["INSUMO", "Jeringuilla"], ["INSUMO", "Gasas"], ["INSUMO", "Sonda Foley"],
  ["INSUMO", "Mascarilla"], ["INSUMO", "Guantes"], ["INSUMO", "Hoja de bisturí"],
];

export const SEED_PROCEDURES = [
  ["Curación pequeña", ["Hoja de bisturí", "Jeringuilla", "Guantes", "Gasas"]],
  ["Curación mediana", []],
  ["Curación grande", []],
  ["PAP test", []],
  ["Retiro de puntos simple", []],
  ["Retiro de puntos complejo", []],
  ["Inyección intramuscular sin medicamento", ["Jeringuilla"]],
  ["Canalización + hidratación 250 mL", ["Cloruro de sodio 250 mL", "Vasocan", "Equipo de venoclisis", "Jeringuilla"]],
  ["Canalización + hidratación 500 mL", ["Cloruro de sodio 500 mL", "Vasocan", "Equipo de venoclisis", "Jeringuilla"]],
  ["Canalización + hidratación 1000 mL", ["Cloruro de sodio 1000 mL", "Vasocan", "Equipo de venoclisis", "Jeringuilla"]],
  ["Nebulización adulto", ["Mascarilla"]],
  ["Nebulización pediátrica", ["Mascarilla"]],
  ["Colocación de sonda Foley", ["Sonda Foley", "Guantes"]],
];

export const SEED_EXPENSES = [
  ["Arriendo", "MENSUAL"], ["Enfermera", "MENSUAL"], ["Luz", "MENSUAL"], ["Agua", "MENSUAL"],
  ["Internet", "MENSUAL"], ["Limpieza", "MENSUAL"],
  ["Manejo de desechos", "ANUAL"], ["Permiso de funcionamiento", "ANUAL"], ["Patente", "ANUAL"],
];

/* Opciones para el buscador (SearchPick) */
const TYPE_ORDER = { MEDICAMENTO: 0, HIDRATACION: 1, INSUMO: 2 };
export const TYPE_ICON = { MEDICAMENTO: "💊", HIDRATACION: "💧", INSUMO: "🧷", PROCEDIMIENTO: "🩹" };
export const GROUP_LABEL = { MEDICAMENTO: "Medicamentos", HIDRATACION: "Hidratación", INSUMO: "Insumos" };

export const productPickItems = (products, { showPrice = true } = {}) =>
  [...products]
    .sort((a, b) => (TYPE_ORDER[a.type] - TYPE_ORDER[b.type]) || a.name.localeCompare(b.name, "es"))
    .map((p) => ({
      id: p.id,
      label: p.name,
      keywords: `${p.code ?? ""} ${typeInfo(p.type).label}`,
      sub: `${p.code ?? ""} · costo ${fmtUSD(p.cost)}`,
      right: showPrice ? fmtUSD(p.price) : fmtUSD(p.cost),
      group: `${TYPE_ICON[p.type]} ${GROUP_LABEL[p.type] ?? p.type}`,
      kind: "product",
      data: p,
    }));

export const procedurePickItems = (procs) =>
  procs.map((p) => ({
    id: "proc-" + p.id,
    label: p.name,
    keywords: "procedimiento",
    sub: `${(p.fc_procedure_items ?? []).length} insumos · costo ${fmtUSD(procedureCost(p))}`,
    right: fmtUSD(procedurePrice(p)),
    group: "🩹 Procedimientos",
    kind: "procedure",
    data: p,
  }));

/* ¿El error es porque faltan las tablas? */
export const isMissingTable = (err) =>
  !!err && (err.code === "42P01" || err.code === "PGRST205" || err.code === "PGRST200" ||
    /does not exist|schema cache|Could not find the table/i.test(err.message ?? ""));

/* Resumen de un día de caja */
export function summarizeDay(cash, procs = [], prods = []) {
  const consultIncome = num(cash?.consult_count) * num(cash?.consult_price);
  const reserve = Math.min(num(cash?.consult_count) * num(cash?.reserve_per_consult), consultIncome);
  const line = (l, k) => l.reduce((s, r) => s + num(r.qty) * num(r[k]), 0);
  procs = procs ?? []; prods = prods ?? [];
  const by = (t) => prods.filter((r) => r.type === t);
  const med = by("MEDICAMENTO"), hid = by("HIDRATACION"), ins = by("INSUMO");
  const procIncome = line(procs, "unit_price"), procCost = line(procs, "unit_cost");
  const prodIncome = line(prods, "unit_price");
  const repMed = line(med, "unit_cost"), repHid = line(hid, "unit_cost"), repIns = line(ins, "unit_cost");
  const total = consultIncome + procIncome + prodIncome;
  const costs = repMed + repHid + repIns + procCost;
  const toSave = reserve + costs;
  return {
    consultIncome, reserve, procIncome, procCost, prodIncome,
    medIncome: line(med, "unit_price"), hidIncome: line(hid, "unit_price"), insIncome: line(ins, "unit_price"),
    repMed, repHid, repIns, total, costs, toSave, profit: total - toSave,
  };
}
