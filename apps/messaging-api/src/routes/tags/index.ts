import { httpErrors } from "@fastify/sensible";
import type { FastifyInstance } from "fastify";
import {
  createTag,
  deleteTag,
  getTagTree,
  listTags,
  updateTag,
} from "../../services/tags/tag-service.js";
import { Permissions } from "../../types/permissions.js";
import type { FastifyRequestTypebox } from "../../types/shared.js";
import {
  CreateTagReqSchema,
  DeleteTagReqSchema,
  GetTagTreeReqSchema,
  ListTagsReqSchema,
  UpdateTagReqSchema,
} from "../../types/tags.js";

export const prefix = "/tags";

export default async function tags(app: FastifyInstance) {
  // Create tag
  app.post(
    "/",
    {
      preValidation: (req, res) =>
        app.checkPermissions(req, res, [
          Permissions.MessageSelf.Write,
          Permissions.OnboardedCitizen,
        ]),
      schema: CreateTagReqSchema,
    },
    async function handleCreateTag(
      request: FastifyRequestTypebox<typeof CreateTagReqSchema>,
      reply,
    ) {
      if (!request.userData) {
        throw httpErrors.unauthorized("User needs to be logged in");
      }

      const result = await createTag(
        app.pg.pool,
        request.userData.userId,
        request.body,
      );

      return reply.status(201).send({ data: result });
    },
  );

  // List tags (flat)
  app.get(
    "/",
    {
      preValidation: (req, res) =>
        app.checkPermissions(
          req,
          res,
          [Permissions.MessageSelf.Read, Permissions.OnboardedCitizen],
          { method: "AND" },
        ),
      schema: ListTagsReqSchema,
    },
    async function handleListTags(
      request: FastifyRequestTypebox<typeof ListTagsReqSchema>,
    ) {
      if (!request.userData) {
        throw httpErrors.unauthorized("User needs to be logged in");
      }

      const result = await listTags(app.pg.pool, request.userData.userId);

      return { data: result };
    },
  );

  // Tag tree — MUST be registered before /:tagId to avoid "tree" being parsed as an id
  app.get(
    "/tree",
    {
      preValidation: (req, res) =>
        app.checkPermissions(
          req,
          res,
          [Permissions.MessageSelf.Read, Permissions.OnboardedCitizen],
          { method: "AND" },
        ),
      schema: GetTagTreeReqSchema,
    },
    async function handleGetTagTree(
      request: FastifyRequestTypebox<typeof GetTagTreeReqSchema>,
    ) {
      if (!request.userData) {
        throw httpErrors.unauthorized("User needs to be logged in");
      }

      const result = await getTagTree(app.pg.pool, request.userData.userId);

      return { data: result };
    },
  );

  // Update tag
  app.patch(
    "/:tagId",
    {
      preValidation: (req, res) =>
        app.checkPermissions(req, res, [
          Permissions.MessageSelf.Write,
          Permissions.OnboardedCitizen,
        ]),
      schema: UpdateTagReqSchema,
    },
    async function handleUpdateTag(
      request: FastifyRequestTypebox<typeof UpdateTagReqSchema>,
      reply,
    ) {
      if (!request.userData) {
        throw httpErrors.unauthorized("User needs to be logged in");
      }

      const result = await updateTag(
        app.pg.pool,
        request.userData.userId,
        request.params.tagId,
        request.body,
      );

      return reply.send({ data: result });
    },
  );

  // Delete tag
  app.delete(
    "/:tagId",
    {
      preValidation: (req, res) =>
        app.checkPermissions(req, res, [
          Permissions.MessageSelf.Write,
          Permissions.OnboardedCitizen,
        ]),
      schema: DeleteTagReqSchema,
    },
    async function handleDeleteTag(
      request: FastifyRequestTypebox<typeof DeleteTagReqSchema>,
      reply,
    ) {
      if (!request.userData) {
        throw httpErrors.unauthorized("User needs to be logged in");
      }

      const result = await deleteTag(
        app.pg.pool,
        request.userData.userId,
        request.params.tagId,
      );

      return reply.send({ data: result });
    },
  );
}
