import { BookCarousel } from "@component/Home/HomeCarousel";
import { gql, useQuery } from "urql";

export const Home = () => {
    const [{ data, fetching, error }] = useQuery({
        query: gql`
            query HomeDelayQuery {
                books {
                    id
                }
            }
        `,
    });
    return (
        <div className="w-10/12 mx-auto">
            {/* First Carousel */}
            <div className="q-pa-md flex space-x-4">
                <div className="text-purple w-2/3 p-4 flex-none">
                    <BookCarousel autoplayIntervalNum={3000} />
                </div>
                <div className="w-1/3 bg-green-200 p-4 flex-1">右侧公告板</div>
            </div>
            {/* End First Carousel */}
            {/* 干脆写个插件化定制板块的首页。 */}
            <div>
                {fetching ? (
                    <div>Loading...</div>
                ) : error ? (
                    <div>Error: {error.message}</div>
                ) : (
                    <div>{data?.book && <div key={data?.book.id}>{data?.book.id}</div>}</div>
                )}
            </div>
        </div>
    );
};
