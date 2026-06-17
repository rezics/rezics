import { createFileRoute } from "@tanstack/react-router";
import { realmStreamSearchForSingleTag, useRealmDetail } from "@/realm";
import { RealmTagBrowser } from "@/realm/components/RealmTagBrowser";

export const Route = createFileRoute(
  "/_mainLayout/realm/$realmId/_detail/tags",
)({
  component: () => {
    const { realmId, tagTree, tagTreeDisplayNames } = useRealmDetail();
    const navigate = Route.useNavigate();
    return (
      <RealmTagBrowser
        realmId={realmId}
        tagTree={tagTree}
        displayNames={tagTreeDisplayNames}
        onTagSelect={(selection) =>
          navigate({
            to: "/realm/$realmId",
            params: { realmId },
            search: realmStreamSearchForSingleTag(
              {},
              selection.tagId,
              selection.querySource,
            ),
          })
        }
      />
    );
  },
});
