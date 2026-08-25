import { Type } from "typebox";

export const HealthCheckSchema = {
  tags: ["Health"],
  hide: true,
  description: "It checks the current liveness status of the API",
  response: {
    200: Type.Record(Type.String(), Type.String(), {
      description: "Indicates the liveness status of the service",
    }),
  },
};

export const HealthCheckReadySchema = {
  tags: ["Health"],
  hide: true,
  description:
    "It checks the readiness status of the API, pinging external dependencies",
  response: {
    200: Type.Object(
      {
        db: Type.Boolean(),
      },
      {
        additionalProperties: false,
        description:
          "Indicates the readiness status of the service, pinging external dependencies",
      },
    ),
  },
};
