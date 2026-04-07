import type { GeneratedTemplate, MetaTemplateSubmission, MetaComponent } from "./types";
import { META_LANGUAGE_CODES, NAMED_VARIABLES } from "./constants";

export function toMetaFormat(template: GeneratedTemplate): MetaTemplateSubmission {
  const components: MetaComponent[] = [];

  if (template.content.header) {
    components.push({
      type: "HEADER",
      text: template.content.header,
    });
  }

  const bodyComponent: MetaComponent = {
    type: "BODY",
    text: template.content.body,
  };

  // Collect all variables used in body: named (from system) + numbered (from LLM)
  const allExamples: string[] = [];
  const bodyText = template.content.body;

  // Extract all variable placeholders in order of appearance
  const varMatches = [...bodyText.matchAll(/\{\{(\w+)\}\}/g)];
  for (const match of varMatches) {
    const varName = match[1];
    // Check if it's a named system variable
    const namedVar = NAMED_VARIABLES.find((nv) => nv.name === varName);
    if (namedVar) {
      allExamples.push(namedVar.example);
    } else {
      // Numbered variable — find in template's variables array
      const numVar = template.content.variables.find((v) => String(v.index) === varName);
      if (numVar) allExamples.push(numVar.example);
    }
  }

  if (allExamples.length > 0) {
    bodyComponent.example = {
      body_text: [allExamples],
    };
  }
  components.push(bodyComponent);

  if (template.content.footer) {
    components.push({
      type: "FOOTER",
      text: template.content.footer,
    });
  }

  if (template.content.buttons && template.content.buttons.length > 0) {
    components.push({
      type: "BUTTONS",
      buttons: template.content.buttons.map((b) => ({
        type: b.type,
        text: b.text,
        ...(b.url ? { url: b.url } : {}),
        ...(b.phone_number ? { phone_number: b.phone_number } : {}),
      })),
    });
  }

  return {
    name: template.name,
    category: "UTILITY",
    language: META_LANGUAGE_CODES[template.language] || template.language,
    components,
  };
}

export function toExportJSON(templates: GeneratedTemplate[]): string {
  const metaTemplates = templates.map(toMetaFormat);
  return JSON.stringify(metaTemplates, null, 2);
}
