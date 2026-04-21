import { ReplyAction } from "./ReplyAction";

export default {
  "sm · count mode · zero": () => (
    <ReplyAction size="sm" replyCount={0} mode="count" />
  ),
  "md · count mode · 12 replies": () => (
    <ReplyAction size="md" replyCount={12} mode="count" />
  ),
  "md · label mode": () => (
    <ReplyAction size="md" replyCount={4} mode="label" />
  ),
  "lg · large detail surface": () => (
    <ReplyAction size="lg" replyCount={128} mode="count" />
  ),
};
