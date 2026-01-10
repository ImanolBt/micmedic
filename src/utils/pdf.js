import jsPDF from "jspdf";

export function generarRecetaPDF({ doctor, paciente, diagnostico, tratamiento }) {
  const doc = new jsPDF();
  const m = 15;
  let y = 18;

  // Encabezado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("MedGo", m, y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  y += 6;
  doc.text("Receta Médica (DEMO)", m, y);

  y += 10;
  doc.setDrawColor(180);
  doc.line(m, y, 195, y);

  // Datos
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Doctora:", m, y);
  doc.setFont("helvetica", "normal");
  doc.text(doctor || "Dra. Andrea", m + 25, y);

  y += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Paciente:", m, y);
  doc.setFont("helvetica", "normal");
  doc.text(paciente || "Paciente demo", m + 25, y);

  y += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Fecha:", m, y);
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toLocaleDateString(), m + 25, y);

  // Diagnóstico
  y += 12;
  doc.setFont("helvetica", "bold");
  doc.text("Diagnóstico:", m, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(diagnostico || "-", 175), m, y);

  // Tratamiento
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.text("Tratamiento / Indicaciones:", m, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(tratamiento || "-", 175), m, y);

  // Firma
  y += 25;
  doc.setFont("helvetica", "normal");
  doc.text("Firma:", m, y);
  doc.line(m + 15, y, 110, y);

  doc.save(`MedGo-Receta-${(paciente || "paciente").replaceAll(" ", "_")}.pdf`);
}
