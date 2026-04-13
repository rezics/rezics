export default {
  title: "ICS",
  motto: "Erben Schaffen Verbreiten",

  // Navigation & Menu
  navigation: {
    main_items: "Hauptelemente",
    home: "Startseite",
    books: "Bücher",
    book: "Buch",
    analytics: "Analytik",
    auth: "Authentifizierung",
    login: "Anmelden",
    register: "Registrieren",
    book_edit: "Buch bearbeiten",
    book_edit_main: "Buch Hauptbearbeitung",
    book_edit_chapter: "Kapitel bearbeiten",
    test: "Test",
    back_to_main: "Zurück zur Hauptseite",
    book_editor_navigation: "Buchbearbeitungsnavigation",
    profile: "Profil",
    settings: "Einstellungen",
    logout: "Abmelden",
  },

  // Authentication
  auth: {
    login: "Anmelden",
    logout: "Abmelden",
    register: "Registrieren",
    resolve: "Lösen",
    already_login:
      "Sie sind bereits angemeldet. Eine erneute Anmeldung überschreibt die vorherigen Anmeldeinformationen.",
    error: {
      invalid_email: "Ungültige E-Mail-Adresse.",
      invalid_password: "Das Passwort muss mindestens 6 Zeichen lang sein.",
      invalid_username: "Ungültiger Benutzername.",
      invalid_confirm: "Ungültige Passwort-Bestätigung.",
      passwords_mismatch: "Passwörter stimmen nicht überein.",
    },
    flow: {
      new_to_app: "Neu bei REZICS?",
      create_account: "Konto erstellen",
      forgot_password: "Passwort vergessen?",
      already_have_account: "Haben Sie bereits ein Konto?",
      sign_in_instead: "Anmelden",
      providers_divider: "oder fortfahren mit",
      providers_loading: "Anmeldeanbieter werden geladen…",
      continue_with_provider: "Weiter mit {{provider}}",
      onboarding_title: "Onboarding abschließen",
      onboarding_sign_in_first:
        "Bitte melden Sie sich zuerst an, um das Onboarding abzuschließen.",
      onboarding_social_only:
        "Diese Seite ist nur für Social-Sign-in-Konten vorgesehen.",
      onboarding_complete: "Ihr Onboarding ist bereits abgeschlossen.",
      onboarding_intro:
        "Für Social Sign-in wird eine nutzbare E-Mail-Adresse benötigt, bevor das Konto als mitgliedsbereit gilt. Ein Passwort ist optional.",
      onboarding_trusted_email:
        "Diese E-Mail-Adresse wird von Ihrem Anbieter als vertrauenswürdig eingestuft. Wenn Sie sie ändern, ist eine erneute Verifizierung erforderlich.",
      onboarding_editable_email:
        "Wenn Sie die E-Mail-Adresse ändern, ist vor dem Mitgliederzugriff eine Verifizierung erforderlich.",
      onboarding_optional_password:
        "Lassen Sie das Passwort leer, wenn das Konto vorerst nur per Social Sign-in genutzt werden soll.",
      onboarding_saved: "Onboarding-Daten gespeichert.",
      onboarding_submit: "Onboarding abschließen",
      onboarding_saving: "Wird gespeichert…",
      verify_title: "E-Mail verifizieren",
      verify_sign_in_first:
        "Bitte melden Sie sich zuerst an, um mit der E-Mail-Verifizierung fortzufahren.",
      verify_already_done: "Ihre E-Mail-Adresse ist bereits verifiziert.",
      verify_intro_prefix: "Verifizieren Sie",
      verify_intro_suffix: "um Mitgliederzugriff freizuschalten.",
      verify_email_fallback: "Ihre E-Mail-Adresse",
      verify_widget_loading: "Verifizierungs-Widget wird geladen…",
      verify_widget_required:
        "Das erneute Senden der Bestätigungs-E-Mail bleibt deaktiviert, bis das Widget geladen wurde.",
      verify_guest_notice:
        "Sie können weiterhin gastzugängliche Seiten nutzen, aber Mitgliedsfunktionen bleiben bis zur Verifizierung gesperrt.",
      verify_refresh: "Status aktualisieren",
      verify_resend: "E-Mail erneut senden",
      verify_refreshed: "Verifizierungsstatus aktualisiert.",
      verify_sent: "Bestätigungs-E-Mail gesendet.",
      verify_missing_email:
        "Für die Verifizierung ist keine Konto-E-Mail-Adresse vorhanden.",
      verify_complete_widget:
        "Schließen Sie das Verifizierungs-Widget ab, bevor Sie eine weitere E-Mail anfordern.",
      verify_checking_state: "Verifizierungsstatus wird geprüft…",
      verify_banner_action: "E-Mail verifizieren",
      verify_banner_message:
        "Ihr Konto kann gastzugängliche Seiten weiterhin nutzen, aber Mitgliedsfunktionen bleiben gesperrt, bis Ihre E-Mail verifiziert ist.",
      retry: "Erneut versuchen",
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
    email: "E-Mail",
    password: "Passwort",
    confirm: "Passwort bestätigen",
    username: "Benutzername",
    back: "Zurück",
    home: "Startseite",
    cancel: "Abbrechen",
    submit: "Senden",
    save: "Speichern",
    delete: "Löschen",
    edit: "Bearbeiten",
    add: "Hinzufügen",
    remove: "Entfernen",
    create: "Erstellen",
    continue: "Weiter",
    update: "Aktualisieren",
    search: "Suchen",
    expand: "Erweitern",
    collapse: "Einklappen",
    reply: "Antworten",
    close: "Schließen",
    open: "Öffnen",
  },

  // Pages
  pages: {
    not_found: "Seite nicht gefunden",
    book_tag_edit: "Buch-Tag bearbeiten",
    book_description_edit: "Buchbeschreibung bearbeiten",
    book_edit_page: "Buchbearbeitungsseite",
    review_page: "Ausführliche Bewertungsseite",
    review_edit_page: "Ausführliche Bewertung bearbeiten",
    short_review_page: "Kurze Bewertungsseite",
    book_collection_list_page: "Buchsammlungslistenseite",
    book_list_edit_page: "Buchliste bearbeiten",
  },

  // Form & Editor
  editor: {
    bold: "Fett",
    italic: "Kursiv",
    heading: "Überschrift",
    quote: "Zitat",
    generic_list: "Liste",
    numbered_list: "Nummerierte Liste",
    create_link: "Link erstellen",
    insert_image: "Bild einfügen",
    insert_table: "Tabelle einfügen",
    toggle_preview: "Vorschau umschalten",
    toggle_side_by_side: "Nebeneinanderansicht umschalten",
    markdown_guide: "Markdown-Anleitung",
  },

  // Placeholders & Labels
  placeholders: {
    search_books: "Bücher suchen",
    chapter_title: "Kapiteltitel eingeben",
  },

  // Chapters & Books
  chapters: {
    new_chapter: "Neues Kapitel",
    expand: "Erweitern",
    collapse: "Einklappen",
  },

  // Accessibility Labels
  accessibility: {
    favorite: "Favorit",
    comments: "Kommentare",
    collection: "Sammlung",
    search: "Suchen",
    close: "Schließen",
    open_drawer: "Schublade öffnen",
  },
};
