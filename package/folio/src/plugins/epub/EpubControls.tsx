import type { PanelProps } from "../../types";

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
          // biome-ignore lint/a11y/useSemanticElements: toc item button
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static list
            key={i}
            role="button"
            tabIndex={0}
            onClick={() => dispatch({ type: "SET_CHAPTER", index: item.index })}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                dispatch({ type: "SET_CHAPTER", index: item.index });
              }
            }}
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
