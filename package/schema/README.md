# Schema Package

这个包包含了整个应用的类型定义和 API schema，使用 Zod v4 进行类型验证。

## 目录结构

```
src/
├── base.ts              # 基础类型定义
├── index.ts             # 主入口文件
└── modules/             # 功能模块
    ├── index.ts         # 模块索引
    ├── user.ts          # 用户相关类型和 API
    ├── book.ts          # 书籍相关类型和 API
    ├── booklist.ts      # 书单相关类型和 API
    ├── review.ts        # 书评相关类型和 API
    ├── tag.ts           # 标签相关类型
    ├── auth.ts          # 认证相关类型和 API
    └── endpoints.ts     # API 端点配置
```

## 模块说明

### 功能模块
- **base.ts**: 包含基础类型定义，如 ID、字符串、数字等通用类型
- **user.ts**: 用户和作者相关的类型定义及 API
- **book.ts**: 书籍、章节、引用摘录等类型定义及 API（包含搜索功能）
- **booklist.ts**: 书单和评论相关的类型定义及 API
- **review.ts**: 书评相关的类型定义及 API
- **tag.ts**: 标签相关的类型定义
- **auth.ts**: 认证相关的类型定义及 API
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

// 导入 API 类型
import { LoginRequest, BookInfoResponse } from 'schema';
```

## 特点

- 使用 Zod v4 进行类型验证
- 模块化设计，便于维护和扩展
- 完整的 TypeScript 类型支持
- 统一的 API 响应格式
- 清晰的请求/响应 schema 分离