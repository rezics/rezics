# API 使用快速参考

## 导入类型

```typescript
// ✅ 正确 - 从 contract 导入
import { 
  type BookDTO, 
  type CreateBookInput,
  type OffsetPaginated 
} from "contract";

// ❌ 错误 - 不要从 API 文件导入类型
import { type BookDTO } from "@/api/Book";
```

## 使用 API

### 1. 列表查询
```typescript
import { bookQueries } from "@/api/Book";
import { useQuery } from "@tanstack/react-query";

function BookList() {
  const { data } = useQuery(bookQueries.list(0, 20));
  // data 类型: OffsetPaginated<BookDTO> | undefined
  
  return (
    <div>
      {data?.items.map(book => (
        <div key={book.id}>{book.title}</div>
      ))}
    </div>
  );
}
```

### 2. 详情查询
```typescript
import { bookQueries } from "@/api/Book";
import { useQuery } from "@tanstack/react-query";

function BookDetail({ id }: { id: string }) {
  const { data: book } = useQuery(bookQueries.byId(id));
  // book 类型: BookDTO | undefined
  
  return <div>{book?.title}</div>;
}
```

### 3. 创建数据
```typescript
import { bookApi } from "@/api/Book";
import { useMutation } from "@tanstack/react-query";
import type { CreateBookInput } from "contract";

function CreateBook() {
  const mutation = useMutation({
    mutationFn: (input: CreateBookInput) => bookApi.create(input),
  });
  
  const handleSubmit = () => {
    mutation.mutate({
      title: "新书",
      authorIds: ["author-1"],
    });
  };
  
  return <button onClick={handleSubmit}>创建</button>;
}
```

### 4. 更新数据
```typescript
import { bookApi } from "@/api/Book";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bookKeys } from "@/api/Book";
import type { UpdateBookInput } from "contract";

function EditBook({ id }: { id: string }) {
  const queryClient = useQueryClient();
  
  const mutation = useMutation({
    mutationFn: (input: UpdateBookInput) => bookApi.update(id, input),
    onSuccess: () => {
      // 刷新缓存
      queryClient.invalidateQueries({ queryKey: bookKeys.detail(id) });
    },
  });
  
  return <button onClick={() => mutation.mutate({ title: "新标题" })}>
    更新
  </button>;
}
```

### 5. 删除数据
```typescript
import { bookApi } from "@/api/Book";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bookKeys } from "@/api/Book";

function DeleteBook({ id }: { id: string }) {
  const queryClient = useQueryClient();
  
  const mutation = useMutation({
    mutationFn: () => bookApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookKeys.lists() });
    },
  });
  
  return <button onClick={() => mutation.mutate()}>删除</button>;
}
```

## 所有可用的 API

### Book API
```typescript
import { bookApi, bookQueries, bookKeys } from "@/api/Book";
import type { BookDTO, CreateBookInput, UpdateBookInput } from "contract";

// 查询
bookQueries.list(offset, limit)  // 列表
bookQueries.byId(id)              // 详情

// API
bookApi.list({ offset, limit })   // GET /book/list
bookApi.get(id)                   // GET /book/:id
bookApi.create(input)             // POST /books
bookApi.update(id, input)         // PATCH /book/:id
bookApi.remove(id)                // DELETE /book/:id
```

### Chapter API
```typescript
import { chapterApi, chapterQueries, chapterKeys } from "@/api/Chapter";
import type { ChapterListDTO, ChapterDetailDTO, CreateChapterInput, UpdateChapterInput } from "contract";

// 查询
chapterQueries.list(bookId)       // 列表
chapterQueries.byId(id)           // 详情

// API
chapterApi.list(bookId)           // GET /books/:bookId/chapters
chapterApi.get(id)                // GET /chapters/:id
chapterApi.create(input)          // POST /chapters
chapterApi.update(id, input)      // PATCH /chapters/:id
chapterApi.remove(id)             // DELETE /chapters/:id
```

### Comment API
```typescript
import { commentApi, commentQueries, commentKeys } from "@/api/Comment";
import type { CommentDTO, CreateCommentInput, UpdateCommentInput } from "contract";

// 查询
commentQueries.byRoot(rootPostId)           // 根评论列表
commentQueries.byDepth(rootPostId, depth)   // 按深度查询
commentQueries.byId(id)                     // 详情

// API
commentApi.listByRoot(rootPostId)           // GET /comments?rootPostId=xxx
commentApi.listByDepth(rootPostId, depth)   // GET /comments/by-depth
commentApi.get(id)                          // GET /comments/:id
commentApi.create(input)                    // POST /comments
commentApi.update(id, input)                // PATCH /comments/:id
commentApi.remove(id)                       // DELETE /comments/:id
```

### Readlist API
```typescript
import { readlistApi, readlistQueries, readlistKeys } from "@/api/Readlist";
import type { ReadlistDTO, CreateReadlistInput, UpdateReadlistInput } from "contract";

// 查询
readlistQueries.list(offset, limit)  // 列表
readlistQueries.byId(id)             // 详情

// API
readlistApi.list({ offset, limit })  // GET /readlists
readlistApi.get(id)                  // GET /readlists/:id
readlistApi.create(input)            // POST /readlists
readlistApi.update(id, input)        // PATCH /readlists/:id
readlistApi.remove(id)               // DELETE /readlists/:id
```

### Review API
```typescript
import { reviewApi, reviewQueries, reviewKeys } from "@/api/Review";
import type { ReviewDTO, QuoteDTO, CreateReviewInput, UpdateReviewInput } from "contract";

// 查询
reviewQueries.list(bookId, limit, offset)  // 列表
reviewQueries.byId(id)                     // 详情
reviewQueries.quoteList(bookId, limit)     // 引用列表
reviewQueries.commentList(bookId, limit)   // 短评列表

// API
reviewApi.list({ bookId, limit, offset })  // GET /review
reviewApi.get(id)                          // GET /review/:id
reviewApi.create(input)                    // POST /review
reviewApi.update(id, input)                // PATCH /review/:id
reviewApi.remove(id)                       // DELETE /review/:id
reviewApi.quotes(bookId, limit)            // GET /quote/book/:bookId
reviewApi.commentList(bookId, limit)       // GET /review/comment/book/:bookId
```

### Tag API
```typescript
import { tagApi, tagQueries, tagKeys } from "@/api/Tag";
import type { TagDTO, CreateTagInput, UpdateTagInput } from "contract";

// 查询
tagQueries.list(offset, limit)  // 列表
tagQueries.byId(id)             // 详情

// API
tagApi.list({ offset, limit })  // GET /tags
tagApi.get(id)                  // GET /tags/:id
tagApi.create(input)            // POST /tags
tagApi.update(id, input)        // PATCH /tags/:id
tagApi.remove(id)               // DELETE /tags/:id
```

### User API
```typescript
import { userApi, userQueries, userKeys } from "@/api/User";
import type { UserDTO, CreateUserInput, UpdateUserInput } from "contract";

// 查询
userQueries.me()                    // 当前用户
userQueries.list(offset, limit)     // 列表
userQueries.byId(id)                // 详情

// API
userApi.me()                        // GET /users/me
userApi.list({ offset, limit })     // GET /users
userApi.get(id)                     // GET /users/:id
userApi.create(input)               // POST /users
userApi.update(id, input)           // PATCH /users/:id
userApi.remove(id)                  // DELETE /users/:id
```

## 类型列表

### 通用类型
```typescript
import type {
  OffsetPaginationParams,
  OffsetPaginated,
  CursorPaginationParams,
  CursorPaginated,
} from "contract";
```

### 实体 DTO
```typescript
import type {
  BookDTO,
  ChapterListDTO,
  ChapterDetailDTO,
  CommentDTO,
  ReadlistDTO,
  ReviewDTO,
  QuoteDTO,
  TagDTO,
  UserDTO,
} from "contract";
```

### 输入类型
```typescript
import type {
  CreateBookInput,
  UpdateBookInput,
  CreateChapterInput,
  UpdateChapterInput,
  CreateCommentInput,
  UpdateCommentInput,
  CreateReadlistInput,
  UpdateReadlistInput,
  CreateReviewInput,
  UpdateReviewInput,
  CreateTagInput,
  UpdateTagInput,
  CreateUserInput,
  UpdateUserInput,
} from "contract";
```

## 常见模式

### 带筛选的列表查询
```typescript
const { data } = useQuery({
  ...bookQueries.list(page * 20, 20),
  // 额外的配置
  enabled: true,
  staleTime: 5000,
});
```

### 依赖查询
```typescript
const { data: book } = useQuery(bookQueries.byId(bookId));
const { data: chapters } = useQuery({
  ...chapterQueries.list(bookId),
  enabled: !!book, // 只在 book 加载后才查询 chapters
});
```

### 乐观更新
```typescript
const mutation = useMutation({
  mutationFn: (input: UpdateBookInput) => bookApi.update(id, input),
  onMutate: async (newData) => {
    await queryClient.cancelQueries({ queryKey: bookKeys.detail(id) });
    const previous = queryClient.getQueryData(bookKeys.detail(id));
    queryClient.setQueryData(bookKeys.detail(id), (old) => ({
      ...old,
      ...newData,
    }));
    return { previous };
  },
  onError: (err, newData, context) => {
    queryClient.setQueryData(bookKeys.detail(id), context?.previous);
  },
});
```
