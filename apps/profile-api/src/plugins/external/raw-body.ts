import fastifyRawBody from "fastify-raw-body";

export const autoConfig = {
  field: "rawBody",
  global: false,
  encoding: false,
  runFirst: true,
  routes: [],
};

export default fastifyRawBody;
