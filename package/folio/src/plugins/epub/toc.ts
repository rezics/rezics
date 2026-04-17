import { XMLParser } from "fast-xml-parser";
import type { FolioNode } from "../../types";
import type { FileMap } from "./zip";
import { readText } from "./zip";

interface TocNavPoint {
  id: string;
  label: string;
  src: string;
  children: TocNavPoint[];
}

function ensureArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

export function parseNcx(fileMap: FileMap, ncxPath: string): TocNavPoint[] {
  const xml = readText(fileMap, ncxPath);
  if (!xml) return [];

  const parser = new XMLParser({ ignoreAttributes: false });
  const doc = parser.parse(xml);

  const navMap = doc?.ncx?.navMap;
  if (!navMap) return [];

  function parseNavPoint(np: unknown): TocNavPoint {
    const obj = np as Record<string, unknown>;
    const id = (obj["@_id"] as string) ?? "";
    const label =
      typeof obj.navLabel === "object" && obj.navLabel
        ? (((obj.navLabel as Record<string, unknown>).text as string) ?? "")
        : "";
    const content = obj.content as Record<string, string> | undefined;
    const src = content?.["@_src"] ?? "";
    const children = ensureArray(obj.navPoint).map(parseNavPoint);

    return { id, label, src, children };
  }

  const navPoints = ensureArray(navMap.navPoint);
  return navPoints.map(parseNavPoint);
}

export function parseNavDoc(fileMap: FileMap, navPath: string): TocNavPoint[] {
  const xml = readText(fileMap, navPath);
  if (!xml) return [];

  const parser = new XMLParser({ ignoreAttributes: false });
  const doc = parser.parse(xml);

  // EPUB 3 nav doc — look for <nav epub:type="toc">
  const html = doc?.html ?? doc;
  const body = html?.body;
  if (!body) return [];

  // Find the nav element with toc
  const navs = ensureArray(body.nav);
  const tocNav =
    navs.find((n: Record<string, unknown>) =>
      (n["@_epub:type"] as string)?.includes("toc"),
    ) ?? navs[0];

  if (!tocNav) return [];

  function parseOl(ol: Record<string, unknown>): TocNavPoint[] {
    const items = ensureArray(ol?.li);
    return items.map((item) => {
      const li = item as Record<string, unknown>;
      const a = li.a as Record<string, unknown> | undefined;
      const label = (a?.["#text"] as string) ?? "";
      const src = (a?.["@_href"] as string) ?? "";
      const childOl = li.ol as Record<string, unknown> | undefined;

      return {
        id: "",
        label,
        src,
        children: childOl ? parseOl(childOl) : [],
      };
    });
  }

  return tocNav.ol ? parseOl(tocNav.ol) : [];
}

export function tocToFolioNodes(
  navPoints: TocNavPoint[],
  spineHrefs: string[],
  chapterFetch: (
    href: string,
  ) => () => Promise<{ contentType: string; raw: string }>,
): FolioNode[] {
  function convert(np: TocNavPoint): FolioNode {
    // Strip fragment from src for matching
    const baseSrc = np.src.split("#")[0];

    if (np.children.length > 0) {
      // Has children — may itself be a leaf too if src points to content
      const children = np.children.map(convert);

      if (baseSrc && spineHrefs.includes(baseSrc)) {
        // Branch that also has content — make it a leaf with children
        return {
          id: `epub-${baseSrc}`,
          title: np.label || baseSrc,
          fetch: chapterFetch(baseSrc),
          children,
        };
      }

      return {
        id: `epub-branch-${np.id || np.label}`,
        title: np.label || "Untitled",
        children,
      };
    }

    // Leaf node
    return {
      id: `epub-${baseSrc || np.id}`,
      title: np.label || baseSrc || "Untitled",
      fetch: baseSrc ? chapterFetch(baseSrc) : undefined,
    };
  }

  return navPoints.map(convert);
}
