/**
 * Robust JSON extraction from LLM responses.
 * Handles markdown fences, preamble text, and truncated responses.
 */
export function safeParseJSON<T = unknown>(raw: string): T {
  // Strip markdown fences
  let text = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // ignore, try recovery strategies
  }

  // Extract JSON object from surrounding text (LLM sometimes adds preamble/epilogue)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // Try fixing truncated JSON — close open arrays/objects
      let candidate = jsonMatch[0];
      const openBraces = (candidate.match(/\{/g) || []).length;
      const closeBraces = (candidate.match(/\}/g) || []).length;
      const openBrackets = (candidate.match(/\[/g) || []).length;
      const closeBrackets = (candidate.match(/\]/g) || []).length;

      // Remove trailing incomplete values (comma, partial string)
      candidate = candidate.replace(/,\s*["\w]*$/, "");
      candidate += "]".repeat(Math.max(0, openBrackets - closeBrackets));
      candidate += "}".repeat(Math.max(0, openBraces - closeBraces));

      try {
        return JSON.parse(candidate);
      } catch {
        // last resort: failed
      }
    }
  }

  throw new Error("Could not extract valid JSON from LLM response");
}
