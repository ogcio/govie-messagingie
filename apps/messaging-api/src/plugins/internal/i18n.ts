import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import fp from "fastify-plugin";
import { Translator } from "../../utils/i18n.js";

export default fp(
  async function i18nPlugin(
    fastify: FastifyInstance,
    _options: FastifyPluginOptions,
  ) {
    fastify.decorate("i18n", new Translator());

    return Promise.resolve();
  },
  {
    name: "i18n-plugin",
  },
);
