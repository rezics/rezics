import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const html = verbatimTerms.html.value;
const https = verbatimTerms.https.value;
const json = verbatimTerms.json.value;
const markdown = verbatimTerms.markdown.value;

const en = `---
title: Lantern Field Notes
author: A. Reader
tags:
  - writing
  - field-notes
draft: false
---

# Lantern Field Notes

This is an editable ${markdown} sampler. Move the cursor into formatted text to reveal its source, change anything you like, or replace the whole document with your own notes.

[Jump to the field checklist](#field-checklist), or follow the sections from top to bottom.

## Words and emphasis

A paragraph can contain *emphasis*, **strong emphasis**, ***both at once***, ~~an outdated observation~~, and \`inline code\`. Escaped marks stay literal: \\*not emphasis\\* and \\# not a heading.

Two spaces or a backslash can request a hard line break.\\
This sentence begins on the next line, while an ordinary wrapped line remains part of the same paragraph.

### Links and images

Use an [inline link](${https}://example.com/field-guide "Open the field guide"), a [reference link][guide], or an automatic link such as <${https}://example.com/lanterns>.

![A sketched route between the harbor and the hill](./images/lantern-route.png "Lantern route")

[guide]: ${https}://example.com/reference "Reference notes"

## Field checklist

- Pack a notebook and a soft pencil.
- Record the weather.
  - Note the wind direction.
  - Compare the first and last readings.
- Leave enough room for later corrections.

1. Mark the starting point.
2. Walk to the old signal tower.
3. Review the notes before returning.

- [x] Test the lantern before dusk.
- [x] Tell someone the planned route.
- [ ] Add the final distance after the walk.

## Quotations

> A useful field note separates what was seen from what was inferred.
>
> A second paragraph can remain inside the same quotation.
>
> > Nested quotations are available when a source quotes another source.

## A small table

| Station | Time | Wind | Visibility |
| :-- | --: | :--: | --: |
| Harbor steps | 18:10 | west | 8 km |
| Pine ridge | 18:42 | calm | 12 km |
| Signal tower | 19:05 | north | 6 km |

## Code and structured data

Use \`const observation = "clear"\` inside a sentence, or a fenced block for several lines:

~~~${json.toLocaleLowerCase("en-US")}
{
  "station": "signal-tower",
  "temperature": 14.2,
  "unit": "celsius",
  "verified": true
}
~~~

An indented block is another common form:

    lantern --brightness medium
    notebook --page 12

---

## Extensions and graceful fallback

The following forms are common extensions. A renderer that does not support one of them can still keep the original text intact.

### Footnotes

The brass lens was cleaned before the reading.[^lens] A named note can be reused when a longer explanation would interrupt the paragraph.[^method]

[^lens]: The cleaning cloth was dry and free of grit.
[^method]: Readings were taken at eye level, five minutes apart, and written down immediately.

### Definition list

Bearing
: A direction measured clockwise from north.

Waymark
: A visible sign that helps a traveler follow a route.

### Mathematical notation

Inline notation may look like $d = vt$. A separate expression can occupy its own block:

$$
E = mc^2
$$

### Inert ${html}

<details>
<summary>Optional expedition note</summary>

Raw ${html} may remain visible as source text when a preview intentionally treats it as inert content.

</details>

## Heading scale

### Third-level heading

Use deeper headings only when they clarify a real hierarchy.

#### Fourth-level heading

Short sections are easier to scan than a single uninterrupted wall of text.

##### Fifth-level heading

This level is uncommon, but useful for checking spacing and outline nesting.

###### Sixth-level heading

This is the smallest standard heading.

## Closing note

Thematic breaks, multilingual characters such as 灯・燈・🏮, long paragraphs, and mixed punctuation all belong in realistic documents. When you are ready, select everything and turn this sampler into something of your own.
`;

const zhHans = `---
title: 提灯野外笔记
author: 一位记录者
tags:
  - 写作
  - 野外笔记
draft: false
---

# 提灯野外笔记

这是一份可以直接编辑的 ${markdown} 样例。把光标移入带格式的文字即可看到源码；你可以随意修改，也可以选中全文，换成自己的内容。

[跳到出发清单](#出发清单)，或者从头到尾浏览各种常见写法。

## 文字与强调

段落里可以有*强调*、**加粗**、***同时强调并加粗***、~~已经作废的观察~~和\`行内代码\`。转义符号会保持原样：\\*这里不是强调\\*，\\# 这里也不是标题。

两个行末空格或反斜杠可以要求强制换行。\\
这句话会从下一行开始；普通的自动折行仍然属于同一段。

### 链接与图片

这里有[行内链接](${https}://example.com/field-guide "打开野外指南")、[引用式链接][guide]，以及 <${https}://example.com/lanterns> 这样的自动链接。

![一条连接港口与山丘的手绘路线](./images/lantern-route.png "提灯路线")

[guide]: ${https}://example.com/reference "参考笔记"

## 出发清单

- 带上笔记本和软铅笔。
- 记录天气。
  - 写下风向。
  - 对比最早与最晚的读数。
- 为后续修订留出空白。

1. 标出起点。
2. 步行到旧信号塔。
3. 返程前复核记录。

- [x] 黄昏前测试提灯。
- [x] 把计划路线告诉同伴。
- [ ] 行程结束后补上总距离。

## 引用

> 有用的野外笔记会把亲眼所见与推断所得分开。
>
> 同一段引用中也可以继续写第二段。
>
> > 当资料中又引用了其他来源时，可以使用嵌套引用。

## 小型表格

| 观测点 | 时间 | 风向 | 能见度 |
| :-- | --: | :--: | --: |
| 港口台阶 | 18:10 | 西风 | 8 千米 |
| 松林山脊 | 18:42 | 无风 | 12 千米 |
| 旧信号塔 | 19:05 | 北风 | 6 千米 |

## 代码与结构化数据

句子里可以写 \`const observation = "clear"\`，多行内容则适合使用围栏代码块：

~~~${json.toLocaleLowerCase("en-US")}
{
  "station": "signal-tower",
  "temperature": 14.2,
  "unit": "celsius",
  "verified": true
}
~~~

缩进代码块也是常见写法：

    lantern --brightness medium
    notebook --page 12

---

## 扩展语法与自然降级

下面是一些常见扩展。渲染器即使暂不支持其中某种写法，也可以完整保留原始文本。

### 脚注

读取数据前已经擦净黄铜透镜。[^lens] 如果补充说明会打断正文，也可以使用带名称的脚注。[^method]

[^lens]: 擦镜布保持干燥，表面没有砂粒。
[^method]: 所有读数都在视线高度获取，间隔五分钟，并在读取后立即写下。

### 定义列表

方位角
: 从正北方向起，按顺时针计算的角度。

路标
: 帮助行人辨认路线的可见标记。

### 数学记号

行内公式可以写成 $d = vt$，较长的表达式则可以单独成块：

$$
E = mc^2
$$

### 惰性 ${html}

<details>
<summary>可选的行程记录</summary>

当预览功能有意不执行原始 ${html} 时，这些内容可以继续以源码文本显示。

</details>

## 标题层级

### 三级标题

只有在确实需要表达层级时，才继续使用更深的标题。

#### 四级标题

短小的分节通常比一整面不间断的文字更容易浏览。

##### 五级标题

这个层级并不常用，但可以用来检查间距和大纲嵌套。

###### 六级标题

这是最小的标准标题。

## 结语

分隔线、灯・燈・🏮 这样的多语种字符、较长的段落和混合标点都可能出现在真实文档中。准备好以后，选中全文，把这份样例改成真正属于你的内容吧。
`;

const zhHant = `---
title: 提燈野外筆記
author: 一位記錄者
tags:
  - 寫作
  - 野外筆記
draft: false
---

# 提燈野外筆記

這是一份可以直接編輯的 ${markdown} 範例。把游標移入帶格式的文字即可看到原始碼；你可以隨意修改，也可以選取全文，換成自己的內容。

[跳到出發清單](#出發清單)，或者從頭到尾瀏覽各種常見寫法。

## 文字與強調

段落裡可以有*強調*、**粗體**、***同時強調並加粗***、~~已經作廢的觀察~~和\`行內程式碼\`。跳脫符號會保持原樣：\\*這裡不是強調\\*，\\# 這裡也不是標題。

兩個行尾空格或反斜線可以要求強制換行。\\
這句話會從下一行開始；一般的自動換行仍然屬於同一段。

### 連結與圖片

這裡有[行內連結](${https}://example.com/field-guide "開啟野外指南")、[參照式連結][guide]，以及 <${https}://example.com/lanterns> 這樣的自動連結。

![一條連接港口與山丘的手繪路線](./images/lantern-route.png "提燈路線")

[guide]: ${https}://example.com/reference "參考筆記"

## 出發清單

- 帶上筆記本和軟鉛筆。
- 記錄天氣。
  - 寫下風向。
  - 比較最早與最晚的讀數。
- 為後續修訂保留空白。

1. 標出起點。
2. 步行到舊信號塔。
3. 回程前複核記錄。

- [x] 黃昏前測試提燈。
- [x] 把預定路線告訴同伴。
- [ ] 行程結束後補上總距離。

## 引用

> 有用的野外筆記會把親眼所見與推論所得分開。
>
> 同一段引用中也可以繼續寫第二段。
>
> > 當資料中又引用了其他來源時，可以使用巢狀引用。

## 小型表格

| 觀測點 | 時間 | 風向 | 能見度 |
| :-- | --: | :--: | --: |
| 港口階梯 | 18:10 | 西風 | 8 公里 |
| 松林山脊 | 18:42 | 無風 | 12 公里 |
| 舊信號塔 | 19:05 | 北風 | 6 公里 |

## 程式碼與結構化資料

句子裡可以寫 \`const observation = "clear"\`，多行內容則適合使用圍欄程式碼區塊：

~~~${json.toLocaleLowerCase("en-US")}
{
  "station": "signal-tower",
  "temperature": 14.2,
  "unit": "celsius",
  "verified": true
}
~~~

縮排程式碼區塊也是常見寫法：

    lantern --brightness medium
    notebook --page 12

---

## 擴充語法與自然降級

下面是一些常見擴充。算繪器即使暫不支援其中某種寫法，也可以完整保留原始文字。

### 註腳

讀取資料前已經擦淨黃銅透鏡。[^lens] 如果補充說明會打斷正文，也可以使用具名註腳。[^method]

[^lens]: 擦鏡布保持乾燥，表面沒有砂粒。
[^method]: 所有讀數都在視線高度取得，間隔五分鐘，並在讀取後立即寫下。

### 定義清單

方位角
: 從正北方向起，依順時針計算的角度。

路標
: 幫助行人辨認路線的可見標記。

### 數學記號

行內公式可以寫成 $d = vt$，較長的算式則可以獨立成塊：

$$
E = mc^2
$$

### 惰性 ${html}

<details>
<summary>選擇性的行程記錄</summary>

當預覽功能刻意不執行原始 ${html} 時，這些內容可以繼續以原始碼文字顯示。

</details>

## 標題層級

### 三級標題

只有在確實需要表達層級時，才繼續使用更深的標題。

#### 四級標題

短小的分節通常比一整面不中斷的文字更容易瀏覽。

##### 五級標題

這個層級並不常用，但可以用來檢查間距和大綱巢狀結構。

###### 六級標題

這是最小的標準標題。

## 結語

分隔線、灯・燈・🏮 這樣的多語字元、較長的段落和混合標點都可能出現在真實文件中。準備好以後，選取全文，把這份範例改成真正屬於你的內容吧。
`;

export const rezicsTextSampleDocuments = {
	en,
	"zh-Hans": zhHans,
	"zh-Hant": zhHant,
} as const satisfies Readonly<Record<"en" | "zh-Hans" | "zh-Hant", string>>;
