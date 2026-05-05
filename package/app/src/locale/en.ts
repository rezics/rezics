export default {
  title: "REZICS",
  motto: "Inherited Create Spread",

  layout: {
    header: {
      toggle_language: "Toggle language",
      toggle_theme: "Toggle theme",
    },
    footer: {
      brand: {
        description:
          "A multi-library platform for books, games, and media — helping people discover the works they love.",
        slogan: "inherited·create·spread",
      },
      social: {
        aria: "Social links",
        github: "GitHub",
        telegram: "Telegram",
      },
      product: {
        aria: "Product",
        title: "Product",
        discover: "Discover",
        shelves: "Shelves",
        reviews: "Reviews & Ratings",
        search: "Search",
      },
      resources: {
        aria: "Resources",
        title: "Resources",
        docs: "Docs",
        api: "API",
        changelog: "Changelog",
        status: "System status",
      },
      newsletter: {
        title: "Subscribe for updates",
        description:
          "Get the latest features and curated shelf picks. (In development)",
        email_placeholder: "Your email",
        email_aria: "Email",
        submit: "Subscribe",
      },
      copyright: "© {{year}} REZICS · All rights reserved",
      legal: {
        privacy: "Privacy",
        terms: "Terms",
        contact: "Contact us",
      },
    },
  },

  pages: {
    review_page: "Review Page",
    unit_page: "Unit",
    book_collection_list_page: "Reading lists containing this book",
  },

  page: {
    home: {
      name: "Home",
      hero: {
        kicker: "REZICS",
        title_highlight: "Meet the stories you love",
        subtitle:
          "Search for books you want, and discover high-quality reading lists, short reviews, and quotes.",
      },
      quick_access: {
        title_quick_entry: "Quick access",
        title_fast_explore: "Fast explore",
        title_quick_explore: "Quick explore",
      },
      mobile: {
        search_placeholder: "Search title, author, ISBN...",
        floating_status: {
          browsing_recommendations: "Browsing home recommendations",
          beta_experimental: "Beta · Experimental features",
        },
      },
      carousel: {
        alert: {
          parse_failed: "Carousel data parsing failed: {{error}}",
        },
      },
      noticeboard: {
        caption: "Notice",
        title: "Noticeboard",
        empty: "No notices",
        time: {
          just_now: "Just now",
          hours_ago_one: "{{count}} hour ago",
          hours_ago_other: "{{count}} hours ago",
          days_ago_one: "{{count}} day ago",
          days_ago_other: "{{count}} days ago",
          weeks_ago_one: "{{count}} week ago",
          weeks_ago_other: "{{count}} weeks ago",
        },
      },
      discovery: {
        recommended_for_you: "Recommended for you",
        recommendations: "Recommendations",
        meili_subtitle: "Real-time recommendations powered by Meilisearch",
        featured_shelves_subtitle: "Go create your own shelf",
        top_rated_reviews_subtitle: "See what everyone’s been talking about",
      },
      sections: {
        trending_wiki: "Trending Wiki",
        trending_reviews: "Trending Reviews",
        trending_shelves: "Trending Shelves",
        tag_explore: "Tag Explore",
        shelf_recommendation: "Shelf Picks",
        ranking: "Rankings",
        partner_brands: "Partners",
        new_book_recommendations: "New Book Picks",
        editor_picks: "Editor's Picks",
        author_spotlight: "Author Spotlight",
        wiki_teaser_placeholder:
          "Entry teaser placeholder: includes author, publication info, topic tags, and more.",
        review_teaser_placeholder:
          "“This book made me rethink… (sample placeholder review)”",
        promotion_item_1: "Platform notice: this week's new version is live",
        promotion_item_2: "Book fair event: Autumn Reading Festival",
        promotion_item_3: "Limited-time offer: featured reading lists 20% off",
        newsletter: {
          title: "Subscribe for updates",
          thanks: "Thanks for subscribing!",
          email_placeholder: "Enter your email",
          submit: "Subscribe",
        },
        new_book: {
          title: "Latest Works",
          tab_latest_serial: "Latest Serial",
          tab_new_on_shelf: "New on Shelf",
          tab_recently_completed: "Recently Completed",
          more: "More \u2192",
        },
        trending_book: {
          title: "Trending Books",
          more: "More \u2192",
          loading: "Loading...",
        },
        trending_excerpt: {
          title: "Trending Excerpts",
          more: "More \u2192",
          empty: "No excerpts yet",
        },
        active_realms: {
          title: "Active Realms",
          more: "More",
        },
        library_cards: {
          book_library: "Book Library",
          game_library: "Game Library",
          media_library: "Media Library",
          coming_soon: "Coming Soon",
        },
      },
    },
    book_home: {
      hero: {
        kicker: "Book Library",
        title: "Discover your next great read",
        subtitle:
          "Browse new releases, trending books, curated quotes, and more.",
        search_placeholder: "Search title, author, ISBN...",
      },
    },
    book: {
      tabs: {
        info: "Info",
        reviews: "Reviews",
        toc: "Contents",
        overview: "Overview",
        review_shelf: "Review & Shelf",
        content: "Content",
        community: "Community",
      },
    },
    book_edit: {
      info: {
        title: "Book editor",
        dialog: {
          view_book: "View book",
        },
        toast: {
          create_success_title: "Book created",
          create_success_message:
            "Book created successfully. The detail page may need a few minutes / a manual refresh to show the latest content.",
          create_failed_title: "Create book failed",
          update_success_title: "Book updated",
          update_success_message:
            "Book updated successfully. The detail page may need a few minutes / a manual refresh to show the latest content.",
          update_failed_title: "Update book failed",
        },
        validation: {
          publish_url_required:
            "Please add at least one valid publish URL (starting with https://), e.g. a Qidian book page URL.",
        },
        translation: {
          section_title: "Translations",
          language_label: "Language",
          default_badge: "default",
          add_button: "Add translation",
          delete_button: "Remove this translation",
          delete_confirm:
            "Remove the {{lang}} translation? This cannot be undone.",
          empty_for_lang:
            "No translation yet for {{lang}} — fill in the fields and Submit to create it.",
          diverge_warning:
            "This translation is sourced from a release. Saving local edits will diverge from the source.",
          fields: {
            subtitle: "Subtitle",
            summary: "Summary",
          },
          source: {
            label: "Source release",
            sync_tooltip:
              "Replace the form with the source release's content for this language. You still need to Submit to save.",
            no_match:
              "The source release has no translation in {{lang}} to copy from.",
            sync_button: "Sync from release",
            open_button: "Open source release",
          },
          set_source: {
            label: "Source release",
            none: "(none)",
          },
          add_dialog: {
            title: "Add translation",
            language: "Language",
            source_release: "Sync source (optional)",
            source_release_help:
              "If set, this language's content will be marked as sourced from that release.",
            no_source: "(no source release)",
            submit: "Add",
          },
        },
      },
    },
    shelf: {
      loading: "Loading...",
      not_found: "Shelf not found",
      open_user_ui: "Open user UI",
      likes_comments: "Likes & comments",
      no_reviews: "No reviews",
      comments: "Comments",
      meta_info: "Meta",
      title_label: "Shelf title",
      summary_label: "Shelf summary",
      cover_label: "Cover URL",
      add_review: "Add review",
      paste_review_input_label: "Paste review URL or ID (/review/:unitId)",
      search_review_label: "Search reviews (keyword)",
      search_button: "Search",
      searching: "Searching...",
      add_button: "Add",
      current_reviews_title: "Current reviews (sortable & deletable)",
      no_reviews_small: "No reviews",
      edit_shelf: "Edit shelf",
      back: "Back",
      submit: "Submit",
      delete: "Delete",
      new_shelf: "New shelf",
      like_tooltip: "Like",
      favorite_tooltip: "Favorite",
      items_count: "{{count}} items",
      reviews_count: "{{count}} reviews",
      move_up: "Move up",
      move_down: "Move down",
      update_success: "Shelf updated",
      delete_success: "Shelf deleted",
      delete_failed: "Failed to delete shelf",
      untitled: "(Untitled)",
      list: {
        search_placeholder: "Search shelves",
      },
    },
  },

  // Navigation & Menu
  navigation: {
    main_items: "Main Items",
    home: "Home",
    books: "Books",
    book: "Book",
    analytics: "Analytics",
    auth: "Auth",
    login: "Sign in",
    register: "Sign up",
    book_edit: "Book Edit",
    book_edit_main: "Book Edit Main",
    book_edit_chapter: "Book Edit Chapter",
    test: "Test",
    back_to_main: "Back to Main",
    book_editor_navigation: "Book Editor Navigation",
    profile: "Profile",
    settings: "Settings",
    logout: "Sign out",
  },

  // Authentication
  auth: {
    login: "Sign in",
    logout: "Sign out",
    register: "Sign up",
    resolve: "Resolve",
    already_login:
      "You have already logged in. Re-login will overwrite the previous login information.",
    help: {
      slug: "Username is globally unique.",
      slug_require: "Only allow a-z, 0-9, A-Z, -, length range 6-32",
      password_require:
        "At least 8 characters long, must include both letters and numbers.",
    },
    error: {
      email_required: "Email is required.",
      invalid_email: "Invalid email address.",
      invalid_password: "Password must be at least 6 characters long.",
      invalid_username: "Invalid username.",
      invalid_confirm: "Invalid password confirmation.",
      passwords_mismatch: "Passwords do not match.",
    },
    flow: {
      new_to_app: "New to ReZICS?",
      create_account: "Create an account",
      forgot_password: "Forgot password?",
      already_have_account: "Already have an account?",
      sign_in_instead: "Sign in",
      providers_divider: "or continue with",
      providers_loading: "Loading sign-in providers…",
      continue_with_provider: "Continue with {{provider}}",
      onboarding_title: "Finish Onboarding",
      onboarding_sign_in_first: "Sign in first to complete account onboarding.",
      onboarding_social_only:
        "This onboarding page is only used for social sign-in accounts.",
      onboarding_complete: "Your onboarding is already complete.",
      onboarding_intro:
        "Social sign-in needs a usable email before the app can treat your account as member-ready. Password is optional.",
      onboarding_trusted_email:
        "This email is trusted by your provider. Edit it only if you want to verify a different address.",
      onboarding_editable_email:
        "Changing email will require verification before member access is available.",
      onboarding_optional_password:
        "Leave password blank if you want to keep this account social-only for now.",
      onboarding_saved: "Onboarding details saved.",
      onboarding_submit: "Complete Onboarding",
      onboarding_saving: "Saving…",
      verify_title: "Verify Email",
      verify_sign_in_first:
        "Sign in first to continue with email verification.",
      verify_already_done: "Your email is already verified.",
      verify_intro_prefix: "Verify",
      verify_intro_suffix: "to unlock member access.",
      verify_email_fallback: "your email address",
      verify_widget_loading: "Loading verification widget…",
      verify_turnstile_passed: "Verification passed.",
      verify_widget_required:
        "Verification email resend stays disabled until the widget finishes loading.",
      verify_guest_notice:
        "You can keep browsing guest-accessible pages, but member-only actions stay locked until verification completes.",
      verify_refresh: "Refresh Status",
      verify_resend_code: "Re-send Code",
      verify_resend_cooldown: "Re-send Code ({{seconds}}s)",
      verify_refreshed: "Verification status refreshed.",
      verify_sent: "Verification code sent. Check your inbox.",
      verify_missing_email: "Missing account email for verification.",
      verify_complete_widget:
        "Complete the verification widget before requesting another email.",
      verify_checking_state: "Checking verification state…",
      verify_send_code: "Send Code",
      verify_submit_code: "Verify",
      verify_code_sent_to: "A 6-digit code was sent to",
      verify_code_expires: "The code expires in 5 minutes.",
      verify_code_incomplete: "Please enter the full 6-digit code.",
      verify_success: "Email verified successfully!",
      verify_banner_action: "Complete Registration",
      verify_banner_message:
        "Your account can browse guest-accessible pages, but member features stay locked until registration is complete.",
      complete_registration_action: "Complete Registration",
      complete_registration_prompt: "Complete registration to {{action}}",
      retry: "Retry",
      providers: {
        github: "GitHub",
        google: "Google",
        microsoft: "Microsoft",
        telegram: "Telegram",
        twitter: "X / Twitter",
      },
    },
  },

  // ANCHOR User
  user: {
    open_profile: "Open Profile",
  },

  // ANCHOR Unit
  unit: {
    no_content: "No content",
    meta_data: "Meta Data",
    no_metadata: "No metadata",
  },

  units: {
    search_placeholder: "Search units",
  },

  // Book
  book: {
    description: "Description",
    chapters: "Chapters",
    authorInfo: "Author Info",
    tags: "Tags",
    reviews: "Reviews",
    collections: "Collections",
    edit: "Edit Book",
    add_to_collection: "Add to Collection",
    new_releases: "New arrivals",
    no_cover: "No cover",
    unknown_author: "Unknown author",
    toc: "Contents",
    remark: "Remark",
    excerpts: "Excerpts",
    reviews_of_book: "Reviews for {{title}}",
    copyright_notice: {
      body: "Cover artwork and bibliographic metadata are the property of their respective publishers, authors, and copyright holders.",
      fair_use:
        "This platform displays them under fair use for cataloging and reader discussion. If you are the rights holder and have any concerns, please contact us.",
    },
    info_panel: {
      title: "Book info",
    },
    fields: {
      title: "Title",
      isbn: "ISBN",
      cover_url: "Cover URL",
      author: "Author",
      press: "Publisher",
      producer: "Producer",
      text_length: "Text length",
      rating: "Content rating",
    },
    placeholders: {
      search_author: "Search authors...",
      search_press: "Search publishers...",
      search_producer: "Search producers...",
    },
    flags: {
      rating: "Content rating",
      licensed: "Licensed",
    },
    tooltips: {
      rating:
        "Choose the content rating. GENERAL is default; R_15, R_18, and R_18G require caller opt-in.",
      licensed:
        "Please check this option if the book has been licensed (e.g. you are the copyright holder).",
    },
    edit_sections: {
      metadata: "MetaData",
      extra: "Extra",
    },
    chapter: {
      enable_drag: "Enable drag",
      double_click_rename: "Double-click rename",
      rename_help:
        "Renaming chapters here only affects the table-of-contents display and will not update the actual chapter title. To rename the chapter title, go to the chapter editor page; after changing the title there, the table of contents will update automatically.",
      edit_dialog: {
        title: "Edit Chapter",
        status: "Publish Status",
      },
      status: {
        draft: "Draft",
        published: "Published",
        archived: "Archived",
      },
      bulk_rating: {
        title: "Set rating for selected",
        description:
          "This will override the rating on {{count}} selected chapters.",
      },
      resync_overrides: "Resync index overrides",
      select_mode: "Select chapters",
    },
    author_info: {
      author_line: "Author: {{name}}",
      bio_label: "Bio",
      description_label: "Description",
    },
    description_editor: {
      title: "Edit book description",
    },
    extra: {
      publish_urls: {
        title: "Publish URLs",
      },
    },
  },

  search: {
    placeholders: {
      search_books: "Search books",
    },
    tooltips: {
      rating: "Narrow search results by content rating",
      ratingOptIn: "Enable this rating in settings",
      ratingSignIn: "Sign in and opt in to enable this rating",
      licensed: "Whether to search for content that has been licensed",
    },
    filters: {
      rating: "Rating",
    },
    pagination: {
      tips: "Tips: The page number does not represent the total number of data, please click the last page to try to load more",
    },
    filter: {
      relevance: "Relevance",
      time: "Latest",
      favorites: "Total Favorites",
      word_count: "Word Count",
      month_votes: "Monthly Votes",
      recommendation: "Recommendation",
      week_votes: "Weekly Votes",
      total_votes: "Total Votes",
      desc: "Descending",
      asc: "Ascending",
    },
    input: {
      placeholder: "Title, ISBN, Author, Publisher, Producer",
      tags_label: "Tags",
      tags_hint: "Click tags below or enter tags separated by commas",
      word_count_label: "Word Count",
      word_count_placeholder: "10000-20000",
      preset_tags: {
        fiction: "Fiction",
        nonfiction: "Nonfiction",
        mystery: "Mystery",
        romance: "Romance",
        history: "History",
        science: "Science",
        fantasy: "Fantasy",
        philosophy: "Philosophy",
      },
    },
    empty: {
      title: "No results found",
    },
  },

  // Shelf
  shelf: {
    featured: "Featured shelves",
    includes_items: "Includes {{count}} items",
    includes_reviews: "Includes {{count}} reviews",
    includes_reviews_one: "{{count}} short review",
    includes_reviews_other: "{{count}} short reviews",
    includes_book_title: "Shelves containing {{title}}",
    a11y: {
      book_review: "Book review",
    },
    discussion: {
      composer: {
        placeholder: "Start a discussion",
      },
      empty: {
        title: "No discussions yet",
      },
      signInPrompt: "Sign in to join the discussion",
    },
  },

  // Realm
  realm: {
    title: "Realms",
    search: "Search Realms",
    new_realm: "New Realm",
    manage: "Manage Realm",
    join: "Join",
    leave: "Leave",
    members: "Members",
    feed: "Feed",
    tags: "Tags",
    public: "Public",
    official: "Official",
    no_realms: "No realms found",
    content: {
      empty: {
        title: "No content in this realm yet",
      },
    },
    extra: {
      pinboard: {
        note: "Ordered list of Unit IDs pinned within the realm. Surfaced on the realm page above the feed; entries are usually POST Releases of Work entries authored by the realm's contributors.",
      },
      announcement: {
        note: "Ordered list of Unit IDs reserved for special pages like the homepage announcement bar. Not for general forum notifications; reserved for special pages like the homepage announcement bar.",
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
      work_link_claim_pending: "Work-link claim pending review",
      work_link_claim_approved: "Work-link claim approved",
      work_link_claim_rejected: "Work-link claim rejected",
    },
  },

  work_link_claim: {
    inbox: {
      title: "Pending claims",
      empty: "No claims awaiting review.",
      release: "Release",
      claimer: "Claimer",
      submitted_at: "Submitted",
      reason: "Reason",
      review: "Review",
      approve: "Approve",
      reject: "Reject",
      withdraw: "Withdraw",
    },
    modal: {
      approve_title: "Approve claim",
      approve_description:
        "This will link the release to your work and notify the claimer.",
      reject_title: "Reject claim",
      reject_description:
        "Provide a brief reason. The claimer will be notified.",
      reject_reason_label: "Reason",
      reject_reason_placeholder:
        "Optional — explain why this claim is rejected",
      withdraw_title: "Withdraw claim",
      withdraw_description:
        "This will remove your pending claim. You can submit again later.",
      approve_done: "Claim approved.",
      reject_done: "Claim rejected.",
      withdraw_done: "Claim withdrawn.",
      action_failed: "Action failed: {{error}}",
    },
  },

  // Review
  review: {
    hot: "Hot reviews",
    top_rated_short_reviews: "Top-rated short reviews",
    short_review: "Review",
    open_user_interface: "Open user profile",
    open_review_page: "Open review page",
    a11y: {
      open_review_page: "Open review page",
    },
    comments: "Comments",
    form: {
      title: "Title",
      rating: "Rating",
    },
    messages: {
      update_success: "Review updated successfully",
      delete_success: "Review deleted successfully",
      rating_range_error: "Rating must be between 0 and 10",
      failed_load: "Failed to load review.",
    },
    list: {
      empty: {
        title: "No reviews yet",
      },
    },
    search: {
      empty: {
        title: "No reviews found",
      },
    },
  },

  // Remark
  remark: {
    list: {
      empty: {
        title: "No remarks yet",
      },
    },
  },

  // Excerpt
  excerpt: {
    title: "Excerpts",
    subtitle:
      "A brushstroke stirs wind and rain; a poem moves gods and ghosts to tears.",
    not_found: "Excerpt not found",
    excerpts_title: "Excerpts",
    updated_success: "Excerpt updated successfully",
    form: {
      title: "Title",
      source: "Source",
    },
    messages: {
      update_failed: "Update excerpt failed: {{error}}",
    },
    list: {
      empty: {
        title: "No excerpts yet",
      },
    },
    card: {
      description: {
        fallback: "No excerpt content",
      },
      source: {
        unknown: "Unknown source",
      },
      likes_count: "{{count}} likes",
    },
  },

  // Tag
  tag: {
    loading: "Loading tags...",
    load_failed: "Load failed: {{error}}",
    ungrouped: "Ungrouped",
    showing_top_tags: "Showing top tags",
  },

  // Comment
  comment: {
    login_to_view: "Please login to view comments",
  },

  // Common UI Elements
  common: {
    created_at: "Created at",
    updated_at: "Updated at",
    email: "Email",
    password: "Password",
    confirm: "Confirm Password",
    username: "Username",
    nickname: "Nickname",
    back: "Back",
    home: "Home",
    cancel: "Cancel",
    submit: "Submit",
    save: "Save",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    remove: "Remove",
    create: "Create",
    continue: "Continue",
    update: "Update",
    apply: "Apply",
    search: "Search",
    expand: "Expand",
    collapse: "Collapse",
    reply: "Reply",
    close: "Close",
    open: "Open",
    no_data: "No data",
    view_more: "View more",
    view_all: "View all",
    pinned: "Pinned",
    new: "New",
    no_description: "No description",
    loading: "Loading...",
    submitting: "Submitting...",
    error: "Error",
    error_generic: "Oh no...",
    unknown_error: "Unknown error",
    expand_all: "Expand all",
    collapse_all: "Collapse all",
    retry: "Retry",
    dismiss: "Dismiss",
    saving: "Saving...",
  },

  // Form & Editor
  editor: {
    bold: "Bold",
    italic: "Italic",
    heading: "Heading",
    quote: "Quote",
    generic_list: "Generic List",
    numbered_list: "Numbered List",
    create_link: "Create Link",
    insert_image: "Insert Image",
    insert_table: "Insert Table",
    toggle_preview: "Toggle Preview",
    toggle_side_by_side: "Toggle Side by Side",
    markdown_guide: "Markdown Guide",
  },

  // Placeholders & Labels
  placeholders: {
    search_books: "Search books",
    chapter_title: "Enter chapter title",
    enter_search_term: "Enter search term",
    enter_url: "Enter URL",
  },

  // Chapters & Books
  chapters: {
    new_chapter: "New Chapter",
    expand: "Expand",
    collapse: "Collapse",
  },

  // Accessibility Labels
  accessibility: {
    hot: "Hot",
    favorite: "Favorite",
    comments: "Comments",
    collection: "Collection",
    search: "Search",
    close: "Close",
    open_drawer: "Open drawer",
  },

  // Content rating tiers (used via t(`rating.tier.${tier}`))
  rating: {
    tier: {
      GENERAL: "General",
      R_15: "R-15",
      R_18: "R-18",
      R_18G: "R-18G",
    },
  },

  settings: {
    content_rating: {
      section_title: "Content rating",
      section_description:
        "Baseline ratings are always on. Opt in to age-restricted tiers to see them in search and listings.",
      always_on: "Always on",
      saved: "Preferences saved.",
      description: {
        R_18: "Adult content.",
        R_18G: "Explicit adult content.",
      },
      opt_in_modal: {
        title: "Confirm age-restricted content",
        body: "By enabling {{rating}} you confirm you are of legal age in your jurisdiction and consent to viewing this content.",
        confirm: "I confirm",
      },
    },
  },

  pinboard: {
    empty: {
      title: "No entries yet",
      description: "When entries are added they will appear here.",
    },
    error: {
      title: "Failed to load",
      description: "Please try again in a moment.",
    },
    entry: {
      untitled: "Untitled",
      stale: "Stale",
      language: "Language: {{lang}}",
    },
    pinned: {
      region: "Pinned posts",
      heading: "Pinned",
    },
    reorder: {
      list: "Reorderable pinboard entries",
      drag_handle: "Drag handle for {{title}}",
      conflict:
        "The list changed since you started dragging. The latest order has been loaded.",
      error: "Reorder failed: {{error}}",
    },
    stale: {
      title: "Some pinned entries no longer exist",
      description_one: "{{count}} entry is stale.",
      description_other: "{{count}} entries are stale.",
      description: "{{count}} entries are stale.",
      cleanup: "Clean up",
      cleanup_done: "Stale entries cleaned up.",
      cleanup_partial:
        "{{failed}} of {{total}} stale entries failed to clean up.",
    },
    admin: {
      title: "Pinboards",
      tabs_aria: "Pinboard types",
      tabs: {
        announcement: "Announcements",
        pinboard: "Pinboard",
      },
      create: "New entry",
      delete_title: "Delete entry",
      delete_description:
        'This will remove "{{title}}" from the pinboard. This action cannot be undone.',
      delete_done: "Entry deleted.",
      delete_failed: "Delete failed: {{error}}",
    },
    editor: {
      title_create: "Create entry",
      title_edit: "Edit entry",
      language_tabs_aria: "Translation languages",
      default_language: "Default language",
      add_language: "Add language",
      remove_language: "Remove {{lang}}",
      no_active_language: "Select a language to edit.",
      saved: "Saved.",
      created: "Created.",
      discard_title: "Discard changes?",
      discard_description:
        "You have unsaved changes. Leaving will discard them.",
      discard_confirm: "Discard",
      fields: {
        title: "Title",
        subtitle: "Subtitle",
        summary: "Summary",
        body: "Body",
      },
      errors: {
        missing_default_title: "Title is required for the default language.",
        save_failed: "Save failed: {{error}}",
      },
    },
  },
};
