import { describe, expect, it } from "bun:test";
import { PluginRegistry } from "./registry";
import type { RendererPlugin } from "./types";

function makePlugin(
  id: string,
  contentTypes: string[],
  slots?: Partial<Pick<RendererPlugin, "Toolbar" | "Controls" | "Settings">>,
): RendererPlugin {
  return {
    kind: "renderer",
    id,
    contentTypes,
    Renderer: () => null,
    ...slots,
  };
}

describe("PluginRegistry", () => {
  it("resolves renderer by content type", () => {
    const registry = new PluginRegistry();
    const plugin = makePlugin("txt", ["txt", "text"]);
    registry.register(plugin);

    expect(registry.resolveRenderer("txt")).toBe(plugin);
    expect(registry.resolveRenderer("text")).toBe(plugin);
  });

  it("returns undefined for unregistered content type", () => {
    const registry = new PluginRegistry();
    registry.register(makePlugin("txt", ["txt"]));

    expect(registry.resolveRenderer("html")).toBeUndefined();
  });

  it("returns first matching renderer when multiple match", () => {
    const registry = new PluginRegistry();
    const first = makePlugin("first", ["html"]);
    const second = makePlugin("second", ["html"]);
    registry.register(first, second);

    expect(registry.resolveRenderer("html")).toBe(first);
  });

  it("collects slot components from registered plugins", () => {
    const registry = new PluginRegistry();
    const SettingsA = () => null;
    const SettingsB = () => null;
    registry.register(
      makePlugin("a", ["txt"], { Settings: SettingsA }),
      makePlugin("b", ["html"], { Settings: SettingsB }),
      makePlugin("c", ["md"]),
    );

    const collected = registry.collectSlot("Settings");
    expect(collected).toEqual([SettingsA, SettingsB]);
  });

  it("returns empty array when no plugins provide the slot", () => {
    const registry = new PluginRegistry();
    registry.register(makePlugin("txt", ["txt"]));

    expect(registry.collectSlot("Toolbar")).toEqual([]);
  });
});
