import type { AboutLocale } from "./locales";

export type UiDictionary = {
  nav: {
    home: string;
    product: string;
    app: string;
    language: string;
  };
  cta: {
    enterApp: string;
    readProduct: string;
    backHome: string;
  };
  footer: {
    originNote: string;
  };
  notFound: {
    title: string;
    body: string;
  };
};

export const uiDictionaries: Record<AboutLocale, UiDictionary> = {
  "zh-hant": {
    nav: {
      home: "關於",
      product: "產品",
      app: "進入 Rezics",
      language: "語言",
    },
    cta: {
      enterApp: "進入作品索引",
      readProduct: "查看產品",
      backHome: "回到關於頁",
    },
    footer: {
      originNote: "互動索引、書架與社群工作流在 Rezics 主應用中開啟。",
    },
    notFound: {
      title: "找不到這個頁面",
      body: "這個關於站點目前只有關於與產品頁。你可以切回本語言的公開導覽。",
    },
  },
  "zh-hans": {
    nav: {
      home: "关于",
      product: "产品",
      app: "进入 Rezics",
      language: "语言",
    },
    cta: {
      enterApp: "进入作品索引",
      readProduct: "查看产品",
      backHome: "回到关于页",
    },
    footer: {
      originNote: "互动索引、书架与社区工作流在 Rezics 主应用中开启。",
    },
    notFound: {
      title: "找不到这个页面",
      body: "这个关于站点目前只有关于与产品页。你可以切回本语言的公开导览。",
    },
  },
  en: {
    nav: {
      home: "About",
      product: "Product",
      app: "Open Rezics",
      language: "Language",
    },
    cta: {
      enterApp: "Open the catalog",
      readProduct: "Explore products",
      backHome: "Back to about",
    },
    footer: {
      originNote:
        "Interactive catalog, shelf, and community workflows open in the main Rezics app.",
    },
    notFound: {
      title: "Page not found",
      body: "This public site currently includes the about and product pages. Use the localized navigation to continue.",
    },
  },
  ja: {
    nav: {
      home: "Rezics について",
      product: "製品",
      app: "Rezics を開く",
      language: "言語",
    },
    cta: {
      enterApp: "作品カタログを開く",
      readProduct: "製品を見る",
      backHome: "概要へ戻る",
    },
    footer: {
      originNote:
        "対話型の索引、棚、コミュニティの操作は Rezics 本体アプリで開きます。",
    },
    notFound: {
      title: "ページが見つかりません",
      body: "この公開サイトには現在、概要ページと製品ページがあります。ローカライズされたナビゲーションから続行してください。",
    },
  },
  de: {
    nav: {
      home: "Über Rezics",
      product: "Produkt",
      app: "Rezics öffnen",
      language: "Sprache",
    },
    cta: {
      enterApp: "Katalog öffnen",
      readProduct: "Produkte ansehen",
      backHome: "Zurück zur Übersicht",
    },
    footer: {
      originNote:
        "Interaktive Katalog-, Regal- und Community-Abläufe öffnen sich in der Rezics-Hauptanwendung.",
    },
    notFound: {
      title: "Seite nicht gefunden",
      body: "Diese öffentliche Site enthält derzeit die Über-uns- und Produktseiten. Nutze die lokalisierte Navigation, um fortzufahren.",
    },
  },
  ko: {
    nav: {
      home: "소개",
      product: "제품",
      app: "Rezics 열기",
      language: "언어",
    },
    cta: {
      enterApp: "작품 카탈로그 열기",
      readProduct: "제품 보기",
      backHome: "소개로 돌아가기",
    },
    footer: {
      originNote:
        "상호작용형 카탈로그, 서가, 커뮤니티 작업은 Rezics 기본 앱에서 열립니다.",
    },
    notFound: {
      title: "페이지를 찾을 수 없습니다",
      body: "이 공개 사이트에는 현재 소개와 제품 페이지만 있습니다. 현지화된 탐색을 사용해 계속하세요.",
    },
  },
};
