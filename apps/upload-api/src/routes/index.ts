import type { FastifyInstance } from "fastify";
import files from "./files/index.js";
import supportFiles from "./files/support.js";
import metadata from "./metadata/index.js";
import supportMetadata from "./metadata/support.js";
import permissions from "./permissions/index.js";
import supportPermissions from "./permissions/support.js";
import schedulerCallback from "./schedulerCallback.js";

export default async function routes(app: FastifyInstance) {
  app.register(files, { prefix: "/files" });
  app.register(supportFiles, { prefix: "/support/files" });
  app.register(metadata, { prefix: "/metadata" });
  app.register(supportMetadata, { prefix: "/support/metadata" });
  app.register(permissions, { prefix: "/permissions" });
  app.register(supportPermissions, { prefix: "/support/permissions" });
  app.register(schedulerCallback, { prefix: "/jobs" });
}
