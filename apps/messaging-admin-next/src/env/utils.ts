import z from "zod"

export const requiredInProduction = (
  value: string | undefined,
  ctx: z.RefinementCtx,
) => {
  if (process.env.NODE_ENV === "production" && !value) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Missing required environment variable in production",
    })
  }
}

export const requiredInDevelopment = (
  value: string | undefined,
  ctx: z.RefinementCtx,
) => {
  if (process.env.NODE_ENV === "development" && !value) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Missing required environment variable in development",
    })
  }
}
