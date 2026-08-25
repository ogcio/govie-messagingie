import type { FastifyInstance } from "fastify";
import tasks from "./tasks/index.js";

export default async function routes(app: FastifyInstance) {
  app.register(tasks, { prefix: "/tasks" });
}
