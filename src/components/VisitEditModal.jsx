import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import Cie10Picker from "./Cie10Picker";

function toLocalDateTimeValue(iso) {
  const d = iso ? new Date(iso) : new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function VisitEditModal({ open, visit, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [visitDate, setVisitDate] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [cie, setCie] = useState(null);

  useEffect(() => {
    if (!open || !visit) return;
    setVisitDate(toLocalDateTimeValue(visit.visit_date));
    setReason(visit.reason || "");
    setNotes(visit.notes || "");
    setCie(visit.cie10_code ? { code: visit.cie10_code, name: visit.cie10_name || "" } : null);
  }, [open, visit]);

  const canSave = useMemo(() => {
    return !!visit?.id && reason.trim().length >= 3 && !!cie?.code && !saving;
  }, [visit, reason, cie, saving]);

  async function save() {
    if (!canSave) return;
    setSaving(true);
    const payload = {
      visit_date: visitDate ? new Date(visitDate).toISOString() : new Date().toISOString(),
      reason: reason.trim(),
      cie10_code: cie.code,
      cie10_name: cie.name,
      notes: notes.trim() || null,
    };
    const { error } = await supabase.from("medical_visits").update(payload).eq("id", visit.id);
    setSaving(false);
    if (error) { alert(error.message || "No se pudo guardar"); return; }
    onSaved?.();
    onClose?.();
  }

  if (!open) return null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "grid", placeItems: "center", padding: 16, zIndex: 9999, backdropFilter: "blur(2px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--mm-surface)", borderRadius: 16, width: "min(600px, 100%)", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.25)", border: "1px solid var(--mm-border)" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--mm-border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--mm-bg)" }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--mm-text)" }}>✏ Editar consulta</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="mm-btn mm-btn--primary mm-btn--sm" onClick={save} disabled={!canSave}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: "grid", gap: 14 }}>
          <div>
            <label className="mm-label">Fecha y hora</label>
            <input className="mm-input" type="datetime-local" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} disabled={saving} />
          </div>
          <div>
            <label className="mm-label">Motivo *</label>
            <input className="mm-input" placeholder="Motivo de consulta" value={reason} onChange={(e) => setReason(e.target.value)} disabled={saving} />
          </div>
          <div>
            <label className="mm-label">Diagnóstico CIE10 *</label>
            <Cie10Picker value={cie} onChange={setCie} disabled={saving} />
          </div>
          <div>
            <label className="mm-label">Notas / Evolución</label>
            <textarea
              className="mm-input"
              placeholder="Evolución clínica..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
              style={{ minHeight: 100, paddingTop: 10, resize: "vertical" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
