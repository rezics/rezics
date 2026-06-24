export interface PreviewConfig {
  mode?: "side-by-side" | "toggle";
  /**
   * Custom code highlighter. Set to `false` to disable. Defaults to built-in highlight.js.
   * 自定义代码高亮器。设为 `false` 可禁用。默认使用内置的 highlight.js。
   */
  highlight?: ((code: string, lang: string) => string) | false;
}
