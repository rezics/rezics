// Realistic mock data factories for React Cosmos fixtures.
// All dates are fixed strings for deterministic rendering.

const FIXED_NOW = "2025-06-20T12:00:00.000Z";

export function mockPost(overrides: Partial<MockPost> = {}): MockPost {
  return {
    unitId: "post-001",
    title: "Effect 4.0 正式发布：TypeScript 函数式编程的新纪元",
    summary:
      "Effect 4.0 带来了全新的 Atom 响应式系统、HTTP API 声明式路由和改进的错误处理。本文深入介绍核心变化和迁移指南。",
    authorUserId: "user-alice",
    replyCount: 42,
    isLocked: false,
    createdAt: "2025-06-19T08:30:00.000Z",
    updatedAt: "2025-06-19T08:30:00.000Z",
    ...overrides,
  };
}

export function mockPostLong(overrides: Partial<MockPost> = {}): MockPost {
  return mockPost({
    unitId: "post-002",
    title:
      "为什么我从 Redux 迁移到 Effect Atom：一个大型 SaaS 应用的状态管理重构实录——从架构决策到性能优化的完整故事",
    summary:
      "详细记录了将一个 50 万行 TypeScript 代码库从 Redux Toolkit 迁移到 Effect Atom 的全过程。包括性能基准测试、团队培训、渐进式迁移策略和最终结果。迁移后首屏加载时间降低 40%，状态相关 bug 减少 80%。",
    replyCount: 128,
    createdAt: "2025-06-15T14:20:00.000Z",
    updatedAt: "2025-06-18T09:15:00.000Z",
    ...overrides,
  });
}

export function mockPostLocked(overrides: Partial<MockPost> = {}): MockPost {
  return mockPost({
    unitId: "post-003",
    title: "社区行为准则讨论：关于 AI 生成内容的标注规范",
    summary: "本帖讨论已结束。最终决议请参见置顶评论。",
    isLocked: true,
    replyCount: 89,
    createdAt: "2025-06-10T06:00:00.000Z",
    updatedAt: "2025-06-12T18:00:00.000Z",
    ...overrides,
  });
}

export function mockPostMinimal(overrides: Partial<MockPost> = {}): MockPost {
  return mockPost({
    unitId: "post-004",
    title: null,
    summary: null,
    replyCount: 0,
    ...overrides,
  });
}

export function mockBook(overrides: Partial<MockBook> = {}): MockBook {
  return {
    unitId: "book-001",
    title: "计算机程序的构造和解释",
    slug: "sicp",
    status: "published",
    chapterCount: 5,
    ...overrides,
  };
}

export function mockBookDraft(overrides: Partial<MockBook> = {}): MockBook {
  return mockBook({
    unitId: "book-002",
    title: "Crafting Interpreters: 从零构建编程语言",
    slug: "crafting-interpreters",
    status: "draft",
    chapterCount: 30,
    ...overrides,
  });
}

export function mockBookNoSlug(overrides: Partial<MockBook> = {}): MockBook {
  return mockBook({
    unitId: "book-003",
    title: "The Art of Computer Programming, Volume 4B",
    slug: null,
    status: "in_progress",
    chapterCount: 12,
    ...overrides,
  });
}

export function mockRealm(overrides: Partial<MockRealm> = {}): MockRealm {
  return {
    id: "realm-001",
    slug: "effect-ts",
    name: "Effect TypeScript",
    ...overrides,
  };
}

export function mockRealms(): MockRealm[] {
  return [
    mockRealm(),
    mockRealm({ id: "realm-002", slug: "functional-programming", name: "函数式编程" }),
    mockRealm({ id: "realm-003", slug: "rust-lang", name: "Rust 语言" }),
    mockRealm({ id: "realm-004", slug: "book-club", name: "读书会" }),
    mockRealm({ id: "realm-005", slug: "gamedev", name: "游戏开发" }),
    mockRealm({
      id: "realm-006",
      slug: "very-long-realm-name-for-testing",
      name: "这是一个名字非常非常非常长的社区用于测试截断效果",
    }),
  ];
}

export function mockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-alice",
    name: "Alice Chen",
    email: "alice@example.com",
    image: null,
    ...overrides,
  };
}

export function mockSession(overrides: Partial<MockSession> = {}): MockSession {
  return {
    user: mockUser(),
    ...overrides,
  };
}

export function mockComment(overrides: Partial<MockComment> = {}): MockComment {
  return {
    id: "comment-001",
    content: "非常详细的分析！特别是关于渐进式迁移的部分，对我们团队很有参考价值。",
    authorUserId: "user-bob",
    authorName: "Bob Wang",
    createdAt: "2025-06-19T10:45:00.000Z",
    ...overrides,
  };
}

export function mockComments(): MockComment[] {
  return [
    mockComment(),
    mockComment({
      id: "comment-002",
      content:
        "I've been using Effect for 6 months now and the DX is incredible. The type-safe error handling alone was worth the migration effort.",
      authorUserId: "user-carol",
      authorName: "Carol Liu",
      createdAt: "2025-06-19T11:30:00.000Z",
    }),
    mockComment({
      id: "comment-003",
      content: "请问 Atom 和 Jotai 的区别主要在哪里？",
      authorUserId: "user-dave",
      authorName: "Dave Zhang",
      createdAt: "2025-06-19T14:00:00.000Z",
    }),
  ];
}

export function mockPortableTextBlocks(): PortableTextBlock[] {
  return [
    {
      _type: "block",
      _key: "b1",
      style: "h2",
      children: [{ _type: "span", _key: "s1", text: "背景与动机", marks: [] }],
      markDefs: [],
    },
    {
      _type: "block",
      _key: "b2",
      style: "normal",
      children: [
        {
          _type: "span",
          _key: "s2",
          text: "Effect 4.0 是一次里程碑式的更新，它不仅重新定义了 TypeScript 函数式编程的范式，还引入了全新的响应式状态管理原语——",
          marks: [],
        },
        { _type: "span", _key: "s3", text: "Atom", marks: ["strong"] },
        {
          _type: "span",
          _key: "s4",
          text: "。这使得 Effect 从一个纯后端库演变为全栈解决方案。",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      _key: "b3",
      style: "normal",
      children: [
        {
          _type: "span",
          _key: "s5",
          text: 'The new HttpApi declarative routing is a game changer. Instead of writing imperative route handlers, you declare your API as a schema and Effect generates type-safe clients automatically. As the docs say: "Your API is your documentation."',
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      _key: "b4",
      style: "h2",
      children: [{ _type: "span", _key: "s6", text: "核心变化", marks: [] }],
      markDefs: [],
    },
    {
      _type: "block",
      _key: "b5",
      style: "normal",
      children: [
        {
          _type: "span",
          _key: "s7",
          text: "1. Atom 响应式系统：提供类似 Jotai 的原子化状态管理，但深度集成 Effect 的类型安全错误处理和依赖注入。",
          marks: [],
        },
      ],
      markDefs: [],
    },
    {
      _type: "block",
      _key: "b6",
      style: "normal",
      children: [
        {
          _type: "span",
          _key: "s8",
          text: "2. HttpApi 声明式路由：通过 Schema 定义 API 端点，自动生成客户端 SDK 和 OpenAPI 文档。",
          marks: [],
        },
      ],
      markDefs: [],
    },
  ];
}

export function mockNotifications(): MockNotification[] {
  return [
    {
      id: "notif-001",
      type: "reply",
      title: "Alice Chen 回复了你的帖子",
      body: "「非常详细的分析！特别是关于渐进式迁移的部分...」",
      read: false,
      createdAt: "2025-06-20T10:30:00.000Z",
    },
    {
      id: "notif-002",
      type: "mention",
      title: "Bob Wang 在评论中提到了你",
      body: "「@你 可以看看这个 Effect 的新特性...」",
      read: false,
      createdAt: "2025-06-20T09:15:00.000Z",
    },
    {
      id: "notif-003",
      type: "follow",
      title: "Carol Liu 关注了你",
      body: "",
      read: true,
      createdAt: "2025-06-19T18:00:00.000Z",
    },
    {
      id: "notif-004",
      type: "realm_invite",
      title: "你被邀请加入「函数式编程」社区",
      body: "Dave Zhang 邀请你加入函数式编程社区",
      read: true,
      createdAt: "2025-06-18T12:00:00.000Z",
    },
  ];
}

export function mockConversations(): MockConversation[] {
  return [
    {
      id: "conv-001",
      participantName: "Alice Chen",
      participantImage: null,
      lastMessage: "好的，我周末把那个 PR review 一下",
      lastMessageAt: "2025-06-20T11:00:00.000Z",
      unread: true,
    },
    {
      id: "conv-002",
      participantName: "Dave Zhang",
      participantImage: null,
      lastMessage: "Effect 的文档真的越来越好了，特别是新加的 cookbook",
      lastMessageAt: "2025-06-19T16:30:00.000Z",
      unread: false,
    },
  ];
}

export function mockAdminStats(): MockAdminStats {
  return {
    totalUsers: 12847,
    totalRealms: 356,
    totalBooks: 8921,
    totalPosts: 45632,
    totalTags: 2341,
    totalCases: 18,
    dau: 2341,
    wau: 8756,
    mau: 11234,
  };
}

export function mockBookInfo(): MockBookInfo {
  return {
    unitId: "book-001",
    title: "计算机程序的构造和解释",
    isbn: "978-7-111-13510-8",
    pageCount: 473,
    textLength: 285000,
    status: "published",
    createdAt: "2025-01-15T00:00:00.000Z",
    updatedAt: "2025-06-01T00:00:00.000Z",
  };
}

export function mockPoll(): MockPoll {
  return {
    unitId: "poll-001",
    title: "2025 年你最期待的 TypeScript 特性是什么？",
    options: [
      { id: "opt-1", text: "Pattern Matching", votes: 234 },
      { id: "opt-2", text: "Throw Expressions", votes: 156 },
      { id: "opt-3", text: "Pipeline Operator", votes: 189 },
      { id: "opt-4", text: "Immutable Records & Tuples", votes: 312 },
    ],
    totalVotes: 891,
    hasVoted: false,
    createdAt: "2025-06-18T00:00:00.000Z",
  };
}

export function mockExcerpt(): MockExcerpt {
  return {
    unitId: "excerpt-001",
    passage:
      "Programs must be written for people to read, and only incidentally for machines to execute.",
    sourceTitle: "Structure and Interpretation of Computer Programs",
    sourceAuthor: "Harold Abelson & Gerald Jay Sussman",
    chapter: "Preface to the First Edition",
    createdAt: "2025-06-10T00:00:00.000Z",
  };
}

export function mockGame(): MockGame {
  return {
    unitId: "game-001",
    title: "Baba Is You",
    developer: "Hempuli Oy",
    publisher: "Hempuli Oy",
    releaseDate: "2019-03-13",
    genres: ["Puzzle", "Indie"],
    platforms: ["PC", "Switch", "iOS", "Android"],
    rating: 9.2,
    description:
      "Baba Is You 是一款获奖无数的益智游戏，玩家通过推动代表游戏规则的文字方块来改变关卡规则，从而找到通关方法。",
  };
}

export function mockEntity(): MockEntity {
  return {
    unitId: "entity-001",
    name: "Abelson, Harold",
    kind: "person",
    slug: "harold-abelson",
    summary: "MIT 电气工程与计算机科学教授，SICP 合著者，Creative Commons 联合创始人。",
  };
}

// Type definitions

export interface MockPost {
  readonly unitId: string;
  readonly title: string | null;
  readonly summary: string | null;
  readonly authorUserId: string;
  readonly replyCount: number;
  readonly isLocked: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MockBook {
  readonly unitId: string;
  readonly title: string;
  readonly slug: string | null;
  readonly status: string;
  readonly chapterCount: number;
}

export interface MockRealm {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
}

export interface MockUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly image: string | null;
}

export interface MockSession {
  readonly user: MockUser;
}

export interface MockComment {
  readonly id: string;
  readonly content: string;
  readonly authorUserId: string;
  readonly authorName: string;
  readonly createdAt: string;
}

export interface MockNotification {
  readonly id: string;
  readonly type: "reply" | "mention" | "follow" | "realm_invite";
  readonly title: string;
  readonly body: string;
  readonly read: boolean;
  readonly createdAt: string;
}

export interface MockConversation {
  readonly id: string;
  readonly participantName: string;
  readonly participantImage: string | null;
  readonly lastMessage: string;
  readonly lastMessageAt: string;
  readonly unread: boolean;
}

export interface MockAdminStats {
  readonly totalUsers: number;
  readonly totalRealms: number;
  readonly totalBooks: number;
  readonly totalPosts: number;
  readonly totalTags: number;
  readonly totalCases: number;
  readonly dau: number;
  readonly wau: number;
  readonly mau: number;
}

export interface MockBookInfo {
  readonly unitId: string;
  readonly title: string;
  readonly isbn: string;
  readonly pageCount: number;
  readonly textLength: number;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MockPoll {
  readonly unitId: string;
  readonly title: string;
  readonly options: readonly { readonly id: string; readonly text: string; readonly votes: number }[];
  readonly totalVotes: number;
  readonly hasVoted: boolean;
  readonly createdAt: string;
}

export interface MockExcerpt {
  readonly unitId: string;
  readonly passage: string;
  readonly sourceTitle: string;
  readonly sourceAuthor: string;
  readonly chapter: string;
  readonly createdAt: string;
}

export interface MockGame {
  readonly unitId: string;
  readonly title: string;
  readonly developer: string;
  readonly publisher: string;
  readonly releaseDate: string;
  readonly genres: readonly string[];
  readonly platforms: readonly string[];
  readonly rating: number;
  readonly description: string;
}

export interface MockEntity {
  readonly unitId: string;
  readonly name: string;
  readonly kind: "person" | "organization" | "group";
  readonly slug: string;
  readonly summary: string;
}

export interface PortableTextBlock {
  readonly _type: string;
  readonly _key: string;
  readonly style?: string;
  readonly children: readonly {
    readonly _type: string;
    readonly _key: string;
    readonly text: string;
    readonly marks: readonly string[];
  }[];
  readonly markDefs: readonly { readonly _type: string; readonly _key: string }[];
}
