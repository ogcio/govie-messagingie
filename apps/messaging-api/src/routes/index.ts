import type { FastifyInstance } from "fastify";

import jobs, { prefix as jobsPrefix } from "./jobs/index.js";
import messageAction, {
  prefix as messageActionsPrefix,
} from "./message-actions/index.js";
import messageEvents, {
  prefix as messsageEventsPrefix,
} from "./message-events/index.js";
import messages, { prefix as messagePrefix } from "./messages/index.js";
import supportMessages, { supportMessagesPrefix } from "./messages/support.js";
import providers, { prefix as providersPrefix } from "./providers/index.js";
import tags, { prefix as tagsPrefix } from "./tags/index.js";
import templates from "./templates/index.js";

export default async function routes(app: FastifyInstance) {
  app.register(messages, { prefix: messagePrefix });
  app.register(providers, { prefix: providersPrefix });
  app.register(templates, { prefix: "/templates" });
  app.register(messageEvents, { prefix: messsageEventsPrefix });
  app.register(jobs, { prefix: jobsPrefix });
  app.register(messageAction, { prefix: messageActionsPrefix });
  app.register(supportMessages, { prefix: supportMessagesPrefix });
  app.register(tags, { prefix: tagsPrefix });
}
