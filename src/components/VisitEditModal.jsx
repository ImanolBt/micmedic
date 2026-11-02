import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import Cie10Picker from "./Cie10Picker";

function toLocalDateTimeValue(iso) {
  const d = iso ? new Date(iso) : new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
}

export default function VisitEditModal({ open, visit, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);

  const [visitDate, setVisitDate] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [cie, setCie] = useState(null); // {code,name}

  useEffect(() => {
    if (!open || !visit) return;

    setVisitDate(toLocalDateTimeValue(visit.visit_date));
    setReason(visit.reason || "");
    setNotes(visit.notes || "");
    setCie(
      visit.cie10_code
        ? { code: visit.cie10_code, name: visit.cie10_name || "" }
        : null
    );
  }, [open, visit]);

  const canSave = useMemo(() => {
    return (
      !!visit?.id &&
      reason.trim().length >= 3 &&
      !!cie?.code &&
      !saving
    );
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

    const { error } = await supabase
      .from("medical_visits")
      .update(payload)
      .eq("id", visit.id);

    setSaving(false);

    if (error) {
      console.error(error);
      alert(error.message || "No se pudo guardar la consulta");
      return;
    }

    onSaved?.();
    onClose?.();
  }

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        display: "grid",
        placeItems: "center",
        padding: 14,
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mm-card"
        style={{ width: "min(760px, 100%)" }}
      >
        <div className="mm-cardHead" style={{ justifyContent: "space-between" }}>
          <div className="mm-cardTitle">Editar consulta</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="mm-btn mm-btn--ghost" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="mm-btn" type="button" onClick={save} disabled={!canSave}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>

        <div style={{ padding: 14, display: "grid", gap: 10 }}>
          <div className="mm-row">
            <input
              className="mm-input"
              type="datetime-local"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              disabled={saving}
              title="Fecha y hora"
            />

            <input
              className="mm-input"
              placeholder="Motivo de consulta"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={saving}
            />
          </div>

          <Cie10Picker value={cie} onPick={(x) => setCie(x)} onClear={() => setCie(null)} />

          <textarea
            className="mm-input"
            style={{ minHeight: 90, paddingTop: 10 }}
            placeholder="Notas / evolución (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={saving}
          />

          <div className="mm-hint">
            Requisito: motivo + diagnóstico CIE10 seleccionado.
          </div>
        </div>
      </div>
    </div>
  );
}
