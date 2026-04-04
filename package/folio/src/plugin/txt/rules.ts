export const DEFAULT_SPLIT_RULES: RegExp[] = [
  /^第[零一二三四五六七八九十百千万\d]+[章节回]/m,
  /^Chapter\s+\d+/im,
  /^#{1,3}\s+/m,
  /^={3,}/m,
  /^-{3,}/m,
];
