import { useFixtureInput } from "react-cosmos/client";
import { ReactionBar } from "./ReactionBar";

export default () => {
    const [props] = useFixtureInput<Parameters<typeof ReactionBar>[0]>("Props", {
        onReply: () => alert("Reply clicked!"),
        size: "medium",
        fontSize: "1.2rem",
        className: "",
    });

    return (
        <div className="p-4 max-w-md mx-auto">
            <ReactionBar {...props} />
        </div>
    );
};
