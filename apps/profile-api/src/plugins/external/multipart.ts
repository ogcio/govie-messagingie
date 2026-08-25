import fastifyMultipart from "@fastify/multipart";

export const autoConfig = {
  limits: {
    fieldNameSize: 100, // Max field name size in bytes
    fieldSize: 100, // Max field value size in bytes
    fields: 10, // Max number of non-file fields
    fileSize: 10 * 1024 * 1024, // Max file size in bytes (10 MB)
    files: 1, // Max number of file fields
    parts: 1000, // Max number of parts
  },
  attachFieldsToBody: true,
};

export default fastifyMultipart;
