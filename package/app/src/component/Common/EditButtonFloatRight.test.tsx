import { useFixtureInput } from "react-cosmos/client";
import { EditButtonFloatRight } from "./EditButtonFloatRight";

export default {
  Default: () => {
    const [props] = useFixtureInput<
      Parameters<typeof EditButtonFloatRight.Container>[0]
    >("Props", {
      onClick: () => console.log("Edit clicked"),
      text: "编辑",
    });

    return (
      <div className="p-4 border border-gray-200 rounded">
        <EditButtonFloatRight.Container {...props} />
      </div>
    );
  },

  CustomText: () => {
    const [props] = useFixtureInput<
      Parameters<typeof EditButtonFloatRight.Container>[0]
    >("Props", {
      onClick: () => console.log("Modify clicked"),
      text: "修改",
    });

    return (
      <div className="p-4 border border-gray-200 rounded">
        <EditButtonFloatRight.Container {...props} />
      </div>
    );
  },
};
