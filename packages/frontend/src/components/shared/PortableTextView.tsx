"use client";

import { PortableText, type PortableTextComponents } from "@portabletext/react";
import type { ArbitraryTypedObject } from "@portabletext/types";

const components: PortableTextComponents = {
  block: {
    h1: ({ children }) => <h1 className="mb-4 text-2xl font-bold">{children}</h1>,
    h2: ({ children }) => <h2 className="mb-3 text-xl font-bold">{children}</h2>,
    h3: ({ children }) => <h3 className="mb-2 text-lg font-semibold">{children}</h3>,
    blockquote: ({ children }) => (
      <blockquote className="border-border my-2 border-l-2 pl-4 italic">{children}</blockquote>
    ),
    normal: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
  },
  marks: {
    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    underline: ({ children }) => <span className="underline">{children}</span>,
    "strike-through": ({ children }) => <s>{children}</s>,
    code: ({ children }) => (
      <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm">{children}</code>
    ),
    link: ({ children, value }) => (
      <a className="text-primary underline" href={value?.href} rel="noopener noreferrer" target="_blank">
        {children}
      </a>
    ),
  },
  list: {
    bullet: ({ children }) => <ul className="mb-2 list-disc pl-6">{children}</ul>,
    number: ({ children }) => <ol className="mb-2 list-decimal pl-6">{children}</ol>,
  },
};

function isTypedObject(item: unknown): item is ArbitraryTypedObject {
  return (
    typeof item === "object" &&
    item !== null &&
    "_type" in item &&
    typeof item._type === "string"
  );
}

// Runtime guard: every element must carry `_type: string` (TypedObject contract).
// 运行时守卫：每个元素必须携带 `_type: string`（TypedObject 契约）。
function isPortableTextArray(v: unknown): v is ArbitraryTypedObject[] {
  return Array.isArray(v) && v.every(isTypedObject);
}

// Accept unknown content and render only when it is a valid PortableText array.
// The API may return structured ContentDoc envelopes or other shapes; this guard
// ensures we never pass incompatible data to @portabletext/react.
// 接受 unknown 内容，仅当其为有效的 PortableText 数组时才渲染。
// API 可能返回结构化 ContentDoc 信封或其他形态；此守卫确保不会将不兼容数据传给 @portabletext/react。
export function PortableTextView({ value }: { readonly value: unknown }) {
  if (!isPortableTextArray(value)) return null;
  return (
    <div className="prose prose-sm max-w-none">
      <PortableText components={components} value={value} />
    </div>
  );
}
