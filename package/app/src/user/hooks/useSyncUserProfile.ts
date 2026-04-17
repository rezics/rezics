import { userQueries } from "@rezics/api/user/user.queries";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useUserProfileStore } from "@/user/states";

/**
 * Subscribes to the `me` query and syncs its data into the Zustand
 * profile store whenever the query result changes (e.g. after an
 * update-profile mutation invalidates the cache).
 *
 * Call once in a top-level layout component.
 */
export function useSyncUserProfile() {
  const setUser = useUserProfileStore((s) => s.setUser);
  const { data } = useQuery(userQueries.me());

  useEffect(() => {
    if (data) {
      setUser(data);
    }
  }, [data, setUser]);
}
