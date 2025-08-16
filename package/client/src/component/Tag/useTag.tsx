import useSWR from "swr";
import { Tag } from "contract";
import { apiPost } from "@/api/swr.ts";

const createTagInput = {
	operation: "tag.create",
	parameter: { name: "New Tag", owners: [{ id: "owner-id" }] },
	select: {
		id: true,
		name: true,
	},
} satisfies Tag.Input.Create;

export function UseTag() {
<<<<<<< Updated upstream
	// Silence unused data for now
	const { data: _data } = useSWR<
		Tag.Output.Create<typeof createTagInput.select>,
		Error,
		typeof createTagInput
	>(
		createTagInput,
		apiPost,
	);
	return (
		<div>
			<h1>Tag</h1>
			{JSON.stringify(_data)}
		</div>
	);
=======
    // Silence unused data for now
    const { data: _data } = useSWR<
        Tag.Output.Create<typeof createTagInput.select>,
        Error,
        typeof createTagInput
    >(
        createTagInput,
        apiPost,
    );
    return (
        <div>
            <h1>Tag</h1>
            {JSON.stringify(_data?.id)}
        </div>
    );
>>>>>>> Stashed changes
}
