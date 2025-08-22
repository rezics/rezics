import { tsr } from "@/api/tsr";
import { BookCarousel } from "@component/Home/HomeCarousel";
import { useTranslation } from "react-i18next";

export namespace Home {
	export type Show = {};

	export const Show: React.FC<Show> = () => {
		const { t } = useTranslation();
		return (
			<div className="w-10/12 mx-auto">
				{/* First Carousel */}
				<div className="q-pa-md flex space-x-4">
					<div className="text-purple w-2/3 p-4 flex-none">
						<BookCarousel autoplayIntervalNum={3000} />
					</div>
					<div className="w-1/3 bg-green-200 p-4 flex-1">
						右侧公告板
					</div>
				</div>
				{/* End First Carousel */}
				{/* 干脆写个插件化定制板块的首页。 */}
				<div>
					<p>{t("title")}</p>、<p>{t("accessibility.comments")}</p>
					<p>{t("auth.error.invalid_username")}</p>
				</div>
			</div>
		);
	};

	export type Container = {};

	export const Container: React.FC<Container> = () => {
		return <Show />;
	};
}
