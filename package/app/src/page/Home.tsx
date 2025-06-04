import { BookCarousel } from "@/components/Home/HomeCarousel";

export const Home = () => {
    return (
        <div className="w-10/12 mx-auto">
    {/* First Carousel */}
    <div className="q-pa-md flex space-x-4">
      <div  className="text-purple w-2/3 p-4 flex-none">
        <BookCarousel autoplayIntervalNum={3000} />
      </div>
      <div className="w-1/3 bg-green-200 p-4 flex-1">右侧公告板</div>
    </div>
    {/* End First Carousel */}
    {/* 干脆写个插件化定制板块的首页。 */}
  </div>
    );
};
