import type { ComponentType } from "react";
import type { PanelProps, RendererPlugin } from "./types";

export class PluginRegistry {
  private renderers: RendererPlugin[] = [];

  register(...plugins: RendererPlugin[]): this {
    for (const p of plugins) {
      this.renderers.push(p);
    }
    return this;
  }

  resolveRenderer(contentType: string): RendererPlugin | undefined {
    return this.renderers.find((p) => p.contentTypes.includes(contentType));
  }

  collectSlot<K extends "Toolbar" | "Controls" | "Settings">(
    slot: K,
  ): ComponentType<PanelProps>[] {
    return this.renderers
      .map((p) => p[slot])
      .filter(Boolean) as ComponentType<PanelProps>[];
  }
}
