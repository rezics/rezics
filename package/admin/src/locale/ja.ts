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

  entity: {
    kind: {
      person: "人物",
      organization: "組織",
      circle: "サークル",
      studio: "スタジオ",
      label: "レーベル",
      character: "キャラクター",
      faction: "勢力",
      family: "家族",
      location: "場所",
      artifact: "アイテム",
      event: "イベント",
      concept: "概念",
    },
  },

  attribution: {
    credit: {
      role: {
        author: "著者",
        co_author: "共著者",
        translator: "翻訳者",
        illustrator: "イラスト",
        editor: "編集者",
        publisher: "出版社",
        letterer: "レタラー",
        colorist: "カラー担当",
        developer: "開発者",
        composer: "作曲者",
        designer: "デザイナー",
        director: "監督",
        producer: "プロデューサー",
        writer: "脚本",
        actor: "出演者",
        narrator: "ナレーター",
        studio: "スタジオ",
        distributor: "配給",
      },
    },
    subject: {
      role: {
        primary_character: "主要キャラクター",
        featured_character: "登場キャラクター",
        appears: "登場",
        about: "関連",
        setting: "舞台",
        source_work: "原作",
        canonical_wiki_page: "標準 Wiki ページ",
        related_subject: "関連対象",
      },
    },
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
