export function getCurrentUTCDate(): string {
  return new Date(new Date().toUTCString()).toISOString();
}
