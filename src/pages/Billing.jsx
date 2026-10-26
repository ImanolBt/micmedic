import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const STATUS_CHIP = {
  pending:  { label: "Pendiente", cls: "mm-chip--warn" },
  paid:     { label: "Pagada",    cls: "mm-chip--green" },
  cancelled:{ label: "Cancelada", cls: "mm-chip--red" },
  overdue:  { label: "Vencida",   cls: "mm-chip--red" },
};

export default function Billing() {
  const [invoices, setInvoices] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState("all");
  const [stats,    setStats]    = useState({ total: 0, paid: 0, pending: 0, overdue: 0 });

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("invoices")
      .select("*, patients(first_name, last_name)")
      .order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q.limit(100);
    const all = data ?? [];
    setInvoices(all);

    // Calcular stats
    const { data: allInv } = await supabase.from("invoices").select("status, amount");
    const inv = allInv ?? [];
    setStats({
      total:   inv.reduce((s, i) => s + (i.amount ?? 0), 0),
      paid:    inv.filter(i => i.status === "paid").reduce((s, i) => s + (i.amount ?? 0), 0),
      pending: inv.filter(i => i.status === "pending").length,
      overdue: inv.filter(i => i.status === "overdue").length,
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const markPaid = async (id) => {
    await supabase.from("invoices").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  const fmt = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  };

  const fmtMXN = (n) =>
    n != null ? new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n) : "—";

  return (
    <div className="mm-page">
      <div className="mm-page-header">
        <div>
          <h1 className="mm-page-title">Facturación</h1>
          <p className="mm-page-sub">Gestión de ingresos y cobros</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="mm-kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 24 }}>
        {[
          { label: "Ingresos totales", value: fmtMXN(stats.total),   icon: "💰", badge: "Histórico" },
          { label: "Total cobrado",    value: fmtMXN(stats.paid),    icon: "✅", badge: "Pagado" },
          { label: "Pendientes",       value: stats.pending,          icon: "⏳", badge: "Por cobrar" },
          { label: "Vencidas",         value: stats.overdue,          icon: "⚠️", badge: "Requiere atención" },
        ].map((k, i) => (
          <div key={i} className="mm-kpi">
            <div className="mm-kpi-icon">{k.icon}</div>
            <div className="mm-kpi-label">{k.label}</div>
            <div className="mm-kpi-value" style={{ fontSize: typeof k.value === "string" ? 20 : 30 }}>
              {loading ? <span style={{ fontSize: 18, opacity: .4 }}>…</span> : k.value}
            </div>
            <div className="mm-kpi-badge">● {k.badge}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {[
          { id: "all",       label: "Todas" },
          { id: "pending",   label: "Pendientes" },
          { id: "paid",      label: "Pagadas" },
          { id: "overdue",   label: "Vencidas" },
          { id: "cancelled", label: "Canceladas" },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`mm-btn mm-btn--sm ${filter === f.id ? "" : "mm-btn--ghost"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="mm-card" style={{ padding: 0 }}>
        <div className="mm-card-accent-bar" />
        <div className="mm-table-wrap">
          <table className="mm-table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Concepto</th>
                <th>Monto</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--c-muted)", padding: "40px 0" }}>Cargando…</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={6}><div className="mm-empty">Sin facturas registradas</div></td></tr>
              ) : invoices.map(inv => {
                const chip = STATUS_CHIP[inv.status] ?? { label: inv.status, cls: "" };
                return (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 600 }}>
                      {inv.patients?.first_name} {inv.patients?.last_name}
                    </td>
                    <td style={{ color: "var(--c-text-2)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {inv.concept || inv.description || "Consulta médica"}
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--c-text)" }}>{fmtMXN(inv.amount)}</td>
                    <td style={{ color: "var(--c-muted)", fontSize: 13 }}>{fmt(inv.created_at)}</td>
                    <td><span className={`mm-chip ${chip.cls}`}>{chip.label}</span></td>
                    <td>
                      {inv.status === "pending" && (
                        <button
                          onClick={() => markPaid(inv.id)}
                          className="mm-btn mm-btn--sm"
                          style={{ padding: "4px 12px", fontSize: 11 }}
                        >
                          ✓ Marcar pagada
                        </button>
                      )}
                      {inv.status === "paid" && (
                        <span style={{ fontSize: 12, color: "var(--c-muted)" }}>Pagada {fmt(inv.paid_at)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
