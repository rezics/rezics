# REZICS Tag Path 語義模型與 UX 設計判斷

## 核心結論

如果今天從頭設計，我不會把 `support`、`display`、`required member` 直接做成 `tag_path_member` 上的幾個布林欄位，也不會讓 Path 本身同時充當階層、斷言、推理規則和 UI 標籤。

我建議採用以下分層：

> **Vocabulary Structure → Tag Expression → Path Sense → Path Application → Derived Projection → Contextual Rendering**

也就是：

* **Tag** 表示穩定的概念身分；
* **Path** 只表示詞彙圖中的一條結構路線；
* **Tag Expression** 表示「對 Unit 到底斷言了什麼」；
* **Path Sense** 把某條 Path 的成員映射到一個 Tag Expression；
* **Path Application** 表示某個 Unit 實際採用了哪個 Path Sense；
* **Effective Tag** 只是檢索／推理投影；
* **Rendered Badge** 是根據當前頁面語境，對一個或多個 Application 臨時計算出的 UI 表示。

因此 Unit 頁面真正展示的既不是單獨的 Tag，也不是完整 Path，而是：

> **一個或多個 Path Application 所共同支持的 Tag Expression 的情境化投影。**

例如：

* `TypeScript` 是簡單 Expression，獨立顯示為 `TypeScript`；
* `發色 = 紅色` 是限定 Expression，獨立顯示為 `發色 · 紅色`；
* `瞳色 = 紅色` 是另一個 Expression，獨立顯示為 `瞳色 · 紅色`；
* 在已經以 `發色` 分組的區塊中，`發色 = 紅色` 可縮短為 `紅色`。

這不是視覺層的小修補，而是需要把目前被混在 Path 裡的幾種語義正式拆開。

目前倉庫中的 `tag_path` 以有序 Tag 陣列作為精確定義身分；`tag_path_member` 只有 `path_id / ordinal / tag_id`，沒有斷言、限定詞、顯示或推理語義。正向 Path fit 又會為每個 Path Member 產生 support，而 `unit_effective_tag` 則是 direct Tag 與 Path-derived support 的可重建聯集。  

前端則把 Path 和普通 Tag 分成兩塊：Path 使用完整 breadcrumb，普通 Tag 使用裸標籤；Associations 只拿到 Tag ID 和標題，因此會出現沒有語義價值的 `Red`。 

---

## 1. 這個問題的本質是什麼？

本質不是「breadcrumb 應該顯示幾層」，而是目前同一個 Path 被迫承擔至少四種完全不同的工作：

1. **詞彙結構與導航位置**：TypeScript 在知識圖中的位置。
2. **Unit 斷言**：這個 Unit 到底被聲稱具備或涉及什麼。
3. **檢索推理**：搜尋上位概念時，要不要找到這個 Unit。
4. **人類可讀表示**：需要顯示多少上下文才能讓人理解。

此外，現在討論中至少存在四種不同的「歧義」，不能用同一個 `requires_context` 屬性處理：

* **詞彙歧義**：例如同名但不同概念的 Java 島嶼與 Java 語言。這應由兩個 Tag concept 加概念級 qualifier 解決。
* **關係／slot 歧義**：同一個 `紅色` 概念被用作髮色或瞳色。這不是兩個紅色概念，而是兩個不同的 Expression。
* **階層位置歧義**：同一概念在 polyhierarchy 中有多個位置。
* **畫面語境歧義**：Expression 本身完整，但分組或頁面標題已經表達部分資訊，因此可以省略。

`人物 → 發色 → 紅色` 的真正意思不是「Unit 同時具有人物、發色、紅色三個 Tag」，而更接近：

$$
hairColor(Unit, Red)
$$

同樣，對一個使用 TypeScript 寫成的軟體：

$$
implementationLanguage(Unit, TypeScript)
$$

即使存在：

$$
TypeScript \; isA \; ProgrammingLanguage
$$

也不能自動推出：

$$
about(Unit, ProgrammingLanguage)
$$

更不能推出 Unit 本身「是程式語言」。這說明 **概念間的 hierarchy 與 Unit 對概念的關係不能透過普通 Tag fan-out 混為一談**。

成熟系統也普遍把這些問題拆開。MeSH 中一個 Descriptor 可以有多個 tree position，實際索引使用特定 Descriptor／Qualifier，而搜尋時是否展開 narrower terms 是另一個檢索選項；SKOS 也刻意區分直接 `broader` 關係與用於 query expansion 的傳遞閉包。([National Library of Medicine][1])

---

## 2. Tag、Path、Path Application、Effective Tag 各自應該代表什麼？

僅靠這四個概念還不夠。REZICS 至少需要補上一個 **Tag Expression**，以及將 Path 映射到 Expression 的 **Path Sense**。

| 對象                       | 推薦語義                                                                                                   | 不應代表                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Tag**                    | 一個穩定、語言無關的 concept identity，擁有多語標題、別名、scope note                                      | 某次 Unit 應用、某條 breadcrumb、某個 UI badge  |
| **Tag Path**               | 一條有序且具有 typed edges 的 vocabulary route／hierarchy position                                         | Unit 同時具有所有成員、完整斷言包、預設顯示字串 |
| **Tag Expression**         | 可被應用到 Unit 的結構化語義，例如 `simple(TypeScript)`、`facetValue(發色, 紅色)`                          | 完整 Path 或純文字拼接                          |
| **Path Sense**             | 某條 Path 如何實現一個 Expression；把 Path Member 綁定為 focus、slot、value、qualifier 等角色              | Unit 應用本身                                   |
| **Path Application**       | 在某個 authority 下，一個 Unit 實際採用某個 Path Sense 的來源事實                                          | Tag 的全部全局位置、推理出的祖先集合            |
| **Direct Tag Application** | 不依賴 Path，直接應用簡單 Expression 的來源事實                                                            | 所有 qualified usages                           |
| **Effective Tag**          | 從 direct application、Expression 和明確 inference rules 派生出的可重建檢索投影                            | UI 應展示的 badge、使用者直接投票的語義單位     |
| **Rendered Badge**         | 對一個或多個 Application／Expression，在 locale、surface、group、authority、spoiler context 下計算出的表示 | 持久化的 domain identity                        |

最重要的不變量是：

$$
Path \neq Expression \neq Application \neq EffectiveTag \neq Badge
$$

其中：

$$
Application = Unit + Authority + PathSense
$$

$$
PathSense = Path + ExpressionBinding
$$

$$
EffectiveTags = f(AcceptedApplications,\ DirectApplications,\ ExplicitInferenceRules)
$$

$$
Badge = Render(Group(Applications),\ RenderContext)
$$

MeSH 把 descriptor identity、tree location、descriptor/qualifier indexing expression 和檢索展開分開；Wikidata 把 item identity 與 property-value statement 分開，statement 還能攜帶 qualifier、reference 和 rank。這些系統都支持「概念身分不等於使用該概念所構成的陳述」這一判斷。([National Library of Medicine][1])

---

## 3. Path Member 需要哪些語義屬性？為什麼？

我的判斷是：

> **`tag_path_member` 本身不應擁有通用的 `support:boolean` 和 `display:boolean`。**

Path Member 的核心資料應仍然很少：

* `path_id`
* `ordinal`
* `node_id`
* 與前一節點之間的 typed relation／edge

但 Path 不應再被限定為只能包含可斷言的 Tag。長期最乾淨的模型是引入統一的 `VocabularyNode`：

* `concept node`：對應 Tag，可索引、可作 Expression argument；
* `guide node`：只用於組織和導航，不是 concept，不可被應用或取得 support。

這不是另做一套 VNDB Trait 系統，而是在同一詞彙圖中允許兩種節點語義。Getty AAT 的 Guide Term 就是為了在沒有合適 concept 的位置建立分組層級，而且官方明確規定 Guide Term 不供 indexing 或 cataloging；SKOS 也把供 node label 使用的 Collection 與 Concept 分成不相交類別。([Getty][2])

同時，Path 的相鄰關係需要 typed edge。至少應能區分：

* generic／is-a；
* partitive／part-of；
* instance；
* organizational；
* facet／slot-value 類關係。

Getty 詞彙體系正式區分 generic、partitive、instance 等 hierarchy relationship type，因為它們的可傳遞性與語義後果並不相同。([Getty][3])

真正與 Application 有關的角色，應放在 **Path Sense／Expression binding** 上，而不是直接塞進 Path Member：

| 關注點                       | 應由誰持有                       | 例子                               |
| ---------------------------- | -------------------------------- | ---------------------------------- |
| 是否位於 Path 中             | Path Member                      | `外貌` 位於 ordinal 1              |
| 與前一節點的關係             | Path Edge                        | `紅色` 是 `發色` 的可選值          |
| Expression 的 focus/value    | Path Sense binding               | `紅色` 是 value                    |
| Expression 的 slot/predicate | Path Sense binding               | `發色` 是 slot                     |
| 獨立顯示所需組件             | Expression label signature       | `[發色, 紅色]`                     |
| Grouping key                 | Expression presentation metadata | `發色`                             |
| 主要斷言                     | Expression                       | `發色=紅色`                        |
| 可推導的概念                 | Explicit inference rule          | 可選擇推導 `人物特徵`              |
| 純搜尋展開                   | Retrieval rule                   | 搜尋 `紅色` 或 `外貌特徵` 時可找到 |
| breadcrumb fallback          | Path                             | 完整 route                         |

單一 role enum 同樣不夠，因為同一成員可能同時是：

* Expression 的 slot；
* UI 的 qualifier；
* grouping key；
* 搜尋 filter key。

而 inference output 甚至可能不是 Path Member。例如某個 Expression 可以明確推出 `前端開發`，即使 `前端開發` 不在原 Path 裡。這進一步證明 `support:boolean` 不應是 Path Member 屬性。

---

## 4. 展示語義和推理／support 語義應如何分離？

兩者應該在資料模型上完全分開，但不應是毫無約束的任意布林組合。它們應共同追溯到同一個 Expression。

我建議把現在籠統的 support 分成四層：

| 層次                    | 含義                                  | 是否接受使用者對該事實投票 |
| ----------------------- | ------------------------------------- | -------------------------: |
| **Primary assertion**   | Application 直接聲稱的完整 Expression |   是，透過 Application fit |
| **Entailed assertion**  | 由明確、經治理的語義規則推出          |   通常不單獨投票，保留來源 |
| **Retrieval expansion** | 為提高 recall 而在查詢時展開          |                         否 |
| **Navigation context**  | 只供 hierarchy／browse 使用           |                         否 |

因此，正向 Path fit 應支持的是：

> 「這個 Unit 符合這個 Tag Expression」

而不是：

> 「這個 Unit 對 Path 中所有 Tag 都投了正向票」。

以：

`編程 → 編程語言 → TypeScript`

為例，可以配置成：

* Primary assertion：`simple(TypeScript)` 或 `implementationLanguage(TypeScript)`；
* `編程語言`：slot、分類或導航節點，不取得 Unit support；
* `編程`：只有在存在經治理的明確 entailment／retrieval rule 時，才成為 inferred result；
* UI label：`TypeScript`；
* full breadcrumb：只供 Path detail／popover 展開。

VNDB 的 API 很清楚地區分這些層次：VN 返回的 Tag 只包含直接應用的 Tag，不返回父 Tag；但 `tag` 搜尋會匹配父級，`dtag` 則只匹配直接 Tag。Trait 也有 `trait`／`dtrait` 的同類區分。([VNDB API][4])

MeSH 也採用同樣的基本原則：文獻以具體 Descriptor／Qualifier 索引，而 PubMed 的預設搜尋可以「explode」到 narrower descriptors；使用 `noexp` 則可關閉展開。([National Library of Medicine][5])

SKOS 更直接地把 `broader` 視為直接關係，把 `broaderTransitive` 視為推理閉包，並指出傳遞閉包適合 query expansion，而不是拿來取代直接斷言。([W3C][6])

Danbooru 則沒有因為 Tag 位於某個隱含 hierarchy 就自動繼承，而是把 implication 做成明確、有方向、可治理的邊，並檢查循環和重複的傳遞關係。

另一個重要後果是：目前「同一 Profile 對裸 `紅色` 投負票，同時對 `發色=紅色` Path 投正票」不應被視為必然衝突。前者與後者可能是不同斷言。只有它們最終映射到同一 Expression／claim key 時，才需要做去重或衝突判斷。

---

## 5. 如何統一 self-describing Tag 和 context-dependent Tag？

不應給 Tag 增加全局 `requires_context`。

應該由 **Tag Expression 的 standalone semantic label signature** 決定。

例如：

| Expression               | Standalone signature | 獨立顯示      |
| ------------------------ | -------------------- | ------------- |
| `simple(TypeScript)`     | `[TypeScript]`       | `TypeScript`  |
| `simple(懸疑)`           | `[懸疑]`             | `懸疑`        |
| `facetValue(發色, 紅色)` | `[發色, 紅色]`       | `發色 · 紅色` |
| `facetValue(瞳色, 紅色)` | `[瞳色, 紅色]`       | `瞳色 · 紅色` |

深層 Path：

`人物特徵 → 外貌 → 頭部 → 頭髮 → 發色 → 紅色`

仍然可以映射到：

`facetValue(發色, 紅色)`

因此獨立顯示仍是：

`發色 · 紅色`

而不是完整 Path。

這裡必須區分兩種 qualifier：

### Concept-level qualifier

用於同名但不同概念，例如：

* Java（程式語言）
* Java（島嶼）

這應進入 Tag concept identity／label。

### Expression-level qualifier

用於同一概念在不同 slot 中的使用，例如：

* 發色 · 紅色
* 瞳色 · 紅色

此時 `紅色` 仍然是一個 Tag。

Getty AAT 的 qualifier 主要用於區分 homograph，並且特別指出 qualifier 不應拿來表達 compound concept；組合概念應保留成分概念並在索引或應用時組合。這正好支持 REZICS 把 `紅色` 保留為同一 concept，再以 Expression 表達 `發色=紅色`。([Getty][7])

VNDB Trait 採取了更硬的產品規則：Trait 名稱不一定自描述，因此官方 API 要求始終連同 top-level group 顯示。REZICS 不應照搬成「所有 Trait 都顯示 group」，而應把它泛化成每個 Expression 自己的最小獨立 signature。([VNDB API][4])

---

## 6. 一個 Tag 多 Path 時，Unit 頁面與 Tag card 應如何表現？

必須明確區分：

* **Tag 的所有全局 hierarchy positions**；
* **這個 Unit 實際採用的 Path Applications**。

Unit 頁面的 badge 只根據後者產生。點擊後，popover 再分成兩個區域：

### 「此 Unit 的應用」

置頂顯示形成這個 badge 的實際來源：

* Path Application；
* direct application；
* authority；
* fit／spoiler；
* provenance；
* 必要時可展開完整 breadcrumb。

### 「此 Tag 的其他位置」

摺疊顯示 Tag 在全局詞彙圖中的其他位置，明確標示它們**沒有被此 Unit 採用**。

當一個 Unit 實際採用兩條 Path 時：

#### 兩條 Path 映射到同一 Expression

例如：

* `人物 → 發色 → 紅色`
* `人物特徵 → 外貌 → 發色 → 紅色`

都映射到 `發色=紅色`。

Unit Overview 顯示一個：

`發色 · 紅色`

Popover 顯示：

`2 個應用來源`

並列出兩條完整 Path。投票控制仍然針對各自 Application，不針對合併後的 badge。

#### 兩條 Path 映射到不同 Expression

例如：

* `發色=紅色`
* `瞳色=紅色`

顯示為兩個獨立語義項，最好分組成：

* 發色：紅色
* 瞳色：紅色

#### 兩個 Expression 恰好渲染成同一字串

不能按照字串合併。Renderer 必須恢復更多 qualifier、relation label 或 authority label，直到可區分。

因此 badge 的合併鍵應是：

$$
(authority,\ expressionId)
$$

而不是：

$$
renderedText
$$

MeSH 與 Getty AAT 都允許同一 concept 出現在多個 hierarchy position；Getty 甚至允許多個 parent，只指定一個 preferred parent 供預設展示，但其他 parent 對 retrieval 仍然成立。這支持「多位置是真實結構；預設顯示只是一個 presentation choice」的區分。([National Library of Medicine][1])

我不建議 REZICS 把某條 Path 永久提升為概念的語義性 `primaryPath`。需要顯示 breadcrumb 時，優先使用當前 Unit 實際採用的 Path；沒有 Unit context 時，再使用可替換的 presentation ranking，並顯示「另有 N 個位置」。

---

## 7. Overview、Associations、Search、Picker、Tag Detail 各自應展示多少 Path 資訊？

成熟 faceted UI 的共同做法不是把完整 hierarchy 塞入每個結果，而是讓 facet heading、目前選擇、breadcrumb 和分組共同承擔上下文，逐層披露下一步資訊。Getty 的搜尋結果也使用 preferred term 加縮短過的 parent string，而完整 hierarchy 留在詳細頁。([Flamenco at Berkeley][8])

我建議各 surface 採用以下規則：

| Surface                        | 預設顯示                                                                                          | 完整 Path 何時出現             |
| ------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Unit Overview**              | direct／Path Applications 的 Expression projection；facet-like 項目按 group 聚合                  | 點擊 badge 後展開              |
| **Associations preview**       | 最緊湊的 `group：value1、value2`；最多一至兩行                                                    | popover 或 Associations 詳情頁 |
| **Search result：Unit**        | 顯示 match reason，例如 `匹配：發色 · 紅色`；明確標示 direct／inferred                            | 展開「為何匹配」               |
| **Search result：Tag concept** | Tag 標題、scope summary、最小 context；多位置顯示 `另有 N 個位置`                                 | Tag detail                     |
| **Tag Picker**                 | 使用者選擇 Expression／Path Sense，而不是歧義的裸 Tag；一眼顯示 `發色 · 紅色`                     | hover／expand 顯示完整 Path    |
| **Tag Badge Popover**          | 先顯示此 Unit 的實際 Application；再顯示全局其他位置                                              | Application row 展開           |
| **Tag Detail**                 | 以 Tag concept 為主；分開列出 direct usages、qualified expressions、all positions、inferred reach | Paths section 顯示完整結構     |
| **Path Detail／Explorer**      | 完整 breadcrumb、typed edges、guide nodes、Path Senses、assertion outputs、inference rules        | 這裡完整展示是正常狀態         |
| **Curation UI**                | 同時展示結構、Expression binding、label signature 和 inference 規則                               | 不做省略                       |

Picker 不應繼續採用「只有一條 ending Path 就靜默套用」作為普遍規則。只有當搜尋結果唯一、Expression 無歧義，且畫面明確呈現即將應用的語義時，才能一鍵套用。否則應選擇：

* `紅色`

  * 發色 · 紅色
  * 瞳色 · 紅色
  * 其他 qualified usages

---

## 8. Grouping／aggregation 的正式渲染規則應是什麼？

你提出的：

$$
renderedLabel = requiredMembers - informationAlreadyExpressedByContext
$$

方向是合理的，但 `requiredMembers` 必須改成 **Expression 的語義 label components**，不能直接對 Path Member 做集合減法。

### 定義

對 Expression \(e\) 與 locale \(l\)，定義：

$$
Sig(e,l)=[c_1,c_2,\ldots,c_n]
$$

這是 Expression 在沒有任何外部語境時，足以表達其語義的有序 component IDs。

例如：

$$
Sig(hairColorRed,zh)=[hairColor,red]
$$

Render Context \(C\) 不是文字集合，而是已由頁面明確表達的 semantic component／role：

* group heading；
* section authority；
* 已套用的 filter；
* 當前 Path Explorer 節點；
* association role；
* 上層卡片標題。

### 正式算法

#### 1. 先做可見性過濾

先按 authority、權限、spoiler、content label 過濾 Application。只有可見來源才能形成 badge。

#### 2. 先做語義聚合

若兩個來源滿足：

$$
authority(a)=authority(b)
$$

且：

$$
expression(a)=expression(b)
$$

則先聚合為一個 presentation item，但保留所有 Application IDs 和 provenance。

不同 authority 不自動合併。

#### 3. 選擇 group

Expression 可以聲明一個語義 `groupKey`，例如 `發色`。

不能根據「第一個祖先」或「最常見 parent」自動猜 group。只有被 Expression 明確聲明為 facet／slot／group key 的成員才可作分組鍵。

若 renderer 顯示：

**發色**

則把 `發色` 加入 \(C\)。

#### 4. 做 contextual subtraction

$$
Residual(e,C)=Sig(e)-C
$$

但有三個限制：

* 只刪除 semantic ID 和 role 都匹配的 component；
* value／focus 至少保留一個；
* 不能因為文字相同就刪除。

因此：

$$
Sig=[aa,bb,cc], \quad C=\{aa\}
$$

結果是：

$$
[bb,cc]
$$

正好得到：

`bb · cc`

#### 5. 做 collision repair

在同一可見集合中，如果兩個不同 Expression 的 residual label 相同，依序恢復資訊：

1. 最近被省略的 semantic qualifier；
2. Expression 定義的 fallback qualifier；
3. 能區分的 Path ancestor；
4. authority／relation label；
5. 最後才是完整 breadcrumb。

選擇第一個能區分非等價 Expression 的候選。

完整公式可寫成：

$$
Render(e,C,V)=FirstUnique(
Residual,\ RestoreQualifier,\ AddFallback,\ FullPath
)
$$

其中 \(V\) 是同一畫面上的可見 Expression 集合。

### 例子

普通卡片：

`aa · bb · cc`

已按 `aa` 分組：

**aa**

* `bb · cc`

對髮色／瞳色：

**發色**

* 紅色
* 黑色

**瞳色**

* 紅色
* 藍色

對無 grouping 的緊湊 badge：

* 發色 · 紅色
* 瞳色 · 紅色

這套規則能同時服務 Overview、Associations、Search、Picker 和 Popover；差異只在各 surface 提供的 \(C\)、可用空間和 fallback depth。

---

## 9. Path identity 到底是否應包含 configuration？

答案不是簡單的「包含」或「不包含」，因為現在所謂 configuration 混合了不同種類的資料。

應按以下方式分層：

| 發生變化的內容                           | 應產生什麼新身分                       |
| ---------------------------------------- | -------------------------------------- |
| ordered node sequence 改變               | 新 Path                                |
| typed edge sequence／edge semantics 改變 | 新 Path                                |
| 同一 Path 被解讀為不同 proposition       | 新 Tag Expression／Path Sense          |
| focus／slot／predicate 改變              | 新 Expression／Path Sense              |
| `發色 · 紅色` 改為另一個同義顯示模板     | 同一 Expression，presentation revision |
| separator、縮寫、ellipsis 改變           | renderer policy 變更                   |
| inferred output 改變                     | inference rule revision                |
| locale 標題或翻譯改變                    | 同一概念與 Expression                  |
| ranking／usage count 改變                | aggregate 更新，不改 identity          |

因此我推薦：

### Path identity

由：

$$
ordered\ node\ sequence + typed\ edge\ sequence
$$

確定。

不包含 support、display、ranking、usage 等 configuration。

### Tag Expression identity

由結構化 proposition 確定，例如：

$$
facetValue(hairColor,red)
$$

或：

$$
simple(TypeScript)
$$

### Path Sense identity

由：

$$
Path + Expression + memberRoleBinding
$$

確定。

同一 Path 可以有多個 Path Sense，但這應是少數情況，只有在同一結構路線確實存在不同應用語義時才成立。

### 對你提出的 configuration A／B

若 A／B 只是：

* 顯示哪些成員；
* 是否將某些祖先加入搜尋；

它們不是兩條 Path，也未必是兩個 Path Sense。應分別落在 presentation definition 與 inference rules。

只有當 A／B 表達的 Unit proposition 不同，才是兩個 Path Sense／Expression。

這種分層帶來的效果是：

* **uniqueness**：Path 不會因 UI 改版而碎裂；
* **governance**：結構 Path、Expression、inference rule 分別審核；
* **voting**：Path vote 評估路線合法性，Application fit 評估 Unit 是否符合 Expression；
* **merging**：Path merge 與 Expression merge 分開；
* **history**：語義變更不覆寫舊 Application；
* **application identity**：Application 指向不可變 Path Sense；
* **cache**：label cache 可用 `expressionRevision + locale`，Path cache 用 path ID；
* **popularity**：Expression usage 與 Path usage 分別統計；
* **URL**：Path URL 穩定；必要時另有 Expression／Sense 地址；
* **conflict resolution**：可以明確判斷爭議發生在結構、語義、推理還是顯示。

---

## 10. 哪些來自成熟系統，哪些是我的推導？

| 系統／研究                  | 直接可得到的結論                                                                                                                                                                                          | REZICS-specific 推導                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **VNDB Tags／Traits**       | Tag／Trait 形成 DAG；搜尋父級可匹配子級，但條目返回的是直接應用 Tag；Trait 名稱可能不自描述，因此搭配 group 顯示。([VNDB API][4])                                                                         | 不必拆成 Tag／Trait 兩套產品；可把 group 泛化成每個 Expression 的 standalone signature。           |
| **MeSH**                    | Descriptor 可以有多個 tree position；Descriptor／Qualifier 是索引單位；搜尋可 explode narrower terms，也可關閉；複雜主題可用 Descriptor 組合或 Descriptor／Qualifier。([National Library of Medicine][1]) | Path position、索引 Expression 和 retrieval expansion 應是不同物件。                               |
| **SKOS**                    | Concept、label、semantic relation、Collection 分離；直接 broader 與 transitive closure 分離；polyhierarchy／alternative paths 合法；Collection 可供 node label 使用但不是 Concept。([W3C][6])             | REZICS 應有 concept node 與 guide node，且不能把 hierarchy closure 當 Unit assertion。             |
| **ISO 25964**               | 標準將 thesaurus 的 concept、term、relation、facet analysis、presentation 和資料模型視為不同問題，面向資訊檢索而非單純 UI 樹。([ISO][9])                                                                  | REZICS 不應用一個 Path Member role 同時承載所有語義。                                              |
| **Getty AAT**               | Guide Term 只供組織、不供 indexing；hierarchy edge 有 generic／partitive／instance 類型；支援多父級；水平顯示會生成並縮短 parent string。([Getty][2])                                                     | Path 應有 typed edges，完整 breadcrumb 應主要出現在 detail／explorer，compact label 應是獨立投影。 |
| **LCSH**                    | Pre-coordinated heading string 可保留概念間上下文，提高 precision／browseability，同時也能被機器拆解做 post-coordinate search。([Library of Congress][10])                                                | `發色 · 紅色` 應是結構化 Expression 的顯示，而不是把字串本身或完整 breadcrumb 當 identity。        |
| **Wikidata**                | Concept／item 與 statement 分開；statement 由 property-value 構成，可附 qualifier、reference、rank。([Wikidata][11])                                                                                      | `發色=紅色` 應被視為 proposition，而不是單獨 `紅色` Tag 的 UI 別名。                               |
| **Danbooru**                | Tag implication 是明確、有方向、可治理的規則，會檢查循環和重複的傳遞關係。                                                                                                                                | REZICS 的 ancestor inference 應由明確規則產生，而不是 Path-wide fan-out。                          |
| **Faceted navigation 研究** | Facet 名稱、目前選擇、階層 breadcrumb 和逐步 drill-down 共同表達 context；結果可在已選 facet 下分組，避免重複資訊。([Flamenco at Berkeley][8])                                                            | `signature - render context + collision repair` 是合理的統一 renderer。                            |

以下部分不是任何單一標準直接給出的答案，而是我針對 REZICS 推導出的設計：

* Tag Expression；
* 可由多條 Path 共同實現同一 Expression；
* Path Sense 作為 Path 到 Expression 的 binding；
* Expression-based badge aggregation；
* 正式 contextual subtraction；
* collision repair ladder；
* Path identity、Expression identity、presentation revision 和 inference revision 的分層；
* Unit 頁面顯示 Applied Expression，而非 Effective Tag。

---

## 11. 最終推薦的資料模型和 UX 模型

### 11.1 語義流程

```text
Tag / Guide Node
        │
        ├── typed relations ──> Tag Path
        │                         │
        │                         └── Path Sense ──> Tag Expression
        │
Unit + Authority + Path Sense ──> Path Application
Direct Tag Application ─────────> Simple Tag Expression

Accepted source applications
        └──> Unit Expression Assertion
                  ├──> Explicit inference / retrieval projections
                  │         └──> Unit Effective Tags / Search index
                  └──> Render context
                            └──> Badge / Group / Popover
```

### 11.2 概念性 relational model

這裡是語義 schema，不是 SQL 實作方案。

#### Vocabulary 結構

* `vocabulary_node`

  * `id`
  * `kind = concept | guide`
* `tag`

  * `node_id`
  * concept identity、scope note、lifecycle
* `guide_node`

  * `node_id`
  * 組織名稱、lifecycle
* `tag_relation`

  * `parent_node_id`
  * `child_node_id`
  * `relation_kind`
  * provenance／governance

#### Path 結構

* `tag_path`

  * immutable ID
  * structural identity hash
* `tag_path_member`

  * `path_id`
  * `ordinal`
  * `node_id`
  * incoming edge／relation reference

Path Member 不含 `support` 或 `display`。

#### Expression 結構

* `tag_expression`

  * immutable semantic ID
  * `expression_kind`
  * canonical claim key
  * focus／value concept
* `tag_expression_argument`

  * `expression_id`
  * `role = predicate | slot | value | focus | qualifier`
  * concept ID
* `tag_expression_label_component`

  * `expression_id`
  * locale 或語言無關 component reference
  * ordinal
  * presentation role
* `tag_expression_group_key`

  * `expression_id`
  * slot／facet component
* `tag_expression_inference_rule`

  * source Expression
  * target Tag／Expression
  * `kind = entailed | retrieval_only`
  * provenance、status、revision

#### Path 到 Expression 的映射

* `tag_path_sense`

  * immutable ID
  * `path_id`
  * `expression_id`
  * member-role binding signature
  * lifecycle、provenance
* `tag_path_sense_binding`

  * sense ID
  * path member ordinal
  * expression argument role

#### Unit 來源事實

邏輯上：

* `unit_direct_tag_application`
* `unit_tag_path_application`
* 對應 judgments／fit／spoiler／provenance

Path Application 指向 `path_sense_id`，而不是只指向裸 `path_id`。

Global 與 Realm 必須保留 authority key。Realm 可以採用全局 Path Sense，但不能在同一 ID 下悄悄改變其語義；若 Realm 需要不同 interpretation，應建立 Realm-scoped Sense。現有 REZICS 已經刻意將 Global 與 Realm 的 Path adoption、application 和 vote population 分離，新的 projection 也應保留這一點。

#### 可重建投影

* `unit_expression_assertion`

  * 對同一 Unit／authority／Expression 聚合 direct 和 Path sources
* `unit_effective_tag`

  * direct、primary expression、entailed、retrieval evidence counts
* search documents／facet indexes
* usage／ranking aggregates

#### 不應持久化

* rendered badge；
* `發色 · 紅色` 拼接字串；
* 已減去 render context 的 residual label；
* 某次畫面中的 group；
* 「目前最短但唯一」的 breadcrumb。

它們都應由 definition cache 加當前 render context 得出。

### 11.3 規模影響

目前模型的正向 fit 會按 Path 長度 \(L\) 為每個 Profile 展開所有 member support；容量文件也明確把寫放大建模為隨 \(L\) 增長，並把 support tables 規劃到數億／數十億列與很高的 WAL 壓力。

新模型的 fan-out 應取決於明確 assertion／inference output 數 \(A\)：

$$
O(L) \rightarrow O(A)
$$

其中通常：

$$
A=1
$$

例如 `發色=紅色` 的主要來源事實是一個 Expression assertion，而不是四至六個 Path Member support。

Ancestor query expansion 優先放在：

* definition-scale closure cache；
* 搜尋引擎 filter expansion；
* bounded query-time expansion；

而不是為每個 Profile、每個 Unit、每個 Path Member 建立 support row。

Path Sense、Expression、label component 和 inference rule 都是 definition-scale 關係，相比 Unit application／judgment 表非常小。對每個 Unit 的讀取只需要：

1. bounded 讀取實際 applications；
2. batch hydrate Path Sense／Expression definitions；
3. 聚合 Expression；
4. render。

不需要 request-path 遍歷整張圖。

### 11.4 遷移原則

由於 REZICS 的 released migration history 必須 append-only，不能覆寫舊 migration，切換應以新 definition／projection 並行的方式完成。

設計上應遵循：

1. 為現有 Path 建立保守 Path Sense；無法可靠判定時，暫時以完整 Path 作 display fallback，標記待策展。
2. 不把現有 all-member support 重新解釋成歷史使用者真的對祖先概念作過斷言；它們只是 legacy derived projection。
3. 將現有 Unit–Path Application 對應到新的 Path Sense，保留原 judgment 與 provenance。
4. 並行生成新的 Expression assertion／Effective Tag projection，與舊搜尋結果比較。
5. UI 先切換到 Expression projection，再切換搜尋與推理。
6. 只有在 parity、搜尋 recall、badge collision 和投票語義驗證完成後，才停止 legacy fan-out。

應監控的指標包括：

* 尚未策展 Path Sense 比例；
* 平均 standalone label component 數；
* collision repair 發生率；
* full breadcrumb fallback 比例；
* 多 Application 合併為一個 Expression 的比例；
* inferred search result 的點擊／否決率；
* 每個 Application 的 assertion output 數；
* support row／WAL 降幅；
* Picker 中使用者返回或改選 sense 的比例。

### 11.5 必要範例的最終行為

| 例子                                                          | 最終語義與 UI                                                                                                                |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **A**：只應用 `人物特徵→外貌→發色→紅色`                       | Expression=`發色=紅色`；Overview 顯示 `發色 · 紅色`；完整 Path 在 popover                                                    |
| **B**：同時應用髮色紅與瞳色紅                                 | 兩個 Expression；分組顯示 `發色：紅色`、`瞳色：紅色`                                                                         |
| **C**：TypeScript 有多個全局 Path，Unit 只應用一條            | Overview 顯示 `TypeScript`；popover 的「此 Unit 的應用」只列一條，其他 Path 放在「其他位置」                                 |
| **D**：`aa→bb→cc` 都是 standalone signature，畫面已按 aa 分組 | group heading=`aa`；child label=`bb · cc`                                                                                    |
| **E**：中間節點不能成為 Unit assertion                        | 中間節點保留於 Path；沒有 support；若需搜尋匹配，使用 retrieval-only rule                                                    |
| **F**：相同 member sequence 有兩個候選 configuration          | 仍是一條結構 Path；顯示變更是 presentation revision，推理變更是 rule revision，斷言含義不同才建立另一 Expression／Path Sense |
| **G**：Global 與 Realm Path 同時可見                          | 以 authority 分 section／chip；不合併 vote population；同名 badge 也不跨 authority 聚合                                      |

---

## 12. 相比其他候選方案的明確 trade-off

| 方案                                                     | 優點                                                                                   | 主要問題                                                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Path Member `support/display` 布林**                   | 最容易接到現有 schema                                                                  | 無法表達 property-value proposition；允許大量無意義組合；推理 output 只能是 Path Member；顯示和語義版本糾纏 |
| **單一 role enum**                                       | 看似比布林乾淨                                                                         | 一個 member 經常同時是 slot、qualifier、group key；角色不是互斥的                                           |
| **全局 `Tag.requiresContext`**                           | UI 實作簡單                                                                            | 是否需要 context 取決於 Expression、locale 和 surface，不是 Tag 的全局性質                                  |
| **所有畫面顯示完整 breadcrumb**                          | 不易丟失資訊                                                                           | 噪音極大；深層 Path 不適合 Overview／Associations；仍未解決 assertion fan-out                               |
| **自動選擇最短唯一 ancestor**                            | 少策展工作                                                                             | 「唯一」不等於「語義充分」；圖結構和翻譯變動會造成標籤漂移；polyhierarchy 下不穩定                          |
| **Tag／Trait／Facet 分成多套系統**                       | 每個 domain 可做專用 UX                                                                | 重複 concept identity、API、治理和搜尋；跨類型 Unit 很難統一                                                |
| **Path sequence + 所有 configuration 共同決定 identity** | 每個配置不可變、容易快取                                                               | UI 或 inference 小改就產生新 Path，碎裂 votes、usage、URL、merge 與歷史                                     |
| **Path sequence-only，configuration 原地可變**           | ID 穩定                                                                                | 舊 Application 語義會隨配置漂移，歷史與 cache 不可信                                                        |
| **結構 Path + Expression + Path Sense**                  | 語義邊界最清楚；支援 mixed model、polyhierarchy、聚合、Realm、明確推理；可降低 fan-out | 增加 definition 層、策展 UI、API projection 和遷移複雜度                                                    |

推薦模型的主要代價確實是多出 `Tag Expression` 與 `Path Sense` 兩個概念。但這些複雜度本來就已經存在：目前只是被藏在 Path fan-out、完整 breadcrumb、裸 Tag、Picker 猜測和前端特殊分支裡。將它們正式建模，會把隱性且不可驗證的複雜度，轉換成可治理、可測試、可觀察的複雜度。

## 最終判斷

REZICS 最終應採用一套統一的 vocabulary／Tag Path 系統，但不能再讓 Path 成為「所有語義的容器」。

最關鍵的四條原則是：

1. **Path membership 永遠不自動等於 Unit assertion。**
2. **Unit 頁面展示的是 Applied Tag Expression，而不是 Effective Tag 或完整 Path。**
3. **顯示、斷言、推理、導航必須是分離的模型層；不能濃縮成 Path Member 上的一個 role 或兩個布林。**
4. **Path identity 保持結構性；語義 configuration 進入 Expression／Path Sense，顯示與 inference 再各自版本化。**

在這個模型下，`發色 · 紅色` 不再是 UI 為了補救裸 `紅色` 而臨時拼出的字串，而是對一個正式 Expression `發色=紅色` 的最小獨立表示；完整 `人物特徵→外貌→發色→紅色` 則回到它真正擅長的位置：導航、策展、來源解釋與 Path Explorer。

[1]: https://www.nlm.nih.gov/mesh/intro_trees.html "https://www.nlm.nih.gov/mesh/intro_trees.html"
[2]: https://www.getty.edu/publications/vocabularies-editorial-guidelines/aat-guidelines/3_editorial_rules/3.1/ "https://www.getty.edu/publications/vocabularies-editorial-guidelines/aat-guidelines/3_editorial_rules/3.1/"
[3]: https://www.getty.edu/publications/vocabularies-editorial-guidelines/ulan-guidelines/3_editorial_rules/3.1/ "https://www.getty.edu/publications/vocabularies-editorial-guidelines/ulan-guidelines/3_editorial_rules/3.1/"
[4]: https://api.vndb.org/kana "https://api.vndb.org/kana"
[5]: https://www.nlm.nih.gov/mesh/intro_retrieval.html "https://www.nlm.nih.gov/mesh/intro_retrieval.html"
[6]: https://www.w3.org/TR/skos-reference/ "https://www.w3.org/TR/skos-reference/"
[7]: https://www.getty.edu/publications/vocabularies-editorial-guidelines/aat-guidelines/3_editorial_rules/3.3/ "https://www.getty.edu/publications/vocabularies-editorial-guidelines/aat-guidelines/3_editorial_rules/3.3/"
[8]: https://flamenco.berkeley.edu/papers/faceted-workshop06.pdf "https://flamenco.berkeley.edu/papers/faceted-workshop06.pdf"
[9]: https://www.iso.org/standard/53657.html "https://www.iso.org/standard/53657.html"
[10]: https://www.loc.gov/catdir/cpso/pre_vs_post.html "https://www.loc.gov/catdir/cpso/pre_vs_post.html"
[11]: https://www.wikidata.org/wiki/Help%3AStatements "https://www.wikidata.org/wiki/Help%3AStatements"
