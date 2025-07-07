import zhCN from "./zh-CN";

export default {
    title: "ICS",
    motto: "Erben Erschaffen Verbreiten",
    auth: {
        login: "Anmelden",
        logout: "Abmelden",
        register: "Registrieren",
        resolve: "Lösen",
        already_login: "Sie sind bereits angemeldet. Eine erneute Anmeldung überschreibt die vorherigen Anmeldeinformationen.",
        error: {
            invalid_email: "Ungültige E-Mail-Adresse.",
            invalid_password: "Das Passwort muss mindestens 6 Zeichen lang sein.",
            invalid_username: "Ungültiger Benutzername.",
            invalid_confirm: "Ungültige Passwort-Bestätigung.",
            passwords_mismatch: "Passwörter stimmen nicht überein.",
        },
    },
    common: {
        email: "E-Mail",
        password: "Passwort",
        confirm: "Passwort bestätigen",
        username: "Benutzername",
    },
} satisfies typeof zhCN;