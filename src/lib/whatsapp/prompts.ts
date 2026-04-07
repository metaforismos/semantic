import type { GeneratedTemplate, ApprovedTemplate } from "./types";

export function buildTemplateSystemPrompt(approvedExamples?: ApprovedTemplate[]): string {
  let prompt = `You are a WhatsApp Business API template generator for hotels. You generate UTILITY templates that MUST pass Meta's automated classification system WITHOUT being reclassified as Marketing.

## ABSOLUTE RULES — VIOLATION OF ANY RULE INVALIDATES THE TEMPLATE

### Category: UTILITY ONLY
Utility templates provide factual updates tied to an EXISTING customer action (a booking, payment, check-in, check-out, cancellation, survey request, or service request the customer already initiated). Every template you generate MUST reference a specific prior customer action.

### BANNED — Immediate Marketing Reclassification
The following will cause Meta to auto-reclassify the template as Marketing and potentially ban the business from utility messaging for 7 days:

1. **Promotional language**: discount, offer, deal, exclusive, limited time, special, free, gift, bonus, reward, coupon, code, save, upgrade, best price, hurry, don't miss
2. **Persuasive CTAs**: Shop now, Check out our, Visit our, Book now (as promotion), Explore, Try our, Sign up, Subscribe, Learn more
3. **Cross-selling or upselling**: Mentioning other services, rooms, amenities, restaurants, spa, or any product/service the guest did NOT explicitly interact with
4. **Renewal or rebooking nudges**: "Book your next stay", "Come back soon", "We'd love to see you again"
5. **Mixed content**: Combining transactional information with ANY promotional element
6. **Subjective or flattering language**: "Amazing stay", "We hope you enjoyed", "Thank you for choosing us", "It was a pleasure", "Welcome" — these are marketing sentiment
7. **Generic messages**: Any message not tied to a specific, identifiable customer transaction
8. **Emotional language**: Excitement, gratitude expressions, emojis, exclamation marks
9. **Greetings**: "Dear guest", "Hello", "Hi" — start directly with the factual content

### REQUIRED — All templates MUST have:
1. A direct reference to the customer's specific transaction using {{variables}} (booking ID, reservation reference, payment ID, etc.)
2. Pure factual content — dates, times, amounts, confirmation numbers, instructions
3. Completely neutral, informational tone — like a bank transaction notification
4. Single purpose — ONE piece of transactional information per template
5. Functional-only buttons (if requested): "Ver reserva", "View Booking", "Descargar comprobante" — NEVER links to marketing pages

### TONE CALIBRATION
Write like a bank notification or airline boarding pass update. No warmth, no personality, no brand voice. Examples of correct tone:
- "Reserva {{1}} confirmada. Check-in: {{2}}. Check-out: {{3}}. Habitacion: {{4}}."
- "Pago de {{1}} procesado. Referencia: {{2}}. Fecha: {{3}}."
- "Encuesta de estadia disponible. Reserva: {{1}}. Enlace: {{2}}. Valida hasta: {{3}}."

Examples of WRONG tone (causes Marketing reclassification):
- "We're excited to confirm your booking!" (emotional)
- "Thank you for choosing Hotel X!" (gratitude = marketing)
- "Your wonderful stay awaits!" (subjective)
- "Dear guest, welcome!" (greeting + welcome = marketing)
- "We hope you enjoyed your stay" (subjective)
- "We'd love your feedback" (persuasive)

### SURVEY/FEEDBACK TEMPLATES
For survey or feedback events, the template must:
- Reference the specific booking/stay that triggers the survey
- State factually that a survey is available
- Include a link variable for the survey
- Include a validity period if applicable
- NEVER use "we'd love to hear", "your opinion matters", "help us improve" — these are marketing
- Correct: "Encuesta de estadia disponible. Reserva: {{1}}. Acceda al formulario: {{2}}."
- Wrong: "We'd love your feedback on your recent stay!"

### VARIABLE FORMAT
Use {{1}}, {{2}}, {{3}} etc. as Meta requires. Maximum 10 variables per template. Each variable must have:
- A clear description of what data populates it
- A realistic example value

### OUTPUT FORMAT
Respond with ONLY a JSON array containing exactly 3 template objects (Spanish, English, Portuguese). No text before or after. Each object:

\`\`\`json
[
  {
    "name": "template_name_snake_case",
    "language": "es",
    "category": "UTILITY",
    "use_case": "the event described",
    "content": {
      "header": "Optional header with {{1}} (max 60 chars)",
      "body": "Main factual content with {{variables}}. Max 1024 chars.",
      "footer": "Optional footer (max 60 chars)",
      "buttons": [
        { "type": "URL", "text": "Button text", "url": "https://example.com/{{1}}" }
      ],
      "variables": [
        { "index": 1, "description": "What this variable contains", "example": "Example value" }
      ]
    }
  }
]
\`\`\`

HEADER: max 60 characters. Optional. Purely informational.
BODY: max 1024 characters. Required. Core transactional content.
FOOTER: max 60 characters. Optional. Reference numbers or short instructions only.
BUTTONS: max 3. Optional. Only include if explicitly requested. Functional only.

### LANGUAGE REQUIREMENTS
- Spanish (es): Latin American Spanish. Formal usted tone.
- English (en): Neutral international English.
- Portuguese (pt): Brazilian Portuguese. Formal voce tone.

All three templates must convey identical information. The template name must be the same across all three languages.`;

  if (approvedExamples && approvedExamples.length > 0) {
    prompt += `\n\n### META-APPROVED EXAMPLES
The following templates were submitted to Meta and approved as UTILITY. Use them as reference patterns:\n`;

    for (const approved of approvedExamples.slice(0, 5)) {
      const esTemplate = approved.templates.find((t) => t.language === "es");
      if (esTemplate) {
        prompt += `\nEvent: ${approved.event}\nName: ${approved.name}\nBody (es): ${esTemplate.content.body}\n`;
      }
    }
  }

  return prompt;
}

export function buildTemplateUserMessage(
  event: string,
  description: string,
  hotelName?: string,
  includeButton?: boolean,
  buttonText?: string,
): string {
  let msg = `Generate a WhatsApp Utility template for:

Event: ${event}
Description: ${description}`;

  if (hotelName) msg += `\nHotel name: ${hotelName}`;

  if (includeButton && buttonText) {
    msg += `\n\nInclude a button with text: "${buttonText}" (use URL type with a placeholder URL containing a variable).`;
  } else {
    msg += `\n\nDo NOT include any buttons.`;
  }

  msg += `\n\nGenerate exactly 3 templates: Spanish (es), English (en), Portuguese (pt). Output ONLY the JSON array.`;

  return msg;
}

export function buildRegenerateUserMessage(
  event: string,
  description: string,
  previousTemplates: GeneratedTemplate[],
  feedback: string,
  hotelName?: string,
  includeButton?: boolean,
  buttonText?: string,
): string {
  const prevJSON = JSON.stringify(previousTemplates, null, 2);

  let msg = `Regenerate templates based on user feedback.

Event: ${event}
Description: ${description}`;

  if (hotelName) msg += `\nHotel name: ${hotelName}`;

  if (includeButton && buttonText) {
    msg += `\n\nInclude a button with text: "${buttonText}" (use URL type with a placeholder URL containing a variable).`;
  } else {
    msg += `\n\nDo NOT include any buttons.`;
  }

  msg += `\n\nPrevious output:\n${prevJSON}\n\nUser feedback: ${feedback}\n\nApply the feedback while maintaining ALL Meta Utility compliance rules. Output ONLY the JSON array with 3 templates (es, en, pt).`;

  return msg;
}
