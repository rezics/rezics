import { Button, TextField, Tooltip } from "@mui/material";
import EasyEditor from "../Form/EasyEditor";
import { useState } from "react";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";

export function QuoteEdit() {
	const [content, setContent] = useState("");
	const onContentChange = (value: string) => {
		setContent(value);
	};
	const onSubmit = () => {
		console.log("submit", content);
	};
	const tipContent = "或者直接编写完整的引用，格式是……";
	return (
		<div>
			<div className="flex w-full justify-between mt-2">
				<div className="flex gap-2 basis-1/2 items-center">
					{/* <span className="text-lg font-bold">Your Rating</span> */}
					<TextField label="引用解析连接" className="w-full" />
					<Tooltip
						title="点击以查阅ICS书籍引用连接支持格式"
						placement="top"
					>
						<HelpOutlineIcon fontSize="large" className="" />
					</Tooltip>
					{/* 通过连接解析直接获取内容 */}
				</div>
				<Button variant="contained" color="primary" onClick={onSubmit}>
					Submit ALL
				</Button>
			</div>
			<div className="mt-4">
				<EasyEditor
					value={content}
					onChange={onContentChange}
					initialValue={tipContent}
				/>
			</div>
		</div>
	);
}
