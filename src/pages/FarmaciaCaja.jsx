import { useSearchParams } from "react-router-dom";
import ProductsTab from "../components/fc/ProductsTab";
import PackagesTab from "../components/fc/PackagesTab";
import CajaDiariaTab from "../components/fc/CajaDiariaTab";
import BalanceTab from "../components/fc/BalanceTab";

const TABS = [
  { id: "caja",      icon: "🧾", label: "Caja diaria",     sub: "Registro del día y cierre de caja",              C: CajaDiariaTab },
  { id: "lista",     icon: "💊", label: "Lista Original",  sub: "Catálogo maestro de productos y su ganancia",     C: ProductsTab },
  { id: "paquetes",  icon: "🩹", label: "Paquetes",        sub: "Procedimientos con costo automático de insumos",  C: PackagesTab },
  { id: "balance",   icon: "📊", label: "Balance",         sub: "Resumen mensual, gastos fijos y utilidad",        C: BalanceTab },
];

export default function FarmaciaCaja() {
  const [params, setParams] = useSearchParams();
  const active = TABS.find((t) => t.id === params.get("tab")) ?? TABS[0];
  const Comp = active.C;

  return (
    <div className="mm-page">
      <div className="mm-page-header">
        <div>
          <h1 className="mm-page-title">Farmacia & Caja</h1>
          <p className="mm-page-sub">{active.sub}</p>
        </div>
      </div>

      <div className="fc-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`fc-tab ${t.id === active.id ? "active" : ""}`}
            onClick={() => setParams({ tab: t.id })}
          >
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      <Comp key={active.id} />
    </div>
  );
}
