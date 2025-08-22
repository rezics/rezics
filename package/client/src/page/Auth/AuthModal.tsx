import { Dialog, DialogContent } from "@mui/material";
import { type FC, useState } from "react";
import { LoginShow, type LoginShowProps } from "./LoginPage.tsx";
import { RegisterShow, type RegisterShowProps } from "./RegisterPage.tsx";

export interface AuthModalProps {
	open: boolean;
	onClose: () => void;
	initialMode?: "login" | "register";
}

/**
 * AuthModal - 认证模态框组件
 * 可以在登录和注册之间切换
 */
export const AuthModal: FC<AuthModalProps> = ({
	open,
	onClose,
	initialMode = "login",
}) => {
	const [mode, setMode] = useState<"login" | "register">(initialMode);

	const handleLoginSubmit: LoginShowProps["onSubmit"] = async (event) => {
		event.preventDefault();
		// TODO: Implement login logic
		console.log("Login submitted from modal");
		// onClose(); // Close modal on successful login
	};

	const handleRegisterSubmit: RegisterShowProps["onSubmit"] = async (
		event,
	) => {
		event.preventDefault();
		// TODO: Implement register logic
		console.log("Register submitted from modal");
		// onClose(); // Close modal on successful registration
	};

	const switchToRegister = () => setMode("register");
	const switchToLogin = () => setMode("login");

	return (
		<Dialog
			open={open}
			onClose={onClose}
			maxWidth="sm"
			fullWidth
		>
			<DialogContent className="p-0">
				{mode === "login"
					? (
						<LoginShow
							loading={false}
							onSubmit={handleLoginSubmit}
							onRegisterClick={switchToRegister}
							isModal={true}
						/>
					)
					: (
						<RegisterShow
							loading={false}
							onSubmit={handleRegisterSubmit}
							onLoginClick={switchToLogin}
							isModal={true}
						/>
					)}
			</DialogContent>
		</Dialog>
	);
};
