import {
  type CSSProperties,
  Fragment,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { easing } from "../../config/tokens/motion";
import { radius } from "../../config/tokens/radius";
import { fontFamilies } from "../../config/tokens/typography";

type DemoPaletteStyle = CSSProperties & Record<`--demo-${string}`, string>;

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

function useStorybookDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const compute = () => {
      const root = document.documentElement;
      setIsDark(
        root.classList.contains("dark") || root.dataset.theme === "dark",
      );
    };
    compute();
    const observer = new MutationObserver(compute);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

function readableTextColor(background: string): string {
  const blackContrast = contrastRatio("#000000", background) ?? 0;
  const whiteContrast = contrastRatio("#ffffff", background) ?? 0;
  return blackContrast >= whiteContrast ? "#111111" : "#ffffff";
}

export function DesignSwatch({
  name,
  cssVar,
  light,
  dark,
  description,
  contrastLight,
  contrastDark,
  height = 64,
  showContrast = true,
}: {
  name: string;
  cssVar: string;
  light: string;
  dark: string;
  description?: string;
  contrastLight?: string;
  contrastDark?: string;
  height?: number;
  showContrast?: boolean;
}) {
  const isDark = useStorybookDarkMode();
  const value = isDark ? dark : light;
  const contrastAgainst = isDark ? contrastDark : contrastLight;
  const contrast = contrastAgainst
    ? contrastRatio(value, contrastAgainst)
    : null;
  const ratio = contrast ?? 0;
  const tier =
    ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA-L" : "diag";
  const textColor = readableTextColor(value);

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
        style={{
          height,
          background: value,
          color: textColor,
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
        <span>{value}</span>
        {showContrast && contrast != null && contrastAgainst ? (
          <span
            style={{
              padding: "2px 6px",
              borderRadius: 999,
              background:
                textColor === "#ffffff"
                  ? "rgba(0, 0, 0, 0.28)"
                  : "rgba(255, 255, 255, 0.68)",
              color: textColor === "#ffffff" ? "#ffffff" : "#111111",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
            title={`Contrast vs ${contrastAgainst}: ${ratio.toFixed(2)}:1`}
          >
            vs {contrastAgainst} · {ratio.toFixed(1)} · {tier}
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
        <div
          style={{
            fontFamily: fontFamilies.mono,
            fontSize: 11,
            color: "var(--colors-text-secondary)",
            marginTop: 2,
          }}
        >
          light {light} · dark {dark}
        </div>
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

const futureLight = {
  canvas: "#ffffff",
  base: "#ffffff",
  elevated: "#ffffff",
  subtle: "#f5f5f5",
  sunken: "#eeeeee",
  text: "#111111",
  textSecondary: "#5f6368",
  border: "rgba(0, 0, 0, 0.12)",
  brand: "#DB515C",
  brandHover: "#C94651",
  brandActive: "#B83F49",
  link: "#1a73e8",
  linkHover: "#1a73e8",
};

const futureDark = {
  canvas: "#000000",
  base: "#0b0b0b",
  elevated: "#161616",
  subtle: "#202020",
  sunken: "#2a2a2a",
  text: "#f5f5f5",
  textSecondary: "#b6b6b6",
  border: "rgba(255, 255, 255, 0.16)",
  brand: "#DB515C",
  brandHover: "#C94651",
  brandActive: "#B83F49",
  link: "#1a73e8",
  linkHover: "#1a73e8",
};

type FuturePalette = typeof futureLight;

function ratioLabel(fg: string, bg: string): string {
  const ratio = contrastRatio(fg, bg);
  return ratio == null ? "n/a" : `${ratio.toFixed(2)}:1`;
}

function FutureTokenPill({
  label,
  color,
  background,
}: {
  label: string;
  color: string;
  background: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        border: "1px solid currentColor",
        borderColor: "color-mix(in srgb, currentColor 30%, transparent)",
        borderRadius: radius.pill,
        padding: "5px 9px",
        color,
        background,
        fontFamily: fontFamilies.mono,
        fontSize: 11,
        lineHeight: 1.3,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 10,
          height: 10,
          borderRadius: radius.full,
          background: color,
          boxShadow: `0 0 0 1px ${background}`,
        }}
      />
      {label}
    </span>
  );
}

function FutureButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="rezics-color-demo-button rezics-color-demo-focus"
      style={{
        appearance: "none",
        border: 0,
        borderRadius: radius.md,
        color: "#ffffff",
        cursor: "pointer",
        fontFamily: fontFamilies.sans,
        fontSize: 13,
        fontWeight: 650,
        lineHeight: 1.4,
        padding: "9px 14px",
      }}
    >
      {label}
    </button>
  );
}

function FuturePanel({
  mode,
  palette,
}: {
  mode: "Light" | "Dark";
  palette: FuturePalette;
}) {
  const isDark = mode === "Dark";
  const panelStyle: DemoPaletteStyle = {
    "--demo-brand": palette.brand,
    "--demo-brand-hover": palette.brandHover,
    "--demo-brand-active": palette.brandActive,
    "--demo-link": palette.link,
    "--demo-link-hover": palette.linkHover,
    border: `1px solid ${palette.border}`,
    borderRadius: radius.md,
    background: palette.canvas,
    color: palette.text,
    overflow: "hidden",
    boxShadow: isDark ? "0 18px 50px rgba(0,0,0,0.45)" : "none",
  };

  return (
    <section style={panelStyle}>
      <div
        style={{
          display: "grid",
          gap: 18,
          padding: 22,
          background: palette.base,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                color: palette.brand,
                fontFamily: fontFamilies.mono,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
              }}
            >
              Rezics
            </div>
            <h3
              style={{
                margin: "8px 0 0",
                color: palette.brand,
                fontFamily: fontFamilies.mono,
                fontSize: 24,
                fontWeight: 750,
                letterSpacing: 0,
                lineHeight: 1.16,
              }}
            >
              Discover your next great read
            </h3>
          </div>
          <FutureTokenPill
            label={mode}
            color={palette.textSecondary}
            background={palette.subtle}
          />
        </div>

        <p
          style={{
            margin: 0,
            color: palette.textSecondary,
            fontFamily: fontFamilies.sans,
            fontSize: 14,
            lineHeight: 1.55,
            maxWidth: 540,
          }}
        >
          Long-form content stays neutral. Inline references use{" "}
          <a
            href="#future-link"
            className="rezics-color-demo-link rezics-color-demo-focus"
            style={{
              fontWeight: 500,
            }}
          >
            link blue
          </a>
          , while product identity and primary action remain brand red.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(210px, 0.7fr)",
            gap: 16,
          }}
        >
          <div
            style={{
              borderLeft: `4px solid ${palette.brand}`,
              background: palette.subtle,
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                color: palette.text,
                fontFamily: fontFamilies.mono,
                fontSize: 18,
                fontWeight: 700,
                lineHeight: 1.3,
              }}
            >
              Description
            </div>
            <div
              style={{
                marginTop: 8,
                color: palette.textSecondary,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              Accent marks, selected rails, logo text, and primary controls keep
              the brand color.
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 8,
              alignContent: "start",
            }}
          >
            <FutureButton label="Add to Library" />
            <a
              href="#future-action"
              className="rezics-color-demo-link rezics-color-demo-focus"
              style={{
                fontFamily: fontFamilies.sans,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              View all editions
            </a>
            <button
              type="button"
              style={{
                appearance: "none",
                border: 0,
                background: "transparent",
                color: palette.brand,
                cursor: "pointer",
                fontFamily: fontFamilies.sans,
                fontSize: 13,
                fontWeight: 650,
                padding: 0,
                textAlign: "left",
              }}
            >
              Disclosure trigger · closed
            </button>
            <button
              type="button"
              style={{
                appearance: "none",
                border: 0,
                background: "transparent",
                color: palette.link,
                cursor: "pointer",
                fontFamily: fontFamilies.sans,
                fontSize: 13,
                fontWeight: 650,
                padding: 0,
                textAlign: "left",
              }}
            >
              Disclosure control · open
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          borderTop: `1px solid ${palette.border}`,
        }}
      >
        {[
          ["brand", palette.brand, palette.canvas],
          ["brand hover", palette.brandHover, palette.canvas],
          ["brand active", palette.brandActive, palette.canvas],
          ["link", palette.link, palette.canvas],
        ].map(([label, color, bg]) => (
          <div
            key={label}
            style={{
              padding: 12,
              borderRight: `1px solid ${palette.border}`,
            }}
          >
            <div
              style={{
                height: 28,
                borderRadius: radius.sm,
                background: color,
                marginBottom: 8,
              }}
            />
            <div
              style={{
                fontFamily: fontFamilies.mono,
                fontSize: 11,
                color: palette.text,
              }}
            >
              {label}
            </div>
            <div
              style={{
                marginTop: 2,
                fontFamily: fontFamilies.mono,
                fontSize: 10,
                color: palette.textSecondary,
              }}
            >
              {color} · {ratioLabel(color, bg)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FutureColorSystemPreview() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 16,
        margin: "20px 0",
      }}
    >
      <style>{`
        .rezics-color-demo-button {
          background: var(--demo-brand, ${futureLight.brand});
          transition: background 150ms ${easing.out}, transform 150ms ${easing.out};
        }
        .rezics-color-demo-button:hover {
          background: var(--demo-brand-hover, ${futureLight.brandHover});
        }
        .rezics-color-demo-button:active {
          background: var(--demo-brand-active, ${futureLight.brandActive});
          transform: translateY(1px);
        }
        .rezics-color-demo-link {
          color: var(--demo-link, ${futureLight.link});
          text-decoration: none;
          transition: color 150ms ${easing.out};
        }
        .rezics-color-demo-link:hover {
          color: var(--demo-link-hover, ${futureLight.linkHover});
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .rezics-color-demo-link:active {
          color: var(--demo-link-hover, ${futureLight.linkHover});
        }
        .rezics-color-demo-focus:focus-visible {
          outline: 2px solid var(--demo-brand, ${futureLight.brand});
          outline-offset: 2px;
        }
      `}</style>
      <FuturePanel mode="Light" palette={futureLight} />
      <FuturePanel mode="Dark" palette={futureDark} />
    </div>
  );
}

export function FutureInteractionStates() {
  const rows = [
    {
      role: "Primary button",
      rest: futureLight.brand,
      hover: futureLight.brandHover,
      active: futureLight.brandActive,
      note: "Brand red remains the default CTA/action fill.",
    },
    {
      role: "Text link",
      rest: futureLight.link,
      hover: futureLight.linkHover,
      active: futureLight.linkHover,
      note: "Blue handles textual navigation; hover also underlines.",
    },
    {
      role: "Focus ring",
      rest: futureLight.brand,
      hover: futureLight.brand,
      active: futureLight.brand,
      note: "Keyboard focus can stay brand-led even when the label is blue.",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        margin: "16px 0",
      }}
    >
      <style>{`
        .rezics-future-link:hover {
          color: var(--demo-link-hover);
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .rezics-future-button:hover {
          background: var(--demo-brand-hover);
        }
        .rezics-future-button:active {
          background: var(--demo-brand-active);
          transform: translateY(1px);
        }
        .rezics-future-focus:focus-visible {
          outline: 2px solid var(--demo-brand);
          outline-offset: 2px;
        }
      `}</style>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr repeat(3, minmax(110px, 0.7fr)) 1.5fr",
          gap: 0,
          border: "1px solid var(--colors-border-whisper)",
          borderRadius: radius.md,
          overflow: "hidden",
          background: "var(--colors-surface-elevated)",
        }}
      >
        {["Role", "Rest", "Hover", "Active", "Rule"].map((header) => (
          <div
            key={header}
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid var(--colors-border-whisper)",
              background: "var(--colors-surface-subtle)",
              color: "var(--colors-text-secondary)",
              fontFamily: fontFamilies.mono,
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            {header}
          </div>
        ))}
        {rows.map((row) => (
          <Fragment key={row.role}>
            <div
              key={`${row.role}-role`}
              style={{
                padding: 12,
                borderTop: "1px solid var(--colors-border-whisper)",
                color: "var(--colors-text-primary)",
                fontWeight: 600,
              }}
            >
              {row.role}
            </div>
            {[
              { label: "rest", color: row.rest },
              { label: "hover", color: row.hover },
              { label: "active", color: row.active },
            ].map(({ label, color }) => (
              <div
                key={`${row.role}-${label}`}
                style={{
                  padding: 12,
                  borderTop: "1px solid var(--colors-border-whisper)",
                }}
              >
                <div
                  style={{
                    height: 28,
                    borderRadius: radius.sm,
                    background: color,
                  }}
                />
                <div
                  style={{
                    marginTop: 5,
                    color: "var(--colors-text-secondary)",
                    fontFamily: fontFamilies.mono,
                    fontSize: 11,
                  }}
                >
                  {color}
                </div>
              </div>
            ))}
            <div
              key={`${row.role}-note`}
              style={{
                padding: 12,
                borderTop: "1px solid var(--colors-border-whisper)",
                color: "var(--colors-text-secondary)",
                fontSize: 13,
                lineHeight: 1.45,
              }}
            >
              {row.note}
            </div>
          </Fragment>
        ))}
      </div>

      <div
        style={
          {
            "--demo-brand": futureLight.brand,
            "--demo-brand-hover": futureLight.brandHover,
            "--demo-brand-active": futureLight.brandActive,
            "--demo-link": futureLight.link,
            "--demo-link-hover": futureLight.linkHover,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
            padding: 16,
            border: "1px solid var(--colors-border-whisper)",
            borderRadius: radius.md,
            background: "var(--colors-surface-base)",
          } as DemoPaletteStyle
        }
      >
        <button
          type="button"
          className="rezics-future-button rezics-future-focus"
          style={{
            appearance: "none",
            border: 0,
            borderRadius: radius.md,
            background: "var(--demo-brand)",
            color: "#ffffff",
            cursor: "pointer",
            fontFamily: fontFamilies.sans,
            fontSize: 13,
            fontWeight: 650,
            lineHeight: 1.4,
            padding: "9px 14px",
            transition: `background 150ms ${easing.out}, transform 150ms ${easing.out}`,
          }}
        >
          Hover primary action
        </button>
        <a
          href="#future-hover-link"
          className="rezics-future-link rezics-future-focus"
          style={{
            color: "var(--demo-link)",
            fontFamily: fontFamilies.sans,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            transition: `color 150ms ${easing.out}`,
          }}
        >
          Hover text link
        </a>
        <button
          type="button"
          className="rezics-future-focus"
          style={{
            appearance: "none",
            border: 0,
            background: "transparent",
            color: futureLight.brand,
            cursor: "pointer",
            fontFamily: fontFamilies.sans,
            fontSize: 13,
            fontWeight: 650,
            padding: 0,
          }}
        >
          Closed disclosure affordance
        </button>
        <button
          type="button"
          className="rezics-future-link rezics-future-focus"
          style={{
            appearance: "none",
            border: 0,
            background: "transparent",
            color: "var(--demo-link)",
            cursor: "pointer",
            fontFamily: fontFamilies.sans,
            fontSize: 13,
            fontWeight: 650,
            padding: 0,
          }}
        >
          Open disclosure control
        </button>
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
// 用于 Foundation/Patterns 的密度 / 状态层 / 层级 / 反色表面演示。

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
