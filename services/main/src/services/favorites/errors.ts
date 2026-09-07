import { HTTPError } from "elysia";
export class FavoriteRevisionConflict extends HTTPError.id("FavoriteRevisionConflict", 409) {}
export class FavoriteNotFound extends HTTPError.id("FavoriteNotFound", 404) {}
