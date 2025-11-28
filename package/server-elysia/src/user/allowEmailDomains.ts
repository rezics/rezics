const emailIntl = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'proton.me',
  'protonmail.com',
  'icloud.com',
  'me.com',
  'yandex.com',
];

const emailCN = [
  'qq.com',
  '163.com',
  '126.com',
  'yeah.net',
  'sina.com',
  'sina.cn',
  'vip.sina.com',
  'sohu.com',
  'tom.com',
  'aliyun.com',
  'foxmail.com',
  '139.com',
];

const emailHK = [
  'netvigator.com',
  'icloud.com',
  'gmail.com',
  'yahoo.com',
  'connect.hku.hk',
  'hku.hk',
  'cuhk.edu.hk',
  'connect.polyu.hk',
];

const emailTW = [
  'gmail.com',
  'yahoo.com.tw',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'seed.net.tw',
  'pchome.com.tw',
  'giga.net.tw',
  'msa.hinet.net',
  'hinet.net',
];

const emailJP = [
  'gmail.com',
  'yahoo.co.jp',
  'hotmail.co.jp',
  'outlook.jp',
  // 手机运营商邮箱
  'docomo.ne.jp',
  'ezweb.ne.jp',
  'au.com',
  'softbank.ne.jp',
  'i.softbank.jp',
  // 其他常见
  'biglobe.ne.jp',
  'nifty.com',
  'ocn.ne.jp',
];

export const allowEmailDomains = [
  ...new Set([...emailIntl, ...emailCN, ...emailHK, ...emailTW, ...emailJP]),
];
