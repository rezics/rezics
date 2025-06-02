import { proxy, useSnapshot } from "valtio";

// This will re-render on `state.count` change but not on `state.text` change
const state = proxy({ count: 0, text: "hello" });

function Counter() {
    
    const snap = useSnapshot(state);

    function handleClick() {
        ++state.count;
        console.log('handleClick', state, snap);
    }
    return (
        <div>
            {snap.count}
            <Button onClick={handleClick}>+1</Button>
        </div>
    );
}

export default function TestPage() {
    return (
        <div className="ml-10 mt-10">
            <Counter />
        </div>
    );
}

