import { getVersion } from "./getVersion.js";
import { ClamavPassthrough } from "./passthrough.js";
import type {
  ClamavConnectionOptions,
  ClamavPassthroughOptions,
  ClamavStreamOptions,
} from "./types.js";

export type ClamavClientOptions = ClamavConnectionOptions & ClamavStreamOptions;

export class ClamavClient {
  private options: ClamavClientOptions;

  constructor(options: ClamavClientOptions) {
    this.options = options;
  }

  passthrough(options?: ClamavPassthroughOptions): ClamavPassthrough {
    return new ClamavPassthrough(this.options, options);
  }

  async getVersion(): Promise<string> {
    return getVersion(this.options);
  }
}
