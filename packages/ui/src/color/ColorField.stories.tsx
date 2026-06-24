import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ColorField } from "./ColorField";
import type { ColorThemeSet } from "./ColorPalette";

const swatches = [
  { label: "Brand", value: "#db515c" },
  { label: "Ink", value: "#1f2937" },
  { label: "Paper", value: "#ffffff" },
  { label: "Ocean", value: "#2563eb" },
  { label: "Forest", value: "#16a34a" },
  { label: "Amber", value: "#d97706" },
];

type ZoneToken = "background" | "surface" | "text" | "accent";

const themeSets: ColorThemeSet<ZoneToken>[] = [
  {
    label: "Library",
    values: {
      background: "#ffffff",
      surface: "#f8fafc",
      text: "#1f2937",
      accent: "#db515c",
    },
  },
  {
    label: "Night",
    values: {
      background: "#111827",
      surface: "#1f2937",
      text: "#f9fafb",
      accent: "#60a5fa",
    },
  },
];

const meta = {
  title: "Primitive/Control/ColorField",
  component: ColorField,
} satisfies Meta<typeof ColorField>;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlledColor() {
  const [value, setValue] = useState("#db515c");
  return (
    <div className="max-w-sm">
      <ColorField
        label="Accent"
        value={value}
        onChange={setValue}
        swatches={swatches}
      />
    </div>
  );
}

function ControlledThemeSet() {
  const [tokens, setTokens] = useState<Record<ZoneToken, string>>({
    background: "#ffffff",
    surface: "#f8fafc",
    text: "#1f2937",
    accent: "#db515c",
  });
  return (
    <div className="grid max-w-2xl gap-4 md:grid-cols-2">
      {(Object.keys(tokens) as ZoneToken[]).map((token) => (
        <ColorField<ZoneToken>
          key={token}
          label={token}
          value={tokens[token]}
          onChange={(value) => setTokens({ ...tokens, [token]: value })}
          swatches={swatches}
          themeSets={themeSets}
          onApplyThemeSet={(values) => setTokens({ ...tokens, ...values })}
        />
      ))}
    </div>
  );
}

function NonHexColor() {
  const [value, setValue] = useState("oklch(0.7 0.1 20)");
  return (
    <div className="max-w-sm">
      <ColorField label="Raw CSS color" value={value} onChange={setValue} />
    </div>
  );
}

export const Default: Story = {
  args: { value: "#db515c", onChange: () => undefined },
  render: () => <ControlledColor />,
};

export const ThemeSetApplication: Story = {
  args: { value: "#db515c", onChange: () => undefined },
  render: () => <ControlledThemeSet />,
};

export const NonHexValue: Story = {
  args: { value: "oklch(0.7 0.1 20)", onChange: () => undefined },
  render: () => <NonHexColor />,
};
