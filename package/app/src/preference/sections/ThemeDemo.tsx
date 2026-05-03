import {
  Alert,
  AlertDescription,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
} from "@rezics/ui/shadcn";
import {
  Plus as Add,
  CircleAlert as ErrorIcon,
  CircleCheck as CheckCircle,
  Heart as Favorite,
  Info,
  Send as Share,
  TriangleAlert as Warning,
} from "lucide-react";
import type React from "react";
import { useAppStore } from "@/app/states/appStore";

// MOCK: local preview palette for demo cards (used to be PRESET_COLORS from ui).
const DEMO_COLORS: Array<{ name: string; color: string }> = [
  { name: "Brand", color: "#f4606c" },
  { name: "Blue", color: "#3b82f6" },
  { name: "Green", color: "#10b981" },
  { name: "Amber", color: "#f59e0b" },
  { name: "Purple", color: "#8b5cf6" },
  { name: "Red", color: "#ef4444" },
  { name: "Teal", color: "#14b8a6" },
  { name: "Pink", color: "#ec4899" },
];

export const ThemeDemo: React.FC = () => {
  const customColor = useAppStore((state) => state.customColor);

  const demoItems = [
    { icon: <CheckCircle className="h-4 w-4" />, text: "任务已完成" },
    { icon: <Warning className="h-4 w-4" />, text: "需要注意" },
    { icon: <Info className="h-4 w-4" />, text: "信息提示" },
    { icon: <ErrorIcon className="h-4 w-4" />, text: "错误警告" },
  ];

  return (
    <div className="p-6 mx-auto max-w-[1200px]">
      {/* 标题区域 */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-semibold mb-2 text-rezics-color-brand-fill">
          主题演示
        </h1>
        <h2 className="text-lg text-rezics-color-fg-muted mb-2">
          体验应用的颜色与组件系统
        </h2>

        {customColor && (
          <Alert className="mt-4 max-w-[600px] mx-auto">
            <AlertDescription>
              当前自定义颜色: {customColor.toUpperCase()}
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 颜色系统演示 */}
        <div className="col-span-12 md:col-span-6">
          <Card>
            <CardContent>
              <h2 className="text-2xl font-semibold mb-4 text-rezics-color-brand-fill">
                颜色系统
              </h2>
              <div className="mb-6">
                <p className="text-sm font-medium mb-2">主要颜色</p>
                <div className="flex flex-wrap gap-2">
                  <Badge>Primary</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="destructive">Error</Badge>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm font-medium mb-2">表面颜色</p>
                <div className="flex gap-2 mb-4">
                  <div className="p-4 flex-1 bg-rezics-color-bg-canvas border border-rezics-color-border rounded-md">
                    <span className="text-xs text-rezics-color-fg-muted">
                      Background
                    </span>
                  </div>
                  <div className="p-4 flex-1 bg-rezics-color-bg-elevated border border-rezics-color-border rounded-md">
                    <span className="text-xs text-rezics-color-fg-muted">
                      Surface
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">文本颜色</p>
                <p className="text-base mb-1">主要文本 (Primary Text)</p>
                <p className="text-sm text-rezics-color-fg-muted mb-1">
                  次要文本 (Secondary Text)
                </p>
                <p className="text-sm opacity-50">禁用文本 (Disabled Text)</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 组件演示 */}
        <div className="col-span-12 md:col-span-6">
          <Card>
            <CardContent>
              <h2 className="text-2xl font-semibold mb-4 text-rezics-color-brand-fill">
                组件展示
              </h2>

              <div className="mb-6">
                <p className="text-sm font-medium mb-2">按钮</p>
                <div className="flex flex-wrap gap-2">
                  <Button>Contained</Button>
                  <Button variant="outline">Outlined</Button>
                  <Button variant="ghost">Text</Button>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm font-medium mb-2">状态指示</p>
                <ul className="flex flex-col gap-2">
                  {demoItems.map((item, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static list
                    <li key={index} className="flex items-center gap-2">
                      {item.icon}
                      <span className="text-sm">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mb-6">
                <p className="text-sm font-medium mb-2">进度条</p>
                <div className="h-2 bg-rezics-color-bg-elevated rounded-full overflow-hidden mb-1">
                  <div
                    className="h-full bg-rezics-color-brand-fill"
                    style={{ width: "75%" }}
                  />
                </div>
                <p className="text-xs text-rezics-color-fg-muted">75% 完成</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 卡片组合演示 */}
        <div className="col-span-12">
          <h2 className="text-2xl font-semibold mb-6 text-rezics-color-brand-fill">
            卡片组合演示
          </h2>
          <div className="grid grid-cols-12 gap-4">
            {DEMO_COLORS.map(({ name, color }) => (
              <div
                key={name}
                className="col-span-12 sm:col-span-6 md:col-span-3"
              >
                <Card
                  className="transition-all hover:-translate-y-1"
                  style={{
                    background: `linear-gradient(135deg, ${color}1a 0%, ${color}0d 100%)`,
                    borderColor: `${color}33`,
                  }}
                >
                  <CardContent>
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar
                        className="w-10 h-10"
                        style={{ backgroundColor: color }}
                      >
                        <AvatarFallback style={{ backgroundColor: color }}>
                          {name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-base font-semibold">{name}</p>
                        <p className="text-sm text-rezics-color-fg-muted">
                          {color}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-rezics-color-fg-muted mb-4">
                      这是一个使用 {name} 颜色主题的演示卡片。
                    </p>

                    <div className="flex justify-between items-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        style={{ color }}
                      >
                        查看
                      </Button>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" aria-label="like">
                          <Favorite className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label="share">
                          <Share className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 浮动操作按钮 */}
      <Button
        size="icon"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
        aria-label="add"
      >
        <Add className="h-6 w-6" />
      </Button>
    </div>
  );
};
