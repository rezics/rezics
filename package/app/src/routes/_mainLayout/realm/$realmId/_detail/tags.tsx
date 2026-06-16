import { createFileRoute } from "@tanstack/react-router";
import { realmStreamSearchForSingleTag, useRealmDetail } from "@/realm";
import { RealmTagBrowser } from "@/realm/components/RealmTagBrowser";

export const Route = createFileRoute(
  "/_mainLayout/realm/$realmId/_detail/tags",
)({
  component: () => {
    const { realmId, realm, tagTree } = useRealmDetail();
    const navigate = Route.useNavigate();
    return (
      <RealmTagBrowser
        realmId={realmId}
        tagTree={tagTree}
        tagView={realm.extra?.tagView ?? null}
        onTagSelect={(tagId) =>
          navigate({
            to: "/realm/$realmId",
            params: { realmId },
            search: realmStreamSearchForSingleTag({}, tagId),
          })
        }
      />
    );
  },
});
