import { redirectToAuthPortal, type AuthRouteSearchParams } from "@/features/auth/auth-route";

export default function RegisterPage({ searchParams }: { searchParams: AuthRouteSearchParams }) {
	return redirectToAuthPortal("register", searchParams);
}
