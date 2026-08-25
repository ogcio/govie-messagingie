import rateLimit from "@fastify/rate-limit";

// Rate limit will only be applied to routes that explicitly register it
// in our case, the upload file route
export const autoConfig = {
  global: false,
};

export default rateLimit;
