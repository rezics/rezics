import zhCN from "./zh-CN";

export default {
    title: "ICS",
    motto: "Inherited Create Spread",
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
    common: {
        email: "Email",
        password: "Password",
        confirm: "Confirm Password",
        username: "Nickname",
    },
} satisfies typeof zhCN;
