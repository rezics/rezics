/**
 * Opaque base64-url cursors for `(createdAt, id)` pagination.
 *
 * Encoded shape: base64-url(JSON.stringify({ t: <iso8601>, i: <uuid> })).
 * Clients treat the string as opaque; the server is the only entity that
 * decodes it.
 */

export interface ReactionCursor {
  createdAt: Date;
  id: string;
}

interface CursorPayload {
  t: string;
  i: string;
}

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  const padded =
    input.replace(/-/g, "+").replace(/_/g, "/") +
    "===".slice((input.length + 3) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

export class CursorDecodeError extends Error {
  constructor(message = "Malformed cursor") {
    super(message);
    this.name = "CursorDecodeError";
  }
}

export function encodeCursor(cursor: ReactionCursor): string {
  const payload: CursorPayload = {
    t: cursor.createdAt.toISOString(),
    i: cursor.id,
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeCursor(raw: string): ReactionCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(raw));
  } catch {
    throw new CursorDecodeError();
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as CursorPayload).t !== "string" ||
    typeof (parsed as CursorPayload).i !== "string"
  ) {
    throw new CursorDecodeError();
  }
  const { t, i } = parsed as CursorPayload;
  const createdAt = new Date(t);
  if (Number.isNaN(createdAt.getTime())) throw new CursorDecodeError();
  return { createdAt, id: i };
}
