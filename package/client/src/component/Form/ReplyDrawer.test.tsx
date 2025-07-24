import { useFixtureInput } from "react-cosmos/client";
import ReplyDrawer from "./ReplyDrawer";

export default () => {
    const [props] = useFixtureInput<Parameters<typeof ReplyDrawer>[0]>("Props", {
        dialogId: "reply-test-123",
        onSubmit: (content: string) => {
            alert(`Submitted content: ${content}`);
        },
    });

    return (
        <div className="p-4">
            <h3 className="mb-4 text-lg font-semibold">底部抽屉回复组件</h3>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                    注意：此组件依赖于 useDialogStore 全局状态管理，在 Cosmos 中可能无法正常显示。 ReplyDrawer
                    是一个底部抽屉式的回复组件，包含富文本编辑器。
                </p>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
                <p className="mb-2">在实际应用中，ReplyDrawer 会从屏幕底部弹出，包含：</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>EasyEditor 富文本编辑器</li>
                    <li>提交按钮</li>
                    <li>自适应的宽度和高度</li>
                    <li>从底部弹出的动画效果</li>
                </ul>
            </div>

            <div className="mt-4 p-4 border-l-4 border-blue-500 bg-blue-50">
                <p className="text-sm">
                    <strong>组件参数：</strong>
                </p>
                <ul className="mt-2 text-sm space-y-1">
                    <li>
                        <strong>dialogId:</strong> {props.dialogId}
                    </li>
                    <li>
                        <strong>onSubmit:</strong> 提交回调函数
                    </li>
                </ul>
            </div>

            <div className="mt-4 text-sm text-gray-500">
                <p>ReplyDrawer 组件特点：</p>
                <ul className="mt-2 list-disc list-inside space-y-1">
                    <li>使用 Material-UI Drawer 组件</li>
                    <li>底部锚点（anchor="bottom"）</li>
                    <li>集成 EasyEditor 富文本编辑器</li>
                    <li>响应式布局设计</li>
                    <li>高 z-index 确保在最上层显示</li>
                </ul>
            </div>

            {/* 模拟的 ReplyDrawer 外观 */}
            <div className="mt-6 p-4 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-sm font-medium mb-2">模拟的 ReplyDrawer 外观：</p>
                <div className="bg-white rounded-lg shadow-lg p-4 max-w-3xl mx-auto">
                    <div className="flex gap-4">
                        <div className="flex-1 border border-gray-200 rounded min-h-[200px] p-3">
                            <p className="text-gray-500 text-sm">EasyEditor 富文本编辑器区域</p>
                        </div>
                        <div className="flex flex-col justify-end">
                            <button
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                                onClick={() => props.onSubmit && props.onSubmit("示例内容")}
                            >
                                提交
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
