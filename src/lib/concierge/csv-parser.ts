import type {
  RawMessage,
  Message,
  Conversation,
  CSVParseResult,
  CSVValidationError,
  MessageType,
} from "./types";

const REQUIRED_FIELDS = [
  "customer_id",
  "conversation_id",
  "message_type",
  "sent_at",
  "message_order",
  "conversation_text",
];

const VALID_MESSAGE_TYPES: MessageType[] = ["Campaign", "Human", "IA", "Survey", "Automatic"];

function detectSeparator(firstLine: string): string {
  if (firstLine.includes("\t")) return "\t";
  if (firstLine.split(",").length > firstLine.split(";").length) return ",";
  return ";";
}

function isValidPhone(value: string): boolean {
  if (!value || !value.trim()) return false;
  const cleaned = value.replace(/[\s\-\(\)\+]/g, "");
  return /^\d{7,15}$/.test(cleaned);
}

/**
 * Parse CSV content handling quoted fields with embedded newlines.
 * Returns array of rows, each row is an array of field values.
 */
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
        i++; // skip escaped quote
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
        if (ch === "\r") i++; // skip \n after \r
      } else {
        current += ch;
      }
    }
  }

  // Last row
  if (current.length > 0 || fields.length > 0) {
    fields.push(current.trim());
    if (fields.some((f) => f.length > 0)) {
      rows.push([...fields]);
    }
  }

  return rows;
}

export function parseCSV(content: string): {
  result?: CSVParseResult;
  errors: CSVValidationError[];
} {
  const errors: CSVValidationError[] = [];
  const warnings: string[] = [];

  // Detect separator from first line
  const firstNewline = content.indexOf("\n");
  const firstLine = firstNewline >= 0 ? content.slice(0, firstNewline).replace(/\r$/, "") : content;

  if (!firstLine.trim()) {
    errors.push({ type: "blocking", message: "El CSV está vacío o solo tiene encabezados." });
    return { errors };
  }

  const separator = detectSeparator(firstLine);

  // Parse with proper quoted-field handling
  const allRows = parseCSVLines(content, separator);
  if (allRows.length < 2) {
    errors.push({ type: "blocking", message: "El CSV está vacío o solo tiene encabezados." });
    return { errors };
  }

  const headers = allRows[0].map((h) => h.replace(/^"|"$/g, ""));

  // Check required fields
  const missing = REQUIRED_FIELDS.filter((f) => !headers.includes(f));
  if (missing.length > 0) {
    errors.push({
      type: "blocking",
      message: `Campos requeridos faltantes: ${missing.join(", ")}`,
    });
    return { errors };
  }

  const fieldIndex: Record<string, number> = {};
  headers.forEach((h, i) => (fieldIndex[h] = i));

  const rawMessages: RawMessage[] = [];
  let rowsWithIssues = 0;

  for (let i = 1; i < allRows.length; i++) {
    const cols = allRows[i].map((c) => c.replace(/^"|"$/g, ""));

    // Skip truly empty rows (all fields empty)
    if (cols.every((c) => !c.trim())) continue;

    const conversationId = cols[fieldIndex["conversation_id"]] || "";
    const sentAt = cols[fieldIndex["sent_at"]] || "";
    const messageTypeRaw = cols[fieldIndex["message_type"]] || "";

    // Never discard rows — use fallback values for missing/invalid fields
    const validDate = sentAt && !isNaN(new Date(sentAt).getTime());
    const validType = VALID_MESSAGE_TYPES.includes(messageTypeRaw as MessageType);
    const messageOrder = parseInt(cols[fieldIndex["message_order"]] || "0", 10);

    if (!conversationId || !validDate || !validType) {
      rowsWithIssues++;
    }

    // Assign message_type: keep original if valid, otherwise treat as "Human"
    // (better to include an unknown message than to lose it)
    const messageType: MessageType = validType
      ? (messageTypeRaw as MessageType)
      : "Human";

    rawMessages.push({
      customer_id: parseInt(cols[fieldIndex["customer_id"]] || "0", 10),
      customer_name: cols[fieldIndex["customer_name"]] || "",
      conversation_id: conversationId || `unknown_${i}`,
      external_line: cols[fieldIndex["external_line"]] || "",
      message_type: messageType,
      campaign: cols[fieldIndex["campaign"]] || "",
      template: cols[fieldIndex["template"]] || "",
      sent_at: validDate ? sentAt : new Date(0).toISOString(),
      message_order: isNaN(messageOrder) ? i : messageOrder,
      conversation_text: cols[fieldIndex["conversation_text"]] || "",
    });
  }

  if (rowsWithIssues > 0) {
    warnings.push(`${rowsWithIssues} filas con datos parciales (incluidas con valores por defecto).`);
  }

  // Check single customer_id
  const customerIds = [...new Set(rawMessages.map((m) => m.customer_id))];
  if (customerIds.length > 1) {
    errors.push({
      type: "blocking",
      message: "El CSV contiene datos de múltiples hoteles (customer_id inconsistente).",
    });
    return { errors };
  }

  // Group by conversation
  const conversationMap = new Map<string, RawMessage[]>();
  for (const msg of rawMessages) {
    const existing = conversationMap.get(msg.conversation_id) || [];
    existing.push(msg);
    conversationMap.set(msg.conversation_id, existing);
  }

  const conversations: Conversation[] = [];
  for (const [convId, msgs] of conversationMap) {
    // Sort by message_order, with sent_at as tiebreaker
    msgs.sort((a, b) => {
      if (a.message_order !== b.message_order) return a.message_order - b.message_order;
      return new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime();
    });

    const messages: Message[] = msgs.map((m) => ({
      message_type: m.message_type,
      campaign: m.campaign,
      template: m.template,
      sent_at: new Date(m.sent_at),
      message_order: m.message_order,
      text: m.conversation_text,
      external_line: m.external_line,
    }));

    const firstCampaignIdx = messages.findIndex(
      (m) => m.message_type === "Campaign" || m.message_type === "Survey"
    );
    const hasHumanMessage = messages.some((m) => m.message_type === "Human");

    const origin = firstCampaignIdx >= 0 ? messages[firstCampaignIdx].campaign || "Sin campaña" : "Sin campaña";
    const externalLine = msgs[0]?.external_line || "";

    conversations.push({
      conversation_id: convId,
      customer_id: customerIds[0],
      customer_name: msgs[0]?.customer_name || "",
      messages,
      origin,
      is_active: hasHumanMessage,
      external_line: externalLine,
    });
  }

  // Check minimum active conversations
  const activeCount = conversations.filter((c) => c.is_active).length;
  if (activeCount < 10) {
    errors.push({
      type: "blocking",
      message: `El CSV no contiene suficientes conversaciones con interacción para generar un reporte representativo (${activeCount} activas, mínimo 10).`,
    });
    return { errors };
  }

  // Auto-detect period
  const allDates = rawMessages.map((m) => new Date(m.sent_at).getTime());
  const periodStart = new Date(Math.min(...allDates)).toISOString().split("T")[0];
  const periodEnd = new Date(Math.max(...allDates)).toISOString().split("T")[0];

  return {
    result: {
      conversations,
      customer_id: customerIds[0],
      customer_name: rawMessages[0]?.customer_name || "Hotel",
      period_start: periodStart,
      period_end: periodEnd,
      warnings,
      total_rows: rawMessages.length,
      discarded_rows: 0,
    },
    errors: warnings.map((w) => ({ type: "warning" as const, message: w })),
  };
}
