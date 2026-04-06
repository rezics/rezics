import { useFixtureInput } from "react-cosmos/client";
import { AccentBarWithText } from "./AccentBarWithText";

export default function AccentBarTest() {
  const [_barProps] = useFixtureInput<Parameters<typeof AccentBarWithText>[0]>(
    "Accent Bar Props",
    {
      height: 24,
      text: "推荐阅读",
    },
  );

  const [barWithTextProps] = useFixtureInput<
    Parameters<typeof AccentBarWithText>[0]
  >("Accent Bar With Text Props", {
    height: 24,
    text: "推荐阅读",
  });

  return (
    <div className="p-4 space-y-6">
      <div>
        <AccentBarWithText {...barWithTextProps} />
      </div>

      <div className="space-y-3">
        <AccentBarWithText text="默认主色" />
        <AccentBarWithText text="自定义颜色" color="#ec4899" />
      </div>
    </div>
  );
}
