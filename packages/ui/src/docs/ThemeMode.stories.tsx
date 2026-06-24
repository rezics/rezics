import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";

function ThemeModeProbe() {
  const [snapshot, setSnapshot] = useState({
    mode: "",
    bgColor: "",
    textColor: "",
  });

  useEffect(() => {
    const read = () => {
      const root = document.documentElement;
      const cs = getComputedStyle(root);
      setSnapshot({
        mode: root.classList.contains("dark") ? "dark" : "light",
        bgColor: cs.getPropertyValue("--colors-surface-canvas").trim(),
        textColor: cs.getPropertyValue("--colors-text-primary").trim(),
      });
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <strong>mode:</strong> {snapshot.mode || "(unset)"}
      </div>
      <div>
        <strong>--colors-surface-canvas:</strong> {snapshot.bgColor}
      </div>
      <div>
        <strong>--colors-text-primary:</strong> {snapshot.textColor}
      </div>
      <div
        className="rounded-md p-4"
        style={{
          background: "var(--colors-surface-elevated)",
          color: "var(--colors-text-primary)",
          border: "1px solid var(--colors-border-whisper)",
        }}
      >
        Toggle the Storybook theme toolbar (sun/moon). The values above and the
        sample card should re-resolve when the <code>dark</code> class on{" "}
        <code>&lt;html&gt;</code> flips.
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
