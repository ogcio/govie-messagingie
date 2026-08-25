export const getUploadLimit = (config: {
  UPLOAD_LIMIT_PER_IP_PER_MINUTE?: number;
}) =>
  config.UPLOAD_LIMIT_PER_IP_PER_MINUTE &&
  Number.isInteger(config.UPLOAD_LIMIT_PER_IP_PER_MINUTE)
    ? (config.UPLOAD_LIMIT_PER_IP_PER_MINUTE as number)
    : 250;
