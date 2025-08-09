import { useFixtureInput } from "react-cosmos/client";
import { Thread } from ".";
import { loremIpsum } from "lorem-ipsum";

export default () => {
    const [user] = useFixtureInput<Thread.Show["user"]>("User", {
        id: "",
        name: "Bob",
        subscriber: 114514,
        avatar: "https://i.pravatar.cc/300",
    });

    const reactions = {
        state: {
            up: true,
            star: false,
        },
        event: {
            onUp: () => console.log("up clicked"),
            onDown: () => console.log("down clicked"),
            onStar: () => console.log("star clicked"),
            onReply: () => console.log("reply clicked"),
        },
    };

    return (
        <Thread.Show
            user={user}
            rating={5}
            create_at={new Date()}
            reactions={reactions}
        >
            {loremIpsum({ count: 12 })}
        </Thread.Show>
    );
};
