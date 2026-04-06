import { GreenButton } from "./GreenButton";

export default function GreenButtonTest() {
  return (
    <div className="p-4">
      <GreenButton label="Click me" onClick={() => console.log("clicked")} />
    </div>
  );
}
