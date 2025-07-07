export default {
    title: "ICS",
    motto: "继承 创造 传播",

    // Navigation & Menu
    navigation: {
        main_items: "主要项目",
        home: "首页",
        books: "图书",
        book: "书籍",
        analytics: "分析",
        auth: "认证",
        login: "登录",
        register: "注册",
        book_edit: "编辑书籍",
        book_edit_main: "书籍主要编辑",
        book_edit_chapter: "章节编辑",
        test: "测试",
        back_to_main: "返回主页",
        book_editor_navigation: "书籍编辑器导航",
        profile: "个人资料",
        settings: "设置",
        logout: "登出",
    },

    // Authentication
    auth: {
        login: "登录",
        logout: "登出",
        register: "注册",
        resolve: "解决",
        already_login: "您已经登录。重新登录将覆盖之前的登录信息。",
        error: {
            invalid_email: "无效的邮箱地址。",
            invalid_password: "密码必须至少包含6个字符。",
            invalid_username: "无效的用户名。",
            invalid_confirm: "无效的密码确认。",
            passwords_mismatch: "密码不匹配。",
        },
    },

    // Common UI Elements
    common: {
        email: "邮箱",
        password: "密码",
        confirm: "确认密码",
        username: "用户名",
        back: "返回",
        home: "首页",
        cancel: "取消",
        submit: "提交",
        save: "保存",
        delete: "删除",
        edit: "编辑",
        add: "添加",
        remove: "移除",
        create: "创建",
        update: "更新",
        search: "搜索",
        expand: "展开",
        collapse: "折叠",
        reply: "回复",
        close: "关闭",
        open: "打开",
    },

    // Pages
    pages: {
        not_found: "页面未找到",
        book_tag_edit: "书籍标签编辑",
        book_description_edit: "书籍描述编辑",
        book_edit_page: "书籍编辑页面",
        long_review_page: "长篇评论页面",
        long_review_edit_page: "长篇评论编辑页面",
        short_review_page: "短评页面",
        book_collection_list_page: "书籍收藏列表页面",
        book_list_edit_page: "书单编辑页面",
    },

    // Form & Editor
    editor: {
        bold: "粗体",
        italic: "斜体",
        heading: "标题",
        quote: "引用",
        generic_list: "列表",
        numbered_list: "编号列表",
        create_link: "创建链接",
        insert_image: "插入图片",
        insert_table: "插入表格",
        toggle_preview: "切换预览",
        toggle_side_by_side: "切换并排",
        markdown_guide: "Markdown指南",
    },

    // Placeholders & Labels
    placeholders: {
        search_books: "搜索图书",
        chapter_title: "请输入章节标题",
    },

    // Chapters & Books
    chapters: {
        new_chapter: "新章节",
        expand: "展开",
        collapse: "折叠",
    },

    // Accessibility Labels
    accessibility: {
        favorite: "收藏",
        comments: "评论",
        collection: "收藏夹",
        search: "搜索",
        close: "关闭",
        open_drawer: "打开侧边栏",
    },

    test: {
        fn: (name: string) => `你好，${name}！`,
    },
};
