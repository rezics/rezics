import React from "react";
import { Avatar, Box, Link, Paper, Typography } from "@mui/material";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import { useTranslation } from "react-i18next";

export namespace SingleQuoteExcerpt {
	export type Show = {
		author: {
			name: string;
			avatar: string;
		};
		content: string;
		stats: {
			replies: number;
			likes: number;
			date: string;
		};
		source: string;
		originalLink: string;
	};

	export const Show: React.FC<Show> = (
		{ author, content, stats, source, originalLink },
	) => {
		const { t } = useTranslation();
		return (
			<Paper
				variant="outlined"
				sx={{
					p: 2,
					"& .MuiPaper-root": {
						borderColor: "divider",
					},
				}}
			>
				<Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
					<Avatar
						src={author.avatar}
						sx={{ width: 20, height: 20, mr: 1 }}
					/>
					<Typography variant="subtitle2" fontWeight="bold">
						{author.name}
					</Typography>
				</Box>

				<Box sx={{ display: "flex", alignItems: "flex-start" }}>
					<FormatQuoteIcon
						sx={{
							fontSize: 30,
							color: "text.secondary",
							mr: 1,
							mt: 0.5,
						}}
					/>
					<Box sx={{ flex: 1 }}>
						<Typography
							variant="body2"
							color="text.primary"
							sx={{ lineHeight: 1.6 }}
						>
							{content}
							<Link
								href={originalLink}
								sx={{
									ml: 0.5,
									color: "primary.main",
									"&:hover": {
										textDecoration: "underline",
									},
								}}
							>
								(查看全文)
							</Link>
						</Typography>

						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								mt: 1.5,
								color: "text.secondary",
								fontSize: "0.75rem",
							}}
						>
							<Box sx={{ display: "flex", gap: 1 }}>
								<Typography variant="caption">
									{stats.replies} {t("common.reply")}
								</Typography>
								<Typography variant="caption">
									{stats.likes} {t("accessibility.favorite")}
								</Typography>
								<Typography variant="caption">
									{stats.date}
								</Typography>
							</Box>
							<Typography variant="caption" color="text.disabled">
								—— {source}
							</Typography>
						</Box>
					</Box>
				</Box>
			</Paper>
		);
	};

	export type Container = {
		children: string;
	};
	export const Container: React.FC<Container> = () => {
		const res = {} as Show;
		return <Show {...res}></Show>;
	};
}
