export interface PreviewConfig {
  mode?: "side-by-side" | "toggle";
  /** Custom code highlighter. Set to `false` to disable. Defaults to built-in highlight.js. */
  highlight?: ((code: string, lang: string) => string) | false;
}
