import { pgSequence } from "drizzle-orm/pg-core";
export const post_path_label_seq = pgSequence("post_path_label_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "9223372036854775807",
  cache: "1",
  cycle: false,
});
