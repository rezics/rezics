export default {
  title: 'REZICS',
  motto: 'Inherited Create Spread',

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
    no_metadata: 'No metadata',
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
  },

  // Readlist
  readlist: {
    featured: 'Featured reading lists',
    includes_books: 'Includes {{count}} books',
    includes_reviews: 'Includes {{count}} reviews',
    includes_reviews_one: '{{count}} short review',
    includes_reviews_other: '{{count}} short reviews',
  },

  // Review
  review: {
    hot: 'Hot reviews',
    top_rated_short_reviews: 'Top-rated short reviews',
    short_review: 'Review',
  },

  // Quote
  quote: {
    title: 'Quotes',
    subtitle:
      'A brushstroke stirs wind and rain; a poem moves gods and ghosts to tears.',
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
