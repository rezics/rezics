import zhCN from "./zh-CN";

export default {
    title: "ICS",
    motto: "継承 創造 伝播",
    auth: {
        login: "ログイン",
        logout: "ログアウト",
        register: "登録",
        resolve: "解決",
        already_login: "既にログインしています。再ログインすると、以前のログイン情報が上書きされます。",
        error: {
            invalid_email: "無効なメールアドレスです。",
            invalid_password: "パスワードは少なくとも6文字である必要があります。",
            invalid_username: "無効なユーザー名です。",
            invalid_confirm: "無効なパスワード確認です。",
            passwords_mismatch: "パスワードが一致しません。",
        },
    },
    common: {
        email: "メール",
        password: "パスワード",
        confirm: "パスワード確認",
        username: "ユーザー名",
    },
} satisfies typeof zhCN;