import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { LiveDot, useAgo } from "../components/ui/kit";
import { fmtUSD, summarizeDay, todayISO } from "../components/fc/fcUtils";

const WATCH = ["patients", "medical_visits", "appointments", "prescriptions", "certificates", "fc_daily_cash", "fc_daily_products", "fc_daily_procedures"];
const DAYS = 14;

const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const localISO = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

const fmtTime = (iso) => new Date(iso).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", hour12: false });
const fmtWhen = (iso) => {
  const d = new Date(iso);
  const today = startOfDay();
  const diff = Math.round((startOfDay(d) - today) / 86400000);
  if (diff === 0) return `Hoy, ${fmtTime(iso)}`;
  if (diff === -1) return `Ayer, ${fmtTime(iso)}`;
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short" }) + `, ${fmtTime(iso)}`;
};

const STATUS = {
  scheduled: { label: "Pendiente", cls: "mm-chip--scheduled" },
  done:      { label: "Atendida",  cls: "mm-chip--done" },
  cancelled: { label: "Cancelada", cls: "mm-chip--cancelled" },
};

export default function Dashboard() {
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [live, setLive] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [pulse, setPulse] = useState(false);
  const timer = useRef(null);
  const ago = useAgo(updatedAt);

  const load = useCallback(async () => {
    const t0 = startOfDay(), t1 = endOfDay();
    const monthStart = new Date(t0.getFullYear(), t0.getMonth(), 1);
    const since = startOfDay(new Date(Date.now() - (DAYS - 1) * 86400000));
    const today = todayISO();

    const [pTotal, pMonth, vToday, vRange, appts, rx, certs, recent, cashToday, cashMonth, pRange, cRange] = await Promise.all([
      supabase.from("patients").select("id", { count: "exact", head: true }),
      supabase.from("patients").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()),
      supabase.from("medical_visits").select("id", { count: "exact", head: true }).gte("visit_date", t0.toISOString()).lte("visit_date", t1.toISOString()),
      supabase.from("medical_visits").select("visit_date, patient_id").gte("visit_date", since.toISOString()).limit(5000),
      supabase.from("appointments").select("id, patient_id, start_at, reason, status, patients(name, phone)").gte("start_at", t0.toISOString()).lte("start_at", t1.toISOString()).order("start_at"),
      supabase.from("prescriptions").select("id", { count: "exact", head: true }).gte("date", t0.toISOString()).lte("date", t1.toISOString()),
      supabase.from("certificates").select("id", { count: "exact", head: true }).gte("created_at", t0.toISOString()).lte("created_at", t1.toISOString()),
      supabase.from("medical_visits").select("id, patient_id, visit_date, reason, cie10_code, cie10_name").order("visit_date", { ascending: false }).limit(7),
      supabase.from("fc_daily_cash").select("*, fc_daily_procedures(qty, unit_cost, unit_price), fc_daily_products(type, qty, unit_cost, unit_price)").eq("date", today).maybeSingle(),
      supabase.from("fc_daily_cash").select("*, fc_daily_procedures(qty, unit_cost, unit_price), fc_daily_products(type, qty, unit_cost, unit_price)").gte("date", localISO(monthStart)).lte("date", today),
      supabase.from("patients").select("created_at").gte("created_at", since.toISOString()).limit(5000),
      supabase.from("certificates").select("patient_id, created_at").gte("created_at", since.toISOString()).limit(5000),
    ]);

    // Pacientes de las últimas consultas (en 2 pasos, igual que antes)
    const ids = [...new Set((recent.data ?? []).map((v) => v.patient_id).filter(Boolean))];
    let pmap = {};
    if (ids.length) {
      const pp = await supabase.from("patients").select("id, name, cedula").in("id", ids);
      pmap = Object.fromEntries((pp.data ?? []).map((x) => [x.id, x]));
    }

    // Consultas por día
    const buckets = Array.from({ length: DAYS }, (_, i) => {
      const day = new Date(since.getTime() + i * 86400000);
      return { key: localISO(day), day, n: 0, nuevos: 0, _att: new Set() };
    });
    const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
    // Atendidos = consultas registradas + pacientes con certificado ese día (sin repetir paciente)
    (vRange.data ?? []).forEach((v, i) => { const b = byKey[localISO(new Date(v.visit_date))]; if (b) b._att.add(v.patient_id ?? "v" + i); });
    (cRange.data ?? []).forEach((c, i) => { const b = byKey[localISO(new Date(c.created_at))]; if (b) b._att.add(c.patient_id ?? "c" + i); });
    (pRange.data ?? []).forEach((p) => { const b = byKey[localISO(new Date(p.created_at))]; if (b) b.nuevos++; });
    buckets.forEach((b) => { b.n = b._att.size; delete b._att; });

    const cashOk = !cashToday.error && !cashMonth.error;
    const todaySum = cashToday.data ? summarizeDay(cashToday.data, cashToday.data.fc_daily_procedures, cashToday.data.fc_daily_products) : summarizeDay({}, [], []);
    const monthSum = (cashMonth.data ?? []).reduce((acc, c) => {
      const s = summarizeDay(c, c.fc_daily_procedures, c.fc_daily_products);
      return { total: acc.total + s.total, profit: acc.profit + s.profit };
    }, { total: 0, profit: 0 });

    const ap = appts.data ?? [];
    setD({
      patients: pTotal.count ?? 0,
      patientsMonth: pMonth.count ?? 0,
      visitsToday: vToday.count ?? 0,
      rx: rx.error ? null : rx.count ?? 0,
      certs: certs.error ? null : certs.count ?? 0,
      appts: ap,
      apptsPending: ap.filter((a) => a.status === "scheduled").length,
      apptsDone: ap.filter((a) => a.status === "done").length,
      chart: buckets,
      recent: (recent.data ?? []).map((v) => ({ ...v, patient: pmap[v.patient_id] })),
      cashOk, todaySum, monthSum,
    });
    setUpdatedAt(new Date());
    setPulse(true); setTimeout(() => setPulse(false), 900);
  }, []);

  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(load, 500);
  }, [load]);

  useEffect(() => {
    load();
    // Tiempo real: cualquier cambio en estas tablas actualiza el panel
    let ch = supabase.channel("dashboard-live");
    WATCH.forEach((table) => { ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, schedule); });
    ch.subscribe((status) => setLive(status === "SUBSCRIBED"));
    // Respaldo: refresca cada 30 s y al volver a la pestaña
    const poll = setInterval(load, 30000);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(poll);
      clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load, schedule]);

  const maxBar = Math.max(1, ...(d?.chart ?? []).map((b) => Math.max(b.n, b.nuevos)));
  const chartNew = (d?.chart ?? []).reduce((s, b) => s + b.nuevos, 0);
  const chartTotal = (d?.chart ?? []).reduce((s, b) => s + b.n, 0);
  const todayLong = new Date().toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" });
  const nextAppt = d?.appts.find((a) => a.status === "scheduled" && new Date(a.start_at) >= new Date(Date.now() - 15 * 60000));

  return (
    <div className="mm-page db">
      {/* Bienvenida */}
      <section className="db-hero">
        <div className="db-hero-main">
          <div className="db-hero-top">
            <span className="db-date">{todayLong}</span>
            <LiveDot live={live} label={live ? `En vivo · ${ago}` : `Actualizado ${ago}`} />
          </div>
          <h1 className="db-hello">{greeting()}, doctora</h1>
          <p className="db-hero-sub">
            {!d ? "Preparando el resumen del día…" :
              d.appts.length === 0 ? "No hay citas agendadas para hoy." :
              nextAppt ? <>Próxima cita a las <b>{fmtTime(nextAppt.start_at)}</b> con <b>{nextAppt.patients?.name ?? "paciente"}</b>.</> :
              `Ya se atendieron todas las citas de hoy (${d.apptsDone}).`}
          </p>
          <div className="db-actions">
            <button className="db-action" onClick={() => nav("/patients")}><span>👥</span>Buscar paciente</button>
            <button className="db-action" onClick={() => nav("/agenda")}><span>📅</span>Agendar cita</button>
            <button className="db-action" onClick={() => nav("/caja")}><span>🧾</span>Abrir caja de hoy</button>
          </div>
        </div>

        <Link to="/caja" className={`db-cash ${pulse ? "pulse" : ""}`}>
          <div className="db-cash-label">Caja de hoy</div>
          {d && !d.cashOk ? (
            <div className="db-cash-setup">Activa Farmacia &amp; Caja para ver aquí lo cobrado del día.</div>
          ) : (
            <>
              <div className="db-cash-value">{d ? fmtUSD(d.todaySum.total) : "—"}</div>
              <div className="db-cash-row"><span>Ganancia real</span><b>{d ? fmtUSD(d.todaySum.profit) : "—"}</b></div>
              <div className="db-cash-row"><span>Para guardar</span><b>{d ? fmtUSD(d.todaySum.toSave) : "—"}</b></div>
              <div className="db-cash-foot">Este mes: {d ? fmtUSD(d.monthSum.total) : "—"} cobrados</div>
            </>
          )}
        </Link>
      </section>

      {/* KPIs */}
      <div className="mm-kpi-grid db-kpis">
        {[
          { icon: "👥", label: "Pacientes", value: d?.patients.toLocaleString("es-EC"), badge: d ? `+${d.patientsMonth} nuevos este mes` : "", to: "/patients" },
          { icon: "🩺", label: "Consultas de hoy", value: d?.visitsToday, badge: d ? `${chartTotal} atendidos en ${DAYS} días` : "" },
          { icon: "📅", label: "Citas de hoy", value: d?.appts.length, badge: d ? `${d.apptsPending} pendientes · ${d.apptsDone} atendidas` : "", to: "/agenda" },
          { icon: "📄", label: "Recetas y certificados hoy", value: d ? (d.rx ?? 0) + (d.certs ?? 0) : undefined, badge: d ? `${d.rx ?? 0} recetas · ${d.certs ?? 0} certificados` : "" },
        ].map((k) => (
          <div key={k.label} className={`mm-kpi ${k.to ? "db-kpi-link" : ""} ${pulse ? "pulse" : ""}`} onClick={() => k.to && nav(k.to)}>
            <div className="mm-kpi-icon">{k.icon}</div>
            <div className="mm-kpi-label">{k.label}</div>
            <div className="mm-kpi-value">{d ? k.value : <span className="ui-skel" style={{ width: 60, height: 28 }} />}</div>
            <div className="mm-kpi-badge">{k.badge}</div>
          </div>
        ))}
      </div>

      <div className="db-grid">
        {/* Gráfico */}
        <section className="mm-card">
          <div className="mm-card-head">
            <div>
              <div className="mm-card-title">Pacientes por día</div>
              <div className="mm-card-sub">Últimos {DAYS} días · {chartTotal} atendidos · {chartNew} pacientes nuevos</div>
            </div>
            <div className="db-legend">
              <span><i className="att" />Atendidos</span>
              <span><i className="new" />Nuevos</span>
            </div>
          </div>
          <div className="db-chart" role="img" aria-label={`Pacientes por día, últimos ${DAYS} días`}>
            {(d?.chart ?? Array.from({ length: DAYS }, (_, i) => ({ key: i, n: 0, nuevos: 0, day: new Date() }))).map((b, i) => {
              const isToday = i === DAYS - 1;
              const label = b.day.toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "short" });
              return (
                <div key={b.key} className={`db-bar ${isToday ? "today" : ""}`} title={`${label}: ${b.n} atendidos · ${b.nuevos} nuevos`}>
                  <span className="db-bar-n">{b.n + b.nuevos > 0 ? Math.max(b.n, b.nuevos) : ""}</span>
                  <div className="db-bar-pair">
                    <div className="db-bar-fill" style={{ height: `${d ? Math.max(3, (b.n / maxBar) * 100) : 3}%` }} />
                    <div className="db-bar-fill new" style={{ height: `${d ? Math.max(3, (b.nuevos / maxBar) * 100) : 3}%` }} />
                  </div>
                  <span className="db-bar-day">{d ? (isToday ? "Hoy" : b.day.toLocaleDateString("es-EC", { weekday: "narrow" }).toUpperCase() + b.day.getDate()) : ""}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Agenda de hoy */}
        <section className="mm-card db-agenda">
          <div className="mm-card-head">
            <div>
              <div className="mm-card-title">Agenda de hoy</div>
              <div className="mm-card-sub">{d ? `${d.appts.length} citas` : "Cargando…"}</div>
            </div>
            <Link to="/agenda" className="mm-btn mm-btn--ghost mm-btn--sm">Ver agenda</Link>
          </div>
          {d && d.appts.length === 0 ? (
            <div className="db-empty">Día libre de citas. <Link to="/agenda">Agendar una cita</Link></div>
          ) : (
            <ul className="db-timeline">
              {(d?.appts ?? []).map((a) => {
                const st = STATUS[a.status] ?? { label: a.status, cls: "" };
                const isNext = nextAppt?.id === a.id;
                return (
                  <li key={a.id} className={`${a.status} ${isNext ? "next" : ""}`} onClick={() => a.patient_id && nav(`/patients/${a.patient_id}`)}>
                    <span className="db-time">{fmtTime(a.start_at)}</span>
                    <span className="db-tl-dot" />
                    <div className="db-tl-body">
                      <div className="db-tl-name">{a.patients?.name ?? "Paciente"}</div>
                      <div className="db-tl-reason">{a.reason || "Consulta"}</div>
                    </div>
                    <span className={`mm-chip ${st.cls}`}>{isNext ? "Siguiente" : st.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Últimas consultas */}
      <section className="mm-card" style={{ padding: 0, marginTop: 16 }}>
        <div className="mm-card-accent-bar" />
        <div className="mm-card-head" style={{ padding: "16px 20px 6px", marginBottom: 0 }}>
          <div>
            <div className="mm-card-title">Últimas consultas</div>
            <div className="mm-card-sub">Se actualiza solo cuando se registra una consulta nueva</div>
          </div>
        </div>
        <div className="mm-table-wrap">
          <table className="mm-table">
            <thead><tr><th>Paciente</th><th>Motivo</th><th>Diagnóstico (CIE-10)</th><th>Fecha</th></tr></thead>
            <tbody>
              {!d ? Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={4}><div className="ui-skel" style={{ width: `${50 + i * 10}%` }} /></td></tr>) :
                d.recent.length === 0 ? <tr><td colSpan={4}><div className="mm-empty">Aún no hay consultas registradas.</div></td></tr> :
                d.recent.map((v) => (
                  <tr key={v.id} className="mm-table-click" onClick={() => nav(`/visits/${v.id}`)}>
                    <td style={{ fontWeight: 600 }}>{v.patient?.name ?? "—"}<div className="pt-meta">{v.patient?.cedula ?? ""}</div></td>
                    <td className="db-ellipsis">{v.reason || "—"}</td>
                    <td>{v.cie10_code ? <><span className="mm-chip mm-chip--blue">{v.cie10_code}</span> <span className="db-ellipsis-inline">{v.cie10_name}</span></> : <span className="mm-text-muted">Sin diagnóstico</span>}</td>
                    <td className="mm-text-muted" style={{ whiteSpace: "nowrap" }}>{fmtWhen(v.visit_date)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
