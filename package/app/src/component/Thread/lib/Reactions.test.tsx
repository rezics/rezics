import { useFixtureInput } from "react-cosmos/client";
import { Reactions } from "./Reactions";

export default () => {
  const [up, setUp] = useFixtureInput<Reactions["state"]["up"]>("Up", null);
  const [star, setStar] = useFixtureInput<Reactions["state"]["star"]>(
    "star",
    false,
  );

  return (
    <Reactions
      state={{
        up,
        star,
      }}
      event={{
        onUp: () => setUp(up === true ? null : true),
        onDown: () => setUp(up === false ? null : false),
        onStar: () => setStar(!star),
      }}
    >
    </Reactions>
  );
};
