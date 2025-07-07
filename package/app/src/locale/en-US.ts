import zhCN from "./zh-CN";

export default {
    title: "ICS",
    motto: "Inherited Create Spread",
    
    // Navigation & Menu
    navigation: {
        main_items: "Main Items",
        home: "Home",
        books: "Books",
        book: "Book",
        analytics: "Analytics",
        auth: "Auth",
        login: "Login",
        register: "Register",
        book_edit: "Book Edit",
        book_edit_main: "Book Edit Main",
        book_edit_chapter: "Book Edit Chapter",
        test: "Test",
        back_to_main: "Back to Main",
        book_editor_navigation: "Book Editor Navigation",
        profile: "Profile",
        settings: "Settings",
        logout: "Logout",
    },
    
    // Authentication
    auth: {
        login: "Login",
        logout: "Logout",
        register: "Register",
        resolve: "Resolve",
        already_login: "You have already logged in. Re-login will overwrite the previous login information.",
        error: {
            invalid_email: "Invalid email address.",
            invalid_password: "Password must be at least 6 characters long.",
            invalid_username: "Invalid username.",
            invalid_confirm: "Invalid password confirmation.",
            passwords_mismatch: "Passwords do not match.",
        },
    },
    
    // Common UI Elements
    common: {
        email: "Email",
        password: "Password",
        confirm: "Confirm Password",
        username: "Username",
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
        update: "Update",
        search: "Search",
        expand: "Expand",
        collapse: "Collapse",
        reply: "Reply",
        close: "Close",
        open: "Open",
    },
    
    // Pages
    pages: {
        not_found: "Page Not Found",
        book_tag_edit: "Book Tag Edit",
        book_description_edit: "Book Description Edit",
        book_edit_page: "Book Edit Page",
        long_review_page: "Long Review Page",
        long_review_edit_page: "Long Review Edit Page",
        short_review_page: "Short Review Page",
        book_collection_list_page: "Book Collection List Page",
        book_list_edit_page: "Book List Edit Page",
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
    },
    
    // Chapters & Books
    chapters: {
        new_chapter: "New Chapter",
        expand: "Expand",
        collapse: "Collapse",
    },
    
    // Accessibility Labels
    accessibility: {
        favorite: "Favorite",
        comments: "Comments",
        collection: "Collection",
        search: "Search",
        close: "Close",
        open_drawer: "Open drawer",
    },
} satisfies typeof zhCN;
