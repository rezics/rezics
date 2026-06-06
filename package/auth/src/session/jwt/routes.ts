import { getAuthPublicJwks } from "./service";

export async function getAuthSessionJwksResponse() {
  return Response.json(await getAuthPublicJwks());
}
