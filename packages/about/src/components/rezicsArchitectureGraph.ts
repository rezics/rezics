export const REZICS_ARCHITECTURE_NODE_LABELS = [
  "Work / Unit",
  "Library / Catalog",
  "Review",
  "Shelf",
  "Wiki",
  "Realm",
  "Global Tag",
  "Realm Tag Application",
] as const;

export const REZICS_ARCHITECTURE_DOT = String.raw`
digraph RezicsArchitecture {
  graph [
    rankdir=LR,
    bgcolor="transparent",
    margin=0,
    nodesep=0.42,
    ranksep=0.68,
    splines=ortho,
    outputorder=edgesfirst
  ];

  node [
    shape=box,
    style="rounded,filled",
    penwidth=1.4,
    margin="0.14,0.08",
    fontname="Inter",
    fontsize=12
  ];

  edge [
    penwidth=1.25,
    arrowsize=0.7,
    fontname="Inter",
    fontsize=10
  ];

  WorkUnit [label="Work / Unit\ncross-language identity"];
  Catalog [label="Library / Catalog\nfacts, aliases, sources"];
  Review [label="Review\nreader judgment"];
  Shelf [label="Shelf\ncurated paths"];
  Wiki [label="Wiki\ncollaborative knowledge"];
  Realm [label="Realm\ncommunity"];
  Tag [label="Global Tag\nshared vocabulary"];
  RealmTag [label="Realm Tag Application\ncommunity meaning"];

  { rank=same; Catalog; Review; Shelf; Wiki; Realm; }

  Catalog -> WorkUnit [label="indexes"];
  Wiki -> WorkUnit [label="documents"];
  Review -> WorkUnit [label="targets"];
  Shelf -> WorkUnit [label="collects"];
  Shelf -> Review [label="explains why"];
  Realm -> WorkUnit [label="hosts"];

  Tag -> WorkUnit [label="classifies"];

  // Realm is a community surface, UnitRealm is feed membership, and
  // RealmTagApplication is a realm-scoped use of an existing global Tag. Keep
  // these separate so the diagram does not imply that realms own tags or that
  // realm-tag classification requires a work to be posted into the realm feed.
  // Realm 是社区界面，UnitRealm 是 feed 成员关系，而 RealmTagApplication 是对
  // 现有全局 Tag 的 realm 范围内的使用。保持三者分离，以免图示暗示 realm 拥有
  // tag，或暗示 realm-tag 分类需要先把作品发布到 realm feed 中。
  Realm -> RealmTag [label="interprets"];
  RealmTag -> Tag [label="uses"];
  RealmTag -> WorkUnit [label="classifies in context"];
}
`;
