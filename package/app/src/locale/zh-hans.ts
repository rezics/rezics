export default {
  title: "ICS",
  motto: "繼承 創造 傳播",

  // Shelf
  shelf: {
    system: {
      favorites: "收藏",
      backlog: "想看",
      active: "在看",
      completed: "已读",
      recoveryToast: "你的「{{kind}}」列表暂未就绪。",
      recoveryRetry: "重试",
    },
  },

  // Navigation & Menu
  navigation: {
    main_items: "主要項目",
    home: "首頁",
    books: "圖書",
    book: "書籍",
    analytics: "分析",
    auth: "認證",
    login: "登錄",
    register: "註冊",
    book_edit: "編輯書籍",
    book_edit_main: "書籍主要編輯",
    book_edit_chapter: "章節編輯",
    test: "測試",
    back_to_main: "返回主頁",
    book_editor_navigation: "書籍編輯器導航",
    profile: "個人資料",
    settings: "設置",
    logout: "登出",
  },

  // Authentication
  auth: {
    login: "登錄",
    logout: "登出",
    register: "註冊",
    resolve: "解決",
    already_login: "您已經登錄。重新登錄將覆蓋之前的登錄信息。",
    error: {
      invalid_email: "無效的郵箱地址。",
      invalid_password: "密碼必須至少包含6個字符。",
      invalid_username: "無效的用戶名。",
      invalid_confirm: "無效的密碼確認。",
      passwords_mismatch: "密碼不匹配。",
    },
    flow: {
      new_to_app: "第一次來到 REZICS？",
      create_account: "建立帳號",
      forgot_password: "忘記密碼？",
      reset_link_sending: "正在发送重设链接…",
      already_have_account: "已經有帳號了？",
      sign_in_instead: "去登入",
      providers_divider: "或使用以下方式繼續",
      providers_loading: "正在載入登入方式…",
      continue_with_provider: "使用 {{provider}} 繼續",
      onboarding_title: "完成帳號設定",
      onboarding_sign_in_first: "請先登入，再繼續完成帳號設定。",
      onboarding_social_only: "此頁面僅用於社交登入帳號的首次設定。",
      onboarding_complete: "你的帳號設定已完成。",
      onboarding_intro:
        "社交登入帳號需要先提供可用郵箱，系統才能將其視為可使用成員能力的帳號。密碼為可選項。",
      onboarding_trusted_email:
        "此郵箱已被你的登入提供方信任。若改用其他郵箱，則需要重新驗證。",
      onboarding_editable_email: "修改郵箱後，需要完成驗證才能獲得成員能力。",
      onboarding_optional_password:
        "如果你暫時只想使用社交登入，可以將密碼留空。",
      onboarding_saved: "帳號設定資訊已儲存。",
      onboarding_submit: "完成設定",
      onboarding_saving: "儲存中…",
      verify_title: "驗證郵箱",
      verify_sign_in_first: "請先登入，再繼續郵箱驗證。",
      verify_already_done: "你的郵箱已經驗證完成。",
      verify_intro_prefix: "驗證",
      verify_intro_suffix: "後即可解鎖成員能力。",
      verify_email_fallback: "你的郵箱地址",
      verify_widget_loading: "正在載入驗證元件…",
      verify_turnstile_passed: "驗證通過。",
      verify_widget_required: "驗證元件完成載入前，暫時無法重新發送驗證郵件。",
      verify_guest_notice:
        "在完成郵箱驗證前，你仍可瀏覽訪客可見頁面，但成員專屬功能會繼續保持鎖定。",
      verify_refresh: "重新整理狀態",
      verify_resend_code: "重新發送驗證碼",
      verify_resend_cooldown: "重新發送驗證碼 ({{seconds}}s)",
      verify_refreshed: "驗證狀態已重新整理。",
      verify_sent: "驗證郵件已發送。",
      verify_missing_email: "目前帳號缺少可用於驗證的郵箱地址。",
      verify_complete_widget: "請先完成驗證元件，再要求重新發送郵件。",
      verify_checking_state: "正在檢查驗證狀態…",
      verify_send_code: "发送验证码",
      verify_sending_code: "正在发送验证码…",
      verify_submit_code: "验证",
      verify_code_sent_to: "已发送 6 位数验证码至",
      verify_code_expires: "验证码将在 5 分钟后失效。",
      verify_code_incomplete: "请输入完整的 6 位数验证码。",
      verify_banner_action: "完成注册",
      verify_banner_message:
        "当前账号仍可访问访客可见页面，但在注册完成前，成员功能会保持锁定。",
      complete_registration_action: "完成注册",
      complete_registration_prompt: "完成注册以{{action}}",
      complete_registration_title: "完成注册",
      complete_registration_intro: "请完成必要步骤以建立你的账号。",
      setup_title: "建立你的 Rezics 账号",
      setup_display_name: "显示名称",
      setup_slug_label: "Slug（你的专属网址识别码）",
      setup_slug_short: "Slug 至少需要 6 个字符。",
      setup_slug_taken: "这个 Slug 已被使用。",
      setup_slug_invalid: "Slug 格式无效：{{reason}}",
      setup_slug_available: "可使用",
      setup_slug_checking: "正在检查可用性…",
      setup_submit: "建立账号",
      pause_registration: "稍后继续",
      pause_registration_confirm: "退出并稍后继续",
      registration_complete_redirecting: "注册完成，正在重定向…",
      retry: "重試",
      providers: {
        github: "GitHub",
        google: "Google",
        microsoft: "Microsoft",
        telegram: "Telegram",
        twitter: "X / Twitter",
      },
    },
  },

  page: {
    home: {
      sections: {
        new_book: {
          title: "最新作品",
          tab_latest_serial: "最新連載",
          tab_new_on_shelf: "最新上架",
          tab_recently_completed: "近期完結",
          more: "更多 \u2192",
        },
        trending_book: {
          title: "趨勢好書",
          more: "更多 \u2192",
          loading: "載入中...",
        },
        trending_excerpt: {
          title: "熱門摘錄",
          more: "更多 \u2192",
          empty: "暫無摘錄",
        },
        active_realms: {
          title: "活躍領域",
          more: "更多",
        },
        library_cards: {
          book_library: "圖書館",
          game_library: "遊戲庫",
          media_library: "媒體庫",
          coming_soon: "即將推出",
        },
      },
    },
  },

  search: {
    filter: {
      relevance: "搜尋相關性",
      time: "最新",
      favorites: "總收藏",
      word_count: "總字數",
      month_votes: "月票",
      recommendation: "推薦",
      week_votes: "週推薦票",
      total_votes: "總推薦票",
      desc: "降序",
      asc: "升序",
    },
    input: {
      placeholder: "書名、ISBN、作者、出版社、出品方",
      tags_label: "標籤",
      tags_hint: "點擊下方標籤或輸入標籤，用逗號分隔",
      word_count_label: "字數",
      word_count_placeholder: "10000-20000",
      preset_tags: {
        fiction: "小說",
        nonfiction: "非虛構",
        mystery: "懸疑",
        romance: "言情",
        history: "歷史",
        science: "科學",
        fantasy: "奇幻",
        philosophy: "哲學",
      },
    },
  },

  // Common UI Elements
  common: {
    email: "郵箱",
    password: "密碼",
    confirm: "確認密碼",
    username: "用戶名",
    back: "返回",
    home: "首頁",
    cancel: "取消",
    submit: "提交",
    save: "保存",
    delete: "刪除",
    edit: "編輯",
    add: "添加",
    remove: "移除",
    create: "創建",
    continue: "繼續",
    update: "更新",
    search: "搜索",
    share: "分享",
    copy_link: "复制链接",
    share_via: "分享…",
    expand: "展開",
    collapse: "折疊",
    reply: "回復",
    close: "關閉",
    open: "打開",
  },

  // Pages
  pages: {
    not_found: "頁面未找到",
    book_tag_edit: "書籍標籤編輯",
    book_description_edit: "書籍描述編輯",
    book_edit_page: "書籍編輯頁面",
    review_page: "長篇評論頁面",
    review_edit_page: "長篇評論編輯頁面",
    short_review_page: "短評頁面",
    book_collection_list_page: "書籍收藏列表頁面",
    book_list_edit_page: "書單編輯頁面",
  },

  // Form & Editor
  editor: {
    bold: "粗體",
    italic: "斜體",
    heading: "標題",
    quote: "引用",
    generic_list: "列表",
    numbered_list: "編號列表",
    create_link: "創建鏈接",
    insert_image: "插入圖片",
    insert_table: "插入表格",
    toggle_preview: "切換預覽",
    toggle_side_by_side: "切換並排",
    markdown_guide: "Markdown指南",
  },

  // Placeholders & Labels
  placeholders: {
    search_books: "搜索圖書",
    chapter_title: "請輸入章節標題",
  },

  // Chapters & Books
  chapters: {
    new_chapter: "新章節",
    expand: "展開",
    collapse: "折疊",
  },

  // Accessibility Labels
  accessibility: {
    favorite: "收藏",
    comments: "評論",
    collection: "收藏夾",
    search: "搜索",
    close: "關閉",
    open_drawer: "打開側邊欄",
  },

  realm: {
    extra: {
      pinboard: {
        note: "领域置顶的 Unit ID 有序列表。显示在领域页的动态之上；通常是由领域贡献者撰写的 Work 条目的 POST Release。",
      },
      announcement: {
        note: "为首页公告栏等特殊页面保留的 Unit ID 有序列表。并非一般论坛通知；仅保留给首页公告栏等特殊页面使用。",
      },
      rule: {
        note: "Single Post Unit ID that holds the realm's rule content shown before joining.",
      },
      about: {
        note: "Single Post Unit ID that holds the realm's about or sidebar content.",
      },
      banner: {
        note: "Banner source for the realm, either a Post Unit reference or a direct image URL.",
      },
      tagTree: {
        note: "Ordered tag picker tree used as a realm posting UX hint; it does not constrain tagging.",
      },
    },
  },

  entity: {
    kind: {
      person: "人物",
      organization: "组织",
      circle: "社团",
      studio: "工作室",
      label: "品牌",
      character: "角色",
      faction: "阵营",
      family: "家族",
      location: "地点",
      artifact: "物品",
      event: "事件",
      concept: "概念",
    },
  },

  attribution: {
    credit: {
      role: {
        author: "作者",
        co_author: "共同作者",
        translator: "译者",
        illustrator: "插画",
        editor: "编辑",
        publisher: "出版社",
        letterer: "嵌字",
        colorist: "上色",
        developer: "开发者",
        composer: "作曲",
        designer: "设计",
        director: "导演",
        producer: "制作人",
        writer: "编剧",
        actor: "演员",
        narrator: "朗读者",
        studio: "工作室",
        distributor: "发行",
      },
    },
    subject: {
      role: {
        primary_character: "主要角色",
        featured_character: "登场角色",
        appears: "出现",
        about: "关于",
        setting: "舞台",
        source_work: "来源作品",
        canonical_wiki_page: "标准 Wiki 页",
        related_subject: "相关主题",
      },
    },
  },

  notify: {
    kinds: {
      work_link_claim_pending: "作品关联请求待审核",
      work_link_claim_approved: "作品关联请求已通过",
      work_link_claim_rejected: "作品关联请求已拒绝",
    },
  },

  work_link_claim: {
    inbox: {
      title: "待审核的关联请求",
      empty: "暂无待审核的请求。",
      release: "Release",
      claimer: "申请人",
      submitted_at: "提交时间",
      reason: "理由",
      review: "审核",
      approve: "通过",
      reject: "拒绝",
      withdraw: "撤回",
    },
    modal: {
      approve_title: "通过请求",
      approve_description:
        "此操作会将该 Release 关联到你的作品，并通知申请人。",
      reject_title: "拒绝请求",
      reject_description: "请填写简短理由，申请人将收到通知。",
      reject_reason_label: "理由",
      reject_reason_placeholder: "选填——说明拒绝的原因",
      withdraw_title: "撤回请求",
      withdraw_description: "此操作会撤回你当前的请求，之后仍可重新提交。",
      approve_done: "请求已通过。",
      reject_done: "请求已拒绝。",
      withdraw_done: "请求已撤回。",
      action_failed: "操作失败：{{error}}",
    },
  },
};
