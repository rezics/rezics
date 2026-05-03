import { useEffect, useRef, useState, type ReactNode } from "react";
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
      attributeFilter: ["data-theme", "class", "style"],
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
}: {
  name: string;
  value: string;
  cssVar?: string;
  description?: string;
  invertText?: boolean;
  height?: number;
}) {
  const swatchRef = useRef<HTMLDivElement>(null);
  const hex = useResolvedColor(swatchRef);
  return (
    <div
      style={{
        border: "1px solid var(--rezics-color-border-whisper)",
        borderRadius: radius.md,
        overflow: "hidden",
        background: "var(--rezics-color-surface-elevated)",
      }}
    >
      <div
        ref={swatchRef}
        style={{
          height,
          background: value,
          color: invertText ? "#fff" : "var(--rezics-color-text-primary)",
          padding: "0 12px",
          display: "flex",
          alignItems: "flex-end",
          fontFamily: fontFamilies.mono,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.02em",
        }}
      >
        {hex || value}
      </div>
      <div style={{ padding: "10px 12px" }}>
        <div
          style={{
            fontFamily: fontFamilies.sans,
            fontWeight: 500,
            fontSize: 13,
            color: "var(--rezics-color-text-primary)",
          }}
        >
          {name}
        </div>
        {cssVar ? (
          <div
            style={{
              fontFamily: fontFamilies.mono,
              fontSize: 11,
              color: "var(--rezics-color-text-secondary)",
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
              color: "var(--rezics-color-text-secondary)",
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
        borderBottom: "1px solid var(--rezics-color-border-whisper)",
      }}
    >
      <div>
        <div
          style={{
            fontFamily: fontFamilies.sans,
            fontWeight: 500,
            fontSize: 13,
            color: "var(--rezics-color-text-primary)",
          }}
        >
          {label}
        </div>
        {cssVar ? (
          <div
            style={{
              fontFamily: fontFamilies.mono,
              fontSize: 11,
              color: "var(--rezics-color-text-secondary)",
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
            background: "var(--rezics-color-brand-fill)",
            borderRadius: 2,
          }}
        />
        <span
          style={{
            fontFamily: fontFamilies.mono,
            fontSize: 12,
            color: "var(--rezics-color-text-secondary)",
          }}
        >
          {value}
        </span>
      </div>
    </Row>
  );
}

export function RadiusSample({
  name,
  value,
}: {
  name: string;
  value: string;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: value,
          background: "var(--rezics-color-brand-fill)",
          margin: "0 auto",
        }}
      />
      <div
        style={{
          marginTop: 8,
          fontFamily: fontFamilies.sans,
          fontWeight: 500,
          fontSize: 13,
          color: "var(--rezics-color-text-primary)",
        }}
      >
        {name}
      </div>
      <div
        style={{
          fontFamily: fontFamilies.mono,
          fontSize: 11,
          color: "var(--rezics-color-text-secondary)",
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
    <div style={{ padding: 24, background: "var(--rezics-color-surface-canvas)" }}>
      <div
        style={{
          height: 96,
          borderRadius: radius.md,
          background: "var(--rezics-color-surface-elevated)",
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
            color: "var(--rezics-color-text-primary)",
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontFamily: fontFamilies.mono,
            fontSize: 11,
            color: "var(--rezics-color-text-secondary)",
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
        borderBottom: "1px solid var(--rezics-color-border-whisper)",
      }}
    >
      <div
        style={{
          fontFamily: fontFamilies[family],
          fontSize: size,
          fontWeight: weight ?? 400,
          color: "var(--rezics-color-text-primary)",
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
          color: "var(--rezics-color-text-secondary)",
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
  return <Verdict tone="do" caption={caption}>{children}</Verdict>;
}

export function Dont({
  caption,
  children,
}: {
  caption?: string;
  children: ReactNode;
}) {
  return <Verdict tone="dont" caption={caption}>{children}</Verdict>;
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
    ? "var(--rezics-color-success-fill)"
    : "var(--rezics-color-error-fill)";
  return (
    <div
      style={{
        border: "1px solid var(--rezics-color-border-whisper)",
        borderRadius: radius.md,
        background: "var(--rezics-color-surface-elevated)",
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
          borderBottom: "1px solid var(--rezics-color-border-whisper)",
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
              color: "var(--rezics-color-text-secondary)",
            }}
          >
            — {caption}
          </span>
        ) : null}
      </div>
      <div
        style={{
          padding: 16,
          background: "var(--rezics-color-surface-canvas)",
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
            background: "var(--rezics-color-surface-subtle)",
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
              background: "var(--rezics-color-brand-fill)",
              animation: `rezics-motion-demo ${duration} ${easingProp} infinite alternate`,
            }}
          />
        </div>
        <span
          style={{
            fontFamily: fontFamilies.mono,
            fontSize: 12,
            color: "var(--rezics-color-text-secondary)",
          }}
        >
          {duration}
        </span>
      </div>
      <style>{`@keyframes rezics-motion-demo { from { transform: translateX(0); } to { transform: translateX(208px); } }`}</style>
    </Row>
  );
}
