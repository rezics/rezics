import { ShareAction } from "./ShareAction";

export default {
  "md · default": () => (
    <ShareAction
      size="md"
      href="/post/fixture-share-1"
      title="Example post title"
    />
  ),
  "sm · compact": () => (
    <ShareAction size="sm" href="/post/fixture-share-2" />
  ),
  "lg · detail surface": () => (
    <ShareAction
      size="lg"
      href="/post/fixture-share-3"
      title="Long-form detail page"
    />
  ),
};
