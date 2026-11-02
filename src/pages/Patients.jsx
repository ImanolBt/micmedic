import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import PatientForm from "../components/PatientForm";
import { norm, useUI } from "../components/ui/kit";

const PAGE_SIZE = 25;
const LETTERS = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");
const PARTICLES = new Set(["de", "del", "la", "las", "los", "y", "da", "van", "von", "san", "mc"]);

/* Separa el nombre en palabras uniendo partículas: "María de los Ángeles Pérez" */
function words(name) {
  const raw = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  const out = [];
  let buf = [];
  for (const w of raw) {
    buf.push(w);
    if (!PARTICLES.has(w.toLowerCase())) { out.push(buf.join(" ")); buf = []; }
  }
  if (buf.length) out.push(buf.join(" "));
  return out;
}

/* Apellido paterno según cómo se escribe en Ecuador: Nombre(s) Apellido1 Apellido2 */
function surnameIndex(w) {
  if (w.length >= 3) return w.length - 2;
  if (w.length === 2) return 1;
  return 0;
}

function sortKey(name, mode) {
  const w = words(name);
  if (mode === "nombre" || w.length === 0) return norm(name);
  const i = surnameIndex(w);
  return norm([...w.slice(i), ...w.slice(0, i)].join(" "));
}

function firstLetter(name, mode) {
  const w = words(name);
  const base = mode === "nombre" ? (w[0] ?? "") : (w[surnameIndex(w)] ?? "");
  const ch = base.charAt(0).toUpperCase();
  if (ch === "Ñ") return "Ñ";
  const n = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return LETTERS.includes(n) ? n : "#";
}

function NameCell({ name, mode }) {
  const w = words(name);
  if (mode === "nombre" || w.length < 2) return <span>{name}</span>;
  const i = surnameIndex(w);
  return (
    <span>
      {w.map((x, k) => (
        <span key={k} className={k >= i ? "pt-surname" : ""}>{x}{k < w.length - 1 ? " " : ""}</span>
      ))}
    </span>
  );
}

function initials(name) {
  const w = words(name);
  if (!w.length) return "?";
  const i = surnameIndex(w);
  return ((w[0]?.[0] ?? "") + (w.length > 1 ? w[i]?.replace(/^.*\s/, "")[0] ?? "" : "")).toUpperCase();
}

function ageLabel(birthdate) {
  if (!birthdate) return "—";
  const b = new Date(birthdate + "T12:00:00");
  if (Number.isNaN(b.getTime())) return "—";
  const t = new Date();
  let y = t.getFullYear() - b.getFullYear();
  let m = t.getMonth() - b.getMonth();
  if (t.getDate() < b.getDate()) m--;
  if (m < 0) { y--; m += 12; }
  if (y <= 0) return `${Math.max(m, 0)} ${m === 1 ? "mes" : "meses"}`;
  return `${y} ${y === 1 ? "año" : "años"}`;
}

const allergyText = (a) => (Array.isArray(a) ? a.filter(Boolean).join(", ") : typeof a === "string" ? a.trim() : "");

export default function Patients() {
  const nav = useNavigate();
  const { toast } = useUI();
  const [params, setParams] = useSearchParams();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const q = params.get("q") ?? "";
  const letter = params.get("letra") ?? "";
  const mode = params.get("orden") ?? "apellido";
  const page = Math.max(1, parseInt(params.get("p") ?? "1") || 1);

  const setParam = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === "" || v == null ? next.delete(k) : next.set(k, v)));
    if (!("p" in patch)) next.delete("p");
    setParams(next, { replace: true });
  };

  async function loadPatients() {
    setLoading(true); setError("");
    const all = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("patients")
        .select("id, name, cedula, phone, sex, birthdate, allergies, created_at")
        .order("name")
        .range(from, from + 999);
      if (error) { setError(error.message); break; }
      all.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    setPatients(all);
    setLoading(false);
  }
  useEffect(() => { loadPatients(); }, []);

  const indexed = useMemo(
    () => patients.map((p) => ({ ...p, _key: sortKey(p.name, mode), _letter: firstLetter(p.name, mode), _hay: norm(`${p.name} ${p.cedula ?? ""} ${p.phone ?? ""}`) }))
      .sort((a, b) => a._key.localeCompare(b._key, "es")),
    [patients, mode]
  );

  const counts = useMemo(() => {
    const c = {};
    indexed.forEach((p) => { c[p._letter] = (c[p._letter] ?? 0) + 1; });
    return c;
  }, [indexed]);

  const filtered = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    return indexed.filter((p) =>
      (!letter || p._letter === letter) && words.every((w) => p._hay.includes(w)));
  }, [indexed, q, letter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const rows = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  async function addPatient(payload) {
    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const toInsert = { ...payload, created_by: authData?.user?.id || null };
    const { error } = await supabase.from("patients").insert(toInsert);
    setSaving(false);
    if (error) { toast(`No se pudo guardar el paciente: ${error.message}`, { kind: "error" }); return; }
    setShowNew(false);
    toast(`${payload.name} quedó registrado`);
    await loadPatients();
  }

  const pageList = useMemo(() => {
    const set = new Set([1, pages, cur - 1, cur, cur + 1].filter((n) => n >= 1 && n <= pages));
    const arr = [...set].sort((a, b) => a - b);
    const out = [];
    arr.forEach((n, i) => { if (i && n - arr[i - 1] > 1) out.push("…" + n); out.push(n); });
    return out;
  }, [pages, cur]);

  return (
    <div className="mm-page">
      <div className="mm-page-header">
        <div>
          <h1 className="mm-page-title">Pacientes</h1>
          <p className="mm-page-sub">
            {loading ? "Cargando pacientes…" : `${patients.length.toLocaleString("es-EC")} pacientes registrados`}
          </p>
        </div>
        <div className="mm-page-actions">
          <button className="mm-btn" onClick={() => setShowNew(true)}>+ Nuevo paciente</button>
        </div>
      </div>

      <div className="mm-card pt-panel">
        <div className="pt-toolbar">
          <div className="pt-search">
            <span aria-hidden>⌕</span>
            <input
              className="mm-input"
              value={q}
              autoFocus
              onChange={(e) => setParam({ q: e.target.value })}
              placeholder="Busca por nombre, apellido, cédula o teléfono"
            />
            {q && <button className="pt-clear" onClick={() => setParam({ q: "" })} aria-label="Borrar búsqueda">✕</button>}
          </div>
          <div className="fc-seg" role="group" aria-label="Ordenar por">
            <button className={mode === "apellido" ? "active" : ""} onClick={() => setParam({ orden: "", letra: "" })}>Por apellido</button>
            <button className={mode === "nombre" ? "active" : ""} onClick={() => setParam({ orden: "nombre", letra: "" })}>Por nombre</button>
          </div>
        </div>

        <div className="pt-az" role="toolbar" aria-label="Filtrar por letra">
          <button className={`pt-letter pt-letter--all ${!letter ? "active" : ""}`} onClick={() => setParam({ letra: "" })}>Todos</button>
          {LETTERS.map((L) => (
            <button
              key={L}
              className={`pt-letter ${letter === L ? "active" : ""}`}
              disabled={!counts[L]}
              title={counts[L] ? `${counts[L]} pacientes` : "Sin pacientes"}
              onClick={() => setParam({ letra: letter === L ? "" : L })}
            >
              {L}
            </button>
          ))}
          {counts["#"] > 0 && (
            <button className={`pt-letter ${letter === "#" ? "active" : ""}`} onClick={() => setParam({ letra: letter === "#" ? "" : "#" })}>#</button>
          )}
        </div>
      </div>

      {error && <div className="mm-alert mm-alert--error" style={{ marginBottom: 12 }}>No se pudo cargar la lista de pacientes. {error}</div>}

      <div className="mm-card" style={{ padding: 0 }}>
        <div className="mm-card-accent-bar" />
        <div className="pt-resultbar">
          <span>
            {letter && <span className="pt-big-letter">{letter}</span>}
            {loading ? "Cargando…" : filtered.length === 0 ? "Sin resultados" :
              `Mostrando ${((cur - 1) * PAGE_SIZE + 1).toLocaleString("es-EC")}–${Math.min(cur * PAGE_SIZE, filtered.length).toLocaleString("es-EC")} de ${filtered.length.toLocaleString("es-EC")}`}
          </span>
          {mode === "apellido" && <span className="mm-hint">El apellido se resalta en <b className="pt-surname">verde</b></span>}
        </div>
        <div className="mm-table-wrap">
          <table className="mm-table">
            <thead>
              <tr><th>Paciente</th><th className="pt-hide-sm">Cédula</th><th>Edad</th><th className="pt-hide-sm">Teléfono</th><th className="pt-hide-sm">Alergias</th></tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={5}><div className="ui-skel" style={{ width: `${40 + (i * 7) % 45}%` }} /></td></tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={5}>
                  <div className="mm-empty">
                    {patients.length === 0
                      ? <>Todavía no hay pacientes. <button className="mm-btn mm-btn--sm" style={{ marginLeft: 8 }} onClick={() => setShowNew(true)}>Registrar el primero</button></>
                      : <>Ningún paciente coincide{q ? ` con “${q}”` : ""}{letter ? ` en la letra ${letter}` : ""}. <button className="mm-btn mm-btn--ghost mm-btn--sm" style={{ marginLeft: 8 }} onClick={() => setParam({ q: "", letra: "" })}>Ver todos</button></>}
                  </div>
                </td></tr>
              ) : rows.map((p) => {
                const al = allergyText(p.allergies);
                return (
                  <tr key={p.id} className="mm-table-click" onClick={() => nav(`/patients/${p.id}`)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && nav(`/patients/${p.id}`)}>
                    <td>
                      <div className="pt-who">
                        <div className={`mm-avatar pt-avatar ${p.sex === "M" ? "m" : "f"}`}>{initials(p.name)}</div>
                        <div>
                          <div className="pt-name"><NameCell name={p.name} mode={mode} /></div>
                          <div className="pt-meta">{p.sex === "M" ? "Masculino" : p.sex === "F" ? "Femenino" : ""}{p.cedula ? ` · ${p.cedula}` : ""}{al ? " · ⚠ alergias" : ""}</div>
                        </div>
                      </div>
                    </td>
                    <td className="pt-mono pt-hide-sm">{p.cedula || "—"}</td>
                    <td>{ageLabel(p.birthdate)}</td>
                    <td className="pt-hide-sm">{p.phone ? <a href={`tel:${p.phone}`} onClick={(e) => e.stopPropagation()} className="pt-phone">{p.phone}</a> : "—"}</td>
                    <td className="pt-hide-sm">{al ? <span className="mm-chip mm-chip--red" title={al}>⚠ {al.length > 28 ? al.slice(0, 28) + "…" : al}</span> : <span className="mm-text-muted">Ninguna</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="pt-pager">
            <button className="mm-btn mm-btn--ghost mm-btn--sm" disabled={cur <= 1} onClick={() => setParam({ p: cur - 1 })}>‹ Anterior</button>
            <div className="pt-pages">
              {pageList.map((n) => typeof n === "string"
                ? <span key={n} className="pt-dots">…</span>
                : <button key={n} className={`pt-page ${n === cur ? "active" : ""}`} onClick={() => setParam({ p: n })}>{n}</button>)}
            </div>
            <button className="mm-btn mm-btn--ghost mm-btn--sm" disabled={cur >= pages} onClick={() => setParam({ p: cur + 1 })}>Siguiente ›</button>
          </div>
        )}
      </div>

      {showNew && (
        <div className="mm-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowNew(false)}>
          <div className="mm-modal">
            <div className="mm-modal-head">
              <span className="mm-modal-title">Nuevo paciente</span>
              <button onClick={() => setShowNew(false)} className="mm-icon-btn" aria-label="Cerrar">✕</button>
            </div>
            <div className="pt-newform">
              <div className="mm-hint" style={{ marginBottom: 4 }}>Escribe el nombre completo como en la cédula: <b>nombres y luego apellidos</b>.</div>
              <PatientForm onCreate={addPatient} disabled={saving} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
