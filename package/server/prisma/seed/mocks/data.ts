import { faker } from "@faker-js/faker";

// ── Book covers ─────────────────────────────────────

const book_cover_urls = [
  "https://m.media-amazon.com/images/I/91RwHjXkO6L._SY466_.jpg",
  "https://m.media-amazon.com/images/I/91pqP1xMb2L._SY466_.jpg",
  "https://m.media-amazon.com/images/I/81af+MCATTL._SY466_.jpg",
  "https://m.media-amazon.com/images/I/916tVbg-fHL._SY425_.jpg",
  "https://m.media-amazon.com/images/I/81OthjkJBuL._SY466_.jpg",
  "https://m.media-amazon.com/images/I/91bYsX41DVL._SY445_.jpg",
  "https://m.media-amazon.com/images/I/81iqZ2HHD-L._SY445_.jpg",
  "https://m.media-amazon.com/images/I/71KilybDOoL._SY445_.jpg",
  "https://m.media-amazon.com/images/I/81gepf1eMqL._SY445_.jpg",
  "https://m.media-amazon.com/images/I/81af+MCATTL._SY445_.jpg",
  "https://m.media-amazon.com/images/I/91uwocAMtSL._SY445_.jpg",
  "https://m.media-amazon.com/images/I/81YOuOGFCJL._SY445_.jpg",
  "https://m.media-amazon.com/images/I/81qPmP18mYL._SY466_.jpg",
  "https://m.media-amazon.com/images/I/A1LumMU72HL._SY425_.jpg",
  "https://m.media-amazon.com/images/I/91-qSkyts4L._SY466_.jpg",
  "https://m.media-amazon.com/images/I/91Y94CZ-X3L._SY425_.jpg",
];

export function getRandomBookCover() {
  return faker.helpers.arrayElement(book_cover_urls);
}

// ── Shelf covers (landscape 16:9) ──────────────────

export function getRandomShelfCover() {
  const id = faker.number.int({ min: 1, max: 1000 });
  return `https://picsum.photos/seed/${id}/800/450`;
}

// ── Constants ───────────────────────────────────────

export const PLATFORM_KEYS = [
  "PC",
  "PS5",
  "PS4",
  "XBOX_SERIES",
  "XBOX_ONE",
  "SWITCH",
  "MOBILE",
  "WEB",
] as const;

export const MEDIA_KIND_KEYS = [
  "MOVIE",
  "TV_SERIES",
  "ANIME",
  "DOCUMENTARY",
  "SHORT_FILM",
] as const;

export const SHELF_KIND_KEYS = [
  "READING_LIST",
  "FAVORITES",
  "WATCHLIST",
  "PLAYLIST",
  "CUSTOM",
] as const;

export const REALM_ROLE_KEYS = [
  "owner",
  "admin",
  "moderator",
  "member",
] as const;


export const REACTION_TYPES = ["like", "dislike", "love"] as const;
