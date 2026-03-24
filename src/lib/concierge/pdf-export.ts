import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function exportToPDF(elementId: string, fileName: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Element #${elementId} not found`);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#f8f8fa",
  });

  const imgData = canvas.toDataURL("image/png");
  const imgWidth = 210; // A4 width in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const pageHeight = 297; // A4 height in mm

  const pdf = new jsPDF("p", "mm", "a4");
  let position = 0;
  let heightLeft = imgHeight;

  // First page
  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  // Additional pages if content overflows
  while (heightLeft > 0) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(fileName);
}
