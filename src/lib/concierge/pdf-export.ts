import { pdf } from "@react-pdf/renderer";
import { createElement } from "react";
import { ReportPDF } from "@/components/concierge/ReportPDF";
import type { PilotReportData } from "./types";

export async function exportToPDF(data: PilotReportData, fileName: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = createElement(ReportPDF, { data }) as any;
  const blob = await pdf(doc).toBlob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
