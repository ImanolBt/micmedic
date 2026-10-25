import React, { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail]   = useState("");
  const [pass, setPass]     = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setErrorMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    setLoading(false);
    if (error) setErrorMsg("Correo o contraseña incorrectos");
  };

  const handleKey = (e) => { if (e.key === "Enter") handleLogin(); };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1f2a1f 0%, #2d3d2d 40%, #3a5020 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* decorative blobs */}
      <div style={{
        position:"absolute", width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(150,179,74,.18), transparent 70%)",
        top: -100, right: -80, pointerEvents:"none"
      }}/>
      <div style={{
        position:"absolute", width: 300, height: 300, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(122,166,60,.14), transparent 70%)",
        bottom: -60, left: -60, pointerEvents:"none"
      }}/>

      <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}>
        {/* Logo area */}
        <div style={{ textAlign:"center", marginBottom: 28 }}>
          <div style={{
            display:"inline-flex", alignItems:"center", justifyContent:"center",
            width: 64, height: 64, borderRadius: 18,
            background: "linear-gradient(135deg, #96b34a, #7aa63c)",
            fontSize: 28, marginBottom: 14,
            boxShadow: "0 8px 24px rgba(150,179,74,.4)",
          }}>🏥</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "white", letterSpacing: "-.5px" }}>
            MicMEDIC
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.55)", marginTop: 4 }}>
            Sistema de gestión médica
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: "rgba(255,255,255,.97)",
          borderRadius: 24,
          padding: 32,
          boxShadow: "0 24px 60px rgba(0,0,0,.25)",
        }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#1f2a1f", marginBottom: 6 }}>
            Iniciar sesión
          </div>
          <div style={{ fontSize: 13, color: "rgba(0,0,0,.50)", marginBottom: 24 }}>
            Ingresa tus credenciales para continuar
          </div>

          {/* Email */}
          <div style={{ display:"grid", gap: 5, marginBottom: 14 }}>
            <label className="mm-label">Correo electrónico</label>
            <div style={{ position:"relative" }}>
              <span style={{
                position:"absolute", left: 13, top:"50%", transform:"translateY(-50%)",
                fontSize: 15, color:"rgba(0,0,0,.35)", pointerEvents:"none"
              }}>✉</span>
              <input
                className="mm-input"
                style={{ paddingLeft: 36 }}
                placeholder="medico@micmedic.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKey}
                disabled={loading}
                type="email"
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ display:"grid", gap: 5, marginBottom: 20 }}>
            <label className="mm-label">Contraseña</label>
            <div style={{ position:"relative" }}>
              <span style={{
                position:"absolute", left: 13, top:"50%", transform:"translateY(-50%)",
                fontSize: 15, color:"rgba(0,0,0,.35)", pointerEvents:"none"
              }}>🔒</span>
              <input
                className="mm-input"
                style={{ paddingLeft: 36, paddingRight: 42 }}
                placeholder="••••••••"
                type={showPass ? "text" : "password"}
                value={pass}
                onChange={e => setPass(e.target.value)}
                onKeyDown={handleKey}
                disabled={loading}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={{
                  position:"absolute", right: 12, top:"50%", transform:"translateY(-50%)",
                  border:"none", background:"none", cursor:"pointer",
                  fontSize: 15, color:"rgba(0,0,0,.40)", padding: 4,
                }}
              >
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {/* Error */}
          {errorMsg && (
            <div style={{
              background:"rgba(220,38,38,.08)", color:"#991b1b",
              border:"1px solid rgba(220,38,38,.18)",
              padding:"10px 14px", borderRadius: 12, fontSize: 13, fontWeight: 700,
              marginBottom: 16, display:"flex", alignItems:"center", gap: 8,
            }}>
              <span>⚠️</span> {errorMsg}
            </div>
          )}

          {/* Button */}
          <button
            className="mm-btn mm-btn--primary"
            onClick={handleLogin}
            disabled={loading}
            style={{ width:"100%", padding:"13px", fontSize: 15, borderRadius: 14 }}
          >
            {loading ? "⏳ Ingresando..." : "Iniciar sesión →"}
          </button>

          <div style={{ marginTop: 18, textAlign:"center", fontSize: 12, color:"rgba(0,0,0,.40)" }}>
            Acceso exclusivo para personal autorizado
          </div>
        </div>

        <div style={{ textAlign:"center", marginTop: 20, fontSize: 12, color:"rgba(255,255,255,.35)" }}>
          © {new Date().getFullYear()} MicMEDIC · Todos los derechos reservados
        </div>
      </div>
    </div>
  );
}
