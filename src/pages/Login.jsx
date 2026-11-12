import { useState } from "react";
import { supabase } from "../lib/supabase";

const ERRORS = {
  "Invalid login credentials": "Correo o contraseña incorrectos. Revisa e intenta de nuevo.",
  "Email not confirmed": "Este correo todavía no está confirmado.",
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) setError(ERRORS[err.message] ?? "No se pudo iniciar sesión. Revisa tu conexión e intenta de nuevo.");
    setLoading(false);
  };

  const year = new Date().getFullYear();

  return (
    <div className="lg-page">
      <div className="lg-shell">
        {/* Panel de marca */}
        <aside className="lg-brand" aria-hidden="true">
          <div className="lg-brand-glow" />
          <img src="/logo-watermark.png" alt="" className="lg-emblem" />
          <div className="lg-brand-text">
            <span className="lg-kicker">Consultorio médico</span>
            <h2>Medicina ocupacional<br />y medicina general</h2>
            <ul>
              <li><span>🩺</span>Historias clínicas y consultas</li>
              <li><span>📄</span>Recetas y certificados al instante</li>
              <li><span>🧾</span>Caja diaria y control de insumos</li>
            </ul>
          </div>
          <div className="lg-brand-foot">© {year} MicMEDIC</div>
        </aside>

        {/* Formulario */}
        <main className="lg-form-side">
          <img src="/logo-top.png" alt="MicMEDIC" className="lg-logo" />

          <div className="lg-head">
            <h1>Bienvenida, Dra. Romo</h1>
            <p>Ingresa para continuar con tu consulta del día.</p>
          </div>

          <form onSubmit={handleLogin} className="lg-form">
            <div className="mm-field">
              <label className="mm-label" htmlFor="lg-email">Correo electrónico</label>
              <div className="lg-input">
                <span aria-hidden>✉</span>
                <input id="lg-email" type="email" autoComplete="email" placeholder="doctora@micmedic.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </div>
            </div>

            <div className="mm-field">
              <label className="mm-label" htmlFor="lg-pass">Contraseña</label>
              <div className="lg-input">
                <span aria-hidden>🔒</span>
                <input id="lg-pass" type={show ? "text" : "password"} autoComplete="current-password" placeholder="Tu contraseña"
                  value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" className="lg-eye" onClick={() => setShow(!show)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}>
                  {show ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            {error && <div className="mm-alert mm-alert--error" role="alert">{error}</div>}

            <button type="submit" className="mm-btn mm-btn--lg mm-btn--full lg-submit" disabled={loading}>
              {loading ? <><span className="lg-spin" /> Entrando…</> : "Iniciar sesión"}
            </button>
          </form>

          <p className="lg-foot">Acceso exclusivo para personal autorizado del consultorio.</p>
        </main>
      </div>
    </div>
  );
}
