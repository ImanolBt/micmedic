import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Login() {
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
    setLoading(false);
  };

  return (
    <div className="mm-login-bg">
      <div className="mm-login-card">
        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 18,
            background: "linear-gradient(135deg, var(--c-brand), var(--c-brand-dark))",
            display: "grid", placeItems: "center", fontSize: 26,
            boxShadow: "0 4px 18px rgba(111,168,50,.4)"
          }}>🏥</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: "-.5px", color: "var(--c-text)" }}>MicMEDIC</div>
            <div style={{ fontSize: 13, color: "var(--c-muted)", marginTop: 2 }}>Sistema de Gestión Médica</div>
          </div>
        </div>

        <h1 style={{ fontSize: 18, fontWeight: 800, textAlign: "center", marginBottom: 24, color: "var(--c-text)" }}>
          Bienvenida, Dra. Romo
        </h1>

        <form onSubmit={handleLogin} style={{ display: "grid", gap: 16 }}>
          <div className="mm-field">
            <label className="mm-label">Correo electrónico</label>
            <input
              className="mm-input"
              type="email"
              placeholder="doctora@ejemplo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="mm-field">
            <label className="mm-label">Contraseña</label>
            <input
              className="mm-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="mm-alert mm-alert--error">
              <span>⚠️</span> {error}
            </div>
          )}

          <button
            type="submit"
            className="mm-btn mm-btn--lg mm-btn--full"
            disabled={loading}
            style={{ marginTop: 4 }}
          >
            {loading ? "Entrando…" : "Iniciar sesión →"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 12, color: "var(--c-muted)", marginTop: 24 }}>
          MicMEDIC · Uso exclusivo autorizado
        </p>
      </div>
    </div>
  );
}
