import { EditButtonFloatRight } from "./EditButtonFloatRight";

export default () => {
    return (
        <div className="p-4 space-y-4">
            <div>
                <h3 className="mb-2">右浮动编辑按钮</h3>
                <div className="border border-gray-300 rounded p-4">
                    <div className="flex">
                        <div className="flex-1">
                            <h4>示例内容标题</h4>
                            <p>这是一些示例内容，编辑按钮将浮动在右侧。</p>
                        </div>
                        <EditButtonFloatRight />
                    </div>
                </div>
            </div>
            <div>
                <h3 className="mb-2">在不同容器中的表现</h3>
                <div className="border border-gray-300 rounded p-4 bg-gray-50">
                    <div className="flex">
                        <div className="flex-1">
                            <h4>另一个示例</h4>
                            <p>编辑按钮会根据容器自动调整位置。</p>
                        </div>
                        <EditButtonFloatRight />
                    </div>
                </div>
            </div>
        </div>
    );
};
