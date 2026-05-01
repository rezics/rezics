import type { ReactNode } from "react";

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
  return (
    <div
      style={{
        border: "1px solid var(--rzc-color-border-whisper)",
        borderRadius: "var(--rzc-radius-md)",
        overflow: "hidden",
        background: "var(--rzc-color-surface-elevated)",
      }}
    >
      <div
        style={{
          height,
          background: value,
          color: invertText ? "#fff" : "var(--rzc-color-text-primary)",
          padding: "0 12px",
          display: "flex",
          alignItems: "flex-end",
          fontFamily: "var(--rzc-font-mono)",
          fontSize: 12,
        }}
      >
        {value}
      </div>
      <div style={{ padding: "10px 12px" }}>
        <div
          style={{
            fontFamily: "var(--rzc-font-sans)",
            fontWeight: 500,
            fontSize: 13,
            color: "var(--rzc-color-text-primary)",
          }}
        >
          {name}
        </div>
        {cssVar ? (
          <div
            style={{
              fontFamily: "var(--rzc-font-mono)",
              fontSize: 11,
              color: "var(--rzc-color-text-secondary)",
              marginTop: 2,
            }}
          >
            {cssVar}
          </div>
        ) : null}
        {description ? (
          <div
            style={{
              fontFamily: "var(--rzc-font-sans)",
              fontSize: 12,
              color: "var(--rzc-color-text-secondary)",
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
        borderBottom: "1px solid var(--rzc-color-border-whisper)",
      }}
    >
      <div>
        <div
          style={{
            fontFamily: "var(--rzc-font-sans)",
            fontWeight: 500,
            fontSize: 13,
            color: "var(--rzc-color-text-primary)",
          }}
        >
          {label}
        </div>
        {cssVar ? (
          <div
            style={{
              fontFamily: "var(--rzc-font-mono)",
              fontSize: 11,
              color: "var(--rzc-color-text-secondary)",
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
    <Row label={name} cssVar={`--rzc-space-${name.replace(".", "_")}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: value,
            height: 24,
            background: "var(--rzc-color-brand-fill)",
            borderRadius: 2,
          }}
        />
        <span
          style={{
            fontFamily: "var(--rzc-font-mono)",
            fontSize: 12,
            color: "var(--rzc-color-text-secondary)",
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
          background: "var(--rzc-color-brand-fill)",
          margin: "0 auto",
        }}
      />
      <div
        style={{
          marginTop: 8,
          fontFamily: "var(--rzc-font-sans)",
          fontWeight: 500,
          fontSize: 13,
          color: "var(--rzc-color-text-primary)",
        }}
      >
        {name}
      </div>
      <div
        style={{
          fontFamily: "var(--rzc-font-mono)",
          fontSize: 11,
          color: "var(--rzc-color-text-secondary)",
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
    <div style={{ padding: 24, background: "var(--rzc-color-surface-canvas)" }}>
      <div
        style={{
          height: 96,
          borderRadius: "var(--rzc-radius-md)",
          background: "var(--rzc-color-surface-elevated)",
          boxShadow: `var(${cssVar})`,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontFamily: "var(--rzc-font-sans)",
            fontWeight: 500,
            fontSize: 13,
            color: "var(--rzc-color-text-primary)",
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontFamily: "var(--rzc-font-mono)",
            fontSize: 11,
            color: "var(--rzc-color-text-secondary)",
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
        borderBottom: "1px solid var(--rzc-color-border-whisper)",
      }}
    >
      <div
        style={{
          fontFamily: `var(--rzc-font-${family})`,
          fontSize: size,
          fontWeight: weight ?? 400,
          color: "var(--rzc-color-text-primary)",
          lineHeight: 1.3,
        }}
      >
        {text}
      </div>
      <div
        style={{
          marginTop: 6,
          fontFamily: "var(--rzc-font-mono)",
          fontSize: 11,
          color: "var(--rzc-color-text-secondary)",
        }}
      >
        {cssVar} · {size}
        {weight ? ` · ${weight}` : ""}
      </div>
    </div>
  );
}

export function MotionSample({
  name,
  cssVar,
  duration,
  easing = "var(--rzc-ease-out)",
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
            background: "var(--rzc-color-surface-subtle)",
            borderRadius: "var(--rzc-radius-pill)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--rzc-radius-pill)",
              background: "var(--rzc-color-brand-fill)",
              animation: `rzc-motion-demo ${duration} ${easing} infinite alternate`,
            }}
          />
        </div>
        <span
          style={{
            fontFamily: "var(--rzc-font-mono)",
            fontSize: 12,
            color: "var(--rzc-color-text-secondary)",
          }}
        >
          {duration}
        </span>
      </div>
      <style>{`@keyframes rzc-motion-demo { from { transform: translateX(0); } to { transform: translateX(208px); } }`}</style>
    </Row>
  );
}
