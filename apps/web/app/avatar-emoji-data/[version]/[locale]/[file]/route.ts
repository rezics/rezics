import { createAvatarEmojiDataResponse } from "@/features/media/server/avatar-emoji-data.server";

export async function GET(
	_request: Request,
	{
		params,
	}: {
		readonly params: Promise<{
			readonly version: string;
			readonly locale: string;
			readonly file: string;
		}>;
	},
): Promise<Response> {
	return createAvatarEmojiDataResponse(await params);
}
