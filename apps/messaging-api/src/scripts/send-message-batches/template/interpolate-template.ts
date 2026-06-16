import {
  ALLOWED_TEMPLATE_VARIABLES,
  type AllowedTemplateVariable,
} from "../domain/statuses.js";

const allowedTemplateVariables = new Set<string>(ALLOWED_TEMPLATE_VARIABLES);

export interface TemplateVariables {
  publicName: string | null;
  email: string;
}

function resolveTemplateVariable(
  key: AllowedTemplateVariable,
  variables: TemplateVariables,
): string {
  if (key === "publicName") {
    return variables.publicName ?? "";
  }

  return variables.email;
}

export function interpolateTemplate(
  template: string,
  variables: TemplateVariables,
): string {
  return template.replace(
    /{{\s*([a-zA-Z]+)\s*}}/g,
    (_fullMatch, key: string) => {
      if (!allowedTemplateVariables.has(key)) {
        throw new Error(`Unsupported template variable: ${key}`);
      }

      return resolveTemplateVariable(key as AllowedTemplateVariable, variables);
    },
  );
}
