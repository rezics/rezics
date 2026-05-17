export default {
  title: "ICS",
  motto: "継承 創造 伝播",

  // Navigation & Menu
  navigation: {
    main_items: "メインアイテム",
    home: "ホーム",
    books: "ブック",
    book: "本",
    analytics: "分析",
    auth: "認証",
    login: "ログイン",
    register: "登録",
    book_edit: "本の編集",
    book_edit_main: "本のメイン編集",
    book_edit_chapter: "チャプター編集",
    test: "テスト",
    back_to_main: "メインに戻る",
    book_editor_navigation: "ブックエディターナビゲーション",
    profile: "プロフィール",
    settings: "設定",
    logout: "ログアウト",
  },

  // Authentication
  auth: {
    login: "ログイン",
    logout: "ログアウト",
    register: "登録",
    resolve: "解決",
    already_login:
      "既にログインしています。再ログインすると、以前のログイン情報が上書きされます。",
    error: {
      invalid_email: "無効なメールアドレスです。",
      invalid_password: "パスワードは少なくとも6文字である必要があります。",
      invalid_username: "無効なユーザー名です。",
      invalid_confirm: "無効なパスワード確認です。",
      passwords_mismatch: "パスワードが一致しません。",
    },
    flow: {
      new_to_app: "REZICS は初めてですか？",
      create_account: "アカウントを作成",
      forgot_password: "パスワードをお忘れですか？",
      reset_link_sending: "リセットリンクを送信中…",
      already_have_account: "すでにアカウントをお持ちですか？",
      sign_in_instead: "ログインする",
      providers_divider: "または次の方法で続行",
      providers_loading: "ログイン方法を読み込み中…",
      continue_with_provider: "{{provider}} で続行",
      onboarding_title: "オンボーディングを完了",
      onboarding_sign_in_first:
        "アカウント設定を完了するには、まずログインしてください。",
      onboarding_social_only:
        "このページはソーシャルログインのアカウント専用です。",
      onboarding_complete: "オンボーディングはすでに完了しています。",
      onboarding_intro:
        "ソーシャルログインのアカウントは、利用可能なメールアドレスを設定するまでメンバー利用可能状態になりません。パスワードは任意です。",
      onboarding_trusted_email:
        "このメールアドレスはプロバイダーにより信頼済みです。変更する場合は再確認が必要です。",
      onboarding_editable_email:
        "メールアドレスを変更すると、メンバー機能を使う前に確認が必要になります。",
      onboarding_optional_password:
        "当面はソーシャルログインのみで利用する場合、パスワードは空欄のままで構いません。",
      onboarding_saved: "オンボーディング情報を保存しました。",
      onboarding_submit: "オンボーディングを完了",
      onboarding_saving: "保存中…",
      verify_title: "メール確認",
      verify_sign_in_first:
        "メール確認を続けるには、まずログインしてください。",
      verify_already_done: "メールアドレスはすでに確認済みです。",
      verify_intro_prefix: "",
      verify_intro_suffix: "を確認するとメンバー機能が利用可能になります。",
      verify_email_fallback: "あなたのメールアドレス",
      verify_widget_loading: "確認ウィジェットを読み込み中…",
      verify_turnstile_passed: "認証に合格しました。",
      verify_widget_required:
        "確認ウィジェットの読み込みが完了するまで、確認メールの再送は無効です。",
      verify_guest_notice:
        "確認が完了するまで、ゲスト向けページの閲覧は続けられますが、メンバー限定機能は利用できません。",
      verify_refresh: "状態を更新",
      verify_resend_code: "コードを再送信",
      verify_resend_cooldown: "コードを再送信 ({{seconds}}s)",
      verify_refreshed: "確認状態を更新しました。",
      verify_sent: "確認メールを送信しました。",
      verify_missing_email:
        "確認に使用するアカウントのメールアドレスがありません。",
      verify_complete_widget:
        "再送信を行う前に、確認ウィジェットを完了してください。",
      verify_checking_state: "確認状態を確認中…",
      verify_send_code: "コードを送信",
      verify_sending_code: "コードを送信中…",
      verify_submit_code: "確認",
      verify_code_sent_to: "6桁の確認コードを送信しました:",
      verify_code_expires: "コードは5分後に期限切れになります。",
      verify_code_incomplete: "6桁の確認コードをすべて入力してください。",
      verify_banner_action: "登録を完了",
      verify_banner_message:
        "このアカウントは引き続きゲスト向けページを閲覧できますが、登録が完了するまでメンバー機能はロックされたままです。",
      complete_registration_action: "登録を完了",
      complete_registration_prompt: "{{action}}するには登録を完了してください",
      complete_registration_title: "登録を完了",
      complete_registration_intro:
        "アカウント設定を完了するために必要な手順を完了してください。",
      setup_title: "Rezics アカウントを作成",
      setup_display_name: "表示名",
      setup_slug_label: "Slug（一意のURLハンドル）",
      setup_slug_short: "Slug は 6 文字以上で入力してください。",
      setup_slug_taken: "この Slug はすでに使用されています。",
      setup_slug_invalid: "Slug が無効です: {{reason}}",
      setup_slug_available: "利用できます",
      setup_slug_checking: "利用可否を確認中…",
      setup_submit: "アカウントを作成",
      pause_registration: "後で続ける",
      pause_registration_confirm: "サインアウトして後で続ける",
      registration_complete_redirecting: "登録が完了しました。移動しています…",
      retry: "再試行",
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
          title: "Latest Works", // TODO: translate
          tab_latest_serial: "Latest Serial", // TODO: translate
          tab_new_on_shelf: "New on Shelf", // TODO: translate
          tab_recently_completed: "Recently Completed", // TODO: translate
          more: "More \u2192", // TODO: translate
        },
        trending_book: {
          title: "Trending Books", // TODO: translate
          more: "More \u2192", // TODO: translate
          loading: "Loading...", // TODO: translate
        },
        trending_excerpt: {
          title: "Trending Excerpts", // TODO: translate
          more: "More \u2192", // TODO: translate
          empty: "No excerpts yet", // TODO: translate
        },
        active_realms: {
          title: "Active Realms", // TODO: translate
          more: "More", // TODO: translate
        },
        library_cards: {
          book_library: "Book Library", // TODO: translate
          game_library: "Game Library", // TODO: translate
          media_library: "Media Library", // TODO: translate
          coming_soon: "Coming Soon", // TODO: translate
        },
      },
    },
  },

  search: {
    filter: {
      relevance: "Relevance", // TODO: translate
      time: "Latest", // TODO: translate
      favorites: "Total Favorites", // TODO: translate
      word_count: "Word Count", // TODO: translate
      month_votes: "Monthly Votes", // TODO: translate
      recommendation: "Recommendation", // TODO: translate
      week_votes: "Weekly Votes", // TODO: translate
      total_votes: "Total Votes", // TODO: translate
      desc: "Descending", // TODO: translate
      asc: "Ascending", // TODO: translate
    },
    input: {
      placeholder: "Title, ISBN, Author, Publisher, Producer", // TODO: translate
      tags_label: "Tags", // TODO: translate
      tags_hint: "Click tags below or enter tags separated by commas", // TODO: translate
      word_count_label: "Word Count", // TODO: translate
      word_count_placeholder: "10000-20000",
      preset_tags: {
        fiction: "Fiction", // TODO: translate
        nonfiction: "Nonfiction", // TODO: translate
        mystery: "Mystery", // TODO: translate
        romance: "Romance", // TODO: translate
        history: "History", // TODO: translate
        science: "Science", // TODO: translate
        fantasy: "Fantasy", // TODO: translate
        philosophy: "Philosophy", // TODO: translate
      },
    },
  },

  // Common UI Elements
  common: {
    email: "メール",
    password: "パスワード",
    confirm: "パスワード確認",
    username: "ユーザー名",
    back: "戻る",
    home: "ホーム",
    cancel: "キャンセル",
    submit: "送信",
    save: "保存",
    delete: "削除",
    edit: "編集",
    add: "追加",
    remove: "削除",
    create: "作成",
    continue: "続行",
    update: "更新",
    search: "検索",
    share: "共有",
    copy_link: "リンクをコピー",
    share_via: "共有…",
    expand: "展開",
    collapse: "折りたたみ",
    reply: "返信",
    close: "閉じる",
    open: "開く",
  },

  // Pages
  pages: {
    not_found: "ページが見つかりません",
    book_tag_edit: "本のタグ編集",
    book_description_edit: "本の説明編集",
    book_edit_page: "本の編集ページ",
    review_page: "詳細レビューページ",
    review_edit_page: "詳細レビュー編集ページ",
    short_review_page: "短評ページ",
    book_collection_list_page: "本のコレクションリストページ",
    book_list_edit_page: "ブックリスト編集ページ",
  },

  // Form & Editor
  editor: {
    bold: "太字",
    italic: "斜体",
    heading: "見出し",
    quote: "引用",
    generic_list: "リスト",
    numbered_list: "番号付きリスト",
    create_link: "リンクを作成",
    insert_image: "画像を挿入",
    insert_table: "テーブルを挿入",
    toggle_preview: "プレビューを切り替え",
    toggle_side_by_side: "並列表示を切り替え",
    markdown_guide: "Markdownガイド",
  },

  // Placeholders & Labels
  placeholders: {
    search_books: "本を検索",
    chapter_title: "チャプタータイトルを入力",
  },

  // Chapters & Books
  chapters: {
    new_chapter: "新しいチャプター",
    expand: "展開",
    collapse: "折りたたみ",
  },

  // Accessibility Labels
  accessibility: {
    favorite: "お気に入り",
    comments: "コメント",
    collection: "コレクション",
    search: "検索",
    close: "閉じる",
    open_drawer: "ドロワーを開く",
  },

  realm: {
    extra: {
      pinboard: {
        note: "領域内でピン留めされた Unit ID の順序付きリスト。フィードの上部に表示され、通常は領域の貢献者が作成した Work エントリの POST Release です。",
      },
      announcement: {
        note: "ホームページのアナウンスバーなど特別なページのために予約された Unit ID の順序付きリスト。一般的なフォーラム通知ではなく、ホームページのアナウンスバーのような特別なページ専用です。",
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
      work_link_claim_pending: "ワークリンク申請が確認待ちです",
      work_link_claim_approved: "ワークリンク申請が承認されました",
      work_link_claim_rejected: "ワークリンク申請が却下されました",
    },
  },

  work_link_claim: {
    inbox: {
      title: "確認待ちの申請",
      empty: "確認待ちの申請はありません。",
      release: "Release",
      claimer: "申請者",
      submitted_at: "送信日時",
      reason: "理由",
      review: "確認",
      approve: "承認",
      reject: "却下",
      withdraw: "取り下げ",
    },
    modal: {
      approve_title: "申請を承認",
      approve_description:
        "この Release をあなたの作品に紐づけ、申請者に通知します。",
      reject_title: "申請を却下",
      reject_description:
        "簡単な理由を記入してください。申請者に通知されます。",
      reject_reason_label: "理由",
      reject_reason_placeholder: "任意 — 却下の理由",
      withdraw_title: "申請を取り下げる",
      withdraw_description:
        "現在の申請を取り下げます。後で再送信することもできます。",
      approve_done: "申請を承認しました。",
      reject_done: "申請を却下しました。",
      withdraw_done: "申請を取り下げました。",
      action_failed: "操作に失敗しました：{{error}}",
    },
  },
};
