import type MarkdownIt from "markdown-it";
import { pipe } from "@/util/fp";
import * as A from "fp-ts/lib/Array";
import * as O from "fp-ts/lib/Option";
import * as E from "fp-ts/lib/Either";
import { stringUtils } from "@/util/fp";

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
const multipleEmptyLines = (state: any): void => {
    const processEmptyLines = (src: string): string => {
        const transformMatch = (match: string): string => {
            const total = match.length;
            const brCount = total - 1;
            return "\n\n" + "&nbsp;\n".repeat(brCount);
        };

        return src.replace(/\n{2,}/g, transformMatch);
    };

    const src = state.src;
    if (!src.includes("\n\n")) return;

    state.src = processEmptyLines(src);
};

// ------------------- 2. 处理多空格的核心规则 -------------------
/**
 * 处理多空格的核心规则，使用函数式编程方式重构
 *
 * 设计原则：
 * - 纯函数：不修改输入，返回新的数据结构
 * - 不可变性：使用函数式转换而不是就地修改
 * - 组合性：将复杂逻辑分解为小的、可组合的函数
 * - 类型安全：明确的类型定义和错误处理
 */

// 定义Token类型以提高类型安全性
interface Token {
    type: string;
    content: string;
    children?: Token[];
}

// 检查是否为需要处理的文本token
const isTextTokenWithSpaces = (token: Token): boolean => token.type === "text" && token.content.includes("  ");

// 创建HTML内联token
const createHtmlInlineToken = (content: string, TokenConstructor: any): Token => {
    const token = new TokenConstructor("html_inline", "", 0);
    token.content = content;
    return token;
};

// 创建文本token
const createTextToken = (content: string, TokenConstructor: any): Token => {
    const token = new TokenConstructor("text", "", 0);
    token.content = content;
    return token;
};

// 处理单个文本部分
const processTextPart = (part: string, TokenConstructor: any): O.Option<Token> => {
    if (part.match(/ {2,}/)) {
        // 连续空格，转换为&nbsp;
        const content = "&nbsp;".repeat(part.length);
        return O.some(createHtmlInlineToken(content, TokenConstructor));
    }

    if (part.length > 0) {
        // 普通文本
        return O.some(createTextToken(part, TokenConstructor));
    }

    return O.none;
};

// 分解含有连续空格的文本token
const splitTextToken = (token: Token, TokenConstructor: any): Token[] => {
    const parts = pipe(token.content, stringUtils.split(/( {2,})/g));

    return pipe(
        parts,
        A.map((part) => processTextPart(part, TokenConstructor)),
        A.compact, // 移除None值，只保留Some中的值
    );
};

// 处理单个token
const processToken = (token: Token, TokenConstructor: any): Token[] => {
    if (isTextTokenWithSpaces(token)) {
        return splitTextToken(token, TokenConstructor);
    }
    return [token];
};

// 处理inline token的所有子token
const processInlineTokenChildren = (children: Token[], TokenConstructor: any): Token[] => {
    return pipe(
        children,
        A.chain((token) => processToken(token, TokenConstructor)),
    );
};

// 处理单个块级token
const processBlockToken = (blockToken: Token, TokenConstructor: any): Token => {
    if (blockToken.type === "inline" && blockToken.children) {
        const newChildren = processInlineTokenChildren(blockToken.children, TokenConstructor);
        return { ...blockToken, children: newChildren };
    }
    return blockToken;
};

// 主处理函数，处理所有tokens
const preserveSpacesCore = (state: any): void => {
    const processedTokens = pipe(
        state.tokens,
        A.map((token) => processBlockToken(token, state.Token)),
    );

    state.tokens = processedTokens;
};

// ------------------- 3. 最终的插件函数 -------------------
/**
 * 一个 markdown-it 插件，定制化空行和空格的渲染
 *
 * 工作原理:
 * - 拆分为两个核心组件，multipleEmptyLines and preserveSpacesCore
 * - multipleEmptyLines: 将空行替换成`\n\n&nbsp;\n`渲染, 从而保留空行
 * - preserveSpacesCore: 将空格替换成`&nbsp;`渲染, 从而保留空格
 *
 * 重构改进：
 * - 使用函数式编程方式，提高代码的正确性、效率和美观性
 * - 纯函数设计，无副作用，易于测试和理解
 * - 不可变数据结构，避免意外修改
 * - 组合性强，功能分解为小的、可重用的函数
 *
 * @param md markdown-it 实例
 * @param options 插件选项
 */
export const preserveFormattingPlugin = (md: MarkdownIt, options?: PreserveFormatOptions): void => {
    // 默认选项，使用不可变方式合并
    const defaults: Required<PreserveFormatOptions> = {
        preserveSpaces: true,
        preserveEmptyLines: true,
        emptyLineRender: '<p class="preserved-empty-line">&nbsp;</p>',
    };

    const effectiveOptions = { ...defaults, ...options };

    // 注册空行处理规则
    if (effectiveOptions.preserveEmptyLines) {
        md.core.ruler.before("normalize", "line_break_to_br", multipleEmptyLines);
    }

    // 注册空格处理规则
    if (effectiveOptions.preserveSpaces) {
        md.core.ruler.push("preserve_spaces_core", preserveSpacesCore);
    }
};
