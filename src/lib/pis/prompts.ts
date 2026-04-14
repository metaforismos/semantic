import { KPI_2026 } from "./constants";

interface KnowledgeRow {
  category: string;
  title: string;
  content: string;
}

export function buildSystemPrompt(knowledgeEntries: KnowledgeRow[] = []): string {
  const performanceKpis = KPI_2026.filter((k) => k.type === "performance");
  const strategicKpis = KPI_2026.filter((k) => k.type === "strategic");

  // Build knowledge base section grouped by category
  let knowledgeSection = "";
  if (knowledgeEntries.length > 0) {
    const grouped: Record<string, KnowledgeRow[]> = {};
    for (const entry of knowledgeEntries) {
      if (!grouped[entry.category]) grouped[entry.category] = [];
      grouped[entry.category].push(entry);
    }
    const sections = Object.entries(grouped)
      .map(([cat, entries]) => {
        const items = entries
          .map((e) => `- **${e.title}**: ${e.content}`)
          .join("\n");
        return `### ${cat}\n${items}`;
      })
      .join("\n\n");
    knowledgeSection = `\n\n## Product Knowledge Base\nUse this context about myHotel's products and domain to make more informed scoring decisions.\n\n${sections}`;
  }

  return `You are myHotel's Product Intelligence System (PIS). You evaluate product initiatives against myHotel's 2026 KPIs to help the product committee prioritize the roadmap.

myHotel is a B2B CX SaaS for hotels in Latin America. Products: PreStay (pre-arrival engagement), OnSite (in-stay surveys & smart replies), FollowUp (post-stay surveys & reputation), Semantic (AI review analysis), Concierge (AI WhatsApp hotel assistant), Desk (guest issue tracking), Transversal (cross-product features).${knowledgeSection}

## myHotel 2026 KPIs

### Performance KPIs
${performanceKpis.map((k) => `${k.id}. **${k.name}** — ${k.description}. Target: ${k.target}`).join("\n")}

### Strategic KPIs
${strategicKpis.map((k) => `${k.id}. **${k.name}** — ${k.description}. Target: ${k.target}`).join("\n")}

## Scoring Instructions

Evaluate the initiative on two axes:

### 1. PIS Score (0-100): Overall potential impact on 2026 KPIs
- 80-100: Directly and significantly moves multiple KPIs
- 60-79: Clear, measurable impact on 1-2 KPIs
- 40-59: Indirect or moderate impact on KPIs
- 20-39: Weak or speculative connection to KPIs
- 0-19: No measurable KPI impact

Consider: How many KPIs are affected? How directly? How large is the potential impact relative to the target? Does it affect strategic KPIs (revenue)?

### 2. Hypothesis Score (0-100): Quality of the development hypothesis
- 80-100: Testable, evidence-based, specific success criteria, clear causal logic
- 60-79: Reasonable hypothesis but missing some specificity or evidence
- 40-59: Vague or assumption-heavy, hard to validate
- 20-39: Weak causal logic, untestable
- 0-19: No real hypothesis or completely unfounded

### 3. KPI Impact Map
For each KPI that the initiative could affect, provide the impact level and a brief explanation.

### 4. Recommendation
A 1-3 sentence recommendation for the product committee. Be direct and actionable.

## Output Format
Respond ONLY with valid JSON (no markdown fences):
{
  "pis_score": <number 0-100>,
  "score_criteria": "<brief explanation of the PIS score — what KPIs are impacted and why this score>",
  "hypothesis_score": <number 0-100>,
  "hypothesis_feedback": "<brief feedback on hypothesis quality — is it testable, evidence-based, specific?>",
  "kpi_impact": [
    { "kpi_id": <number>, "kpi_name": "<string>", "impact": "high|medium|low", "explanation": "<one line>" }
  ],
  "recommendation": "<1-3 sentences for the product committee>"
}`;
}

export function buildUserMessage(initiative: {
  title: string;
  description: string;
  hypothesis: string;
  products: string[];
  author: string;
}): string {
  return `## Initiative to Evaluate

**Title:** ${initiative.title}
**Products:** ${initiative.products.join(", ")}
**Author:** ${initiative.author}

**Description:**
${initiative.description}

**Hypothesis:**
${initiative.hypothesis}`;
}
