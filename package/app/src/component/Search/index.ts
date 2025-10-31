export {SearchInputShow as Show} from './SearchInput';
export {SearchInputContainer as Container} from './SearchInput';
export {BookSearchFilter as Filter} from './SearchFilter';
export {SearchPanelShow as panelShow} from './SearchPanel';
export {SearchPanelContainer as panelContainer} from './SearchPanel';

export type {
  SearchInputShowProps,
  SearchInputContainerProps,
} from './SearchInput';
export type {BookSearchFilterProps} from './SearchFilter';
export type {
  SearchPanelShowProps,
  SearchPanelContainerProps,
} from './SearchPanel';

// Aggregated object-style export for ergonomics: Search.Show/Container/Filter
import {SearchInputShow as _Show} from './SearchInput';
import {SearchInputContainer as _Container} from './SearchInput';
import {BookSearchFilter as _Filter} from './SearchFilter';
import {SearchPanelShow as _panelShow} from './SearchPanel';
import {SearchPanelContainer as _panelContainer} from './SearchPanel';

export const Search = {
  Show: _Show,
  Container: _Container,
  Filter: _Filter,
  panel: {
    Show: _panelShow,
    Container: _panelContainer,
  },
};
