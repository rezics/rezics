// import { useFixtureInput } from "react-cosmos/client";
// import { CardBookList } from "./CardBookList.tsx";

// export default () => {
//   const [props] = useFixtureInput<Parameters<typeof CardBookList>[0]>(
//     "Props",
//     {
//       books: [
//         {
//           id: "1",
//           title: "《哈利·波特与魔法石》",
//           author: "J.K. 罗琳",
//           description:
//             "一个关于魔法世界的奇幻故事，讲述了哈利·波特在霍格沃茨魔法学校的冒险经历。这本书开启了一个充满想象力的魔法世界，深受全世界读者喜爱。",
//           cover: "https://images-cn.ssl-images-amazon.com/images/I/81YOuOGFCJL.jpg",
//         },
//         {
//           id: "2",
//           title: "《三体》",
//           author: "刘慈欣",
//           description:
//             "一部硬科幻小说，讲述了地球文明与三体文明的生存斗争。作品深入探讨了宇宙社会学、科技发展与人类文明的关系。",
//           cover: "https://img1.doubanio.com/view/subject/s/public/s2768378.jpg",
//         },
//         {
//           id: "3",
//           title: "《1984》",
//           author: "乔治·奥威尔",
//           description:
//             "一部反乌托邦小说，描述了一个极权主义社会中个人自由和思想被完全控制的世界。这本书对现代社会具有深刻的警示意义。",
//           cover: "https://img1.doubanio.com/view/subject/s/public/s4103315.jpg",
//         },
//         {
//           id: "4",
//           title: "《百年孤独》",
//           author: "加西亚·马尔克斯",
//           description:
//             "魔幻现实主义文学的代表作，通过布恩迪亚家族七代人的传奇故事，反映了拉丁美洲的历史变迁和社会现实。",
//           cover: "https://img1.doubanio.com/view/subject/s/public/s6384944.jpg",
//         },
//       ],
//     },
//   );

//   return (
//     <div className="p-4">
//       <h3 className="mb-4 text-lg font-semibold">书籍卡片列表</h3>
//       <CardBookList {...props} />
//     </div>
//   );
// };
