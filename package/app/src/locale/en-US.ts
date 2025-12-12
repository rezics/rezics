export default {
  title: 'REZICS',
  motto: 'Inherited Create Spread',

  layout: {
    footer: {
      brand: {
        description:
          'A comprehensive library of works for the digital era—helping people find the books they seek, and letting stories meet the right readers.',
        slogan: 'inherited·create·spread',
      },
      social: {
        aria: 'Social links',
        github: 'GitHub',
        telegram: 'Telegram',
      },
      product: {
        aria: 'Product',
        title: 'Product',
        discover: 'Discover',
        readlist: 'Readlists',
        reviews: 'Reviews & Ratings',
        search: 'Search',
      },
      resources: {
        aria: 'Resources',
        title: 'Resources',
        docs: 'Docs',
        api: 'API',
        changelog: 'Changelog',
        status: 'System status',
      },
      newsletter: {
        title: 'Subscribe for updates',
        description:
          'Get the latest features and curated readlist picks. (In development)',
        email_placeholder: 'Your email',
        email_aria: 'Email',
        submit: 'Subscribe',
      },
      copyright: '© {{year}} REZICS · All rights reserved',
      legal: {
        privacy: 'Privacy',
        terms: 'Terms',
        contact: 'Contact us',
      },
    },
  },

  pages: {
    review_page: 'Review Page',
    unit_page: 'Unit',
    book_collection_list_page: 'Reading lists containing this book',
  },

  page: {
    home: {
      name: 'Home',
      hero: {
        kicker: 'Library Book',
        title_highlight: 'Meet the stories you love',
        subtitle:
          'Search for books you want, and discover high-quality reading lists, short reviews, and quotes.',
      },
      quick_access: {
        title_quick_entry: 'Quick access',
        title_fast_explore: 'Fast explore',
        title_quick_explore: 'Quick explore',
      },
      mobile: {
        search_placeholder: 'Search title, author, ISBN...',
        floating_status: {
          browsing_recommendations: 'Browsing home recommendations',
          beta_experimental: 'Beta · Experimental features',
        },
      },
      noticeboard: {
        caption: 'Notice',
        title: 'Noticeboard',
        empty: 'No notices',
        alert: {
          parse_failed: 'Noticeboard data parsing failed: {{error}}',
        },
        tag: {
          notice: 'Notice',
          announcement: 'Announcement',
          event: 'Event',
          update: 'Update',
        },
        time: {
          just_now: 'Just now',
          hours_ago_one: '{{count}} hour ago',
          hours_ago_other: '{{count}} hours ago',
          days_ago_one: '{{count}} day ago',
          days_ago_other: '{{count}} days ago',
          weeks_ago_one: '{{count}} week ago',
          weeks_ago_other: '{{count}} weeks ago',
        },
      },
      discovery: {
        recommended_for_you: 'Recommended for you',
        recommendations: 'Recommendations',
        meili_subtitle: 'Real-time recommendations powered by Meilisearch',
        featured_readlists_subtitle: 'Go create your own reading list',
        top_rated_reviews_subtitle: 'See what everyone’s been talking about',
      },
      sections: {
        trending_wiki: 'Trending Wiki',
        trending_reviews: 'Trending Reviews',
        tag_explore: 'Tag Explore',
        readlist_recommendation: 'Reading List Picks',
        ranking: 'Rankings',
        partner_brands: 'Partners',
        new_book_recommendations: 'New Book Picks',
        editor_picks: "Editor's Picks",
        author_spotlight: 'Author Spotlight',
        wiki_teaser_placeholder:
          'Entry teaser placeholder: includes author, publication info, topic tags, and more.',
        review_teaser_placeholder:
          '“This book made me rethink… (sample placeholder review)”',
        promotion_item_1: "Platform notice: this week's new version is live",
        promotion_item_2: 'Book fair event: Autumn Reading Festival',
        promotion_item_3: 'Limited-time offer: featured reading lists 20% off',
        newsletter: {
          title: 'Subscribe for updates',
          thanks: 'Thanks for subscribing!',
          email_placeholder: 'Enter your email',
          submit: 'Subscribe',
        },
      },
    },
    book: {
      tabs: {
        basic_info: 'Basic info',
        reviews: 'Reviews',
        toc: 'Contents',
      },
    },
    book_edit: {
      info: {
        title: 'Book editor',
        dialog: {
          view_book: 'View book',
        },
        toast: {
          create_success_title: 'Book created',
          create_success_message:
            'Book created successfully. The detail page may need a few minutes / a manual refresh to show the latest content.',
          create_failed_title: 'Create book failed',
          update_success_title: 'Book updated',
          update_success_message:
            'Book updated successfully. The detail page may need a few minutes / a manual refresh to show the latest content.',
          update_failed_title: 'Update book failed',
        },
        validation: {
          publish_url_required:
            'Please add at least one valid publish URL (starting with https://), e.g. a Qidian book page URL.',
        },
      },
    },
    readlist: {
      loading: 'Loading...',
      not_found: 'Readlist not found',
      open_user_ui: 'Open user UI',
      likes_comments: 'Likes & comments',
      no_reviews: 'No reviews',
      comments: 'Comments',
      meta_info: 'Meta',
      title_label: 'Readlist title',
      summary_label: 'Readlist summary',
      cover_label: 'Cover URL',
      add_review: 'Add review',
      paste_review_input_label: 'Paste review URL or ID (/review/:unitId)',
      search_review_label: 'Search reviews (keyword)',
      search_button: 'Search',
      searching: 'Searching...',
      add_button: 'Add',
      current_reviews_title: 'Current reviews (sortable & deletable)',
      no_reviews_small: 'No reviews',
      edit_readlist: 'Edit readlist',
      back: 'Back',
      submit: 'Submit',
      delete: 'Delete',
      new_readlist: 'New readlist',
      like_tooltip: 'Like',
      favorite_tooltip: 'Favorite',
      books_count: '{{count}} books',
      reviews_count: '{{count}} reviews',
      move_up: 'Move up',
      move_down: 'Move down',
      update_success: 'Readlist updated',
      delete_success: 'Readlist deleted',
      delete_failed: 'Failed to delete readlist',
      untitled: '(Untitled)',
      list: {
        search_placeholder: 'Search readlists',
      },
    },
  },

  // Navigation & Menu
  navigation: {
    main_items: 'Main Items',
    home: 'Home',
    books: 'Books',
    book: 'Book',
    analytics: 'Analytics',
    auth: 'Auth',
    login: 'Login',
    register: 'Register',
    book_edit: 'Book Edit',
    book_edit_main: 'Book Edit Main',
    book_edit_chapter: 'Book Edit Chapter',
    test: 'Test',
    back_to_main: 'Back to Main',
    book_editor_navigation: 'Book Editor Navigation',
    profile: 'Profile',
    settings: 'Settings',
    logout: 'Logout',
  },

  // Authentication
  auth: {
    login: 'Login',
    logout: 'Logout',
    register: 'Register',
    resolve: 'Resolve',
    already_login:
      'You have already logged in. Re-login will overwrite the previous login information.',
    help: {
      slug: 'Username is globally unique.',
      slug_require: 'Only allow a-z, 0-9, A-Z, -, _',
      password_require: 'Password must be at least 8 characters long.',
    },
    error: {
      email_required: 'Email is required.',
      invalid_email: 'Invalid email address.',
      invalid_password: 'Password must be at least 6 characters long.',
      invalid_username: 'Invalid username.',
      invalid_confirm: 'Invalid password confirmation.',
      passwords_mismatch: 'Passwords do not match.',
    },
  },

  // ANCHOR User
  user: {
    open_profile: 'Open Profile',
  },

  // ANCHOR Unit
  unit: {
    no_content: 'No content',
    meta_data: 'Meta Data',
    no_metadata: 'No metadata',
  },

  units: {
    search_placeholder: 'Search units',
  },

  // Book
  book: {
    description: 'Description',
    chapters: 'Chapters',
    authorInfo: 'Author Info',
    tags: 'Tags',
    reviews: 'Reviews',
    collections: 'Collections',
    edit: 'Edit Book',
    add_to_collection: 'Add to Collection',
    new_releases: 'New arrivals',
    no_cover: 'No cover',
    unknown_author: 'Unknown author',
    toc: 'Contents',
    remark: 'Remark',
    quote_excerpts: 'Excerpts',
    reviews_of_book: 'Reviews for {{title}}',
    info_panel: {
      title: 'Book info',
    },
    fields: {
      title: 'Title',
      isbn: 'ISBN',
      cover_url: 'Cover URL',
      author: 'Author',
      press: 'Publisher',
      producer: 'Producer',
      text_length: 'Text length',
    },
    placeholders: {
      search_author: 'Search authors...',
      search_press: 'Search publishers...',
      search_producer: 'Search producers...',
    },
    flags: {
      nsfw: 'NSFW',
      licensed: 'Licensed',
    },
    tooltips: {
      nsfw: 'Please check this option if the book title or cover contains nudity, pornography, or other sensitive content.',
      licensed:
        'Please check this option if the book has been licensed (e.g. you are the copyright holder).',
    },
    edit_sections: {
      metadata: 'MetaData',
      extra: 'Extra',
    },
    chapter: {
      enable_drag: 'Enable drag',
      double_click_rename: 'Double-click rename',
      rename_help:
        'Renaming chapters here only affects the table-of-contents display and will not update the actual chapter title. To rename the chapter title, go to the chapter editor page; after changing the title there, the table of contents will update automatically.',
    },
    author_info: {
      author_line: 'Author: {{name}}',
      bio_label: 'Bio',
      description_label: 'Description',
    },
    description_editor: {
      title: 'Edit book description',
    },
    extra: {
      publish_urls: {
        title: 'Publish URLs',
      },
    },
  },

  search: {
    placeholders: {
      search_books: 'Search books',
    },
    tooltips: {
      nsfw: 'Whether to search for content that is not suitable for work',
      licensed: 'Whether to search for content that has been licensed',
    },
    pagination: {
      tips: 'Tips: The page number does not represent the total number of data, please click the last page to try to load more',
    },
  },

  // Readlist
  readlist: {
    featured: 'Featured reading lists',
    includes_books: 'Includes {{count}} books',
    includes_reviews: 'Includes {{count}} reviews',
    includes_reviews_one: '{{count}} short review',
    includes_reviews_other: '{{count}} short reviews',
    includes_book_title: 'Reading lists containing {{title}}',
    a11y: {
      book_review: 'Book review',
    },
  },

  // Review
  review: {
    hot: 'Hot reviews',
    top_rated_short_reviews: 'Top-rated short reviews',
    short_review: 'Review',
    open_user_interface: 'Open user profile',
    open_review_page: 'Open review page',
    a11y: {
      open_review_page: 'Open review page',
    },
    comments: 'Comments',
    form: {
      title: 'Title',
      rating: 'Rating',
    },
    messages: {
      update_success: 'Review updated successfully',
      delete_success: 'Review deleted successfully',
      rating_range_error: 'Rating must be between 0 and 10',
      failed_load: 'Failed to load review.',
    },
  },

  // Quote
  quote: {
    title: 'Quotes',
    subtitle:
      'A brushstroke stirs wind and rain; a poem moves gods and ghosts to tears.',
    not_found: 'Quote not found',
    excerpts_title: 'Quote Excerpts',
    form: {
      title: 'Title',
      source: 'Source',
    },
    updated_success: 'Quote updated successfully',
    messages: {
      update_failed: 'Update quote failed: {{error}}',
    },
  },

  // Tag
  tag: {
    loading: 'Loading tags...',
    load_failed: 'Load failed: {{error}}',
    ungrouped: 'Ungrouped',
    showing_top_tags: 'Showing top tags',
  },

  // Comment
  comment: {
    login_to_view: 'Please login to view comments',
  },

  // Common UI Elements
  common: {
    created_at: 'Created at',
    updated_at: 'Updated at',
    email: 'Email',
    password: 'Password',
    confirm: 'Confirm Password',
    username: 'Username',
    nickname: 'Nickname',
    back: 'Back',
    home: 'Home',
    cancel: 'Cancel',
    submit: 'Submit',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    remove: 'Remove',
    create: 'Create',
    update: 'Update',
    search: 'Search',
    expand: 'Expand',
    collapse: 'Collapse',
    reply: 'Reply',
    close: 'Close',
    open: 'Open',
    no_data: 'No data',
    view_more: 'View more',
    view_all: 'View all',
    pinned: 'Pinned',
    new: 'New',
    no_description: 'No description',
    loading: 'Loading...',
    submitting: 'Submitting...',
    error: 'Error',
    error_generic: 'Oh no...',
    unknown_error: 'Unknown error',
    expand_all: 'Expand all',
    collapse_all: 'Collapse all',
  },

  // Form & Editor
  editor: {
    bold: 'Bold',
    italic: 'Italic',
    heading: 'Heading',
    quote: 'Quote',
    generic_list: 'Generic List',
    numbered_list: 'Numbered List',
    create_link: 'Create Link',
    insert_image: 'Insert Image',
    insert_table: 'Insert Table',
    toggle_preview: 'Toggle Preview',
    toggle_side_by_side: 'Toggle Side by Side',
    markdown_guide: 'Markdown Guide',
  },

  // Placeholders & Labels
  placeholders: {
    search_books: 'Search books',
    chapter_title: 'Enter chapter title',
    enter_search_term: 'Enter search term',
    enter_url: 'Enter URL',
  },

  // Chapters & Books
  chapters: {
    new_chapter: 'New Chapter',
    expand: 'Expand',
    collapse: 'Collapse',
  },

  // Accessibility Labels
  accessibility: {
    hot: 'Hot',
    favorite: 'Favorite',
    comments: 'Comments',
    collection: 'Collection',
    search: 'Search',
    close: 'Close',
    open_drawer: 'Open drawer',
  },
};
