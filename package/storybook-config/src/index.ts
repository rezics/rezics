import react from "@vitejs/plugin-react";
import type { StorybookConfig } from "@storybook/react-vite";
import { type Plugin, type UserConfig, mergeConfig } from "vite";

export type StorybookConfigOverrides = Partial<StorybookConfig>;

export function baseStorybookConfig(
  overrides: StorybookConfigOverrides = {},
): StorybookConfig {
  const { framework, typescript, core, ...rest } = overrides;

  return {
    stories: ["../src/**/*.stories.@(ts|tsx|mdx)"],
    addons: [],
    ...rest,
    framework: {
      name: "@storybook/react-vite",
      options: {
        builder: {
          viteConfigPath: ".storybook/vite.config.ts",
        },
      },
      ...(framework as object | undefined),
    } as StorybookConfig["framework"],
    core: {
      disableTelemetry: true,
      ...core,
    },
    typescript: {
      check: false,
      reactDocgen: false,
      ...typescript,
    },
  };
}

export interface BaseStorybookViteOptions {
  /**
   * Disable UnoCSS for hosts that don't render Uno-classed content
   * (e.g. the composition host or a CodeMirror-only editor preview).
   * When false, `unocss` need not be installed in the consuming package.
   */
  uno?: boolean;
}

export async function baseStorybookViteConfig(
  options: BaseStorybookViteOptions = {},
  overrides: UserConfig = {},
): Promise<UserConfig> {
  const { uno = true } = options;

  const plugins: Plugin[] = [];
  if (uno) {
    const { default: UnoCSS } = await import("unocss/vite");
    plugins.push(UnoCSS() as unknown as Plugin);
  }
  plugins.push(react());

  return mergeConfig(
    {
      resolve: {
        tsconfigPaths: true,
      },
      plugins,
      define: {
        "process.env": {},
      },
    } satisfies UserConfig,
    overrides,
  );
}
