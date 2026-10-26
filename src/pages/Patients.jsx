import { Routes, Route } from "react-router-dom";
import PatientList from "../components/PatientList";
import PatientDetail from "../components/PatientDetail";

export default function Patients() {
  return (
    <Routes>
      <Route index element={<PatientList />} />
      <Route path=":id/*" element={<PatientDetail />} />
    </Routes>
  );
}
