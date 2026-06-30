import { getActiveSpan } from "@ogcio/o11y-sdk-node";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

export default fp(
  async (server: FastifyInstance, _opts: FastifyPluginAsync) => {
    server.addHook("preHandler", async (request) => {
      if (!request.userData?.pseudoUser) {
        return;
      }

      const activeSpan = getActiveSpan();
      if (!activeSpan) {
        return;
      }

      activeSpan.setAttribute("pseudo_user.id", request.userData.pseudoUser.id);
      activeSpan.setAttribute(
        "pseudo_user.version",
        request.userData.pseudoUser.version,
      );
    });
  },
  { name: "pseudo-user-traces-hook", dependencies: ["api-auth"] },
);
