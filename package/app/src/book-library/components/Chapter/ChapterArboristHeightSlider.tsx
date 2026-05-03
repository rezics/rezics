import type * as React from "react";

export function ChapterArboristHeightSlider({
  height,
  setHeight,
}: {
  height: number;
  setHeight: (height: number) => void;
}) {
  const maxHeight = 2000;
  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setHeight(Number(event.target.value));
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setHeight(event.target.value === "" ? 0 : Number(event.target.value));
  };

  const handleBlur = () => {
    if (height < 0) {
      setHeight(0);
    } else if (height > maxHeight) {
      setHeight(maxHeight);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-4">
        <div>
          <label
            htmlFor="chapter-arborist-height"
            className="block mb-2 text-sm"
          >
            Chapter Arborist Height
          </label>
        </div>
        <div className="flex-1">
          <input
            id="chapter-arborist-height"
            type="range"
            value={typeof height === "number" ? height : 0}
            onChange={handleSliderChange}
            aria-labelledby="input-slider"
            max={maxHeight}
            min={0}
            className="w-full"
          />
        </div>
        <div>
          <input
            type="number"
            value={height}
            onChange={handleInputChange}
            onBlur={handleBlur}
            className="w-[42px] border-b border-rezics-color-border-defined bg-transparent text-sm"
          />
        </div>
      </div>
    </div>
  );
}
