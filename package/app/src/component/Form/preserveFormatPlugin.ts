import type MarkdownIt from "markdown-it";

// --- 插件选项接口 ---
export interface PreserveFormatOptions {
    /**
     * 是否保留连续空格。
     * @default true
     */
    preserveSpaces?: boolean;

    /**
     * 是否保留空行。
     * @default true
     */
    preserveEmptyLines?: boolean;

    /**
     * 用于渲染空行的 HTML 字符串。
     * @default '<p class="preserved-empty-line">&nbsp;</p>'
     */
    emptyLineRender?: string;
}

// 两个功能，第一个，将所有的空行转换成一个块标签，所有的空行。第二个，将所有的空格，转换成标准空格渲染出来而不是合并
// ------------------- 1. 处理空行的块级规则 -------------------
/**
 * 处理空行的块级规则，它将 Markdown 源文本中的连续空行保留
 *
 * 工作原理:
 * - 此插件通过一个 core rule 在块级解析前对源字符串进行预处理。
 * - 它查找连续两个或以上的新行。
 * - 两个新行（一个空行）是标准的段落分隔符，其行为被保留。
 * - 每增加一个额外的新行，就被视为一个需要转换为 <br> 的空行。
 * - 例如，三个新行（两个空行）= 一个段落分隔符 + 一个 <br>。
 * - 转换时，它会插入 <br> 标签，并用空行包裹，以确保 markdown-it 将其视为独立的 HTML 块，
 * 从而不破坏原始的段落分割逻辑。
 *
 * @param state markdown-it 的 state 实例
 */
function multipleEmptyLines(state: any) {
    const src = state.src;
    if (!src.includes("\n\n")) return;

    state.src = src.replace(/\n{2,}/g, (match: string) => {
        // match 里全是 \n，长度就是换行数
        const total = match.length;
        // 保留一个 \n 让后续的段落分隔还能生效，多出来的每个就变成一个 <br>
        const brCount = total - 1;
        // ! 注意需要两个换行，这样才能正常分块
        return "\n\n" + "&nbsp;\n".repeat(brCount);
    });
}

// ------------------- 2. 处理多空格的核心规则 -------------------
function preserveSpacesCore(state: any) {
    for (const blockToken of state.tokens) {
        // 我们只关心 inline token，因为文本内容都在这里
        if (blockToken.type === "inline" && blockToken.children) {
            const newChildren: any[] = [];

            for (const token of blockToken.children) {
                // 在 inline token 的子节点中，我们只关心 text token
                if (token.type === "text" && token.content.includes("  ")) {
                    // 如果一个 text token 包含连续空格，我们将它分裂
                    const parts = token.content.split(/( {2,})/g);

                    parts.forEach((part: string) => {
                        if (part.match(/ {2,}/)) {
                            // 这部分是连续空格，创建一个 html_inline token 来渲染 &nbsp;
                            const spaceToken = new state.Token("html_inline", "", 0);
                            // 为了保留视觉上的间距并防止行首折叠，
                            // '   ' -> '&nbsp; &nbsp;' 是一个不错的策略
                            spaceToken.content = "&nbsp;".repeat(part.length);
                            newChildren.push(spaceToken);
                        } else if (part) {
                            // 这部分是普通文本，创建一个新的 text token
                            const textToken = new state.Token("text", "", 0);
                            textToken.content = part;
                            newChildren.push(textToken);
                        }
                    });
                } else {
                    // 如果 token 不是 text 或不含连续空格，直接保留
                    newChildren.push(token);
                }
            }
            // 用分裂后的新 token 数组替换旧的 children 数组
            blockToken.children = newChildren;
        }
    }
}

// ------------------- 3. 最终的插件函数 -------------------
/**
 * 一个 markdown-it 插件，定制化空行和空格的渲染
 *
 * 工作原理:
 * - 拆分为两个核心组件，multipleEmptyLines and preserveSpacesCore 
 * - multipleEmptyLines: 将空行替换成`\n\n&nbsp;\n`渲染, 从而保留空行
 * - preserveSpacesCore: 将空格替换成`&nbsp;`渲染, 从而保留空格
 * @param md markdown-it 实例
 */
export function preserveFormattingPlugin(md: MarkdownIt, options?: PreserveFormatOptions) {
    const defaults: PreserveFormatOptions = {
        preserveSpaces: true,
        preserveEmptyLines: true,
        emptyLineRender: '<p class="preserved-empty-line">&nbsp;</p>',
    };

    const effectiveOptions = { ...defaults, ...options };

    // --- 注册空行处理规则 ---
    // 在 block 解析之前，先把连续空行替换成 <br> token
    md.core.ruler.before('normalize', "line_break_to_br", multipleEmptyLines);

    // --- 注册空格处理规则 ---
    if (effectiveOptions.preserveSpaces) {
        // 注册核心规则。它会在所有 token 解析完毕后执行。
        md.core.ruler.push("preserve_spaces_core", preserveSpacesCore);
    }
}
  