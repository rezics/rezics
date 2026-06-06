const CLIPBOARD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

const CHECK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

export function addCopyButtons(container: HTMLElement): void {
  const pres = container.querySelectorAll("pre");

  for (const pre of pres) {
    if (pre.dataset.copyButton) continue;
    pre.dataset.copyButton = "true";

    const btn = document.createElement("button");
    btn.className = "code-copy-btn";
    btn.type = "button";
    btn.innerHTML = CLIPBOARD_ICON;
    btn.setAttribute("aria-label", "Copy code");

    btn.addEventListener("click", () => {
      const code = pre.querySelector("code");
      const text = (code ?? pre).textContent ?? "";
      navigator.clipboard.writeText(text).then(() => {
        btn.innerHTML = CHECK_ICON;
        setTimeout(() => {
          btn.innerHTML = CLIPBOARD_ICON;
        }, 2000);
      });
    });

    pre.appendChild(btn);
  }
}
