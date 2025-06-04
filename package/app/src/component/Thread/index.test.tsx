import { useFixtureInput } from "react-cosmos/client";
import { Thread } from ".";
import { loremIpsum } from "lorem-ipsum";

export default () => {
    const [user] = useFixtureInput<Thread["user"]>("User", {
        id: "",
        name: "Bob",
        subscriber: 114514,
        avatar: "https://i.pravatar.cc/300",
    });

    return (
        <Thread.Show user={user} rating={5} create_at={new Date()}>
            {loremIpsum({ count: 12 })}
        </Thread.Show>
    );
};
