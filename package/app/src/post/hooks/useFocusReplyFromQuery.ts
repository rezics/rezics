import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import type { ReplyComposerHandle } from "../forms/ReplyComposer";

/**
 * Reads `?focus=reply` from the URL. When present, focuses the attached
 * composer (caller wires the returned ref to its `<ReplyComposer>`), then
 * silently strips the query param without pushing history.
 */
export function useFocusReplyFromQuery() {
  const ref = useRef<ReplyComposerHandle>(null);
  const search = useSearch({ strict: false }) as
    | { focus?: string | null }
    | undefined;
  const navigate = useNavigate();

  useEffect(() => {
    if (search?.focus !== "reply") return;
    ref.current?.focus();
    navigate({
      to: ".",
      search: (prev) => ({ ...prev, focus: undefined }),
      replace: true,
    });
  }, [search?.focus, navigate]);

  return ref;
}
