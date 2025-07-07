import React from "react";

import { get } from "@locale";

export const BookEditMainPage: React.FC = () => {
    return (
        <div>
            <h1>{get("pages->book_edit_page")}</h1>
        </div>
    );
};
