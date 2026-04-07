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

  // Collect example values for all named variables used in body
  const varMatches = [...template.content.body.matchAll(/\{\{(\w+)\}\}/g)];
  const examples = varMatches
    .map((m) => NAMED_VARIABLES.find((nv) => nv.name === m[1]))
    .filter(Boolean)
    .map((nv) => nv!.example);

  if (examples.length > 0) {
    bodyComponent.example = {
      body_text: [examples],
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
