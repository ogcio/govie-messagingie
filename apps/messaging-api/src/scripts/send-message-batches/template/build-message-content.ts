import type { MessageContent } from "../domain/types.js";
import {
  interpolateTemplate,
  type TemplateVariables,
} from "./interpolate-template.js";

function buildExcerpt(plainText: string): string {
  const trimmedPlainText = plainText.trim();

  if (trimmedPlainText.length <= 140) {
    return trimmedPlainText;
  }

  return `${trimmedPlainText.slice(0, 137)}...`;
}

export function buildMessageContent(params: {
  subject: string;
  htmlTemplate: string;
  txtTemplate: string;
  variables: TemplateVariables;
}): MessageContent {
  const plainText = interpolateTemplate(
    params.txtTemplate,
    params.variables,
  ).trim();
  const richText = interpolateTemplate(params.htmlTemplate, params.variables);

  return {
    threadName: params.subject,
    subject: params.subject,
    excerpt: buildExcerpt(plainText),
    plainText,
    richText,
  };
}
