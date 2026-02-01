# API Layer Refactoring

## 重构概述

本次重构将 API 层进行了简化，主要目标：

1. **类型定义统一管理**：所有 DTO 和 Input 类型迁移到 `contract` 包
2. **简化 API 函数**：移除不必要的类型转换和数据重载
3. **前后端类型共享**：后端返回的数据结构直接被前端使用

## 文件结构

### Contract Package（类型定义）

```
contract/src/
├── pagination.ts    # 分页相关类型
├── book.ts         # 图书相关类型
├── chapter.ts      # 章节相关类型
├── comment.ts      # 评论相关类型
├── readlist.ts     # 阅读列表相关类型
├── review.ts       # 书评相关类型
├── tag.ts          # 标签相关类型
├── user.ts         # 用户相关类型
└── index.ts        # 统一导出
```

### API Files（简化版）

每个 API 文件包含三个部分：

1. **Query Keys** - TanStack Query 缓存键
2. **API Functions** - HTTP 请求函数
3. **Query Options** - TanStack Query queryOptions 工厂函数

## 改动说明

### 移除的内容

- ❌ API 文件中的 DTO 类型定义（已迁移到 contract）
- ❌ API 文件中的 Input 类型定义（已迁移到 contract）
- ❌ 不必要的数据转换和重载（如 `BookListItem`, `BookDetail`）
- ❌ 复杂的 `select` 转换函数
- ❌ 冗余的泛型类型标注

### 新增的内容

- ✅ `contract/src/pagination.ts` - 统一的分页类型
- ✅ 独立的类型文件，便于前后端共享
- ✅ 简化的 API 函数，直接返回后端数据

## 使用示例

### Before (重构前)

```typescript
// API 文件中定义类型
export type BookDTO = {
  id: string;
  title: string;
  // ...
};

// 使用时需要转换
export const bookQueries = {
  byId: (id: string) =>
    queryOptions({
      queryKey: bookKeys.detail(id),
      queryFn: () => bookApi.get(id),
      select: b => ({
        id: String(b.id ?? id),
        title: String(b.title ?? ''),
        // 复杂的数据转换...
      }),
    }),
};
```

### After (重构后)

```typescript
// 从 contract 导入类型
import {type BookDTO} from 'contract';

// 直接使用，无需转换
export const bookQueries = {
  byId: (id: string) =>
    queryOptions({
      queryKey: bookKeys.detail(id),
      queryFn: () => bookApi.get(id),
    }),
};
```

## 优势

1. **类型安全**：前后端使用相同的类型定义，减少类型不一致的问题
2. **代码简洁**：移除不必要的转换层，代码更易读
3. **维护方便**：类型定义集中管理，修改一处即可
4. **性能优化**：减少运行时的数据转换开销
5. **开发效率**：后端返回什么，前端直接用，无需手动映射

## 迁移指南

如果你的组件代码中使用了旧的类型或数据结构：

### 1. 更新导入

```typescript
// 旧的
import {type BookDTO} from '@/api/Book';

// 新的
import {type BookDTO} from 'contract';
```

### 2. 移除数据转换

```typescript
// 旧的 - 假设有 select 转换
const {data} = useQuery(bookQueries.byId(id));
// data 类型是 BookDetail（转换后）

// 新的 - 直接使用
const {data} = useQuery(bookQueries.byId(id));
// data 类型是 BookDTO（与后端一致）
```

### 3. 更新类型引用

如果代码中引用了被移除的类型（如 `BookListItem`, `BookDetail`），请直接使用 `BookDTO`。

## 注意事项

- ⚠️ 后端必须确保返回的数据结构与 contract 中定义的类型一致
- ⚠️ 如果确实需要数据转换，建议在组件层处理，而非 API 层
- ⚠️ 分页类型统一使用 `OffsetPaginated<T>` 或 `CursorPaginated<T>`
