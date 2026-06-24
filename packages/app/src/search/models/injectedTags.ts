/**
 * Tag data pre-resolved at navigation time and passed via router state
 * so the search page can render chips without re-querying the API.
 */
export interface InjectedTag {
  slug?: string;
  unitId: string;
  name: string;
}

export interface InjectedSearchState {
  injectedTags?: InjectedTag[];
}
