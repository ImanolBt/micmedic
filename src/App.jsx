import React, { useState } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Agenda from "./pages/Agenda";
import Patients from "./pages/Patients";
import PatientDetail from "./pages/PatientDetail";

const initialPatients = [
  {
    id: 1,
    name: "María Fernanda",
    age: 29,
    cedula: "0501234567",
    phone: "0991234567",
    sex: "F",
    allergies: ["Penicilina"],
    antecedentes: ["Asma leve"],
    history: [],
  },
  {
    id: 2,
    name: "Carlos Andrés",
    age: 41,
    cedula: "0507654321",
    phone: "0987776655",
    sex: "M",
    allergies: [],
    antecedentes: ["HTA (controlada)"],
    history: [],
  },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("dashboard");
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [patients, setPatients] = useState(initialPatients);
  const [appointments, setAppointments] = useState([
  { id: 1, date: "2026-01-06", time: "08:30", patientId: 1, reason: "Control", status: "Agendada" },
  { id: 2, date: "2026-01-07", time: "10:00", patientId: 2, reason: "Dolor lumbar", status: "Agendada" },
]);


  if (!user) return <Login onLogin={setUser} />;

  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || null;

  function addPatient(newPatient) {
    setPatients((prev) => [newPatient, ...prev]);
  }
function addAppointment(ap) {
  setAppointments((prev) => [ap, ...prev]);
}
function updateAppointment(ap) {
  setAppointments((prev) => prev.map((x) => (x.id === ap.id ? ap : x)));
}
  function updatePatient(updated) {
    setPatients((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  return (
    <div className="page">
      <div className="topbar">
        <div className="brand">
          <div className="logo" />
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>MedGo</div>
            <div style={{ opacity: 0.75, fontSize: 12 }}>Demo • Historias clínicas</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn" onClick={() => setView("dashboard")}>Dashboard</button>
          <button className="btn" onClick={() => setView("patients")}>Pacientes</button>
          <button className="btn" onClick={() => setView("agenda")}>Agenda</button>
          <button className="btn danger" onClick={() => { setUser(null); setView("dashboard"); }}>
            Salir
          </button>
        </div>
      </div>

      <div className="card">
        {view === "dashboard" && <Dashboard />}

        {view === "patients" && (
          <Patients
            patients={patients}
            onAddPatient={addPatient}
            onSelect={(patientId) => {
              setSelectedPatientId(patientId);
              setView("patient");
            }}
          />
        )}

        {view === "patient" && (
          <PatientDetail
            patient={selectedPatient}
            onBack={() => setView("patients")}
            onUpdatePatient={updatePatient}
          />
        )}
        {view === "agenda" && (
  <Agenda
    patients={patients}
    appointments={appointments}
    onAddAppointment={addAppointment}
    onUpdateAppointment={updateAppointment}
  />
)}

      </div>
    </div>
  );
}
