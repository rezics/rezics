import { redirectToAuthPortal, type AuthRouteSearchParams } from "@/features/auth/auth-route";

export default function LoginPage({ searchParams }: { searchParams: AuthRouteSearchParams }) {
	return redirectToAuthPortal("login", searchParams);
}
