/**
 * Resolve all computed colors on an element tree to hex/rgb values.
 * html2canvas doesn't support oklab() colors used by Tailwind v4.
 */
function resolveColors(element: HTMLElement): () => void {
  const originals: { el: HTMLElement; prop: string; value: string }[] = [];

  const colorProps = [
    "color",
    "background-color",
    "border-color",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "outline-color",
    "text-decoration-color",
    "fill",
    "stroke",
  ];

  const elements = [element, ...element.querySelectorAll("*")] as HTMLElement[];

  for (const el of elements) {
    if (!el.style) continue;
    const computed = getComputedStyle(el);

    for (const prop of colorProps) {
      const val = computed.getPropertyValue(prop);
      if (val && (val.includes("oklab") || val.includes("oklch") || val.includes("color("))) {
        // Save original inline style
        originals.push({ el, prop, value: el.style.getPropertyValue(prop) });

        // Create a temporary element to resolve the color
        const temp = document.createElement("div");
        temp.style.color = val;
        document.body.appendChild(temp);
        const resolved = getComputedStyle(temp).color;
        document.body.removeChild(temp);

        el.style.setProperty(prop, resolved);
      }
    }
  }

  // Return a cleanup function to restore originals
  return () => {
    for (const { el, prop, value } of originals) {
      if (value) {
        el.style.setProperty(prop, value);
      } else {
        el.style.removeProperty(prop);
      }
    }
  };
}

export async function exportToPDF(elementId: string, fileName: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Element #${elementId} not found`);

  // Dynamic imports to avoid SSR issues
  const html2canvas = (await import("html2canvas")).default;
  const { default: jsPDF } = await import("jspdf");

  // Resolve oklab colors before capture
  const restoreColors = resolveColors(element);

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
  } finally {
    restoreColors();
  }
}
