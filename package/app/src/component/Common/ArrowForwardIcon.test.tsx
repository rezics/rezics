import { ArrowForwardIcon } from "./ArrowForwardIcon";
import { useFixtureInput } from "react-cosmos/client";

export default {
    Default: () => {
        const [props] = useFixtureInput<Parameters<typeof ArrowForwardIcon.Container>[0]>("Props", {
            size: 24,
            children: "点击查看更多",
        });

        return (
            <div className="p-4">
                <ArrowForwardIcon.Container {...props} />
            </div>
        );
    },

    Sizes: () => (
        <div className="p-4 space-y-4">
            <div>
                <ArrowForwardIcon.Container size={16}>小尺寸</ArrowForwardIcon.Container>
            </div>
            <div>
                <ArrowForwardIcon.Container size={24}>中等尺寸</ArrowForwardIcon.Container>
            </div>
            <div>
                <ArrowForwardIcon.Container size={32}>大尺寸</ArrowForwardIcon.Container>
            </div>
        </div>
    ),

    Examples: () => (
        <div className="p-4 space-y-4">
            <div>
                <ArrowForwardIcon.Container>查看详情</ArrowForwardIcon.Container>
            </div>
            <div>
                <ArrowForwardIcon.Container>继续阅读</ArrowForwardIcon.Container>
            </div>
            <div>
                <ArrowForwardIcon.Container>了解更多</ArrowForwardIcon.Container>
            </div>
        </div>
    ),
};
