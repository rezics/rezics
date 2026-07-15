# @rezics/brand

REZICS 的品牌资产。SVG 是首选格式；仅在平台不接受 SVG 时使用 PNG。

| 场景                        | 资产                                          |
| --------------------------- | --------------------------------------------- |
| 浅色 / 深色界面的完整组合标 | `logo.svg` / `logo-dark.svg`                  |
| 无背景的方形标志            | `mark.svg`                                    |
| 单色印刷、遮罩等环境        | `mark-mono-dark.svg` / `mark-mono-light.svg`  |
| App、PWA、桌面快捷方式图标  | `app-icon.svg` 或 `app-icon.png`              |
| 社交媒体头像                | `avatar.svg`、`avatar.png` 或 `avatar@2x.png` |
| Open Graph、分享卡片        | `social-card.svg` / `social-card-dark.svg`    |

## 约定

- 不拉伸、不旋转、不改变渐变。
- 所有变体中的标志本体严格保持原始 `7:5` 比例；方形只指画布，不代表拉伸标志。
- 组合标根据承载面选择浅色或深色版本，不依赖 CSS 滤镜反色。
- App 图标已包含圆角和安全区；交给平台再次裁切时不要另加内边距。
- 头像的重要内容位于圆形安全区内，可直接交给会裁切成圆形的平台。
- 自定义分享卡片应保留左侧标志与安全区，在右侧添加标题，不缩放为头像使用。

运行 `yarn workspace @rezics/brand generate` 可从 `src` 重建 `dist`。暗色与单色版本由生成器从基础版本派生，不维护重复的形状源文件。
