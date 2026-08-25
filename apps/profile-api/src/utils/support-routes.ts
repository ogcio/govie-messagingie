import type { FastifyReply, FastifyRequest } from "fastify";

export function ensureValidSupportUser(
  request: FastifyRequest,
  reply: FastifyReply,
): undefined | FastifyReply {
  if (!request.userData) {
    return reply.status(401).send({
      statusCode: 401,
      name: "Unauthorized",
      code: "UNAUTHORIZED",
      detail: "User must be logged in",
      requestId: request.id,
    });
  }

  if (request.userData.organizationId) {
    return reply.status(403).send({
      statusCode: 403,
      name: "Forbidden",
      code: "FORBIDDEN",
      detail: "User must not be part of an organisation",
      requestId: request.id,
    });
  }

  if (!request.userData.isM2MApplication) {
    return reply.status(403).send({
      statusCode: 403,
      name: "Forbidden",
      code: "FORBIDDEN",
      detail:
        "This endpoint is only accessible by system-to-system applications",
      requestId: request.id,
    });
  }

  return undefined;
}
