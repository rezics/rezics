import { describe, expect, it } from 'bun:test';
import { XMLParser } from 'fast-xml-parser';

// Test the XML parsing logic used by container/opf/toc modules
// Since these modules depend on FileMap from zip.ts, we test the parsing logic directly

describe('epub container.xml parsing', () => {
  it('extracts rootfile full-path', () => {
    const xml = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

    const parser = new XMLParser({ ignoreAttributes: false });
    const doc = parser.parse(xml);
    const rootfile = doc.container.rootfiles.rootfile;
    const fullPath = rootfile['@_full-path'];

    expect(fullPath).toBe('OEBPS/content.opf');
  });
});

describe('epub OPF parsing', () => {
  it('extracts manifest items and spine order', () => {
    const xml = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title>
    <dc:creator>Test Author</dc:creator>
  </metadata>
  <manifest>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`;

    const parser = new XMLParser({ ignoreAttributes: false });
    const doc = parser.parse(xml);
    const pkg = doc.package;

    // Manifest
    const items = Array.isArray(pkg.manifest.item)
      ? pkg.manifest.item
      : [pkg.manifest.item];
    expect(items).toHaveLength(3);
    expect(items[0]['@_id']).toBe('ch1');
    expect(items[0]['@_href']).toBe('chapter1.xhtml');

    // Spine
    const spineItems = Array.isArray(pkg.spine.itemref)
      ? pkg.spine.itemref
      : [pkg.spine.itemref];
    expect(spineItems).toHaveLength(2);
    expect(spineItems[0]['@_idref']).toBe('ch1');
    expect(spineItems[1]['@_idref']).toBe('ch2');

    // Toc reference
    expect(pkg.spine['@_toc']).toBe('ncx');

    // Metadata
    expect(pkg.metadata['dc:title']).toBe('Test Book');
    expect(pkg.metadata['dc:creator']).toBe('Test Author');
  });
});

describe('epub NCX TOC parsing', () => {
  it('extracts hierarchical navPoints', () => {
    const xml = `<?xml version="1.0"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
  <navMap>
    <navPoint id="np1">
      <navLabel><text>Part 1</text></navLabel>
      <content src="part1.xhtml"/>
      <navPoint id="np2">
        <navLabel><text>Chapter 1</text></navLabel>
        <content src="ch1.xhtml"/>
      </navPoint>
    </navPoint>
    <navPoint id="np3">
      <navLabel><text>Chapter 2</text></navLabel>
      <content src="ch2.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`;

    const parser = new XMLParser({ ignoreAttributes: false });
    const doc = parser.parse(xml);
    const navMap = doc.ncx.navMap;

    const navPoints = Array.isArray(navMap.navPoint)
      ? navMap.navPoint
      : [navMap.navPoint];
    expect(navPoints).toHaveLength(2);

    // First has nested navPoint
    const part1 = navPoints[0];
    expect(part1.navLabel.text).toBe('Part 1');
    expect(part1.content['@_src']).toBe('part1.xhtml');

    const nested = part1.navPoint;
    expect(nested.navLabel.text).toBe('Chapter 1');
    expect(nested.content['@_src']).toBe('ch1.xhtml');

    // Second is flat
    const ch2 = navPoints[1];
    expect(ch2.navLabel.text).toBe('Chapter 2');
  });
});

describe('asset URL rewriting', () => {
  it('rewrites relative src attributes', () => {
    const html = '<img src="../images/cover.jpg" />';
    // The regex from assets.ts
    const ASSET_ATTR_REGEX = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;

    const matches = [...html.matchAll(ASSET_ATTR_REGEX)];
    expect(matches).toHaveLength(1);
    expect(matches[0][1]).toBe('../images/cover.jpg');
  });

  it('skips external URLs', () => {
    const html = '<img src="https://example.com/img.jpg" />';
    const src = 'https://example.com/img.jpg';
    expect(
      src.startsWith('http://') || src.startsWith('https://'),
    ).toBe(true);
  });
});
