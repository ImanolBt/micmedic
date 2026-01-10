import React, { useState } from "react";

export default function Login({ onLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");

  function handleLogin() {
    if (user === "doctora" && pass === "1234") {
      onLogin({ name: "Dra. Andrea" });
    } else {
      alert("Usuario o contraseña incorrectos");
    }
  }

  return (
    <div style={{ padding: 40 }}>
      <h2>MedGo - Login</h2>
      <input placeholder="Usuario" onChange={e => setUser(e.target.value)} /><br /><br />
      <input type="password" placeholder="Contraseña" onChange={e => setPass(e.target.value)} /><br /><br />
      <button onClick={handleLogin}>Ingresar</button>
    </div>
  );
}
