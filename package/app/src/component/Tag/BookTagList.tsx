import { Box } from "@mui/material";
import { TagGroup } from "contract/schema";
import { useEffect } from "react";
import { SingleBookTag } from "./SingleBookTag";

export namespace BookTagList {
  export type Show = {
    tagGroups: TagGroup[];
  };

  export const Show: React.FC<Show> = ({ tagGroups }) => {
    useEffect(() => {
      console.log(tagGroups);
    }, [tagGroups]);
    return (
      <Box>
        {tagGroups.map((tagGroup) => (
          <Box key={tagGroup.id} sx={{ mb: 3 }}>
            <SingleBookTag data={tagGroup} />
          </Box>
        ))}
      </Box>
    );
  };

  export type Container = {
    tagGroups: TagGroup[];
  };

  export const Container: React.FC<Container> = ({ tagGroups }) => {
    // TODO then we need to realize logic of classification(grouping) and filtering
    return <Show tagGroups={tagGroups} />;
  };
}
