import baseShareCss from "../css/base.css" with { type: "text" };
import bookShareCss from "../css/book.css" with { type: "text" };

export function getBookShareStyles() {
  return `${baseShareCss}\n${bookShareCss}`;
}
