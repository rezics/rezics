import { useMemo } from "react";
import { proxy, useSnapshot } from "valtio";

// const state = proxy({
//   isReplyModalOpen: false,
// });

export function MiniValtioTest() {
    const state = useMemo(() => proxy({ isReplyModalOpen: false }), []);

    const snap = useSnapshot(state);

    return (
        <>
            <button onClick={() => (state.isReplyModalOpen = true)}>打开</button>
            {snap.isReplyModalOpen && <div>Modal 内容</div>}
        </>
    );
}
