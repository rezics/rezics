import type { Extension } from "@codemirror/state";
import { EditorView, type Panel, showPanel } from "@codemirror/view";
import type { ToolbarItem } from "../types";

function createTooltip(label: string): HTMLSpanElement {
  const tip = document.createElement("span");
  tip.role = "tooltip";
  tip.className = "cm-toolbar-tooltip";
  tip.textContent = label;
  return tip;
}

function attachTooltip(button: HTMLButtonElement, tooltip: HTMLSpanElement) {
  const show = () => tooltip.classList.add("cm-toolbar-tooltip-visible");
  const hide = () => tooltip.classList.remove("cm-toolbar-tooltip-visible");

  button.addEventListener("pointerenter", show);
  button.addEventListener("pointerleave", hide);
  button.addEventListener("focus", show);
  button.addEventListener("blur", hide);
  button.addEventListener("click", hide);

  button.appendChild(tooltip);
}

function createPanelToolbar(items: ToolbarItem[]): (view: EditorView) => Panel {
  return (view: EditorView) => {
    const dom = document.createElement("div");
    dom.className = "cm-toolbar-panel";
    dom.setAttribute("role", "toolbar");

    const buttons: { button: HTMLButtonElement; item: ToolbarItem }[] = [];

    for (const item of items) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cm-toolbar-button";
      button.setAttribute("aria-label", item.label);
      button.textContent =
        typeof item.icon === "string" ? item.icon : item.label;

      attachTooltip(button, createTooltip(item.label));

      button.addEventListener("click", (e) => {
        e.preventDefault();
        item.action(view);
        view.focus();
      });
      dom.appendChild(button);
      buttons.push({ button, item });
    }

    function updateActiveStates() {
      const state = view.state;
      for (const { button, item } of buttons) {
        if (item.isActive) {
          button.classList.toggle(
            "cm-toolbar-button-active",
            item.isActive(state),
          );
        }
      }
    }

    updateActiveStates();

    return {
      dom,
      top: true,
      update() {
        updateActiveStates();
      },
    };
  };
}

export function panelToolbar(items: ToolbarItem[]): Extension {
  return [
    showPanel.of(createPanelToolbar(items)),
    EditorView.baseTheme({
      ".cm-toolbar-panel": {
        display: "flex",
        flexWrap: "wrap",
        gap: "2px",
        padding: "4px 8px",
        borderBottom: "1px solid #ddd",
      },
      ".cm-toolbar-button": {
        position: "relative",
        padding: "2px 8px",
        border: "1px solid transparent",
        borderRadius: "3px",
        background: "none",
        cursor: "pointer",
        fontSize: "13px",
        "&:hover": {
          background: "#f0f0f0",
        },
      },
      ".cm-toolbar-button-active": {
        background: "#e0e0e0",
        borderColor: "#ccc",
      },
      ".cm-toolbar-tooltip": {
        position: "absolute",
        top: "100%",
        left: "50%",
        transform: "translateX(-50%)",
        marginTop: "4px",
        padding: "2px 6px",
        fontSize: "11px",
        lineHeight: "16px",
        whiteSpace: "nowrap",
        color: "#fff",
        background: "#333",
        borderRadius: "3px",
        pointerEvents: "none",
        opacity: "0",
        transition: "opacity 0.12s",
      },
      ".cm-toolbar-tooltip-visible": {
        opacity: "1",
      },
    }),
  ];
}
