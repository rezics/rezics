基於 history service， 二創，分發之類的可以基於history tree的version，然後就類似於git version

可以進行 fork.

fork 之後，需要注意繼承作者信息，以及版權/授權，以及購買分成方案，因爲這不是開源的內容，甚至只能假fork

就是前面章節的閱讀必須去讀原作，而不能在新作中瀏覽

不過需要注意，中間版本一定會造成更多的服務器資源消耗

我的意見是純history獨立service，理由是不同的版本大概率不會需要不同的元信息，如果不同的版本真的大到tag需要分裂，entity信息需要修改，那就在main server 發佈 release 徹底分裂比較好

history version 重要的是 版本uuid 本身以及 計算/讀取某個版本的能力

基於此chapter的版權（指的是cc版權聲明那種，不過默認應該是rezics的作者主導版權）是分開的，價格也是分開的，實際上大概是都需要寫入unit的通用能力
