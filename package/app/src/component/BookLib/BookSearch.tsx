import { useState } from "react";
import { TextField, IconButton, Stack, Chip } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { parseSearchString, SearchInfo } from "@util/searchParser";
import { get } from "@locale";

interface BookSearchProps {
    onSearch: (info: SearchInfo) => void;
}

const searchTags = {
    presetTags: ["fiction", "nonfiction", "mystery", "romance", "history", "science", "fantasy", "philosophy"],
    statusTags: ["10万字", "20万字", "50万字", "100万字", "200万字", "连载中", "已完结"],
};

export const BookSearch: React.FC<BookSearchProps> = ({ onSearch }) => {
    const [value, setValue] = useState("");

    const handleSearch = () => {
        const info = parseSearchString(value);
        onSearch(info);
    };

    const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSearch();
        }
    };

    const handleAddTag = (tag: string) => {
        const withTag = value.includes(`[${tag}]`) ? value : `${value} [${tag}] `;
        setValue(withTag.trim());
    };

    return (
        <div>
            <div className="flex items-center gap-2">
                <TextField
                    fullWidth
                    size="small"
                    label={get("placeholders->search_books")}
                    placeholder='Try: "[tag] author:John"'
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <IconButton color="primary" aria-label={get("accessibility->search")} onClick={handleSearch}>
                    <SearchIcon />
                </IconButton>
            </div>

            <div className="mt-4">
                {Object.entries(searchTags).map(([key, tags]) => (
                    <div key={key} className="flex flex-wrap gap-2 mb-2">
                        <div className="font-bold">{key}</div>
                        <div>
                            {tags.map((tag) => (
                                <Chip
                                    key={tag}
                                    label={tag}
                                    clickable
                                    variant="outlined"
                                    onClick={() => handleAddTag(tag)}
                                    size="small"
                                    className="cursor-pointer !mr-2"
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
