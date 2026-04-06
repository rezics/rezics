import { flattenTree } from "../../tree";
import type { FolioNode, RendererPlugin } from "../../types";
import { createAssetTracker, resolveAssets } from "./assets";
import { parseContainer } from "./container";
import { createEpubControls } from "./EpubControls";
import { parseOpf, resolveHref } from "./opf";
import { parseNavDoc, parseNcx, tocToFolioNodes } from "./toc";
import { extractZip, readText } from "./zip";

export interface EpubPluginResult {
  plugin: RendererPlugin;
  tree: FolioNode[];
  cleanup: () => void;
  warnings: string[];
}

export async function createEpubPlugin(file: File): Promise<EpubPluginResult> {
  const fileMap = await extractZip(file);
  const warnings: string[] = [];

  // Parse structure
  const opfPath = parseContainer(fileMap);
  const opf = parseOpf(fileMap, opfPath);

  // Build asset tracker for blob URL cleanup
  const tracker = createAssetTracker();

  // Resolve spine items to full paths
  const spineEntries: { href: string; fullPath: string }[] = [];
  for (const spineItem of opf.spine) {
    const manifestItem = opf.manifest.get(spineItem.idref);
    if (manifestItem) {
      const fullPath = resolveHref(opfPath, manifestItem.href);
      spineEntries.push({ href: manifestItem.href, fullPath });
    }
  }

  // Pre-extract chapter HTML with asset resolution
  const chapterCache = new Map<string, string>();
  for (const entry of spineEntries) {
    const raw = readText(fileMap, entry.fullPath);
    if (raw) {
      const resolved = resolveAssets(raw, entry.fullPath, fileMap, tracker);
      chapterCache.set(entry.href, resolved);
    } else {
      warnings.push(`Failed to read spine item: ${entry.fullPath}`);
    }
  }

  // Parse TOC
  const spineHrefs = spineEntries.map((e) => e.href);
  let tocNodes: FolioNode[];

  // Try EPUB 3 nav doc first, then NCX
  const navItem = Array.from(opf.manifest.values()).find((item) =>
    item.properties?.includes("nav"),
  );

  const chapterFetch = (href: string) => {
    return () => {
      const html = chapterCache.get(href);
      if (html) {
        return Promise.resolve({ contentType: "html" as const, raw: html });
      }
      return Promise.reject(new Error(`Chapter not found: ${href}`));
    };
  };

  if (navItem) {
    const navPath = resolveHref(opfPath, navItem.href);
    const navPoints = parseNavDoc(fileMap, navPath);
    tocNodes = tocToFolioNodes(navPoints, spineHrefs, chapterFetch);
  } else if (opf.tocId) {
    const ncxItem = opf.manifest.get(opf.tocId);
    if (ncxItem) {
      const ncxPath = resolveHref(opfPath, ncxItem.href);
      const navPoints = parseNcx(fileMap, ncxPath);
      tocNodes = tocToFolioNodes(navPoints, spineHrefs, chapterFetch);
    } else {
      tocNodes = [];
    }
  } else {
    tocNodes = [];
  }

  // If TOC parsing didn't produce a good tree, fall back to spine order
  const flatFromToc = flattenTree(tocNodes);
  if (flatFromToc.length === 0) {
    tocNodes = spineEntries
      .filter((e) => chapterCache.has(e.href))
      .map((entry, i) => ({
        id: `epub-${entry.href}`,
        title: `Chapter ${i + 1}`,
        fetch: chapterFetch(entry.href),
      }));
  }

  // Build TOC items for the Controls panel
  const flat = flattenTree(tocNodes);
  const tocItems = flat.map((f) => ({
    label: f.node.title,
    index: f.index,
  }));

  const Controls = createEpubControls(tocItems);

  // Simple HTML renderer — renders sanitized HTML
  function EpubRenderer({ raw }: { raw: string }) {
    return (
      <div
        className="folio-epub-content"
        style={{
          padding: "16px 24px",
          maxWidth: "720px",
          margin: "0 auto",
        }}
        dangerouslySetInnerHTML={{ __html: raw }}
      />
    );
  }

  const plugin: RendererPlugin = {
    kind: "renderer",
    id: "epub",
    contentTypes: ["html"],
    Renderer: EpubRenderer,
    Controls,
  };

  return {
    plugin,
    tree: tocNodes,
    cleanup: () => tracker.revoke(),
    warnings,
  };
}
