import { describe, expect, test } from "bun:test";
import { serializeBookToc } from "./bookTocSerializer";
import type { Chapter } from "../components/BookTocEditor";

describe("serializeBookToc", () => {
  test("does not persist empty children added for tree editing", () => {
    const tree: Chapter[] = [
      {
        id: "path:0",
        nodeId: "node-1",
        title: "Chapter 1",
        children: [],
      },
    ];

    expect(serializeBookToc(tree, "GENERAL")).toEqual([
      { id: "node-1", title: "Chapter 1" },
    ]);
  });
});
