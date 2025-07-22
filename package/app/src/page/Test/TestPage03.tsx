import { ChapterList } from "@/component/Book/ChapterList";

import { SingleBookTag } from "@component/Tag/SingleBookTag";
import { CollapsibleByLineText } from "@component/Common/CollapsibleByLineText";

import { BookTagEdit } from "@component/Tag/BookTagEdit";

export function TestPage03() {
    return (
        <div className="w-4/6 mx-auto mt-20">
            <div className="text-2xl font-bold mb-10">TestPage03</div>
            {/* <ChapterList id="1" /> */}
            <BookTagEdit.Container tagObjects={[]} updateTagObjects={() => {}} editOpen={false} setEditOpen={() => {}} />
        </div>
    );
}
