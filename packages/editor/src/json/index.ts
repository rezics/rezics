import type { EditorPlugin } from "../core/types";
import { json } from "./core/index";
import { jsonLint } from "./lint/index";

export interface JsonFullConfig {
  lint?: boolean;
}

export function jsonFull(config?: JsonFullConfig): EditorPlugin[] {
  const plugins: EditorPlugin[] = [json()];

  if (config?.lint !== false) {
    plugins.push(jsonLint());
  }

  return plugins;
}

export { formatJson } from "./core/commands";
// Re-export granular factories
// 重新导出细粒度的工厂函数。
export { json } from "./core/index";
export { jsonLint } from "./lint/index";
