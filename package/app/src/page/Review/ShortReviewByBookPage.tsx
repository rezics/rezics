// import {reviewQueries} from '@/api/review/review';
// import {AccentBarWithTextShow} from '@/component/Common/AccentBar.tsx';
// import {ReviewEditPage} from '@/page/Review/ReviewEditPage';
// import {ShortReviewListShow} from '@/component/Review/ShortReviewList.tsx';
// import {useQuery} from '@tanstack/react-query';
// import {useParams} from 'wouter';

// export function ShortReviewByBookPage() {
//   const {bookId} = useParams();
//   const {data, isLoading, error} = useQuery(reviewQueries.byBook(bookId || ''));

//   return (
//     <div className="w-10/12 mx-auto mt-10">
//       <AccentBarWithTextShow text="短评" />
//       <div className="mt-4">
//         <ReviewEditPage reviewId={bookId || ''} />
//         {isLoading ? (
//           <div>Loading...</div>
//         ) : error instanceof Error ? (
//           <div>Error: {error.message}</div>
//         ) : (
//           <ShortReviewListShow reviews={(data?.reviews as any) ?? []} />
//         )}
//       </div>
//     </div>
//   );
// }
