import type { EditorPlugin } from "../../core/types";
import { jsonLintExtension } from "./lint";

export function jsonLint(): EditorPlugin {
  return {
    name: "json-lint",
    extensions: jsonLintExtension(),
  };
}
