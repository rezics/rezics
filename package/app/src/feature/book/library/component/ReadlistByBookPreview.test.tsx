// import { useFixtureInput } from "react-cosmos/client";
// import ReadlistByBookPreview from "./ReadlistByBookPreview";

// export default () => {
//   const [props] = useFixtureInput<
//     Parameters<typeof ReadlistByBookPreview>[0]
//   >("Props", {
//     bookId: "book-123",
//     title: "《哈利·波特与魔法石》",
//   });

//   return (
//     <div className="p-4 max-w-2xl">
//       <h3 className="mb-4 text-lg font-semibold">书单预览组件</h3>
//       <div className="border border-gray-200 rounded-lg p-4">
//         <ReadlistByBookPreview {...props} />
//       </div>
//       <div className="mt-4 text-sm text-gray-600">
//         <p>
//           注意：此组件依赖 ReadlistByBook 页面组件，可能需要路由和数据支持。
//         </p>
//       </div>
//     </div>
//   );
// };
