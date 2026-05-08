export default {
  title: "REZICS",
  motto: "傳承 創造 傳播",

  layout: {
    header: {
      toggle_language: "切換語言",
      toggle_theme: "切換主題",
    },
    footer: {
      brand: {
        description:
          "一個涵蓋圖書、遊戲和媒體的多元庫平台——幫助人們發現所愛的作品。",
        slogan: "inherited·create·spread",
      },
      social: {
        aria: "社群連結",
        github: "GitHub",
        telegram: "Telegram",
      },
      product: {
        aria: "產品",
        title: "產品",
        discover: "探索",
        shelves: "書架",
        reviews: "評論與評測",
        search: "搜尋",
      },
      resources: {
        aria: "資源",
        title: "資源",
        docs: "文件",
        api: "API",
        changelog: "更新日誌",
        status: "系統狀態",
      },
      newsletter: {
        title: "訂閱更新",
        description: "取得最新功能與精選書單推送。（開發中）",
        email_placeholder: "你的電子郵件",
        email_aria: "電子郵件",
        submit: "訂閱",
      },
      copyright: "© {{year}} REZICS · 保留所有權利",
      legal: {
        privacy: "隱私",
        terms: "條款",
        contact: "聯絡我們",
      },
    },
  },

  pages: {
    review_page: "書評",
    unit_page: "內容",
    book_collection_list_page: "包含該書的書單",
  },

  page: {
    home: {
      name: "首頁",
      hero: {
        kicker: "REZICS",
        title_highlight: "與所愛的故事相遇",
        subtitle: "搜尋想看的書，發現高品質書單、短評和金句。",
      },
      quick_access: {
        title_quick_entry: "快速入口",
        title_fast_explore: "快速探索",
        title_quick_explore: "快捷探索",
      },
      mobile: {
        search_placeholder: "搜尋書名、作者、ISBN...",
        floating_status: {
          browsing_recommendations: "正在瀏覽首頁推薦",
          beta_experimental: "Beta · 實驗功能",
        },
      },
      carousel: {
        alert: {
          parse_failed: "輪播圖資料解析失敗：{{error}}",
        },
      },
      noticeboard: {
        caption: "通知",
        title: "公告板",
        empty: "暫無公告",
        time: {
          just_now: "剛剛",
          hours_ago_one: "{{count}} 小時前",
          hours_ago_other: "{{count}} 小時前",
          days_ago_one: "{{count}} 天前",
          days_ago_other: "{{count}} 天前",
          weeks_ago_one: "{{count}} 週前",
          weeks_ago_other: "{{count}} 週前",
        },
      },
      discovery: {
        recommended_for_you: "為你推薦",
        recommendations: "推薦",
        meili_subtitle: "基於 Meilisearch 即時推薦",
        featured_shelves_subtitle: "快去製作你的書單吧",
        top_rated_reviews_subtitle: "看看大家最近在聊些什麼",
      },
      sections: {
        trending_wiki: "熱門百科",
        trending_reviews: "熱門短評",
        trending_shelves: "熱門書架",
        tag_explore: "主題探索",
        shelf_recommendation: "書單推薦",
        ranking: "排行榜",
        partner_brands: "合作夥伴",
        new_book_recommendations: "新書推薦",
        editor_picks: "編輯精選",
        author_spotlight: "作者專欄",
        wiki_teaser_placeholder:
          "條目簡介佔位文案：收錄該書的作者、出版資訊、主題標籤等內容。",
        review_teaser_placeholder: "「這本書讓我重新思考了……（範例佔位短評）」",
        promotion_item_1: "平台公告：本週新版本已發布",
        promotion_item_2: "書展活動：秋季讀書節",
        promotion_item_3: "限時優惠：精選書單 8 折",
        newsletter: {
          title: "訂閱最新資訊",
          thanks: "感謝訂閱！",
          email_placeholder: "輸入你的電子郵件",
          submit: "訂閱",
        },
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
    book_home: {
      hero: {
        kicker: "圖書館",
        title: "發現你的下一本好書",
        subtitle: "瀏覽新書、趨勢好書、精選摘錄等。",
        search_placeholder: "搜尋書名、作者、ISBN...",
      },
    },
    book: {
      tabs: {
        info: "資訊",
        reviews: "書評",
        toc: "目錄",
        overview: "總覽",
        review_shelf: "書評與書架",
        content: "內容",
        community: "社群",
      },
    },
    book_edit: {
      info: {
        title: "書籍編輯",
        dialog: {
          view_book: "點擊查看書籍",
        },
        toast: {
          create_success_title: "建立書籍成功",
          create_success_message:
            "建立書籍成功，書籍詳情頁可能需要等待幾分鐘／手動重新整理才能看到最新內容。",
          create_failed_title: "建立書籍失敗",
          update_success_title: "更新書籍成功",
          update_success_message:
            "更新書籍成功，書籍詳情頁可能需要等待幾分鐘／手動重新整理才能看到最新內容。",
          update_failed_title: "更新書籍失敗",
        },
        validation: {
          publish_url_required:
            "請至少新增一個正確的書籍發布連結，例如起點對應書籍的連結，以 https:// 開頭。",
        },
        translation: {
          section_title: "翻譯",
          language_label: "語言",
          default_badge: "預設",
          add_button: "新增翻譯",
          delete_button: "刪除此語言翻譯",
          delete_confirm: "確定刪除 {{lang}} 的翻譯嗎？此操作無法復原。",
          empty_for_lang: "{{lang}} 尚無翻譯——填入欄位並按提交以建立。",
          diverge_warning:
            "此翻譯來源於某個 release，儲存本地修改將與來源版本分歧。",
          fields: {
            subtitle: "副標題",
            summary: "摘要",
          },
          source: {
            label: "來源 release",
            sync_tooltip:
              "用來源 release 對應語言的內容覆蓋目前表單，仍需按提交才會儲存。",
            no_match: "來源 release 沒有 {{lang}} 翻譯可供複製。",
            sync_button: "從 release 同步",
            open_button: "前往來源 release",
          },
          set_source: {
            label: "來源 release",
            none: "（未設定）",
          },
          add_dialog: {
            title: "新增翻譯",
            language: "語言",
            source_release: "同步來源（選填）",
            source_release_help: "若指定，此語言的內容將標記為來自該 release。",
            no_source: "（不設定來源 release）",
            submit: "新增",
          },
        },
      },
    },
    shelf: {
      loading: "載入中...",
      not_found: "未找到書架",
      open_user_ui: "開啟使用者介面",
      likes_comments: "按讚與留言統計",
      no_reviews: "暫無書評",
      comments: "留言",
      meta_info: "詮釋資料",
      title_label: "書架名稱",
      summary_label: "書架簡介",
      cover_label: "書架封面",
      add_review: "新增書評",
      paste_review_input_label: "貼上書評連結或 ID（/review/:unitId）",
      search_review_label: "搜尋書評（關鍵字）",
      search_button: "搜尋",
      searching: "搜尋中...",
      add_button: "新增",
      current_reviews_title: "目前書評（支援排序與刪除）",
      no_reviews_small: "暫無書評",
      edit_shelf: "編輯書架",
      back: "返回",
      submit: "提交",
      delete: "刪除",
      new_shelf: "新建書架",
      like_tooltip: "按讚",
      favorite_tooltip: "收藏",
      items_count: "{{count}} 項",
      reviews_count: "{{count}} 則評論",
      move_up: "上移",
      move_down: "下移",
      update_success: "書架更新成功",
      delete_success: "書架刪除成功",
      delete_failed: "書架刪除失敗",
      untitled: "（無標題）",
      list: {
        search_placeholder: "搜尋書架",
      },
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
    login: "登入",
    register: "註冊",
    book_edit: "編輯書籍",
    book_edit_main: "書籍主要編輯",
    book_edit_chapter: "章節編輯",
    test: "測試",
    back_to_main: "返回主頁",
    book_editor_navigation: "書籍編輯器導覽",
    profile: "個人資料",
    settings: "設定",
    logout: "登出",
  },

  // Authentication
  auth: {
    login: "登入",
    logout: "登出",
    register: "註冊",
    resolve: "解決",
    already_login: "您已經登入。重新登入將覆蓋之前的登入資訊。",
    help: {
      slug: "使用者名稱為全域唯一。",
      slug_require: "僅允許 a-z、0-9、A-Z、-，長度範圍 6-32",
      password_require: "至少包含 8 個字元，必須包含字母和數字。",
    },
    error: {
      email_required: "電子郵件為必填。",
      invalid_email: "無效的電子郵件地址。",
      invalid_password: "密碼必須至少包含 8 個字元。",
      invalid_username: "無效的使用者名稱。",
      invalid_confirm: "無效的密碼確認。",
      passwords_mismatch: "密碼不相符。",
    },
    flow: {
      new_to_app: "第一次來到 REZICS？",
      create_account: "建立帳號",
      forgot_password: "忘記密碼？",
      reset_link_sending: "正在傳送重設連結…",
      already_have_account: "已經有帳號了？",
      sign_in_instead: "前往登入",
      providers_divider: "或使用以下方式繼續",
      providers_loading: "正在載入登入方式…",
      continue_with_provider: "使用 {{provider}} 繼續",
      onboarding_title: "完成帳號設定",
      onboarding_sign_in_first: "請先登入，再繼續完成帳號設定。",
      onboarding_social_only: "此頁面僅用於社群登入帳號的首次設定。",
      onboarding_complete: "你的帳號設定已完成。",
      onboarding_intro:
        "社群登入帳號需要先提供可用電子郵件，系統才能將其視為可使用成員功能的帳號。密碼為選填。",
      onboarding_trusted_email:
        "此電子郵件已獲得你的登入提供方信任。如需改用其他信箱，則需要重新驗證。",
      onboarding_editable_email:
        "修改電子郵件後，需要完成驗證才能取得成員功能。",
      onboarding_optional_password:
        "如果你暫時只想使用社群登入，可以將密碼留空。",
      onboarding_saved: "帳號設定資訊已儲存。",
      onboarding_submit: "完成設定",
      onboarding_saving: "儲存中…",
      verify_title: "驗證電子郵件",
      verify_sign_in_first: "請先登入，再繼續電子郵件驗證。",
      verify_already_done: "你的電子郵件已驗證完成。",
      verify_intro_prefix: "驗證",
      verify_intro_suffix: "後即可解鎖成員功能。",
      verify_email_fallback: "你的電子郵件地址",
      verify_widget_loading: "正在載入驗證元件…",
      verify_turnstile_passed: "驗證通過。",
      verify_widget_required: "驗證元件完成載入前，暫時無法重新傳送驗證郵件。",
      verify_guest_notice:
        "在完成電子郵件驗證前，你仍可瀏覽訪客可見頁面，但成員專屬功能會繼續保持鎖定。",
      verify_refresh: "重新整理狀態",
      verify_resend_code: "重新傳送驗證碼",
      verify_resend_cooldown: "重新傳送驗證碼（{{seconds}}s）",
      verify_refreshed: "驗證狀態已重新整理。",
      verify_sent: "驗證郵件已傳送。",
      verify_missing_email: "目前帳號缺少可用於驗證的電子郵件地址。",
      verify_complete_widget: "請先完成驗證元件，再請求重新傳送郵件。",
      verify_checking_state: "正在檢查驗證狀態…",
      verify_send_code: "傳送驗證碼",
      verify_sending_code: "正在傳送驗證碼…",
      verify_submit_code: "驗證",
      verify_code_sent_to: "已傳送 6 位數驗證碼至",
      verify_code_expires: "驗證碼將在 5 分鐘後失效。",
      verify_code_incomplete: "請輸入完整的 6 位數驗證碼。",
      verify_success: "電子郵件驗證成功！",
      verify_banner_action: "完成註冊",
      verify_banner_message:
        "目前帳號仍可瀏覽訪客可見頁面，但在註冊完成前，成員功能會保持鎖定。",
      complete_registration_action: "完成註冊",
      complete_registration_prompt: "完成註冊以{{action}}",
      complete_registration_title: "完成註冊",
      complete_registration_intro: "請完成必要步驟以建立你的帳號。",
      setup_title: "建立你的 Rezics 帳號",
      setup_display_name: "顯示名稱",
      setup_slug_label: "Slug（你的專屬網址識別碼）",
      setup_slug_short: "Slug 至少需要 6 個字元。",
      setup_slug_taken: "這個 Slug 已被使用。",
      setup_slug_invalid: "Slug 格式無效：{{reason}}",
      setup_slug_available: "可使用",
      setup_slug_checking: "正在檢查可用性…",
      setup_submit: "建立帳號",
      pause_registration: "稍後繼續",
      pause_registration_confirm: "退出並稍後繼續",
      registration_complete_redirecting: "註冊完成，正在重新導向…",
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

  // User
  user: {
    open_profile: "開啟個人檔案",
  },

  // Unit
  unit: {
    no_content: "暫無內容",
    meta_data: "詮釋資料",
    no_metadata: "暫無詮釋資料",
  },

  units: {
    search_placeholder: "搜尋單元",
  },

  // Book
  book: {
    description: "簡介",
    chapters: "章節",
    authorInfo: "作者資訊",
    tags: "標籤",
    reviews: "評論",
    collections: "收藏夾",
    edit: "編輯書籍",
    add_to_collection: "加入收藏夾",
    new_releases: "新書上架",
    no_cover: "暫無封面",
    unknown_author: "未知作者",
    toc: "目錄",
    remark: "短評",
    excerpts: "原文摘錄",
    reviews_of_book: "{{title}}的書評",
    copyright_notice: {
      body: "封面圖像與書目元資料之版權，歸屬於原出版商、作者及版權所有者。",
      fair_use:
        "本平台基於合理使用原則展示，僅作書目參考與讀者交流之用。若您為版權所有者並有任何疑慮，歡迎與我們聯繫。",
    },
    info_panel: {
      title: "書籍資訊",
    },
    fields: {
      title: "書名",
      isbn: "ISBN",
      cover_url: "封面連結",
      author: "作者",
      press: "出版社",
      producer: "出品方",
      text_length: "字數",
      rating: "內容分級",
    },
    placeholders: {
      search_author: "搜尋作者...",
      search_press: "搜尋出版社...",
      search_producer: "搜尋出品方...",
    },
    flags: {
      rating: "內容分級",
      licensed: "版權",
    },
    tooltips: {
      rating: "選擇內容分級：GENERAL 為預設，R_15、R_18、R_18G 需使用者同意",
      licensed: "當書籍已取得版權許可時，如您是版權所有者，請勾選此選項",
    },
    edit_sections: {
      metadata: "詮釋資料",
      extra: "額外資訊",
    },
    chapter: {
      enable_drag: "啟用拖曳",
      double_click_rename: "雙擊重新命名",
      rename_help:
        "修改此處的章節名稱僅影響目錄結構顯示，不會更新實際章節標題。若需修改章節標題，請前往章節編輯頁面，在那裡修改標題後會自動更新目錄結構。",
      edit_dialog: {
        title: "編輯章節",
        status: "發布狀態",
      },
      status: {
        draft: "草稿",
        published: "已發布",
        archived: "已封存",
      },
      bulk_rating: {
        title: "設定所選章節分級",
        description: "此操作將覆寫 {{count}} 個所選章節的分級。",
      },
      resync_overrides: "重新同步索引覆寫",
      select_mode: "選擇章節",
    },
    author_info: {
      author_line: "作者：{{name}}",
      bio_label: "簡介",
      description_label: "描述",
    },
    description_editor: {
      title: "編輯書籍描述",
    },
    extra: {
      publish_urls: {
        title: "發布連結（Publish URLs）",
      },
    },
  },

  search: {
    placeholders: {
      search_books: "搜尋圖書",
    },
    tooltips: {
      rating: "依內容分級篩選搜尋結果",
      ratingOptIn: "請於設定啟用此分級",
      ratingSignIn: "登入並於設定同意後可啟用此分級",
      licensed: "是否搜尋已取得版權許可的內容",
    },
    filters: {
      rating: "分級",
    },
    pagination: {
      tips: "提示：資料頁數並不代表總資料量，請點擊最後一頁來嘗試載入更多資料",
    },
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
    empty: {
      title: "未找到結果",
    },
  },

  // Shelf
  shelf: {
    featured: "精選書架",
    includes_items: "包含 {{count}} 項",
    includes_reviews: "包含 {{count}} 則書評",
    includes_reviews_one: "{{count}} 則短評",
    includes_reviews_other: "{{count}} 則短評",
    includes_book_title: "包含 {{title}} 的書架",
    a11y: {
      book_review: "書評",
    },
    discussion: {
      composer: {
        placeholder: "展開討論",
      },
      empty: {
        title: "目前還沒有討論",
      },
      signInPrompt: "登入以加入討論",
    },
  },

  // Realm
  realm: {
    title: "領域",
    search: "搜尋領域",
    new_realm: "新增領域",
    manage: "管理領域",
    join: "加入",
    leave: "退出",
    members: "成員",
    feed: "動態",
    tags: "標籤",
    public: "公開",
    official: "官方",
    no_realms: "未找到任何領域",
    content: {
      empty: {
        title: "此領域目前還沒有內容",
      },
    },
    extra: {
      pinboard: {
        note: "領域置頂的 Unit ID 有序列表。顯示於領域頁的動態之上；通常為由領域貢獻者撰寫的 Work 條目的 POST Release。",
      },
      announcement: {
        note: "為首頁公告欄等特殊頁面保留的 Unit ID 有序列表。並非一般論壇通知；僅保留給首頁公告欄等特殊頁面使用。",
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

  notify: {
    kinds: {
      work_link_claim_pending: "作品關聯申請待審核",
      work_link_claim_approved: "作品關聯申請已通過",
      work_link_claim_rejected: "作品關聯申請已拒絕",
    },
  },

  work_link_claim: {
    inbox: {
      title: "待審核的關聯申請",
      empty: "目前沒有需要審核的申請。",
      release: "Release",
      claimer: "申請人",
      submitted_at: "提交時間",
      reason: "理由",
      review: "審核",
      approve: "通過",
      reject: "拒絕",
      withdraw: "撤回",
    },
    modal: {
      approve_title: "通過申請",
      approve_description:
        "此操作將把此 Release 關聯至你的作品，並通知申請人。",
      reject_title: "拒絕申請",
      reject_description: "請填寫簡短理由，申請人將收到通知。",
      reject_reason_label: "理由",
      reject_reason_placeholder: "選填——說明拒絕的原因",
      withdraw_title: "撤回申請",
      withdraw_description: "此操作將撤回你目前的申請，之後仍可重新提交。",
      approve_done: "申請已通過。",
      reject_done: "申請已拒絕。",
      withdraw_done: "申請已撤回。",
      action_failed: "操作失敗：{{error}}",
    },
  },

  // Review
  review: {
    hot: "熱門書評",
    top_rated_short_reviews: "高讚短評",
    short_review: "短評",
    open_user_interface: "開啟使用者介面",
    open_review_page: "開啟書評頁面",
    a11y: {
      open_review_page: "開啟書評頁面",
    },
    comments: "留言",
    form: {
      title: "標題",
      rating: "評分",
    },
    messages: {
      update_success: "書評更新成功",
      delete_success: "書評刪除成功",
      rating_range_error: "評分必須在 0 到 10 之間",
      failed_load: "載入書評失敗。",
    },
    list: {
      empty: {
        title: "目前還沒有書評",
      },
    },
    search: {
      empty: {
        title: "未找到相關書評",
      },
    },
  },

  // Remark
  remark: {
    list: {
      empty: {
        title: "目前還沒有短評",
      },
    },
  },

  // Excerpt
  excerpt: {
    title: "摘錄",
    subtitle: "筆落驚風雨，詩成泣鬼神",
    not_found: "未找到摘錄",
    excerpts_title: "原文摘錄",
    updated_success: "摘錄更新成功",
    form: {
      title: "標題",
      source: "來源",
    },
    messages: {
      update_failed: "更新摘錄失敗：{{error}}",
    },
    list: {
      empty: {
        title: "目前還沒有摘錄",
      },
    },
    card: {
      description: {
        fallback: "暫無摘錄內容",
      },
      source: {
        unknown: "未知出處",
      },
      likes_count: "{{count}} 喜歡",
    },
  },

  // Tag
  tag: {
    loading: "正在載入標籤…",
    load_failed: "載入失敗：{{error}}",
    ungrouped: "未分組",
    showing_top_tags: "顯示熱門標籤",
  },

  // Comment
  comment: {
    login_to_view: "請登入以查看留言",
  },

  // Common UI Elements
  common: {
    created_at: "建立時間",
    updated_at: "更新時間",
    email: "電子郵件",
    password: "密碼",
    confirm: "確認密碼",
    username: "使用者名稱",
    nickname: "暱稱",
    back: "返回",
    home: "首頁",
    cancel: "取消",
    submit: "提交",
    save: "儲存",
    delete: "刪除",
    edit: "編輯",
    add: "新增",
    remove: "移除",
    create: "建立",
    continue: "繼續",
    update: "更新",
    apply: "套用",
    search: "搜尋",
    expand: "展開",
    collapse: "摺疊",
    reply: "回覆",
    close: "關閉",
    open: "開啟",
    no_data: "暫無資料",
    view_more: "查看更多",
    view_all: "查看全部",
    pinned: "置頂",
    new: "新",
    no_description: "暫無描述",
    loading: "載入中...",
    submitting: "提交中...",
    error: "錯誤",
    error_generic: "出錯了...",
    unknown_error: "未知錯誤",
    expand_all: "全部展開",
    collapse_all: "全部摺疊",
  },

  // Form & Editor
  editor: {
    bold: "粗體",
    italic: "斜體",
    heading: "標題",
    quote: "引用",
    generic_list: "列表",
    numbered_list: "編號列表",
    create_link: "建立連結",
    insert_image: "插入圖片",
    insert_table: "插入表格",
    toggle_preview: "切換預覽",
    toggle_side_by_side: "切換並排",
    markdown_guide: "Markdown 指南",
  },

  // Placeholders & Labels
  placeholders: {
    search_books: "搜尋圖書",
    chapter_title: "請輸入章節標題",
    enter_search_term: "輸入搜尋詞",
    enter_url: "輸入 URL 地址",
  },

  // Chapters & Books
  chapters: {
    new_chapter: "新章節",
    expand: "展開",
    collapse: "摺疊",
  },

  // Accessibility Labels
  accessibility: {
    hot: "熱門",
    favorite: "收藏",
    comments: "留言",
    collection: "收藏夾",
    search: "搜尋",
    close: "關閉",
    open_drawer: "開啟側邊欄",
  },

  // 內容分級（透過 t(`rating.tier.${tier}`) 讀取）
  rating: {
    tier: {
      GENERAL: "一般",
      R_15: "R-15",
      R_18: "R-18",
      R_18G: "R-18G",
    },
  },

  settings: {
    content_rating: {
      section_title: "內容分級",
      section_description:
        "基本分級永遠啟用。如需在搜尋與列表中顯示年齡限制內容，請於下方同意啟用。",
      always_on: "一律啟用",
      saved: "偏好已儲存。",
      description: {
        R_18: "成人內容。",
        R_18G: "露骨成人內容。",
      },
      opt_in_modal: {
        title: "確認啟用年齡限制內容",
        body: "啟用 {{rating}} 即表示您已達所在地法定年齡，並同意瀏覽此類內容。",
        confirm: "我確認",
      },
    },
  },
};
