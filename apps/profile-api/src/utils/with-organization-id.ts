import { httpErrors } from "@fastify/sensible";

export const withOrganizationId = (request: {
  userData?: { organizationId?: string };
}): string => {
  if (request.userData?.organizationId) {
    return request.userData.organizationId;
  }

  throw httpErrors.forbidden("Organization id is not set");
};
