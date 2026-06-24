import { fileURLToPath } from "node:url";
import { baseStorybookViteConfig } from "@rezics/storybook-config";

export default baseStorybookViteConfig({
  unoConfigPath: fileURLToPath(new URL("../uno.config.ts", import.meta.url)),
});
