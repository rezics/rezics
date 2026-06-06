import { type ReactNode, useEffect, useRef, useState } from "react";
import { easing } from "../../config/tokens/motion";
import { radius } from "../../config/tokens/radius";
import { fontFamilies } from "../../config/tokens/typography";

function rgbToHex(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("#")) return trimmed.toLowerCase();
  const match = trimmed.match(
    /rgba?\(\s*(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)\s*(?:[,/]\s*([0-9.]+%?))?\s*\)/i,
  );
  if (!match) return trimmed;
  const [, r, g, b, a] = match;
  const toHex = (n: string) =>
    Math.round(Number(n)).toString(16).padStart(2, "0");
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  if (a == null) return hex;
  const alpha = a.endsWith("%") ? Number(a.slice(0, -1)) / 100 : Number(a);
  if (Number.isNaN(alpha) || alpha >= 1) return hex;
  const alphaHex = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${alphaHex}`;
}

function relLuminance(r: number, g: number, b: number): number {
  const channel = (n: number) => {
    const v = n / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function parseRgb(input: string): [number, number, number] | null {
  const trimmed = input.trim();
  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    const expanded =
      hex.length === 3
        ? hex
            .split("")
            .map((c) => c + c)
            .join("")
        : hex;
    if (expanded.length < 6) return null;
    return [
      parseInt(expanded.slice(0, 2), 16),
      parseInt(expanded.slice(2, 4), 16),
      parseInt(expanded.slice(4, 6), 16),
    ];
  }
  const match = trimmed.match(
    /rgba?\(\s*(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)/i,
  );
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function contrastRatio(a: string, b: string): number | null {
  const ar = parseRgb(a);
  const br = parseRgb(b);
  if (!ar || !br) return null;
  const la = relLuminance(...ar);
  const lb = relLuminance(...br);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function useResolvedColors(
  ref: React.RefObject<HTMLElement | null>,
  contrastAgainstVar?: string,
): { hex: string; contrast: number | null } {
  const [state, setState] = useState<{ hex: string; contrast: number | null }>({
    hex: "",
    contrast: null,
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const compute = () => {
      const cs = getComputedStyle(el);
      const bg = cs.backgroundColor;
      let pair: number | null = null;
      if (contrastAgainstVar) {
        const rootStyle = getComputedStyle(document.documentElement);
        const target = rootStyle.getPropertyValue(contrastAgainstVar).trim();
        if (target) pair = contrastRatio(bg, target);
      }
      setState({ hex: rgbToHex(bg), contrast: pair });
    };
    compute();
    const observer = new MutationObserver(compute);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, [ref, contrastAgainstVar]);
  return state;
}

function useResolvedColor(ref: React.RefObject<HTMLElement | null>) {
  const [hex, setHex] = useState<string>("");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const cs = getComputedStyle(el);
      setHex(rgbToHex(cs.backgroundColor));
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    return () => observer.disconnect();
  }, [ref]);
  return hex;
}

export function Grid({
  cols = 4,
  children,
}: {
  cols?: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap: 16,
        margin: "16px 0",
      }}
    >
      {children}
    </div>
  );
}

export function Swatch({
  name,
  value,
  cssVar,
  description,
  invertText,
  height = 64,
  showContrast = true,
  contrastAgainst,
}: {
  name: string;
  value: string;
  cssVar?: string;
  description?: string;
  invertText?: boolean;
  height?: number;
  showContrast?: boolean;
  contrastAgainst?: string;
}) {
  const swatchRef = useRef<HTMLDivElement>(null);
  const { hex, contrast } = useResolvedColors(
    swatchRef,
    showContrast ? contrastAgainst : undefined,
  );
  const ratio = contrast ?? 0;
  const tier =
    ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA-L" : "fail";
  const passes = ratio >= 4.5;
  const pairLabel = contrastAgainst
    ? contrastAgainst.replace(/^--colors-/, "")
    : null;
  return (
    <div
      style={{
        border: "1px solid var(--colors-border-whisper)",
        borderRadius: radius.md,
        overflow: "hidden",
        background: "var(--colors-surface-elevated)",
      }}
    >
      <div
        ref={swatchRef}
        style={{
          height,
          background: value,
          color: invertText ? "#fff" : "var(--colors-text-primary)",
          padding: "0 12px",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          fontFamily: fontFamilies.mono,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.02em",
        }}
      >
        <span>{hex || value}</span>
        {showContrast && contrast != null && pairLabel ? (
          <span
            style={{
              padding: "2px 6px",
              borderRadius: 999,
              background: passes
                ? "rgba(0, 0, 0, 0.2)"
                : "rgba(255, 0, 0, 0.35)",
              color: invertText ? "#fff" : "var(--colors-text-primary)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
            title={`Contrast vs ${pairLabel}: ${ratio.toFixed(2)}:1`}
          >
            vs {pairLabel} · {ratio.toFixed(1)} · {tier}
          </span>
        ) : null}
      </div>
      <div style={{ padding: "10px 12px" }}>
        <div
          style={{
            fontFamily: fontFamilies.sans,
            fontWeight: 500,
            fontSize: 13,
            color: "var(--colors-text-primary)",
          }}
        >
          {name}
        </div>
        {cssVar ? (
          <div
            style={{
              fontFamily: fontFamilies.mono,
              fontSize: 11,
              color: "var(--colors-text-secondary)",
              marginTop: 2,
            }}
          >
            {cssVar}
          </div>
        ) : null}
        {description ? (
          <div
            style={{
              fontFamily: fontFamilies.sans,
              fontSize: 12,
              color: "var(--colors-text-secondary)",
              marginTop: 4,
            }}
          >
            {description}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Row({
  label,
  cssVar,
  children,
}: {
  label: string;
  cssVar?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "200px 1fr",
        alignItems: "center",
        gap: 24,
        padding: "16px 0",
        borderBottom: "1px solid var(--colors-border-whisper)",
      }}
    >
      <div>
        <div
          style={{
            fontFamily: fontFamilies.sans,
            fontWeight: 500,
            fontSize: 13,
            color: "var(--colors-text-primary)",
          }}
        >
          {label}
        </div>
        {cssVar ? (
          <div
            style={{
              fontFamily: fontFamilies.mono,
              fontSize: 11,
              color: "var(--colors-text-secondary)",
              marginTop: 2,
            }}
          >
            {cssVar}
          </div>
        ) : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function SpacingRuler({ name, value }: { name: string; value: string }) {
  return (
    <Row label={name} cssVar={`p-${name} · gap-${name} · h-${name}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: value,
            height: 24,
            background: "var(--colors-brand-fill)",
            borderRadius: 2,
          }}
        />
        <span
          style={{
            fontFamily: fontFamilies.mono,
            fontSize: 12,
            color: "var(--colors-text-secondary)",
          }}
        >
          {value}
        </span>
      </div>
    </Row>
  );
}

export function RadiusSample({ name, value }: { name: string; value: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: value,
          background: "var(--colors-brand-fill)",
          margin: "0 auto",
        }}
      />
      <div
        style={{
          marginTop: 8,
          fontFamily: fontFamilies.sans,
          fontWeight: 500,
          fontSize: 13,
          color: "var(--colors-text-primary)",
        }}
      >
        {name}
      </div>
      <div
        style={{
          fontFamily: fontFamilies.mono,
          fontSize: 11,
          color: "var(--colors-text-secondary)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function ElevationSample({
  name,
  cssVar,
}: {
  name: string;
  cssVar: string;
}) {
  return (
    <div style={{ padding: 24, background: "var(--colors-surface-canvas)" }}>
      <div
        style={{
          height: 96,
          borderRadius: radius.md,
          background: "var(--colors-surface-elevated)",
          boxShadow: `var(${cssVar})`,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontFamily: fontFamilies.sans,
            fontWeight: 500,
            fontSize: 13,
            color: "var(--colors-text-primary)",
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontFamily: fontFamilies.mono,
            fontSize: 11,
            color: "var(--colors-text-secondary)",
          }}
        >
          {cssVar}
        </div>
      </div>
    </div>
  );
}

export function TypeSample({
  size,
  weight,
  family = "sans",
  cssVar,
  text,
}: {
  size: string;
  weight?: number;
  family?: "sans" | "serif" | "mono";
  cssVar: string;
  text: string;
}) {
  return (
    <div
      style={{
        padding: "16px 0",
        borderBottom: "1px solid var(--colors-border-whisper)",
      }}
    >
      <div
        style={{
          fontFamily: fontFamilies[family],
          fontSize: size,
          fontWeight: weight ?? 400,
          color: "var(--colors-text-primary)",
          lineHeight: 1.3,
        }}
      >
        {text}
      </div>
      <div
        style={{
          marginTop: 6,
          fontFamily: fontFamilies.mono,
          fontSize: 11,
          color: "var(--colors-text-secondary)",
        }}
      >
        {cssVar} · {size}
        {weight ? ` · ${weight}` : ""}
      </div>
    </div>
  );
}

export function Do({
  caption,
  children,
}: {
  caption?: string;
  children: ReactNode;
}) {
  return (
    <Verdict tone="do" caption={caption}>
      {children}
    </Verdict>
  );
}

export function Dont({
  caption,
  children,
}: {
  caption?: string;
  children: ReactNode;
}) {
  return (
    <Verdict tone="dont" caption={caption}>
      {children}
    </Verdict>
  );
}

export function Compare({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        margin: "16px 0",
      }}
    >
      {children}
    </div>
  );
}

function Verdict({
  tone,
  caption,
  children,
}: {
  tone: "do" | "dont";
  caption?: string;
  children: ReactNode;
}) {
  const isDo = tone === "do";
  const accent = isDo
    ? "var(--colors-semantic-success-fill)"
    : "var(--colors-semantic-error-fill)";
  return (
    <div
      style={{
        border: "1px solid var(--colors-border-whisper)",
        borderRadius: radius.md,
        background: "var(--colors-surface-elevated)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderBottom: "1px solid var(--colors-border-whisper)",
          fontFamily: fontFamilies.sans,
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: accent,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: radius.full,
            background: accent,
          }}
        />
        {isDo ? "Do" : "Don't"}
        {caption ? (
          <span
            style={{
              marginLeft: 4,
              fontWeight: 400,
              letterSpacing: 0,
              textTransform: "none",
              color: "var(--colors-text-secondary)",
            }}
          >
            — {caption}
          </span>
        ) : null}
      </div>
      <div
        style={{
          padding: 16,
          background: "var(--colors-surface-canvas)",
          minHeight: 96,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function MotionSample({
  name,
  cssVar,
  duration,
  easing: easingProp = easing.out,
}: {
  name: string;
  cssVar: string;
  duration: string;
  easing?: string;
}) {
  return (
    <Row label={name} cssVar={cssVar}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 240,
            height: 32,
            background: "var(--colors-surface-subtle)",
            borderRadius: radius.pill,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.pill,
              background: "var(--colors-brand-fill)",
              animation: `rezics-motion-demo ${duration} ${easingProp} infinite alternate`,
            }}
          />
        </div>
        <span
          style={{
            fontFamily: fontFamilies.mono,
            fontSize: 12,
            color: "var(--colors-text-secondary)",
          }}
        >
          {duration}
        </span>
      </div>
      <style>{`@keyframes rezics-motion-demo { from { transform: translateX(0); } to { transform: translateX(208px); } }`}</style>
    </Row>
  );
}

// Density / state-layer / depth / inverse-surface demos for Foundation/Patterns.

const densityRows = [
  {
    token: "--padding-breadcrumb-y",
    label: "Breadcrumb item",
    sample: "Library / Fiction / Chapter 1",
  },
  {
    token: "--padding-menu-item-y",
    label: "Menu item",
    sample: "Move to shelf",
  },
  {
    token: "--padding-table-row-y",
    label: "Table row",
    sample: "978-0-679-72316-5",
  },
  {
    token: "--padding-toolbar-y",
    label: "Toolbar",
    sample: "Search  Filter  Sort",
  },
  {
    token: "--padding-formfield-y",
    label: "Form field",
    sample: "you@example.com",
  },
  {
    token: "--padding-sidebar-item-y",
    label: "Sidebar item",
    sample: "Currently reading",
  },
  {
    token: "--padding-tab-item-y",
    label: "Tab item",
    sample: "Highlights",
  },
  {
    token: "--padding-command-item-y",
    label: "Command item",
    sample: "Open command palette",
  },
  {
    token: "--padding-list-item-y",
    label: "List item",
    sample: "The Library at Mount Char",
  },
] as const;

function useRootToken(name: string) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const compute = () => {
      setValue(
        getComputedStyle(document.documentElement)
          .getPropertyValue(name)
          .trim(),
      );
    };
    compute();
    const observer = new MutationObserver(compute);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, [name]);

  return value;
}

function DensityRow({
  token,
  label,
  sample,
}: {
  token: string;
  label: string;
  sample: string;
}) {
  const value = useRootToken(token);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(150px, 0.8fr) minmax(90px, 0.4fr) 1fr",
        alignItems: "center",
        gap: 12,
        padding: 12,
        border: "1px solid var(--colors-border-whisper)",
        borderRadius: radius.md,
        background: "var(--colors-surface-elevated)",
      }}
    >
      <div>
        <div style={{ fontWeight: 600, color: "var(--colors-text-primary)" }}>
          {label}
        </div>
        <div
          style={{
            fontFamily: fontFamilies.mono,
            fontSize: 12,
            color: "var(--colors-text-secondary)",
          }}
        >
          {token}
        </div>
      </div>
      <div
        style={{
          fontFamily: fontFamilies.mono,
          fontSize: 12,
          color: "var(--colors-text-secondary)",
        }}
      >
        {value || "…"}
      </div>
      <div
        style={{
          paddingTop: `var(${token})`,
          paddingBottom: `var(${token})`,
          paddingLeft: 12,
          paddingRight: 12,
          borderRadius: radius.sm,
          background: "var(--colors-surface-base)",
          color: "var(--colors-text-primary)",
          fontFamily: fontFamilies.sans,
          fontSize: 14,
          lineHeight: 1.4,
        }}
      >
        {sample}
      </div>
    </div>
  );
}

export function DensityDemo({ children }: { children?: ReactNode }) {
  if (children) return <>{children}</>;

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        margin: "16px 0",
      }}
    >
      {densityRows.map((row) => (
        <DensityRow key={row.token} {...row} />
      ))}
    </div>
  );
}

export function StateLayerDemo() {
  const states: Array<{ label: string; opacityVar: string; selector: string }> =
    [
      { label: "Resting", opacityVar: "0", selector: "" },
      {
        label: "Hover",
        opacityVar: "var(--state-hover-opacity)",
        selector: "8%",
      },
      {
        label: "Focus",
        opacityVar: "var(--state-focus-opacity)",
        selector: "12%",
      },
      {
        label: "Pressed",
        opacityVar: "var(--state-pressed-opacity)",
        selector: "12%",
      },
      {
        label: "Dragged",
        opacityVar: "var(--state-dragged-opacity)",
        selector: "16%",
      },
    ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
        gap: 12,
        margin: "16px 0",
      }}
    >
      {states.map((s) => (
        <div
          key={s.label}
          style={{
            position: "relative",
            background: "var(--colors-surface-base)",
            color: "var(--colors-text-primary)",
            border: "1px solid var(--colors-border-whisper)",
            borderRadius: radius.md,
            padding: "20px 16px",
            overflow: "hidden",
            fontFamily: fontFamilies.sans,
            fontSize: 13,
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background: "currentColor",
              opacity: s.opacityVar as unknown as number,
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "relative", fontWeight: 500 }}>{s.label}</div>
          {s.selector ? (
            <div
              style={{
                position: "relative",
                marginTop: 4,
                fontFamily: fontFamilies.mono,
                fontSize: 11,
                color: "var(--colors-text-secondary)",
              }}
            >
              {s.selector}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function DepthDemo() {
  const layers: Array<{
    name: string;
    bg: string;
    cssVar: string;
    note: string;
  }> = [
    {
      name: "canvas",
      bg: "var(--colors-surface-canvas)",
      cssVar: "--colors-surface-canvas",
      note: "Page background",
    },
    {
      name: "base",
      bg: "var(--colors-surface-base)",
      cssVar: "--colors-surface-base",
      note: "Panels / inline blocks",
    },
    {
      name: "elevated",
      bg: "var(--colors-surface-elevated)",
      cssVar: "--colors-surface-elevated",
      note: "Modals, popovers",
    },
    {
      name: "subtle",
      bg: "var(--colors-surface-subtle)",
      cssVar: "--colors-surface-subtle",
      note: "Inset wells",
    },
    {
      name: "sunken",
      bg: "var(--colors-surface-sunken)",
      cssVar: "--colors-surface-sunken",
      note: "Code blocks, deepest",
    },
  ];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        margin: "16px 0",
        padding: 16,
        background: "var(--colors-surface-canvas)",
        border: "1px solid var(--colors-border-whisper)",
        borderRadius: radius.md,
      }}
    >
      {layers.map((l) => (
        <div
          key={l.name}
          style={{
            background: l.bg,
            padding: "14px 16px",
            borderRadius: radius.sm,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "var(--colors-text-primary)",
            fontFamily: fontFamilies.sans,
            fontSize: 13,
          }}
        >
          <span>
            <strong>{l.name}</strong>
            <span
              style={{
                marginLeft: 12,
                fontFamily: fontFamilies.mono,
                fontSize: 11,
                color: "var(--colors-text-secondary)",
              }}
            >
              {l.cssVar}
            </span>
          </span>
          <span style={{ fontSize: 12, color: "var(--colors-text-secondary)" }}>
            {l.note}
          </span>
        </div>
      ))}
    </div>
  );
}

export function InverseSurfaceDemo() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        margin: "16px 0",
      }}
    >
      <div
        style={{
          background: "var(--colors-inverse-surface)",
          color: "var(--colors-inverse-on-surface)",
          padding: "12px 16px",
          borderRadius: radius.md,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: fontFamilies.sans,
          fontSize: 13,
        }}
      >
        <span>Saved your changes.</span>
        <button
          type="button"
          style={{
            background: "transparent",
            color: "inherit",
            border: "1px solid currentColor",
            borderRadius: radius.sm,
            padding: "4px 10px",
            font: "inherit",
            cursor: "pointer",
          }}
        >
          Undo
        </button>
      </div>
      <blockquote
        style={{
          margin: 0,
          background: "var(--colors-inverse-surface)",
          color: "var(--colors-inverse-on-surface)",
          padding: "16px 20px",
          borderRadius: radius.md,
          fontFamily: fontFamilies.serif,
          fontSize: 16,
          fontStyle: "italic",
          lineHeight: 1.5,
        }}
      >
        “The book is a thing made out of attention.”
      </blockquote>
    </div>
  );
}
