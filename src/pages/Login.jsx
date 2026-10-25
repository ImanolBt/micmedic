import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
    setLoading(false);
  }

  return (
    <div className="mm-login-bg">
      <div className="mm-login-card">
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "linear-gradient(135deg, var(--green), var(--green-dk))",
            display: "grid", placeItems: "center", fontSize: 22, color: "white",
            boxShadow: "0 4px 16px rgba(122,166,60,.35)"
          }}>🏥</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: "-.4px" }}>MicMEDIC</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Sistema médico</div>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Bienvenida, Dra. Romo</h1>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>Ingresa tus credenciales para continuar</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: "grid", gap: 14 }}>
          <div>
            <label className="mm-label">Correo electrónico</label>
            <input className="mm-input" type="email" placeholder="correo@ejemplo.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="mm-label">Contraseña</label>
            <input className="mm-input" type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fef2f2",
              color: "#c53030", fontSize: 13, border: "1px solid #fecaca" }}>
              {error}
            </div>
          )}

          <button className="mm-btn mm-btn--lg" disabled={loading} style={{ width: "100%", marginTop: 4 }}>
            {loading ? "Ingresando..." : "Ingresar →"}
          </button>
        </form>
      </div>
    </div>
  );
}
