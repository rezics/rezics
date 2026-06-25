import { type AnyJobCommand, parseJobCommand } from "./command";

export interface EnqueueClientOptions {
  baseUrl: string;
  internalSecret: string;
  fetch?: typeof fetch;
}

export interface EnqueueResult {
  kind: string;
  idempotencyKey: string;
  lane: string;
  status: "created" | "coalesced";
  jobId?: string;
}

export interface BatchEnqueueResult {
  results: EnqueueResult[];
}

export class JobEnqueueClient {
  readonly #baseUrl: string;
  readonly #internalSecret: string;
  readonly #fetch: typeof fetch;

  constructor(options: EnqueueClientOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.#internalSecret = options.internalSecret;
    this.#fetch = options.fetch ?? fetch;
  }

  async enqueue(command: AnyJobCommand): Promise<EnqueueResult> {
    const parsed = parseJobCommand(command);
    const response = await this.#fetch(`${this.#baseUrl}/jobs/enqueue`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": this.#internalSecret,
      },
      body: JSON.stringify(parsed),
    });
    if (!response.ok) {
      throw new Error(
        `Job enqueue failed with HTTP ${response.status}: ${await response.text()}`,
      );
    }
    return (await response.json()) as EnqueueResult;
  }

  async enqueueBatch(commands: AnyJobCommand[]): Promise<BatchEnqueueResult> {
    const parsed = commands.map((command) => parseJobCommand(command));
    const response = await this.#fetch(`${this.#baseUrl}/jobs/enqueue/batch`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": this.#internalSecret,
      },
      body: JSON.stringify({ commands: parsed }),
    });
    if (!response.ok) {
      throw new Error(
        `Batch job enqueue failed with HTTP ${response.status}: ${await response.text()}`,
      );
    }
    return (await response.json()) as BatchEnqueueResult;
  }
}

export function createJobEnqueueClient(options: EnqueueClientOptions) {
  return new JobEnqueueClient(options);
}
