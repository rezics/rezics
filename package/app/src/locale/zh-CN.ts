export default {
  title: 'REZICS',
  motto: '传承 创造 传播',

  layout: {
    footer: {
      brand: {
        description:
          '一个全面的，包含数字时代作品的书库，期待着让人们找到他们所寻的书，让故事遇见正确的人。',
        slogan: 'inherited·create·spread',
      },
      social: {
        aria: '社交链接',
        github: 'GitHub',
        telegram: 'Telegram',
      },
      product: {
        aria: '产品',
        title: '产品',
        discover: '发现',
        readlist: '阅读单',
        reviews: '评论与评测',
        search: '搜索',
      },
      resources: {
        aria: '资源',
        title: '资源',
        docs: '文档',
        api: 'API',
        changelog: '更新日志',
        status: '系统状态',
      },
      newsletter: {
        title: '订阅更新',
        description: '获取最新功能与精选书单推送。(开发中)',
        email_placeholder: '你的邮箱',
        email_aria: '邮箱',
        submit: '订阅',
      },
      copyright: '© {{year}} REZICS · 保留所有权利',
      legal: {
        privacy: '隐私',
        terms: '条款',
        contact: '联系我们',
      },
    },
  },

  pages: {
    review_page: '书评',
    unit_page: '内容',
    book_collection_list_page: '包含该书的书单',
  },

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
    book: {
      tabs: {
        basic_info: '基本信息',
        reviews: '书评',
        toc: '目录',
      },
    },
    book_edit: {
      info: {
        title: '书籍编辑',
        dialog: {
          view_book: '点击查看书籍',
        },
        toast: {
          create_success_title: '创建书籍成功',
          create_success_message:
            '创建书籍成功，书籍详情页可能需要等待几分钟/手动刷新才能看到最新内容。',
          create_failed_title: '创建书籍失败',
          update_success_title: '更新书籍成功',
          update_success_message:
            '更新书籍成功，书籍详情页可能需要等待几分钟/手动刷新才能看到最新内容。',
          update_failed_title: '更新书籍失败',
        },
        validation: {
          publish_url_required:
            '请至少添加一个正确的，书籍发布的链接，譬如起点对应书籍的链接，以https://开头。',
        },
      },
    },
    readlist: {
      loading: '加载中...',
      not_found: '未找到书单',
      open_user_ui: '打开用户界面',
      likes_comments: '点赞与评论统计',
      no_reviews: '暂无书评',
      comments: '评论',
      meta_info: '元信息',
      title_label: '书单名称',
      summary_label: '书单简介',
      cover_label: '书单封面',
      add_review: '添加书评',
      paste_review_input_label: '黏贴书评链接或ID（/review/:unitId）',
      search_review_label: '搜索书评（关键词）',
      search_button: '搜索',
      searching: '搜索中...',
      add_button: '添加',
      current_reviews_title: '当前书评（支持排序与删除）',
      no_reviews_small: '暂无书评',
      edit_readlist: '编辑书单',
      back: '返回',
      submit: '提交',
      delete: '删除',
      new_readlist: '新建书单',
      like_tooltip: '点赞',
      favorite_tooltip: '收藏',
      books_count: '{{count}} 本书',
      reviews_count: '{{count}} 评论',
      move_up: '上移',
      move_down: '下移',
      update_success: '书单更新成功',
      delete_success: '书单删除成功',
      delete_failed: '书单删除失败',
      untitled: '（无标题）',
      list: {
        search_placeholder: '搜索书单',
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
    created_at: '创建时间',
    updated_at: '更新时间',
    email: '邮箱',
    password: '密码',
    confirm: '确认密码',
    username: '用户名',
    nickname: '昵称',
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
    no_data: '暂无数据',
    view_more: '查看更多',
    view_all: '查看全部',
    pinned: '置顶',
    new: '新',
    no_description: '暂无描述',
    loading: '加载中...',
    submitting: '提交中...',
    error: '错误',
    error_generic: '出错了...',
    unknown_error: '未知错误',
    expand_all: '全部展开',
    collapse_all: '全部折叠',
  },

  unit: {
    no_content: '暂无内容',
    meta_data: 'Meta 信息',
    no_metadata: '暂无 Meta 信息',
  },

  units: {
    search_placeholder: '搜索单元',
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
    toc: '目录',
    remark: '短评',
    quote_excerpts: '原文摘录',
    reviews_of_book: '{{title}}的书评',
    info_panel: {
      title: '书籍信息',
    },
    fields: {
      title: '书名',
      isbn: 'ISBN',
      cover_url: '封面链接',
      author: '作者',
      press: '出版社',
      producer: '出品方',
      text_length: '字数',
    },
    placeholders: {
      search_author: '搜索作者...',
      search_press: '搜索出版社...',
      search_producer: '搜索出品方...',
    },
    flags: {
      nsfw: 'NSFW',
      licensed: '版权',
    },
    tooltips: {
      nsfw: '当书籍名称或封面包含裸露、色情等敏感内容时，请勾选此选项',
      licensed: '当书籍已获得版权许可时，如您是版权所有者，请勾选此选项',
    },
    edit_sections: {
      metadata: '元数据',
      extra: '额外信息',
    },
    chapter: {
      enable_drag: '启用拖拽',
      double_click_rename: '双击重命名',
      rename_help:
        '修改此处的章节名称仅影响目录结构展示，不会更新实际章节标题。若需修改章节标题，请前往章节编辑页面，在那里修改标题后会自动更新目录结构。',
    },
    author_info: {
      author_line: '作者：{{name}}',
      bio_label: '简介',
      description_label: '描述',
    },
    description_editor: {
      title: '编辑书籍描述',
    },
    extra: {
      publish_urls: {
        title: '发布链接 (Publish URLs)',
      },
    },
  },

  search: {
    placeholders: {
      search_books: '搜索图书',
    },
    tooltips: {
      nsfw: '是否搜索工作场所不宜内容',
      licensed: '是否搜索已获得版权许可的内容',
    },
    pagination: {
      tips: 'Tips: 数据页数并不代表总数据量，请点击最后一页来尝试加载更多数据',
    },
  },

  // Readlist
  readlist: {
    featured: '精选书单',
    includes_books: '包含 {{count}} 本书',
    includes_reviews: '包含 {{count}} 条书评',
    includes_reviews_one: '{{count}} 条短评',
    includes_reviews_other: '{{count}} 条短评',
    includes_book_title: '包含 {{title}} 的书单',
    a11y: {
      book_review: '书评',
    },
  },

  // Review
  review: {
    hot: '热门书评',
    top_rated_short_reviews: '高赞短评',
    short_review: '短评',
    open_user_interface: '打开用户界面',
    open_review_page: '打开书评页面',
    a11y: {
      open_review_page: '打开书评页面',
    },
    comments: '评论',
    form: {
      title: '标题',
      rating: '评分',
    },
    messages: {
      update_success: '书评更新成功',
      delete_success: '书评删除成功',
      rating_range_error: '评分必须在0到10之间',
      failed_load: '加载书评失败。',
    },
  },

  // Quote
  quote: {
    title: '言',
    subtitle: '笔落惊风雨，诗成泣鬼神',
    not_found: '未找到摘录',
    excerpts_title: '原文摘录',
    form: {
      title: '标题',
      source: '来源',
    },
    updated_success: '摘录更新成功',
    messages: {
      update_failed: '更新摘录失败：{{error}}',
    },
  },

  // Tag
  tag: {
    loading: '正在加载标签…',
    load_failed: '加载失败：{{error}}',
    ungrouped: '未分组',
    showing_top_tags: '显示热门标签',
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
    enter_search_term: '输入搜索词',
    enter_url: '输入 URL 地址',
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
