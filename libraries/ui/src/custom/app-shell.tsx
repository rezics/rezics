import type { CSSProperties, ElementType, ReactNode } from "react";

import {
	BottomNavigation,
	BottomNavigationItem,
	BottomNavigationItemIcon,
	BottomNavigationItemLabel,
	BottomNavigationList,
} from "../ui/bottom-navigation";
import { NativeSelect, NativeSelectOption } from "../ui/native-select";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
} from "../ui/sidebar";

export type AppShellIcon = ElementType<{
	className?: string;
	"aria-hidden"?: boolean;
}>;

export interface AppShellNavigationItem {
	href: string;
	label: string;
	icon: AppShellIcon;
}

export interface AppShellAction {
	href: string;
	label: string;
	icon?: AppShellIcon;
}

function isCurrentPath(currentPath: string, href: string) {
	return href === "/" ? currentPath === href : currentPath.startsWith(href);
}

export function AppShell({
	children,
	brand,
	navigation,
	mobileNavigation,
	currentPath,
	link,
	search,
	locale,
	create,
	account,
	utilities,
	rightRail,
	secondaryNavigation,
}: {
	children: ReactNode;
	brand?: ReactNode;
	navigation: readonly AppShellNavigationItem[];
	mobileNavigation?: readonly AppShellNavigationItem[];
	currentPath: string;
	link: ElementType;
	search: AppShellAction & { icon: AppShellIcon };
	locale: {
		label: string;
		value: string;
		options: readonly { value: string; label: string }[];
		onChange: (value: string) => void | Promise<void>;
	};
	create?: AppShellAction;
	account: AppShellAction & { mobileLabel?: string };
	utilities?: ReactNode;
	rightRail?: ReactNode;
	secondaryNavigation?: ReactNode;
}) {
	const Link = link;
	const SearchIcon = search.icon;
	const CreateIcon = create?.icon;
	const AccountIcon = account.icon;
	const mobileItems = mobileNavigation ?? navigation.slice(0, 4);
	const selectedMobileValue = [...mobileItems, ...(create ? [create] : []), account].find(
		({ href }) => isCurrentPath(currentPath, href),
	)?.href;

	return (
		<SidebarProvider
			className="min-h-svh bg-background pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0"
			style={
				{
					"--sidebar-width": "15rem",
					"--sidebar-width-icon": "4.75rem",
				} as CSSProperties
			}
		>
			<Sidebar collapsible="icon">
				<SidebarHeader>
					{brand && (
						<Link className="flex h-11 items-center gap-3 px-1" href="/">
							{brand}
							<span className="font-heading text-lg font-black tracking-tight group-data-[collapsible=icon]:hidden">
								REZICS
							</span>
						</Link>
					)}
				</SidebarHeader>
				<SidebarContent>
					<SidebarGroup>
						<SidebarMenu>
							{navigation.map(({ href, label, icon: Icon }) => (
								<SidebarMenuItem key={href}>
									<SidebarMenuButton
										asChild
										isActive={isCurrentPath(currentPath, href)}
										size="lg"
										tooltip={label}
									>
										<Link href={href} title={label}>
											<Icon aria-hidden={true} className="size-5" />
											<span>{label}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroup>
					{secondaryNavigation && (
						<SidebarGroup className="hidden xl:flex">
							<SidebarGroupContent>{secondaryNavigation}</SidebarGroupContent>
						</SidebarGroup>
					)}
				</SidebarContent>
				<SidebarFooter>
					{create && (
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton asChild size="lg" tooltip={create.label}>
									<Link href={create.href} title={create.label}>
										{CreateIcon && (
											<CreateIcon aria-hidden={true} className="size-5" />
										)}
										<span>{create.label}</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					)}
					<div className="hidden items-center gap-2 px-2 xl:flex">
						{utilities}
						<NativeSelect
							aria-label={locale.label}
							className="min-w-0 flex-1"
							onChange={(event) => void locale.onChange(event.currentTarget.value)}
							size="sm"
							value={locale.value}
						>
							{locale.options.map((option) => (
								<NativeSelectOption key={option.value} value={option.value}>
									{option.label}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</div>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton asChild size="lg" tooltip={account.label}>
								<Link href={account.href}>
									{AccountIcon && (
										<AccountIcon aria-hidden={true} className="size-5" />
									)}
									<span>{account.label}</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarFooter>
				<SidebarRail />
			</Sidebar>

			<div className="min-w-0 flex-1">
				<header className="bg-background/92 sticky top-0 z-40 border-b backdrop-blur-xl md:hidden">
					<div className="flex h-14 items-center gap-3 px-4">
						{brand && (
							<Link className="flex items-center" href="/" aria-label="Home">
								{brand}
							</Link>
						)}
						<Link
							className="bg-muted text-muted-foreground flex h-9 flex-1 items-center gap-2 rounded-full px-3 text-sm"
							href={search.href}
						>
							<SearchIcon aria-hidden={true} className="size-4" />
							<span className="truncate">{search.label}</span>
						</Link>
						{utilities}
					</div>
				</header>

				<div className="mx-auto grid min-h-svh w-full max-w-[77rem] xl:grid-cols-[minmax(0,54rem)_minmax(19rem,1fr)]">
					<div className="min-w-0 xl:border-e">
						<header className="bg-background/92 sticky top-0 z-30 hidden h-16 items-center border-b px-5 backdrop-blur-xl md:flex">
							<Link
								className="bg-muted text-muted-foreground mx-auto flex h-10 w-full max-w-md items-center gap-2 rounded-full px-4 text-sm"
								href={search.href}
							>
								<SearchIcon aria-hidden={true} className="size-4" />
								{search.label}
							</Link>
						</header>
						{children}
					</div>

					<aside className="sticky top-0 hidden h-svh overflow-y-auto xl:block">
						<div className="flex h-16 items-center justify-end gap-2 border-b px-5">
							{utilities}
						</div>
						<div className="p-5">{rightRail}</div>
					</aside>
				</div>

				<BottomNavigation className="contents md:hidden" value={selectedMobileValue}>
					<BottomNavigationList aria-label="Primary navigation">
						{mobileItems.slice(0, 2).map((item) => (
							<MobileNavigationItem item={item} key={item.href} link={Link} />
						))}
						{create ? (
							<BottomNavigationItem
								asChild
								className="text-primary"
								value={create.href}
							>
								<Link href={create.href}>
									<BottomNavigationItemIcon className="-mt-5">
										<span className="bg-primary text-primary-foreground grid size-12 place-items-center rounded-full border-4 border-background shadow-sm">
											{CreateIcon && (
												<CreateIcon aria-hidden={true} className="size-5" />
											)}
										</span>
									</BottomNavigationItemIcon>
									<BottomNavigationItemLabel>
										{create.label}
									</BottomNavigationItemLabel>
								</Link>
							</BottomNavigationItem>
						) : (
							mobileItems[2] && (
								<MobileNavigationItem item={mobileItems[2]} link={Link} />
							)
						)}
						{create && mobileItems[2] && (
							<MobileNavigationItem item={mobileItems[2]} link={Link} />
						)}
						<BottomNavigationItem asChild value={account.href}>
							<Link href={account.href}>
								<BottomNavigationItemIcon>
									{AccountIcon ? (
										<AccountIcon aria-hidden={true} className="size-5" />
									) : (
										<span className="grid size-5 place-items-center rounded-full border text-[9px] font-bold">
											R
										</span>
									)}
								</BottomNavigationItemIcon>
								<BottomNavigationItemLabel>
									{account.mobileLabel ?? account.label}
								</BottomNavigationItemLabel>
							</Link>
						</BottomNavigationItem>
					</BottomNavigationList>
				</BottomNavigation>
			</div>
		</SidebarProvider>
	);
}

function MobileNavigationItem({
	item: { href, label, icon: Icon },
	link: Link,
}: {
	item: AppShellNavigationItem;
	link: ElementType;
}) {
	return (
		<BottomNavigationItem asChild value={href}>
			<Link href={href}>
				<BottomNavigationItemIcon>
					<Icon aria-hidden={true} className="size-5" />
				</BottomNavigationItemIcon>
				<BottomNavigationItemLabel>{label}</BottomNavigationItemLabel>
			</Link>
		</BottomNavigationItem>
	);
}
