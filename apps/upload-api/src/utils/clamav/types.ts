export type ClamavScanStatus = "valid" | "infected" | "failed";

export type ClamavScanResult = {
  status: ClamavScanStatus;
  message: string;
  viruses?: string[];
};

export type ClamavConnectionOptions = {
  host: string;
  port: number;
  /** Connection timeout in milliseconds. Default: 5000 */
  connectionTimeout?: number;
  /** Scan timeout in milliseconds (time to wait for server response after all data sent). Default: 120000 */
  scanTimeout?: number;
};

export type ClamavStreamOptions = {
  /** Size in bytes of each INSTREAM chunk sent to clamd. Default: 65536 (64 KiB) */
  chunkSize?: number;
  /** Number of chunks to buffer before applying backpressure. Default: 4 */
  highWaterMark?: number;
};

export type ClamavPassthroughOptions = {
  /** Disable readable-side passthrough when the caller only needs scan completion events. */
  emitReadable?: boolean;
};

export type ClamavScannerOptions = ClamavConnectionOptions &
  ClamavStreamOptions;
