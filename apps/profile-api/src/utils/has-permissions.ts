import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export async function hasPermissions({
  app,
  request,
  reply,
  permissions,
}: {
  app: FastifyInstance;
  request: FastifyRequest;
  reply: FastifyReply;
  permissions: string[];
}) {
  try {
    await app.checkPermissions(request, reply, permissions);
    return true;
  } catch {
    return false;
  }
}
