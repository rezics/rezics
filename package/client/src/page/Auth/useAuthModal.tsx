import { useState } from "react";
import { AuthModal, type AuthModalProps } from "./AuthModal.tsx";

/**
 * useAuthModal - Hook for managing auth modal state
 */
export const useAuthModal = (initialMode: "login" | "register" = "login") => {
	const [isOpen, setIsOpen] = useState(false);
	const [mode, setMode] = useState<"login" | "register">(initialMode);

	const openLogin = () => {
		setMode("login");
		setIsOpen(true);
	};

	const openRegister = () => {
		setMode("register");
		setIsOpen(true);
	};

	const close = () => {
		setIsOpen(false);
	};

	return {
		isOpen,
		mode,
		openLogin,
		openRegister,
		close,
		AuthModal: (
			props: Omit<AuthModalProps, "open" | "onClose" | "initialMode">,
		) => (
			<AuthModal
				{...props}
				open={isOpen}
				onClose={close}
				initialMode={mode}
			/>
		),
	};
};
