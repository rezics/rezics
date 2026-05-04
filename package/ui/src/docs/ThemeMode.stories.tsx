import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";

function ThemeModeProbe() {
  const [snapshot, setSnapshot] = useState({
    dataTheme: "",
    bgColor: "",
    textColor: "",
  });

  useEffect(() => {
    const read = () => {
      const root = document.documentElement;
      const cs = getComputedStyle(root);
      setSnapshot({
        dataTheme: root.dataset.theme ?? "",
        bgColor: cs.getPropertyValue("--rezics-sys-color-surface-canvas").trim(),
        textColor: cs.getPropertyValue("--rezics-sys-color-text-primary").trim(),
      });
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <strong>data-theme:</strong> {snapshot.dataTheme || "(unset)"}
      </div>
      <div>
        <strong>--rezics-sys-color-surface-canvas:</strong> {snapshot.bgColor}
      </div>
      <div>
        <strong>--rezics-sys-color-text-primary:</strong> {snapshot.textColor}
      </div>
      <div
        className="rounded-md p-4"
        style={{
          background: "var(--rezics-sys-color-surface-elevated)",
          color: "var(--rezics-sys-color-text-primary)",
          border: "1px solid var(--rezics-sys-color-border-whisper)",
        }}
      >
        Toggle the Storybook theme toolbar (sun/moon). The values above and the
        sample card should re-resolve when `data-theme` flips between "light"
        and "dark".
      </div>
    </div>
  );
}

const meta = {
  title: "Foundation/Theme Mode Regression",
  component: ThemeModeProbe,
} satisfies Meta<typeof ThemeModeProbe>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TokenCascade: Story = {};
