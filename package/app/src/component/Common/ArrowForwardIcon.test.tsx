import { useFixtureInput } from "react-cosmos/client";
import { ArrowForwardIcon } from "./ArrowForwardIcon";

export default () => {
    const [props] = useFixtureInput<Parameters<typeof ArrowForwardIcon>[0]>("Props", {
        size: 24,
        color: "#1976d2",
        children: "点击查看更多",
    });

    return (
        <div className="p-4 space-y-4">
            <div>
                <h3 className="mb-2">默认样式</h3>
                <ArrowForwardIcon {...props} />
            </div>
            <div>
                <h3 className="mb-2">不同尺寸</h3>
                <div className="space-y-2">
                    <div>
                        <ArrowForwardIcon size={16}>小尺寸</ArrowForwardIcon>
                    </div>
                    <div>
                        <ArrowForwardIcon size={24}>中等尺寸</ArrowForwardIcon>
                    </div>
                    <div>
                        <ArrowForwardIcon size={32}>大尺寸</ArrowForwardIcon>
                    </div>
                </div>
            </div>
            <div>
                <h3 className="mb-2">不同文本内容</h3>
                <div className="space-y-2">
                    <div>
                        <ArrowForwardIcon>查看详情</ArrowForwardIcon>
                    </div>
                    <div>
                        <ArrowForwardIcon>继续阅读</ArrowForwardIcon>
                    </div>
                    <div>
                        <ArrowForwardIcon>了解更多</ArrowForwardIcon>
                    </div>
                </div>
            </div>
        </div>
    );
};
