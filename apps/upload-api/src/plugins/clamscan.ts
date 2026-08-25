import fp from "fastify-plugin";
import { ClamavClient } from "../utils/clamav/index.js";

declare module "fastify" {
  interface FastifyRequest {
    avClient: ClamavClient;
  }
}

export default fp(
  async (fastify) => {
    const avClient = new ClamavClient({
      host: fastify.config.CLAMAV_HOST as string,
      port: 3310,
      highWaterMark: fastify.config.CLAMAV_CHUNKS_NUMBER as number,
      // `ClamavPassthrough` multiplies highWaterMark by chunkSize, so keeping
      // chunks modest keeps AV buffering and backpressure under control while
      // still sending frames large enough for good throughput.
      chunkSize: (fastify.config.CLAMAV_CHUNK_SIZE_KB as number) * 1024, // 128 KiB
    });

    fastify.decorate("avClient", avClient);
  },
  { name: "clamscanPlugin" },
);
