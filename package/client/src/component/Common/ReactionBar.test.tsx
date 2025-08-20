import { useFixtureInput } from "react-cosmos/client";
import { ReactionBar } from "./ReactionBar";

export default function ReactionBarTest() {
    const [props] = useFixtureInput<
        Parameters<typeof ReactionBar.Container>[0]
    >("Props", {
        onReply: () => {},
        className: "",
        size: "large",
        fontSize: "1.5rem",
    });

    return <ReactionBar.Container {...props} />;
}
