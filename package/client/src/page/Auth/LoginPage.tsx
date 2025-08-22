import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { type FC, useState } from "react";
import type React from "react";
import { useTranslation } from "react-i18next";
import { string, z } from "zod";
import { login } from "./lib/handler.ts";
import { Layout } from "./lib/Layout.tsx";
import { ModalLayout } from "./lib/ModalLayout.tsx";

export interface LoginShowProps {
    loading: boolean;
    error?: string;
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    showAlreadyLoggedIn?: boolean;
    hideActions?: boolean;
    onRegisterClick?: () => void;
    isModal?: boolean;
}

/**
 * LoginShow - 登录表单展示组件
 * 可以在页面布局中使用，也可以在 Modal 中展示
 */
export const LoginShow: FC<LoginShowProps> = ({
    loading,
    error,
    onSubmit,
    showAlreadyLoggedIn = false,
    hideActions = false,
    onRegisterClick,
    isModal = false,
}) => {
    const { t } = useTranslation();

    const content = (
        <>
            {showAlreadyLoggedIn && (
                <Alert severity="warning">
                    {t("auth.already_login")}
                </Alert>
            )}
            {error && (
                <Alert severity="error">
                    {error}
                    <br />
                    <Button
                        variant="text"
                        type="button"
                        onClick={() => {/* TODO: handle resolve */}}
                    >
                        {t("auth.resolve")}
                    </Button>
                </Alert>
            )}
            <TextField
                name="email"
                type="email"
                label={t("common.email")}
                variant="standard"
                required
            />
            <TextField
                name="password"
                type="password"
                label={t("common.password")}
                variant="standard"
                required
            />
        </>
    );

    const actions = !hideActions && (
        <>
            <Button
                variant="text"
                type="button"
                onClick={onRegisterClick}
            >
                {t("auth.register")}
            </Button>
            <Button
                type="submit"
                variant="contained"
                disabled={loading}
            >
                {loading ? "Loading..." : t("auth.login")}
            </Button>
        </>
    );

    const LayoutComponent = isModal ? ModalLayout : Layout;

    return (
        <LayoutComponent
            title={t("auth.login")}
            onSubmit={onSubmit}
            content={content}
            actions={actions}
        />
    );
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LoginPageProps {}

/**
 * LoginPage - 完整的登录页面容器
 * 包含状态管理和表单处理逻辑
 */
export const LoginPage: FC<LoginPageProps> = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();
    const { t } = useTranslation();

    const handleSubmit = async (
        event: React.FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();
        setLoading(true);
        setError(undefined);

        const form = event.currentTarget as HTMLFormElement;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = new FormData();
        // TODO: Remove hardcoded values
        // data.append("email", "test@test.com");
        // data.append("password", "123456");

        try {
            const { error: e_email, data: _email } = z.string().email().safeParse(
                data.get("email"),
            );
            if (e_email) throw new Error(t("auth.error.invalid_email"));

            const { error: e_password, data: _password } = string()
                .min(1)
                .safeParse(data.get("password"));
            if (e_password) {
                throw new Error(t("auth.error.invalid_password"));
            }

            await login(_email, _password);
            // TODO: Handle successful login (redirect, etc.)
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterClick = () => {
        // TODO: Navigate to register page
        window.location.href = "/register";
    };

    return (
        <LoginShow
            loading={loading}
            error={error}
            onSubmit={handleSubmit}
            onRegisterClick={handleRegisterClick}
        />
    );
};
