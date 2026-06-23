import { Schema } from "effect";

export class PortableTextSpan extends Schema.Class<PortableTextSpan>("PortableTextSpan")({
  _type: Schema.Literal("span"),
  _key: Schema.String,
  text: Schema.String,
  marks: Schema.optional(Schema.Array(Schema.String)),
}) {}

export class PortableTextBlock extends Schema.Class<PortableTextBlock>("PortableTextBlock")({
  _type: Schema.Literal("block"),
  _key: Schema.String,
  style: Schema.optional(Schema.String),
  children: Schema.Array(PortableTextSpan),
  markDefs: Schema.optional(
    Schema.Array(
      Schema.Struct({
        _type: Schema.String,
        _key: Schema.String,
        href: Schema.optional(Schema.String),
      }),
    ),
  ),
  listItem: Schema.optional(Schema.String),
  level: Schema.optional(Schema.Number),
}) {}

export const PortableTextValue = Schema.Array(PortableTextBlock);
export type PortableTextValue = typeof PortableTextValue.Type;
