import type { ReactNode } from "react";
import RealmPage from "./page";
import RealmPostsPage from "./posts/page";
import RealmRulesPage from "./rules/page";
import RealmSearchPage from "./search/page";
import RealmShelvesPage from "./shelves/page";
import RealmTagsPage from "./tags/page";
import RealmWikiPage from "./wiki/page";

function Frame({ children }: { readonly children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">{children}</div>;
}

export default {
  DefaultPostsPlaceholder: (
    <Frame>
      <RealmPage />
    </Frame>
  ),
  ExplicitPostsPlaceholder: (
    <Frame>
      <RealmPostsPage />
    </Frame>
  ),
  ShelvesEmpty: (
    <Frame>
      <RealmShelvesPage />
    </Frame>
  ),
  TagsEmpty: (
    <Frame>
      <RealmTagsPage />
    </Frame>
  ),
  WikiEmpty: (
    <Frame>
      <RealmWikiPage />
    </Frame>
  ),
  RulesEmpty: (
    <Frame>
      <RealmRulesPage />
    </Frame>
  ),
  SearchInitial: (
    <Frame>
      <RealmSearchPage />
    </Frame>
  ),
  NarrowSearchInitial: (
    <div className="max-w-80">
      <Frame>
        <RealmSearchPage />
      </Frame>
    </div>
  ),
};
