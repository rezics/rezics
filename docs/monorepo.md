{
  "name": "my-project",
  "version": "1.0.0",
  "workspaces": ["packages/**", "!packages/**/test/**", "!packages/**/template/**"]
}

bun 支持 Hierarchical Monorepo 结构

基于文档：https://bun.com/docs/runtime/glob#supported-glob-patterns

package/** 意味着树状匹配
