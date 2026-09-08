import { client } from "./generated/.kubb/client";

client.setConfig({ options: { credentials: "include" } });

export { ResponseError as ApiClientError } from "./generated/.kubb/client";
export * from "./generated/.kubb/client";
export * from "./generated/client";
export * from "./generated/hooks";
export * from "./generated/models";
