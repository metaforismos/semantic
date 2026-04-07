import type { GeneratedTemplate, ComplianceViolation, ComplianceResult } from "./types";
import {
  BANNED_WORDS,
  BANNED_CTA_PATTERNS,
  SUBJECTIVE_PATTERNS,
  CROSS_SELL_PATTERNS,
  NAMED_VARIABLES,
} from "./constants";

const ALLOWED_VAR_NAMES = new Set(NAMED_VARIABLES.map((v) => v.name));

export function checkCompliance(template: GeneratedTemplate): ComplianceResult {
  const violations: ComplianceViolation[] = [];
  const { content } = template;
  const allText = [content.header, content.body, content.footer]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Rule 1: Banned promotional words
  for (const word of BANNED_WORDS) {
    if (allText.includes(word.toLowerCase())) {
      violations.push({
        rule: "BANNED_WORD",
        severity: "error",
        message: `Palabra prohibida: "${word}". Causa reclasificacion a Marketing.`,
        location: findLocation(word.toLowerCase(), content),
        match: word,
      });
    }
  }

  // Rule 2: Promotional CTAs
  for (const pattern of BANNED_CTA_PATTERNS) {
    const match = allText.match(pattern);
    if (match) {
      violations.push({
        rule: "PROMOTIONAL_CTA",
        severity: "error",
        message: `CTA promocional: "${match[0]}". Solo se permiten CTAs funcionales.`,
        location: "body",
        match: match[0],
      });
    }
  }

  // Rule 3: Must contain at least one variable placeholder
  if (!/\{\{\w+\}\}/.test(content.body)) {
    violations.push({
      rule: "NO_VARIABLES",
      severity: "error",
      message: "El body no contiene variables ({{guest_name}}, etc.). Templates Utility deben referenciar datos transaccionales.",
      location: "body",
    });
  }

  // Rule 3b: All variables must be from the allowed set
  const allVarMatches = [...allText.matchAll(/\{\{(\w+)\}\}/g)];
  for (const match of allVarMatches) {
    const varName = match[1];
    if (!ALLOWED_VAR_NAMES.has(varName)) {
      violations.push({
        rule: "UNKNOWN_VARIABLE",
        severity: "error",
        message: `Variable no disponible: {{${varName}}}. Solo se permiten: ${[...ALLOWED_VAR_NAMES].map((v) => `{{${v}}}`).join(", ")}.`,
        location: "body",
        match: `{{${varName}}}`,
      });
    }
  }

  // Rule 4: Exclamation marks
  if (allText.includes("!")) {
    violations.push({
      rule: "EXCLAMATION_MARK",
      severity: "warning",
      message: "Signos de exclamacion detectados. El tono debe ser neutral.",
      location: findLocation("!", content),
      match: "!",
    });
  }

  // Rule 5: Emoji detection
  const emojiPattern = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  if (emojiPattern.test(allText)) {
    violations.push({
      rule: "EMOJI",
      severity: "warning",
      message: "Emojis detectados. Templates Utility deben ser puramente textuales.",
      location: "body",
    });
  }

  // Rule 6: Body length
  if (content.body.length > 1024) {
    violations.push({
      rule: "BODY_TOO_LONG",
      severity: "error",
      message: `Body excede 1024 caracteres (${content.body.length}).`,
      location: "body",
    });
  }

  // Rule 7: Header length
  if (content.header && content.header.length > 60) {
    violations.push({
      rule: "HEADER_TOO_LONG",
      severity: "error",
      message: `Header excede 60 caracteres (${content.header.length}).`,
      location: "header",
    });
  }

  // Rule 8: Footer length
  if (content.footer && content.footer.length > 60) {
    violations.push({
      rule: "FOOTER_TOO_LONG",
      severity: "error",
      message: `Footer excede 60 caracteres (${content.footer.length}).`,
      location: "footer",
    });
  }

  // Rule 9: Button validation
  if (content.buttons) {
    if (content.buttons.length > 3) {
      violations.push({
        rule: "TOO_MANY_BUTTONS",
        severity: "error",
        message: "Maximo 3 botones permitidos.",
        location: "button",
      });
    }
    for (const button of content.buttons) {
      const btnText = button.text.toLowerCase();
      for (const pattern of BANNED_CTA_PATTERNS) {
        if (pattern.test(btnText)) {
          violations.push({
            rule: "PROMOTIONAL_BUTTON",
            severity: "error",
            message: `Boton promocional: "${button.text}". Debe ser funcional.`,
            location: "button",
            match: button.text,
          });
        }
      }
    }
  }

  // Rule 10: Gratitude / subjective language
  for (const pattern of SUBJECTIVE_PATTERNS) {
    const match = allText.match(pattern);
    if (match) {
      violations.push({
        rule: "SUBJECTIVE_LANGUAGE",
        severity: "error",
        message: `Lenguaje subjetivo/emotivo: "${match[0]}". Meta clasifica esto como Marketing.`,
        location: "body",
        match: match[0],
      });
    }
  }

  // Rule 11: Cross-sell detection
  for (const pattern of CROSS_SELL_PATTERNS) {
    const match = allText.match(pattern);
    if (match) {
      violations.push({
        rule: "CROSS_SELL",
        severity: "error",
        message: `Cross-sell detectado: "${match[0]}". Templates Utility deben tener un unico proposito.`,
        location: "body",
        match: match[0],
      });
    }
  }

  // Deduplicate by rule+match
  const seen = new Set<string>();
  const dedupedViolations = violations.filter((v) => {
    const key = `${v.rule}:${v.match || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const errorCount = dedupedViolations.filter((v) => v.severity === "error").length;
  const warningCount = dedupedViolations.filter((v) => v.severity === "warning").length;
  const score = Math.max(0, 100 - errorCount * 25 - warningCount * 5);

  return {
    passed: errorCount === 0,
    violations: dedupedViolations,
    score,
  };
}

function findLocation(
  needle: string,
  content: { header?: string; body: string; footer?: string },
): ComplianceViolation["location"] {
  if (content.header?.toLowerCase().includes(needle)) return "header";
  if (content.footer?.toLowerCase().includes(needle)) return "footer";
  return "body";
}
