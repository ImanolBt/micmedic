import { useState } from "react";
import { downloadCajaReport, periodRange } from "../../utils/cajaReport";
import { todayISO } from "./fcUtils";
import { useUI } from "../ui/kit";

const KINDS = [
  { id: "dinero",   icon: "💵", title: "Dinero",   desc: "Cuánto se cobró, cuánto guardar y cuánto es ganancia." },
  { id: "control",  icon: "📋", title: "Control",  desc: "Qué se hizo: consultas, procedimientos y productos usados." },
  { id: "completo", icon: "📑", title: "Completo", desc: "Dinero y control juntos, con montos por cada producto." },
];

export default function ReportModal({ initialDate, initialPeriod = "dia", onClose }) {
  const { toast } = useUI();
  const base = initialDate ?? todayISO();
  const [period, setPeriod] = useState(initialPeriod);
  const [day, setDay] = useState(base);
  const [month, setMonth] = useState(base.slice(0, 7));
  const [year, setYear] = useState(base.slice(0, 4));
  const [type, setType] = useState("dinero");
  const [loading, setLoading] = useState(false);

  const value = period === "dia" ? day : period === "mes" ? month : year;
  const label = value ? periodRange(period, value).label : "";
  const thisYear = new Date().getFullYear();

  const go = async () => {
    setLoading(true);
    try {
      const name = await downloadCajaReport({ period, value, type });
      toast(`Se descargó ${name}`);
      onClose();
    } catch (e) {
      toast(`No se pudo generar el PDF: ${e.message}`, { kind: "error" });
    }
    setLoading(false);
  };

  return (
    <div className="mm-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mm-modal">
        <div className="mm-modal-head">
          <span className="mm-modal-title">Descargar reporte en PDF</span>
          <button onClick={onClose} className="mm-icon-btn" aria-label="Cerrar">✕</button>
        </div>
        <div className="mm-modal-body">
          <div className="mm-field">
            <span className="mm-label">1. ¿De qué período?</span>
            <div className="fc-seg rp-seg">
              {[["dia", "Día"], ["mes", "Mes"], ["anio", "Año"]].map(([id, l]) => (
                <button key={id} className={period === id ? "active" : ""} onClick={() => setPeriod(id)}>{l}</button>
              ))}
            </div>
            <div className="rp-when">
              {period === "dia" && <input className="mm-input" type="date" value={day} onChange={(e) => setDay(e.target.value)} />}
              {period === "mes" && <input className="mm-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />}
              {period === "anio" && (
                <select className="mm-input" value={year} onChange={(e) => setYear(e.target.value)}>
                  {Array.from({ length: 6 }, (_, i) => String(thisYear - i)).map((y) => <option key={y}>{y}</option>)}
                </select>
              )}
              <span className="rp-label">{label}</span>
            </div>
          </div>

          <div className="mm-field">
            <span className="mm-label">2. ¿Qué tipo de reporte?</span>
            <div className="rp-kinds">
              {KINDS.map((k) => (
                <button key={k.id} type="button" className={`rp-kind ${type === k.id ? "active" : ""}`} onClick={() => setType(k.id)}>
                  <span className="rp-kind-ico">{k.icon}</span>
                  <b>{k.title}</b>
                  <span>{k.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mm-flex" style={{ justifyContent: "flex-end", marginTop: 4 }}>
            <button className="mm-btn mm-btn--ghost" onClick={onClose}>Cancelar</button>
            <button className="mm-btn" onClick={go} disabled={loading || !value}>{loading ? "Generando…" : "Descargar PDF"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
