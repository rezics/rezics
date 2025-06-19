/* eslint-disable @typescript-eslint/no-explicit-any */
export function scrollToElementWithOffset(
    selector: any,
    offset = 100,
    behavior: ScrollBehavior = "smooth",
    updateHash = false,
) {
    const element = document.querySelector(selector);
    if (element) {
        const top = element.getBoundingClientRect().top + window.scrollY - offset;
        console.log(selector, ": ", top);
        window.scrollTo({
            top: top,
            behavior: behavior as ScrollBehavior,
        });

        // * This method can't not maintain right hash history
        if (updateHash) {
            // const id = selector.startsWith("#") ? selector.slice(1) : selector;
            // // 修改 URL 的 hash，并记录历史
            // history.pushState(null, "", `#${id}`);
        }
    }
}

/**
 * 滚动到指定元素（带偏移，支持等待元素出现与多次修正，兼容大部分场景）
 * @param {string|Element} selector - 元素选择器或 DOM 对象
 * @param {number} offset - 距离窗口顶部的偏移量（px）
 * @param {string} behavior - "smooth" 或 "auto"
 * @param {number} maxRetry - 最大重试次数（可选，默认10）
 */
export function scrollToElementWithOffsetUniversal(
    selector: any,
    offset = 0,
    behavior: ScrollBehavior = "smooth",
    maxRetry = 10,
) {
    let tries = 0;
    let lastTop: any = null;

    function getElement() {
        if (typeof selector === "string") return document.querySelector(selector);
        return selector;
    }

    function doScroll() {
        const el = getElement();
        if (!el) return false;

        const rect = el.getBoundingClientRect();
        const top = rect.top + window.pageYOffset - offset;

        // 如果两次top几乎一致，说明元素已经稳定
        if (lastTop !== null && Math.abs(lastTop - top) < 2) return true;
        lastTop = top;

        window.scrollTo({
            top,
            behavior,
        });
        return true;
    }

    function tryScroll() {
        const ok = doScroll();
        if (!ok && tries < maxRetry) {
            tries++;
            setTimeout(tryScroll, 50);
            return;
        }
        // 多次修正
        if (tries < maxRetry) {
            tries++;
            setTimeout(doScroll, 80);
            setTimeout(doScroll, 200);
        }
    }

    tryScroll();
}
