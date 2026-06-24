"use client";

import { PortableTextEditor } from "./PortableTextEditor";

export default {
  Empty: <PortableTextEditor />,
  WithContent: (
    <PortableTextEditor
      value="Effect 4.0 带来了全新的 Atom 响应式系统、HTTP API 声明式路由和改进的错误处理。本文深入介绍核心变化和迁移指南。"
    />
  ),
  Placeholder: <PortableTextEditor value="" />,
};
