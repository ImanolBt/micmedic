import React, { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    console.log("LOGIN data:", data);
    console.log("LOGIN error:", error);

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }
    // No necesitas navegar manualmente:
    // App.jsx detecta sesión y cambia solo
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>MicMEDIC - Login</h2>

      <input
        placeholder="Correo"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <br />
      <br />

      <input
        type="password"
        placeholder="Contraseña"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
      />
      <br />
      <br />

      <button onClick={handleLogin} disabled={loading}>
        {loading ? "Ingresando..." : "Ingresar"}
      </button>
    </div>
  );
}
