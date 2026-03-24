/**
 * Tailwind v4 compiles hex colors to oklab() which html2canvas can't parse.
 * Inject raw hex CSS variables directly onto the element to override.
 */
const HEX_COLOR_OVERRIDES: Record<string, string> = {
  "--color-bg": "#f8f8fa",
  "--color-surface": "#ffffff",
  "--color-surface-2": "#f0f0f4",
  "--color-surface-3": "#e6e6ed",
  "--color-border": "#d4d4de",
  "--color-border-light": "#c0c0cc",
  "--color-text": "#1a1a2e",
  "--color-text-muted": "#5c5c78",
  "--color-text-dim": "#8c8ca0",
  "--color-accent": "#4f46e5",
  "--color-accent-light": "#6366f1",
  "--color-positive": "#16a34a",
  "--color-positive-muted": "#dcfce7",
  "--color-negative": "#dc2626",
  "--color-negative-muted": "#fee2e2",
  "--color-neutral-sent": "#ca8a04",
  "--color-neutral-muted": "#fef9c3",
  "--color-mild": "#64748b",
  "--color-moderate": "#475569",
  "--color-strong": "#1e293b",
  "--color-labs-yellow": "#b45309",
  "--color-labs-yellow-bg": "#fef3c7",
};

export async function exportToPDF(elementId: string, fileName: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Element #${elementId} not found`);

  const html2canvas = (await import("html2canvas")).default;
  const { default: jsPDF } = await import("jspdf");

  // Override CSS variables with hex values on the element
  const savedVars: Record<string, string> = {};
  for (const [key, val] of Object.entries(HEX_COLOR_OVERRIDES)) {
    savedVars[key] = element.style.getPropertyValue(key);
    element.style.setProperty(key, val);
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#f8f8fa",
      windowWidth: element.scrollWidth,
    });

    const imgData = canvas.toDataURL("image/png");
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const pageHeight = 297; // A4 height in mm

    const pdf = new jsPDF("p", "mm", "a4");
    let position = 0;
    let heightLeft = imgHeight;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(fileName);
  } finally {
    // Restore original CSS variables
    for (const [key, val] of Object.entries(savedVars)) {
      if (val) {
        element.style.setProperty(key, val);
      } else {
        element.style.removeProperty(key);
      }
    }
  }
}
