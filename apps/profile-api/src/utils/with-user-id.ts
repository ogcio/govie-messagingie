import { httpErrors } from "@fastify/sensible";

export const withUserId = (request: {
  userData?: { userId?: string };
}): string => {
  if (request.userData?.userId) {
    return request.userData.userId;
  }

  throw httpErrors.forbidden("User id is not set");
};
