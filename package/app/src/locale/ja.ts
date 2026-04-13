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
      verify_widget_required:
        "確認ウィジェットの読み込みが完了するまで、確認メールの再送は無効です。",
      verify_guest_notice:
        "確認が完了するまで、ゲスト向けページの閲覧は続けられますが、メンバー限定機能は利用できません。",
      verify_refresh: "状態を更新",
      verify_resend: "確認メールを再送",
      verify_refreshed: "確認状態を更新しました。",
      verify_sent: "確認メールを送信しました。",
      verify_missing_email:
        "確認に使用するアカウントのメールアドレスがありません。",
      verify_complete_widget:
        "再送信を行う前に、確認ウィジェットを完了してください。",
      verify_checking_state: "確認状態を確認中…",
      verify_banner_action: "メールを確認",
      verify_banner_message:
        "このアカウントは引き続きゲスト向けページを閲覧できますが、メール確認が完了するまでメンバー機能はロックされたままです。",
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
        trending_quote: {
          title: "Trending Quotes", // TODO: translate
          more: "More \u2192", // TODO: translate
          empty: "No quotes yet", // TODO: translate
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
};
