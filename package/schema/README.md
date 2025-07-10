# Schema Package

这个包包含了整个应用的类型定义和 API schema，使用 Zod v4 进行类型验证。

## 目录结构

```
src/
├── base.ts              # 基础类型定义
├── index.ts             # 主入口文件
└── modules/             # 功能模块
    ├── index.ts         # 模块索引
    ├── user.ts          # 用户相关类型
    ├── book.ts          # 书籍相关类型
    ├── booklist.ts      # 书单相关类型
    ├── review.ts        # 书评相关类型
    ├── tag.ts           # 标签相关类型
    ├── auth.ts          # 认证相关 API
    ├── book-api.ts      # 书籍相关 API
    ├── booklist-api.ts  # 书单相关 API
    ├── review-api.ts    # 书评相关 API
    ├── search-api.ts    # 搜索相关 API
    ├── user-api.ts      # 用户相关 API
    └── endpoints.ts     # API 端点配置
```

## 模块说明

### 基础模块
- **base.ts**: 包含基础类型定义，如 ID、字符串、数字等通用类型
- **user.ts**: 用户和作者相关的类型定义
- **book.ts**: 书籍、章节、引用摘录等类型定义
- **booklist.ts**: 书单和评论相关的类型定义
- **review.ts**: 书评相关的类型定义
- **tag.ts**: 标签相关的类型定义

### API 模块
- **auth.ts**: 认证相关的请求和响应 schema
- **book-api.ts**: 书籍相关的 API 请求和响应 schema
- **booklist-api.ts**: 书单相关的 API 请求和响应 schema
- **review-api.ts**: 书评相关的 API 请求和响应 schema
- **search-api.ts**: 搜索相关的 API 请求和响应 schema
- **user-api.ts**: 用户相关的 API 请求和响应 schema
- **endpoints.ts**: API 端点配置

## 使用方式

```typescript
// 导入所有类型
import { User, Book, BookList } from 'schema';

// 导入特定模块
import { UserSchema, BookSchema } from 'schema/modules/user';
import { BookListSchema } from 'schema/modules/booklist';

// 导入 API 端点
import { API_ENDPOINTS } from 'schema/modules/endpoints';
```

## 特点

- 使用 Zod v4 进行类型验证
- 模块化设计，便于维护和扩展
- 完整的 TypeScript 类型支持
- 统一的 API 响应格式
- 清晰的请求/响应 schema 分离