import { ShelfAction } from "./ShelfAction";

export default {
  "md · default": () => (
    <ShelfAction size="md" targetUnitId="fixture-shelf-target-1" />
  ),
  "sm · compact": () => (
    <ShelfAction size="sm" targetUnitId="fixture-shelf-target-2" />
  ),
  "md · review target": () => (
    <ShelfAction
      size="md"
      targetUnitId="fixture-shelf-target-3"
      isReview
    />
  ),
};
