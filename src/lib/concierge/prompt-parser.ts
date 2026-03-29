import type { PipelinePrompt, PromptParseResult, PromptValidationError } from "./quality-types";

const REQUIRED_FIELDS = ["PromptKey", "Version", "Status", "System_Template"];

function detectSeparator(firstLine: string): string {
  if (firstLine.includes("\t")) return "\t";
  if (firstLine.split(",").length > firstLine.split(";").length) return ",";
  return ";";
}

function parseCSVLines(content: string, separator: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  const fields: string[] = [];

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === separator) {
        fields.push(current.trim());
        current = "";
      } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        fields.push(current.trim());
        if (fields.some((f) => f.length > 0)) {
          rows.push([...fields]);
        }
        fields.length = 0;
        current = "";
        if (ch === "\r") i++;
      } else {
        current += ch;
      }
    }
  }

  if (current.length > 0 || fields.length > 0) {
    fields.push(current.trim());
    if (fields.some((f) => f.length > 0)) {
      rows.push([...fields]);
    }
  }

  return rows;
}

export function parsePromptCSV(content: string): {
  result?: PromptParseResult;
  errors: PromptValidationError[];
} {
  const errors: PromptValidationError[] = [];
  const warnings: string[] = [];

  const firstNewline = content.indexOf("\n");
  const firstLine = firstNewline >= 0 ? content.slice(0, firstNewline).replace(/\r$/, "") : content;

  if (!firstLine.trim()) {
    errors.push({ type: "blocking", message: "El CSV de prompts está vacío." });
    return { errors };
  }

  const separator = detectSeparator(firstLine);
  const allRows = parseCSVLines(content, separator);

  if (allRows.length < 2) {
    errors.push({ type: "blocking", message: "El CSV de prompts está vacío o solo tiene encabezados." });
    return { errors };
  }

  const headers = allRows[0].map((h) => h.replace(/^"|"$/g, ""));

  const missing = REQUIRED_FIELDS.filter((f) => !headers.includes(f));
  if (missing.length > 0) {
    errors.push({
      type: "blocking",
      message: `Campos requeridos faltantes en prompts CSV: ${missing.join(", ")}`,
    });
    return { errors };
  }

  const fieldIndex: Record<string, number> = {};
  headers.forEach((h, i) => (fieldIndex[h] = i));

  const prompts: PipelinePrompt[] = [];

  for (let i = 1; i < allRows.length; i++) {
    const cols = allRows[i].map((c) => c.replace(/^"|"$/g, ""));
    if (cols.every((c) => !c.trim())) continue;

    const promptKey = cols[fieldIndex["PromptKey"]] || "";
    const version = cols[fieldIndex["Version"]] || "";
    const status = cols[fieldIndex["Status"]] || "";
    const systemTemplate = cols[fieldIndex["System_Template"]] || "";
    const userTemplate = cols[fieldIndex["User_Template"]] || "";
    const systemSize = parseInt(cols[fieldIndex["System_Size"]] || "0", 10);
    const userSize = parseInt(cols[fieldIndex["User_Size"]] || "0", 10);
    const createdAt = cols[fieldIndex["Created_At"]] || "";
    const updatedAt = cols[fieldIndex["Updated_At"]] || "";

    if (!promptKey) {
      warnings.push(`Fila ${i + 1}: PromptKey vacío, ignorada.`);
      continue;
    }

    prompts.push({
      prompt_key: promptKey,
      version,
      status: status === "Active" ? "Active" : "Inactive",
      system_template: systemTemplate,
      user_template: userTemplate,
      system_size: isNaN(systemSize) ? systemTemplate.length : systemSize,
      user_size: isNaN(userSize) ? userTemplate.length : userSize,
      created_at: createdAt,
      updated_at: updatedAt,
    });
  }

  const activePrompts = prompts.filter((p) => p.status === "Active");

  if (activePrompts.length === 0) {
    errors.push({
      type: "blocking",
      message: "No se encontraron prompts activos (Status = 'Active').",
    });
    return { errors };
  }

  return {
    result: {
      prompts,
      active_prompts: activePrompts,
      warnings,
    },
    errors: warnings.map((w) => ({ type: "warning" as const, message: w })),
  };
}
