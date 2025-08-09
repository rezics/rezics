import useSWR from "swr";
import { Tag } from "contract";

const createTagInput = {
    operation: "tag.create",
    parameter: { name: "New Tag", owners: [{ id: "owner-id" }] },
    select: {
        id: true,
        name: true,
    },
} satisfies Tag.Input.Create;

// Silence unused data for now
const { data: _data } = useSWR<
    Tag.Output.Create<typeof createTagInput.select>,
    Error,
    typeof createTagInput
>(
    createTagInput,
    async (key) => {
        const _res = await fetch("/api", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(key),
        });
        if (!_res.ok) {
            throw new Error(`Request failed: ${_res.status}`);
        }
        return (await _res.json()) as any;
    },
);
