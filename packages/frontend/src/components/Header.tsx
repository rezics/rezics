"use client";

import { authClient } from "@/lib/auth-client";
import { BookOpenIcon, BellIcon, PlusIcon, SearchIcon, UserIcon } from "lucide-react";
import Link from "next/link";

export function Header() {
  const { data: session } = authClient.useSession();

  return (
    <header className="border-border bg-background sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
        <Link className="flex shrink-0 items-center gap-2 font-bold" href="/">
          <BookOpenIcon className="size-5" />
          <span>rezics</span>
        </Link>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <Link
            className="text-muted-foreground hover:text-foreground inline-flex size-9 items-center justify-center rounded-md"
            href="/search"
          >
            <SearchIcon className="size-4" />
          </Link>

          {session ? (
            <>
              <Link
                className="bg-primary text-primary-foreground inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium"
                href="/create"
              >
                <PlusIcon className="size-4" />
              </Link>
              <Link
                className="text-muted-foreground hover:text-foreground inline-flex size-9 items-center justify-center rounded-md"
                href="/inbox"
              >
                <BellIcon className="size-4" />
              </Link>
              <Link
                className="text-muted-foreground hover:text-foreground inline-flex size-9 items-center justify-center rounded-md"
                href="/user/me"
              >
                <UserIcon className="size-4" />
              </Link>
            </>
          ) : (
            <Link
              className="bg-primary text-primary-foreground inline-flex h-8 items-center rounded-md px-3 text-sm font-medium"
              href="/api/auth/signin"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
