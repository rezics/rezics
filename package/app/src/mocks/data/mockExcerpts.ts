// MOCK: static excerpts for landing/preview layouts until backend support lands
export const mockExcerpts = [
  {
    id: "1",
    content:
      "作为一个词语，'活着'在我们的语言中充满了力量。它的力量不是来自于喊叫，也不是来自于进攻，而是忍受。去忍受生命赋予我们的责任，去忍受现实给予我们的幸福和苦难、无聊和平庸。",
    created_at: "2025-06-01T12:00:00Z",
    author: {
      name: "余华",
      avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=yuhua.png",
    },
  },
  {
    id: "2",
    content:
      "薄宦各东西，往事随风雨。先自离歌不忍闻，又何况，春将暮。愁共落花多，人逐征鸿去。君向潇湘我向秦，后会知何处。",
    created_at: "2025-06-02T09:30:00Z",
    author: {
      name: "纳兰性德",
      avatar: "https://api.dicebear.com/9.x/pixel-art/svg?seed=nalan.png",
    },
  },
];

interface Excerpt {
  id: string;
  content: string;
  created_at: string;
  author: {
    name: string;
    avatar: string;
  };
}
