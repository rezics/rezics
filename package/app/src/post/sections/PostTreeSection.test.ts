import type { PostDTO } from "@rezics/contract";
import { describe, expect, it } from "bun:test";
import { excludeRootPost } from "../hooks/usePostTreeCollapse";

function makePost(unitId: string): PostDTO {
  return {
    unitId,
    authorUserId: "user-1",
    body: "body",
  } as PostDTO;
}

describe("PostTreeSection helpers", () => {
  it("excludes the root post from the rendered reply tree", () => {
    const posts = [makePost("root"), makePost("reply-1"), makePost("reply-2")];

    expect(excludeRootPost(posts, "root").map((post) => post.unitId)).toEqual([
      "reply-1",
      "reply-2",
    ]);
  });
});
