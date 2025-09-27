import { useFixtureInput } from "react-cosmos/client";
import { BookCarousel } from "./HomeCarousel";

export default () => {
  const [props] = useFixtureInput<Parameters<typeof BookCarousel>[0]>(
    "Props",
    {
      autoplayIntervalNum: 3000,
    },
  );

  return (
    <div className="p-4">
      <h3 className="mb-4 text-lg font-semibold">首页轮播组件</h3>

      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          BookCarousel 是一个基于 Swiper 的轮播组件，用于在首页展示推荐书籍。 支持自动播放、分页指示器和循环播放功能。
        </p>
      </div>

      <div className="border border-gray-200 rounded-lg p-4">
        <div className="mb-4">
          <p className="text-sm font-medium">当前设置：</p>
          <ul className="mt-2 text-sm space-y-1">
            <li>
              <strong>自动播放间隔：</strong> {props.autoplayIntervalNum}ms
            </li>
            <li>
              <strong>循环播放：</strong> 启用
            </li>
            <li>
              <strong>分页指示器：</strong> 启用
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-lg shadow-sm">
          <BookCarousel {...props} />
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <h4 className="font-medium mb-2">不同播放速度的示例</h4>
          <div className="space-y-4">
            <div className="border rounded p-4">
              <p className="text-sm font-medium mb-2">
                快速播放 (1秒间隔):
              </p>
              <BookCarousel autoplayIntervalNum={1000} />
            </div>

            <div className="border rounded p-4">
              <p className="text-sm font-medium mb-2">
                慢速播放 (5秒间隔):
              </p>
              <BookCarousel autoplayIntervalNum={5000} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 text-sm text-gray-500">
        <p>BookCarousel 组件特点：</p>
        <ul className="mt-2 list-disc list-inside space-y-1">
          <li>使用 Swiper 库实现轮播效果</li>
          <li>支持自动播放和无限循环</li>
          <li>响应式设计，适配不同屏幕尺寸</li>
          <li>包含分页指示器</li>
          <li>每个轮播项包含书籍封面和描述</li>
          <li>使用 Material-UI Grid 布局</li>
        </ul>
      </div>
    </div>
  );
};
