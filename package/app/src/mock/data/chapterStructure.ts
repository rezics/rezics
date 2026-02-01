type Chapter = {
  id: number;
  title: string;
  noContent: boolean;
};

type ChaptersMap = Record<number, Chapter>;

type OrderMap = Record<number, number[]>;

const chapters: ChaptersMap = {
  143: {id: 143, title: '设定资料区', noContent: true},
  144: {id: 144, title: '一些我们故事中会涉及的地点', noContent: false},
  145: {id: 145, title: '机神的三重唱——拉斯铸造世界', noContent: false},
  // ...
};

const order: OrderMap = {
  143: [144, 145, 146, 147, 148, 149, 150, 151, 152],
  153: [154, 155, 156, 157, 158 /* ... */],
};
