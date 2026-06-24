import type { ReactNode } from "react";
import ZonePagesPage from "./pages/page";
import ZonePostsPage from "./posts/page";
import ZoneSearchPage from "./search/page";
import ZoneWikiPage from "./wiki/page";

function Frame({ children }: { readonly children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">{children}</div>;
}

export default {
  PagesEmpty: (
    <Frame>
      <ZonePagesPage />
    </Frame>
  ),
  PostsEmpty: (
    <Frame>
      <ZonePostsPage />
    </Frame>
  ),
  WikiEmpty: (
    <Frame>
      <ZoneWikiPage />
    </Frame>
  ),
  SearchInitial: (
    <Frame>
      <ZoneSearchPage />
    </Frame>
  ),
  NarrowSearchInitial: (
    <div className="max-w-80">
      <Frame>
        <ZoneSearchPage />
      </Frame>
    </div>
  ),
};
