import useRpcQuery from "@/api/swr-query/tsrTypeBuild";
import { Tag } from "contract";

const createTagInput = {
  operation: "tag.create",
  parameter: { name: "New Tag", owners: [{ id: "owner-id" }], type: "book" },
  select: {
    id: true,
    name: true,
  },
} satisfies Tag.Input.Create;

export function UseTag() {
  // Silence unused data for now
  const { data: _data } = useRpcQuery<Tag.Output.Create<typeof createTagInput.select>>(createTagInput);
  return (
    <div>
      <h1>Tag</h1>
      {JSON.stringify(_data)}
    </div>
  );
}
