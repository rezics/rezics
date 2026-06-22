// Public API barrel for the entity-picker feature.
// entity-picker feature 的公共 API 桶文件。

// Components
export { EntityInlineCreateForm } from "./components/EntityInlineCreateForm";
export {
  EntityPicker,
  type EntityPickerProps,
  type EntityPickerSelection,
} from "./components/EntityPicker";
export { EntityResultRow } from "./components/EntityResultRow";

// Models
export {
  suggestCreditEligibility,
  suggestSubjectEligibility,
} from "./models/eligibilitySuggestions";
