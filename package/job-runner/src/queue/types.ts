import type { AnyJobCommand, JobLane } from "@rezics/job";

export interface QueueSendOptions {
  retryLimit?: number;
  retryDelay?: number;
  expireInSeconds?: number;
  retentionSeconds?: number;
  deadLetter?: string;
  singletonKey?: string;
  singletonSeconds?: number;
  startAfter?: Date;
  policy?: "short";
}

export interface QueueLike {
  createQueue(name: string, options?: QueueSendOptions): Promise<unknown>;
  send(
    name: JobLane,
    data: AnyJobCommand,
    options?: QueueSendOptions,
  ): Promise<string | null | { id?: string | null }>;
}

export interface WorkerQueueLike extends QueueLike {
  work(
    name: JobLane,
    handler: (
      job:
        | { id: string; data: AnyJobCommand }
        | Array<{ id: string; data: AnyJobCommand }>,
    ) => Promise<unknown>,
  ): Promise<unknown>;
  stop(options?: { graceful?: boolean; timeout?: number }): Promise<void>;
}
