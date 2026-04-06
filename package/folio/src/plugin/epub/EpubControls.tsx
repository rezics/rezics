import type { PanelProps } from "../../types";

interface EpubControlsProps extends PanelProps {
  tocHtml?: string;
}

export function createEpubControls(
  tocItems: { label: string; index: number }[],
) {
  return function EpubControls({ dispatch }: PanelProps) {
    return (
      <div
        className="folio-epub-controls"
        style={{ padding: "8px", fontSize: "13px" }}
      >
        {tocItems.map((item, i) => (
          <div
            key={i}
            onClick={() => dispatch({ type: "SET_CHAPTER", index: item.index })}
            style={{
              padding: "6px 8px",
              cursor: "pointer",
              borderRadius: "4px",
            }}
          >
            {item.label}
          </div>
        ))}
      </div>
    );
  };
}
