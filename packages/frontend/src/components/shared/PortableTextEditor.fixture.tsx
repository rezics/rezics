"use client";

import { useState } from "react";
import { PortableTextEditor } from "./PortableTextEditor";

const longContent = [
  "Effect 4.0 带来了全新的 Atom 响应式系统、HTTP API 声明式路由和改进的错误处理。",
  "This paragraph intentionally includes a verylongunbrokenidentifierthatshouldnotwidenthetextarea.",
  "最后一段用于制造足够的高度，方便在短视口中检查 textarea 的滚动和焦点样式。",
].join("\n\n");

function ControlledEditor() {
  const [value, setValue] = useState("Controlled initial value.");

  return (
    <div className="flex flex-col gap-2">
      <PortableTextEditor onChange={setValue} value={value} />
      <p className="text-muted-foreground text-xs">Length: {value.length}</p>
    </div>
  );
}

export default {
  Empty: (
    <div className="mx-auto w-full max-w-2xl p-4">
      <PortableTextEditor />
    </div>
  ),
  WithContent: (
    <div className="mx-auto w-full max-w-2xl p-4">
      <PortableTextEditor
        value="Effect 4.0 带来了全新的 Atom 响应式系统、HTTP API 声明式路由和改进的错误处理。本文深入介绍核心变化和迁移指南。"
      />
    </div>
  ),
  Controlled: (
    <div className="mx-auto w-full max-w-2xl p-4">
      <ControlledEditor />
    </div>
  ),
  LongContent: (
    <div className="mx-auto w-full max-w-2xl p-4">
      <PortableTextEditor value={longContent} />
    </div>
  ),
  MobileDense: (
    <div className="mx-auto w-full max-w-[320px] p-2">
      <PortableTextEditor value={longContent} />
    </div>
  ),
  Placeholder: (
    <div className="mx-auto w-full max-w-2xl p-4">
      <PortableTextEditor value="" />
    </div>
  ),
};
