import zhCN from "./zh-CN";

export default {
    title: "ICS",
    motto: "繼承 創造 傳播",
    auth: {
        login: "登錄",
        logout: "登出",
        register: "註冊",
        resolve: "解決",
        already_login: "您已經登錄。重新登錄將覆蓋之前的登錄信息。",
        error: {
            invalid_email: "無效的郵箱地址。",
            invalid_password: "密碼必須至少包含6個字符。",
            invalid_username: "無效的用戶名。",
            invalid_confirm: "無效的密碼確認。",
            passwords_mismatch: "密碼不匹配。",
        },
    },
    common: {
        email: "郵箱",
        password: "密碼",
        confirm: "確認密碼",
        username: "用戶名",
    },
} satisfies typeof zhCN;