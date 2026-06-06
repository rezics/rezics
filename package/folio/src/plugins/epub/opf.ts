import { XMLParser } from "fast-xml-parser";
import type { FileMap } from "./zip";
import { readText } from "./zip";

export interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties?: string;
}

export interface SpineItem {
  idref: string;
  linear?: string;
}

export interface EpubMetadata {
  title?: string;
  creator?: string;
  language?: string;
}

export interface OpfData {
  manifest: Map<string, ManifestItem>;
  spine: SpineItem[];
  metadata: EpubMetadata;
  tocId?: string;
}

function ensureArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

export function parseOpf(fileMap: FileMap, opfPath: string): OpfData {
  const xml = readText(fileMap, opfPath);
  if (!xml) {
    throw new Error(`Missing OPF file: ${opfPath}`);
  }

  const parser = new XMLParser({ ignoreAttributes: false });
  const doc = parser.parse(xml);

  const pkg = doc?.package ?? doc?.["opf:package"];
  if (!pkg) {
    throw new Error("Invalid OPF: no <package> element");
  }

  // Parse manifest
  const manifestItems = ensureArray(pkg.manifest?.item);
  const manifest = new Map<string, ManifestItem>();

  for (const item of manifestItems) {
    const id = item["@_id"];
    const href = item["@_href"];
    const mediaType = item["@_media-type"];
    if (id && href) {
      manifest.set(id, {
        id,
        href,
        mediaType: mediaType ?? "",
        properties: item["@_properties"],
      });
    }
  }

  // Parse spine
  const spineItems = ensureArray(pkg.spine?.itemref);
  const spine: SpineItem[] = spineItems.map((item: Record<string, string>) => ({
    idref: item["@_idref"],
    linear: item["@_linear"],
  }));

  // Spine toc attribute (NCX)
  const tocId = pkg.spine?.["@_toc"];

  // Parse metadata
  const meta = pkg.metadata ?? {};
  const metadata: EpubMetadata = {
    title:
      typeof meta["dc:title"] === "string"
        ? meta["dc:title"]
        : meta["dc:title"]?.["#text"],
    creator:
      typeof meta["dc:creator"] === "string"
        ? meta["dc:creator"]
        : meta["dc:creator"]?.["#text"],
    language:
      typeof meta["dc:language"] === "string"
        ? meta["dc:language"]
        : meta["dc:language"]?.["#text"],
  };

  return { manifest, spine, metadata, tocId };
}

export function resolveHref(opfPath: string, href: string): string {
  const opfDir = opfPath.includes("/")
    ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1)
    : "";
  return opfDir + href;
}
