import { useFixtureInput } from "react-cosmos/client";
import { AccentBar, AccentBarWithText } from "./AccentBar";

export default {
    AccentBar: () => {
        const [props] = useFixtureInput<Parameters<typeof AccentBar>[0]>("AccentBar Props", {
            height: 24,
            color: "#1976d2",
        });

        return (
            <div className="p-4">
                <div className="flex items-center">
                    <AccentBar {...props} />
                    <span>这是一个装饰条示例</span>
                </div>
            </div>
        );
    },

    AccentBarWithText: () => {
        const [props] = useFixtureInput<Parameters<typeof AccentBarWithText>[0]>("AccentBarWithText Props", {
            height: 24,
            color: "#1976d2",
            text: "标题文本",
        });

        return (
            <div className="p-4">
                <AccentBarWithText {...props} />
            </div>
        );
    },
};
