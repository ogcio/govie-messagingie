import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export async function hasPermission({
  app,
  request,
  reply,
  permission,
}: {
  app: FastifyInstance;
  request: FastifyRequest;
  reply: FastifyReply;
  permission: string;
}) {
  try {
    await app.checkPermissions(request, reply, [permission]);
    return true;
  } catch {
    return false;
  }
}
