import { realmTagTreeApi } from "./realm-tag-tree.api";
import { realmTagTreeKeys } from "./realm-tag-tree.keys";

export const realmTagTreeQuery = (realmId: string) => ({
  queryKey: realmTagTreeKeys.detail(realmId),
  queryFn: () => realmTagTreeApi.get(realmId),
});
