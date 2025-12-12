export default {
  title: 'REZICS',
  motto: '传承 创造 传播',

  page: {
    home: {
      name: 'Home',
      hero: {
        kicker: 'Library Book',
        title_highlight: '与所爱的故事相遇',
        subtitle: '搜索想看的书，发现高质量书单、短评和金句。',
      },
      quick_access: {
        title_quick_entry: '快速入口',
        title_fast_explore: '快速探索',
        title_quick_explore: '快捷探索',
      },
      mobile: {
        search_placeholder: '搜索书名、作者、ISBN...',
        floating_status: {
          browsing_recommendations: '正在浏览首页推荐',
          beta_experimental: 'Beta · 实验功能',
        },
      },
      noticeboard: {
        caption: '通知',
        title: '公告板',
        empty: '暂无公告',
        alert: {
          parse_failed: '公告板数据解析失败: {{error}}',
        },
        tag: {
          notice: '通知',
          announcement: '公告',
          event: '活动',
          update: '更新',
        },
        time: {
          just_now: '刚刚',
          hours_ago_other: '{{count}} 小时前',
          days_ago_other: '{{count}} 天前',
          weeks_ago_other: '{{count}} 周前',
        },
      },
      discovery: {
        recommended_for_you: '为你推荐',
        recommendations: '推荐',
        meili_subtitle: '基于 Meilisearch 实时推荐',
        featured_readlists_subtitle: '快去制作你的书单吧',
        top_rated_reviews_subtitle: '看看大家最近在聊些什么',
      },
      sections: {
        trending_wiki: '热门百科',
        trending_reviews: '热门短评',
        tag_explore: '主题探索',
        readlist_recommendation: '书单推荐',
        ranking: '排行榜',
        partner_brands: '合作伙伴',
        new_book_recommendations: '新书推荐',
        editor_picks: '编辑精选',
        author_spotlight: '作者专栏',
        wiki_teaser_placeholder:
          '条目简介占位文案：收录该书的作者、出版信息、主题标签等内容。',
        review_teaser_placeholder: '“这本书让我重新思考了……（示例占位短评）”',
        promotion_item_1: '平台公告：本周新版本已发布',
        promotion_item_2: '书展活动：秋季读书节',
        promotion_item_3: '限时优惠：精选书单 8 折',
        newsletter: {
          title: '订阅最新资讯',
          thanks: '感谢订阅！',
          email_placeholder: '输入你的邮箱',
          submit: '订阅',
        },
      },
    },
  },

  // Navigation & Menu
  navigation: {
    main_items: '主要项目',
    home: '首页',
    books: '图书',
    book: '书籍',
    analytics: '分析',
    auth: '认证',
    login: '登录',
    register: '注册',
    book_edit: '编辑书籍',
    book_edit_main: '书籍主要编辑',
    book_edit_chapter: '章节编辑',
    test: '测试',
    back_to_main: '返回主页',
    book_editor_navigation: '书籍编辑器导航',
    profile: '个人资料',
    settings: '设置',
    logout: '登出',
  },

  // Authentication
  auth: {
    login: '登录',
    logout: '登出',
    register: '注册',
    resolve: '解决',
    already_login: '您已经登录。重新登录将覆盖之前的登录信息。',
    error: {
      email_required: '邮箱是必填的。',
      invalid_email: '无效的邮箱地址。',
      invalid_password: '密码必须至少包含6个字符。',
      invalid_username: '无效的用户名。',
      invalid_confirm: '无效的密码确认。',
      passwords_mismatch: '密码不匹配。',
    },
  },

  // Common UI Elements
  common: {
    email: '邮箱',
    password: '密码',
    confirm: '确认密码',
    username: '用户名',
    back: '返回',
    home: '首页',
    cancel: '取消',
    submit: '提交',
    save: '保存',
    delete: '删除',
    edit: '编辑',
    add: '添加',
    remove: '移除',
    create: '创建',
    update: '更新',
    search: '搜索',
    expand: '展开',
    collapse: '折叠',
    reply: '回复',
    close: '关闭',
    open: '打开',
    view_more: '查看更多',
    view_all: '查看全部',
    pinned: '置顶',
    new: '新',
    no_description: '暂无描述',
  },

  // Book
  book: {
    description: '简介',
    chapters: '章节',
    tags: '标签',
    reviews: '评论',
    collections: '收藏夹',
    edit: '编辑书籍',
    add_to_collection: '添加到收藏夹',
    new_releases: '新书上架',
    no_cover: '暂无封面',
    unknown_author: '未知作者',
  },

  // Readlist
  readlist: {
    featured: '精选书单',
    includes_books: '包含 {{count}} 本书',
    includes_reviews: '包含 {{count}} 条书评评',
    includes_reviews_other: '{{count}} 条短评',
  },

  // Review
  review: {
    hot: '热门书评',
    top_rated_short_reviews: '高赞短评',
    short_review: '短评',
  },

  // Quote
  quote: {
    title: '言',
    subtitle: '笔落惊风雨，诗成泣鬼神',
  },

  // Form & Editor
  editor: {
    bold: '粗体',
    italic: '斜体',
    heading: '标题',
    quote: '引用',
    generic_list: '列表',
    numbered_list: '编号列表',
    create_link: '创建链接',
    insert_image: '插入图片',
    insert_table: '插入表格',
    toggle_preview: '切换预览',
    toggle_side_by_side: '切换并排',
    markdown_guide: 'Markdown指南',
  },

  // Placeholders & Labels
  placeholders: {
    search_books: '搜索图书',
    chapter_title: '请输入章节标题',
  },

  // Chapters & Books
  chapters: {
    new_chapter: '新章节',
    expand: '展开',
    collapse: '折叠',
  },

  // Accessibility Labels
  accessibility: {
    favorite: '收藏',
    comments: '评论',
    collection: '收藏夹',
    search: '搜索',
    close: '关闭',
    open_drawer: '打开侧边栏',
  },

  test: {
    fn: (name: string) => `你好，${name}！`,
  },
};
