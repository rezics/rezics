"use client";

import { mockPortableTextBlocks } from "@/__cosmos__/mock-data";
import { PortableTextView } from "./PortableTextView";

const singleParagraph = [
  {
    _type: "block",
    _key: "p1",
    style: "normal",
    children: [{ _type: "span", _key: "s1", text: "A single paragraph of plain text.", marks: [] }],
    markDefs: [],
  },
];

const longArticleBlocks = [
  { _type: "block", _key: "b01", style: "h2", children: [{ _type: "span", _key: "s01", text: "Chapter 1: Getting Started", marks: [] }], markDefs: [] },
  { _type: "block", _key: "b02", style: "normal", children: [{ _type: "span", _key: "s02", text: "This is the opening paragraph of a long article. It introduces the topic and sets the stage for the detailed discussion that follows.", marks: [] }], markDefs: [] },
  { _type: "block", _key: "b03", style: "blockquote", children: [{ _type: "span", _key: "s03", text: "The best way to learn is by doing.", marks: [] }], markDefs: [] },
  { _type: "block", _key: "b04", style: "h3", children: [{ _type: "span", _key: "s04", text: "1.1 Prerequisites", marks: [] }], markDefs: [] },
  { _type: "block", _key: "b05", style: "normal", children: [{ _type: "span", _key: "s05", text: "You will need ", marks: [] }, { _type: "span", _key: "s06", text: "Node.js 20+", marks: ["strong"] }, { _type: "span", _key: "s07", text: " and ", marks: [] }, { _type: "span", _key: "s08", text: "TypeScript 5.3+", marks: ["code"] }, { _type: "span", _key: "s09", text: " installed.", marks: [] }], markDefs: [] },
  { _type: "block", _key: "b06", style: "h2", children: [{ _type: "span", _key: "s10", text: "Chapter 2: Core Concepts", marks: [] }], markDefs: [] },
  { _type: "block", _key: "b07", style: "normal", children: [{ _type: "span", _key: "s11", text: "Effect is a powerful library for building type-safe applications. Its core concept is the ", marks: [] }, { _type: "span", _key: "s12", text: "Effect<A, E, R>", marks: ["code"] }, { _type: "span", _key: "s13", text: " type, representing a computation.", marks: [] }], markDefs: [] },
  { _type: "block", _key: "b08", style: "h3", children: [{ _type: "span", _key: "s14", text: "2.1 Error Handling", marks: [] }], markDefs: [] },
  { _type: "block", _key: "b09", style: "normal", children: [{ _type: "span", _key: "s15", text: "Errors are represented in the type system. You can use ", marks: [] }, { _type: "span", _key: "s16", text: "Effect.catchAll", marks: ["code"] }, { _type: "span", _key: "s17", text: " to handle them exhaustively.", marks: [] }], markDefs: [] },
  { _type: "block", _key: "b10", style: "blockquote", children: [{ _type: "span", _key: "s18", text: "Make illegal states unrepresentable — the guiding principle of typed functional programming.", marks: ["em"] }], markDefs: [] },
  { _type: "block", _key: "b11", style: "h2", children: [{ _type: "span", _key: "s19", text: "Chapter 3: Conclusion", marks: [] }], markDefs: [] },
  { _type: "block", _key: "b12", style: "normal", children: [{ _type: "span", _key: "s20", text: "Effect transforms how you think about side effects. Once you internalize the model, writing correct concurrent programs becomes natural.", marks: [] }], markDefs: [] },
];

const linkedAndListedBlocks = [
  {
    _type: "block",
    _key: "l1",
    style: "normal",
    children: [
      { _type: "span", _key: "l1s1", text: "Read the ", marks: [] },
      { _type: "span", _key: "l1s2", text: "Effect docs", marks: ["effectLink"] },
      { _type: "span", _key: "l1s3", text: " before migrating.", marks: [] },
    ],
    markDefs: [{ _key: "effectLink", _type: "link", href: "https://effect.website" }],
  },
  {
    _type: "block",
    _key: "l2",
    listItem: "bullet",
    level: 1,
    style: "normal",
    children: [{ _type: "span", _key: "l2s1", text: "First checklist item", marks: [] }],
    markDefs: [],
  },
  {
    _type: "block",
    _key: "l3",
    listItem: "bullet",
    level: 1,
    style: "normal",
    children: [{ _type: "span", _key: "l3s1", text: "Second checklist item with code", marks: ["code"] }],
    markDefs: [],
  },
  {
    _type: "block",
    _key: "l4",
    listItem: "number",
    level: 1,
    style: "normal",
    children: [{ _type: "span", _key: "l4s1", text: "Ordered step", marks: [] }],
    markDefs: [],
  },
];

const overflowBlocks = [
  {
    _type: "block",
    _key: "o1",
    style: "h2",
    children: [
      {
        _type: "span",
        _key: "o1s1",
        text: "Singleunbrokenheadingidentifierthatshouldnotcreatehorizontaloverflow",
        marks: [],
      },
    ],
    markDefs: [],
  },
  {
    _type: "block",
    _key: "o2",
    style: "normal",
    children: [
      {
        _type: "span",
        _key: "o2s1",
        text: "singleunbrokenbodyidentifierthatkeepsgoingandgoingandgoingandgoingandgoing",
        marks: ["code"],
      },
    ],
    markDefs: [],
  },
];

export default {
  RichContent: (
    <div className="mx-auto w-full max-w-2xl p-4">
      <PortableTextView value={mockPortableTextBlocks()} />
    </div>
  ),
  SingleParagraph: (
    <div className="mx-auto w-full max-w-2xl p-4">
      <PortableTextView value={singleParagraph} />
    </div>
  ),
  EmptyArray: (
    <div className="mx-auto w-full max-w-2xl p-4">
      <PortableTextView value={[]} />
    </div>
  ),
  InvalidInput_Null: (
    <div className="mx-auto w-full max-w-2xl p-4">
      <PortableTextView value={null} />
    </div>
  ),
  InvalidInput_String: (
    <div className="mx-auto w-full max-w-2xl p-4">
      <PortableTextView value="some raw string content" />
    </div>
  ),
  InvalidInput_Object: (
    <div className="mx-auto w-full max-w-2xl p-4">
      <PortableTextView value={{ _type: "block" }} />
    </div>
  ),
  LongArticle: (
    <div className="mx-auto w-full max-w-2xl p-4">
      <PortableTextView value={longArticleBlocks} />
    </div>
  ),
  LinksAndLists: (
    <div className="mx-auto w-full max-w-2xl p-4">
      <PortableTextView value={linkedAndListedBlocks} />
    </div>
  ),
  MobileOverflow: (
    <div className="mx-auto w-full max-w-[320px] p-2">
      <PortableTextView value={overflowBlocks} />
    </div>
  ),
};
