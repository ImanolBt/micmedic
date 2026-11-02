import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import ProductsTab from "../components/fc/ProductsTab";
import PackagesTab from "../components/fc/PackagesTab";
import CajaDiariaTab from "../components/fc/CajaDiariaTab";
import BalanceTab from "../components/fc/BalanceTab";
import { isMissingTable } from "../components/fc/fcUtils";
import { useUI } from "../components/ui/kit";
import setupSQL from "../../supabase/farmacia_caja.sql?raw";

const TABS = [
  { id: "caja",     icon: "🧾", label: "Caja diaria",    sub: "Registra lo que se cobró hoy y mira cuánto es ganancia real.", C: CajaDiariaTab },
  { id: "lista",    icon: "💊", label: "Lista Original", sub: "Tus productos con su costo y precio de venta. Todo el módulo toma los precios de aquí.", C: ProductsTab },
  { id: "paquetes", icon: "🩹", label: "Paquetes",       sub: "Cada procedimiento con sus insumos. El costo se calcula solo.", C: PackagesTab },
  { id: "balance",  icon: "📊", label: "Balance",        sub: "Cómo va el mes: ingresos, gastos fijos y utilidad.", C: BalanceTab },
];

function SetupCard({ onRetry }) {
  const { toast } = useUI();
  const copy = async () => {
    try { await navigator.clipboard.writeText(setupSQL); toast("Código copiado. Pégalo en el SQL Editor de Supabase."); }
    catch { toast("No se pudo copiar. Abre el archivo supabase/farmacia_caja.sql", { kind: "error" }); }
  };
  return (
    <div className="fc-setup">
      <div className="fc-setup-icon">🧾</div>
      <h2>Falta activar Farmacia &amp; Caja</h2>
      <p>Hay que crear las tablas en la base de datos una sola vez. Toma menos de un minuto.</p>
      <ol>
        <li><b>Copia el código</b> con el botón de abajo.</li>
        <li>En Supabase entra a <b>SQL Editor → New query</b>, pégalo y presiona <b>Run</b>.</li>
        <li>Vuelve aquí y presiona <b>Ya lo ejecuté</b>.</li>
      </ol>
      <div className="mm-flex" style={{ justifyContent: "center" }}>
        <button className="mm-btn" onClick={copy}>Copiar código SQL</button>
        <button className="mm-btn mm-btn--ghost" onClick={onRetry}>Ya lo ejecuté</button>
      </div>
    </div>
  );
}

export default function FarmaciaCaja() {
  const [params, setParams] = useSearchParams();
  const active = TABS.find((t) => t.id === params.get("tab")) ?? TABS[0];
  const Comp = active.C;
  const [ready, setReady] = useState(null);

  const check = async () => {
    setReady(null);
    const { error } = await supabase.from("fc_products").select("id").limit(1);
    setReady(!isMissingTable(error));
  };
  useEffect(() => { check(); }, []);

  return (
    <div className="mm-page">
      <div className="mm-page-header">
        <div>
          <h1 className="mm-page-title">Farmacia &amp; Caja</h1>
          <p className="mm-page-sub">{active.sub}</p>
        </div>
      </div>

      {ready === false ? <SetupCard onRetry={check} /> : (
        <>
          <nav className="fc-tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={t.id === active.id}
                className={`fc-tab ${t.id === active.id ? "active" : ""}`}
                onClick={() => setParams({ tab: t.id })}
              >
                <span className="fc-tab-icon">{t.icon}</span>{t.label}
              </button>
            ))}
          </nav>
          {ready === null ? <div className="mm-card fc-loading">Cargando…</div> : <Comp key={active.id} />}
        </>
      )}
    </div>
  );
}
