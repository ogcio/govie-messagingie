export interface KVCache {
  get<T>(key: string, validator?: (v: unknown) => v is T): Promise<T | null>
  set<T>(key: string, item: T, expiresInSeconds: number): Promise<void>
  destroy(key: string): Promise<void>
}
