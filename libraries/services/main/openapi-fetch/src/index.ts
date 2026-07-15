import { client } from "./generated/.kubb/client";

client.setConfig({ credentials: "include" });

export * from "./generated/.kubb/client";
export * from "./generated/client";
export * from "./generated/models";
