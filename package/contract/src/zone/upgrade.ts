import { Value } from "@sinclair/typebox/value";
import type { Static } from "elysia";
import { t } from "elysia";
import { type ZoneConfigV1, zoneConfigV1Schema } from "./config-v1";

// ANCHOR: Zone config upgrade chain
// ANCHOR: 专区配置升级链

/**
 * Read wide, write narrow: this union accepts every historical envelope
 * version; read paths normalize through `upgradeZoneConfig()` before any
 * business code so that in memory only the latest type exists. Write paths
 * persist `zoneConfigV1Schema` (the latest version) only.
 * 读宽写窄：该联合接受所有历史信封版本；读取路径在任何业务代码之前通过
 * `upgradeZoneConfig()` 归一化，使内存中只存在最新类型。写入路径只持久化
 * `zoneConfigV1Schema`（最新版本）。
 */
export const zoneConfigEnvelopeSchema = t.Union([zoneConfigV1Schema]);

export type ZoneConfigEnvelope = Static<typeof zoneConfigEnvelopeSchema>;

/** The latest in-memory zone config type. 最新的内存中专区配置类型。 */
export type ZoneConfig = ZoneConfigV1;

/**
 * Normalize any historical envelope version to the latest. v1 is the
 * identity today; a future v2 extends the chain here (v1 → v2 → ...),
 * mirroring the content doc-v1/doc-v2 file layout.
 * 将任何历史信封版本归一化为最新版本。当前 v1 为恒等；未来的 v2 在此
 * 扩展升级链（v1 → v2 → ...），与内容文档 doc-v1/doc-v2 的文件布局一致。
 */
export function upgradeZoneConfig(config: ZoneConfigEnvelope): ZoneConfig {
  switch (config.version) {
    case 1:
      return config as ZoneConfig;
  }
}

export function parseZoneConfig(value: unknown): ZoneConfig | null {
  if (!Value.Check(zoneConfigEnvelopeSchema, value)) return null;
  return upgradeZoneConfig(value as ZoneConfigEnvelope);
}
