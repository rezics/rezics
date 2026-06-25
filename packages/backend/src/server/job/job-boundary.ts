import {
  type AnyJobCommand,
  createJobEnqueueClient,
  type EnqueueResult,
} from "@rezics/contract/job";
import { env } from "../env";

export interface JobProducer {
  enqueue(command: AnyJobCommand): Promise<EnqueueResult>;
}

function createDisabledProducer(): JobProducer {
  return {
    async enqueue(command) {
      throw new Error(
        `Job runner is not configured; cannot enqueue ${command.kind}`,
      );
    },
  };
}

export function createServerJobProducer(options: {
  baseUrl?: string;
  internalSecret?: string;
}): JobProducer {
  if (!options.baseUrl || !options.internalSecret) {
    return createDisabledProducer();
  }
  return createJobEnqueueClient({
    baseUrl: options.baseUrl,
    internalSecret: options.internalSecret,
  });
}

export const serverJobProducer = createServerJobProducer({
  baseUrl: env.JOB_RUNNER_BASE_URL,
  internalSecret: env.JOB_RUNNER_INTERNAL_SECRET,
});
