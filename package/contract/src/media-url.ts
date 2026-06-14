import { t } from "elysia";

// Write-path media URL marker. Structurally a string; the `x-rezics-media`
// metadata signals that the server must validate the URL origin against
// MEDIA_PUBLIC_BASE_URL before persisting.
// 写入路径的媒体 URL 标记。结构上是字符串；`x-rezics-media` 元数据标志着
// 服务端在持久化前必须验证该 URL 的 origin 是否匹配 MEDIA_PUBLIC_BASE_URL。
export const mediaUrlSchema = t.String({ "x-rezics-media": true } as never);
