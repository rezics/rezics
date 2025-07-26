/* eslint-disable */
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** The `Bigint` scalar type represents non-fractional signed whole numeric values. */
  Bigint: { input: any; output: any; }
  /** The `Decimal` scalar type represents signed unlimited-precision fractional values. */
  Decimal: { input: any; output: any; }
  /** The `Int64` scalar type represents non-fractional signed whole numeric values. Int can represent values between -2^63 and 2^63 - 1. */
  Int64: { input: any; output: any; }
  /** The `JSON` scalar type represents arbitrary JSON values. */
  JSON: { input: any; output: any; }
};

export type Auditable = {
  created_at: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  updated_at: Scalars['String']['output'];
};

export type Author = {
  books?: Maybe<Array<Book>>;
  description?: Maybe<Scalars['String']['output']>;
  down?: Maybe<Array<Person>>;
  favorites?: Maybe<Array<Person>>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  related_by?: Maybe<Array<Relatable>>;
  related_to?: Maybe<Array<Relatable>>;
  up?: Maybe<Array<Person>>;
  user?: Maybe<Person>;
};


export type AuthorBooksArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterBook>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderBook>;
};


export type AuthorDownArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type AuthorFavoritesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type AuthorRelated_ByArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type AuthorRelated_ToArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type AuthorUpArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type AuthorUserArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};

export type Author_Type = Author & BaseObject & Evaluable & Nameable & Object & Relatable & {
  __typename?: 'Author_Type';
  books?: Maybe<Array<Book>>;
  description?: Maybe<Scalars['String']['output']>;
  down?: Maybe<Array<Person>>;
  favorites?: Maybe<Array<Person>>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  related_by?: Maybe<Array<Relatable>>;
  related_to?: Maybe<Array<Relatable>>;
  up?: Maybe<Array<Person>>;
  user?: Maybe<Person>;
};


export type Author_TypeBooksArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterBook>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderBook>;
};


export type Author_TypeDownArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type Author_TypeFavoritesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type Author_TypeRelated_ByArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type Author_TypeRelated_ToArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type Author_TypeUpArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type Author_TypeUserArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};

/** Root object type. */
export type BaseObject = {
  id: Scalars['ID']['output'];
};

export type Book = {
  author?: Maybe<Array<Author>>;
  chapters?: Maybe<Array<Chapter>>;
  cover?: Maybe<Scalars['String']['output']>;
  created_at: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  down?: Maybe<Array<Person>>;
  favorites?: Maybe<Array<Person>>;
  grabbed_from: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  length: Scalars['Int64']['output'];
  name: Scalars['String']['output'];
  publishers?: Maybe<Array<Publisher>>;
  related_by?: Maybe<Array<Relatable>>;
  related_to?: Maybe<Array<Relatable>>;
  up?: Maybe<Array<Person>>;
  updated_at: Scalars['String']['output'];
};


export type BookAuthorArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterAuthor>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderAuthor>;
};


export type BookChaptersArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterChapter>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderChapter>;
};


export type BookDownArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type BookFavoritesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type BookPublishersArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPublisher>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPublisher>;
};


export type BookRelated_ByArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type BookRelated_ToArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type BookUpArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};

export type Book_Type = Auditable & BaseObject & Book & Evaluable & Nameable & Object & Relatable & {
  __typename?: 'Book_Type';
  author?: Maybe<Array<Author>>;
  chapters?: Maybe<Array<Chapter>>;
  cover?: Maybe<Scalars['String']['output']>;
  created_at: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  down?: Maybe<Array<Person>>;
  favorites?: Maybe<Array<Person>>;
  grabbed_from: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  length: Scalars['Int64']['output'];
  name: Scalars['String']['output'];
  publishers?: Maybe<Array<Publisher>>;
  related_by?: Maybe<Array<Relatable>>;
  related_to?: Maybe<Array<Relatable>>;
  up?: Maybe<Array<Person>>;
  updated_at: Scalars['String']['output'];
};


export type Book_TypeAuthorArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterAuthor>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderAuthor>;
};


export type Book_TypeChaptersArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterChapter>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderChapter>;
};


export type Book_TypeDownArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type Book_TypeFavoritesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type Book_TypePublishersArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPublisher>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPublisher>;
};


export type Book_TypeRelated_ByArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type Book_TypeRelated_ToArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type Book_TypeUpArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};

export type Chapter = {
  book: Book;
  children?: Maybe<Array<Chapter>>;
  down?: Maybe<Array<Person>>;
  favorites?: Maybe<Array<Person>>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  order: Scalars['Float']['output'];
  parent?: Maybe<Chapter>;
  related_by?: Maybe<Array<Relatable>>;
  related_to?: Maybe<Array<Relatable>>;
  up?: Maybe<Array<Person>>;
};


export type ChapterBookArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterBook>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderBook>;
};


export type ChapterChildrenArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterChapter>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderChapter>;
};


export type ChapterDownArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type ChapterFavoritesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type ChapterParentArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterChapter>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderChapter>;
};


export type ChapterRelated_ByArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type ChapterRelated_ToArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type ChapterUpArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};

export type Chapter_Type = BaseObject & Chapter & Evaluable & Nameable & Object & Relatable & {
  __typename?: 'Chapter_Type';
  book: Book;
  children?: Maybe<Array<Chapter>>;
  down?: Maybe<Array<Person>>;
  favorites?: Maybe<Array<Person>>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  order: Scalars['Float']['output'];
  parent?: Maybe<Chapter>;
  related_by?: Maybe<Array<Relatable>>;
  related_to?: Maybe<Array<Relatable>>;
  up?: Maybe<Array<Person>>;
};


export type Chapter_TypeBookArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterBook>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderBook>;
};


export type Chapter_TypeChildrenArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterChapter>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderChapter>;
};


export type Chapter_TypeDownArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type Chapter_TypeFavoritesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type Chapter_TypeParentArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterChapter>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderChapter>;
};


export type Chapter_TypeRelated_ByArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type Chapter_TypeRelated_ToArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type Chapter_TypeUpArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};

export enum Endian {
  Big = 'Big',
  Little = 'Little'
}

export type Evaluable = {
  down?: Maybe<Array<Person>>;
  favorites?: Maybe<Array<Person>>;
  id: Scalars['ID']['output'];
  up?: Maybe<Array<Person>>;
};


export type EvaluableDownArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type EvaluableFavoritesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type EvaluableUpArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};

export type FilterAuditable = {
  and?: InputMaybe<Array<FilterAuditable>>;
  created_at?: InputMaybe<FilterString>;
  id?: InputMaybe<FilterId>;
  not?: InputMaybe<FilterAuditable>;
  or?: InputMaybe<Array<FilterAuditable>>;
  updated_at?: InputMaybe<FilterString>;
};

export type FilterAuthor = {
  and?: InputMaybe<Array<FilterAuthor>>;
  books?: InputMaybe<NestedFilterBook>;
  description?: InputMaybe<FilterString>;
  down?: InputMaybe<NestedFilterPerson>;
  favorites?: InputMaybe<NestedFilterPerson>;
  id?: InputMaybe<FilterId>;
  name?: InputMaybe<FilterString>;
  not?: InputMaybe<FilterAuthor>;
  or?: InputMaybe<Array<FilterAuthor>>;
  related_by?: InputMaybe<NestedFilterRelatable>;
  related_to?: InputMaybe<NestedFilterRelatable>;
  up?: InputMaybe<NestedFilterPerson>;
  user?: InputMaybe<NestedFilterPerson>;
};

export type FilterBaseObject = {
  and?: InputMaybe<Array<FilterBaseObject>>;
  id?: InputMaybe<FilterId>;
  not?: InputMaybe<FilterBaseObject>;
  or?: InputMaybe<Array<FilterBaseObject>>;
};

export type FilterBigint = {
  eq?: InputMaybe<Scalars['Bigint']['input']>;
  exists?: InputMaybe<Scalars['Boolean']['input']>;
  gt?: InputMaybe<Scalars['Bigint']['input']>;
  gte?: InputMaybe<Scalars['Bigint']['input']>;
  in?: InputMaybe<Array<Scalars['Bigint']['input']>>;
  lt?: InputMaybe<Scalars['Bigint']['input']>;
  lte?: InputMaybe<Scalars['Bigint']['input']>;
  neq?: InputMaybe<Scalars['Bigint']['input']>;
};

export type FilterBook = {
  and?: InputMaybe<Array<FilterBook>>;
  author?: InputMaybe<NestedFilterAuthor>;
  chapters?: InputMaybe<NestedFilterChapter>;
  cover?: InputMaybe<FilterString>;
  created_at?: InputMaybe<FilterString>;
  description?: InputMaybe<FilterString>;
  down?: InputMaybe<NestedFilterPerson>;
  favorites?: InputMaybe<NestedFilterPerson>;
  grabbed_from?: InputMaybe<FilterString>;
  id?: InputMaybe<FilterId>;
  length?: InputMaybe<FilterInt64>;
  name?: InputMaybe<FilterString>;
  not?: InputMaybe<FilterBook>;
  or?: InputMaybe<Array<FilterBook>>;
  publishers?: InputMaybe<NestedFilterPublisher>;
  related_by?: InputMaybe<NestedFilterRelatable>;
  related_to?: InputMaybe<NestedFilterRelatable>;
  up?: InputMaybe<NestedFilterPerson>;
  updated_at?: InputMaybe<FilterString>;
};

export type FilterBoolean = {
  eq?: InputMaybe<Scalars['Boolean']['input']>;
  exists?: InputMaybe<Scalars['Boolean']['input']>;
  in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  neq?: InputMaybe<Scalars['Boolean']['input']>;
};

export type FilterChapter = {
  and?: InputMaybe<Array<FilterChapter>>;
  book?: InputMaybe<NestedFilterBook>;
  children?: InputMaybe<NestedFilterChapter>;
  down?: InputMaybe<NestedFilterPerson>;
  favorites?: InputMaybe<NestedFilterPerson>;
  id?: InputMaybe<FilterId>;
  name?: InputMaybe<FilterString>;
  not?: InputMaybe<FilterChapter>;
  or?: InputMaybe<Array<FilterChapter>>;
  order?: InputMaybe<FilterFloat>;
  parent?: InputMaybe<NestedFilterChapter>;
  related_by?: InputMaybe<NestedFilterRelatable>;
  related_to?: InputMaybe<NestedFilterRelatable>;
  up?: InputMaybe<NestedFilterPerson>;
};

export type FilterDecimal = {
  eq?: InputMaybe<Scalars['Decimal']['input']>;
  exists?: InputMaybe<Scalars['Boolean']['input']>;
  gt?: InputMaybe<Scalars['Decimal']['input']>;
  gte?: InputMaybe<Scalars['Decimal']['input']>;
  in?: InputMaybe<Array<Scalars['Decimal']['input']>>;
  lt?: InputMaybe<Scalars['Decimal']['input']>;
  lte?: InputMaybe<Scalars['Decimal']['input']>;
  neq?: InputMaybe<Scalars['Decimal']['input']>;
};

export type FilterEndian = {
  eq?: InputMaybe<Endian>;
  exists?: InputMaybe<Scalars['Boolean']['input']>;
  gt?: InputMaybe<Endian>;
  gte?: InputMaybe<Endian>;
  in?: InputMaybe<Array<Endian>>;
  lt?: InputMaybe<Endian>;
  lte?: InputMaybe<Endian>;
  neq?: InputMaybe<Endian>;
};

export type FilterEvaluable = {
  and?: InputMaybe<Array<FilterEvaluable>>;
  down?: InputMaybe<NestedFilterPerson>;
  favorites?: InputMaybe<NestedFilterPerson>;
  id?: InputMaybe<FilterId>;
  not?: InputMaybe<FilterEvaluable>;
  or?: InputMaybe<Array<FilterEvaluable>>;
  up?: InputMaybe<NestedFilterPerson>;
};

export type FilterFloat = {
  eq?: InputMaybe<Scalars['Float']['input']>;
  exists?: InputMaybe<Scalars['Boolean']['input']>;
  gt?: InputMaybe<Scalars['Float']['input']>;
  gte?: InputMaybe<Scalars['Float']['input']>;
  in?: InputMaybe<Array<Scalars['Float']['input']>>;
  lt?: InputMaybe<Scalars['Float']['input']>;
  lte?: InputMaybe<Scalars['Float']['input']>;
  neq?: InputMaybe<Scalars['Float']['input']>;
};

export type FilterId = {
  eq?: InputMaybe<Scalars['ID']['input']>;
  exists?: InputMaybe<Scalars['Boolean']['input']>;
  in?: InputMaybe<Array<Scalars['ID']['input']>>;
  neq?: InputMaybe<Scalars['ID']['input']>;
};

export type FilterInt = {
  eq?: InputMaybe<Scalars['Int']['input']>;
  exists?: InputMaybe<Scalars['Boolean']['input']>;
  gt?: InputMaybe<Scalars['Int']['input']>;
  gte?: InputMaybe<Scalars['Int']['input']>;
  in?: InputMaybe<Array<Scalars['Int']['input']>>;
  lt?: InputMaybe<Scalars['Int']['input']>;
  lte?: InputMaybe<Scalars['Int']['input']>;
  neq?: InputMaybe<Scalars['Int']['input']>;
};

export type FilterInt64 = {
  eq?: InputMaybe<Scalars['Int64']['input']>;
  exists?: InputMaybe<Scalars['Boolean']['input']>;
  gt?: InputMaybe<Scalars['Int64']['input']>;
  gte?: InputMaybe<Scalars['Int64']['input']>;
  in?: InputMaybe<Array<Scalars['Int64']['input']>>;
  lt?: InputMaybe<Scalars['Int64']['input']>;
  lte?: InputMaybe<Scalars['Int64']['input']>;
  neq?: InputMaybe<Scalars['Int64']['input']>;
};

export type FilterJson = {
  eq?: InputMaybe<Scalars['JSON']['input']>;
  exists?: InputMaybe<Scalars['Boolean']['input']>;
  gt?: InputMaybe<Scalars['JSON']['input']>;
  gte?: InputMaybe<Scalars['JSON']['input']>;
  in?: InputMaybe<Array<Scalars['JSON']['input']>>;
  lt?: InputMaybe<Scalars['JSON']['input']>;
  lte?: InputMaybe<Scalars['JSON']['input']>;
  neq?: InputMaybe<Scalars['JSON']['input']>;
};

export type FilterJsonEmpty = {
  eq?: InputMaybe<JsonEmpty>;
  exists?: InputMaybe<Scalars['Boolean']['input']>;
  gt?: InputMaybe<JsonEmpty>;
  gte?: InputMaybe<JsonEmpty>;
  in?: InputMaybe<Array<JsonEmpty>>;
  lt?: InputMaybe<JsonEmpty>;
  lte?: InputMaybe<JsonEmpty>;
  neq?: InputMaybe<JsonEmpty>;
};

export type FilterNameable = {
  and?: InputMaybe<Array<FilterNameable>>;
  id?: InputMaybe<FilterId>;
  name?: InputMaybe<FilterString>;
  not?: InputMaybe<FilterNameable>;
  or?: InputMaybe<Array<FilterNameable>>;
};

export type FilterObject = {
  and?: InputMaybe<Array<FilterObject>>;
  id?: InputMaybe<FilterId>;
  not?: InputMaybe<FilterObject>;
  or?: InputMaybe<Array<FilterObject>>;
};

export type FilterOrganization = {
  and?: InputMaybe<Array<FilterOrganization>>;
  created_at?: InputMaybe<FilterString>;
  down?: InputMaybe<NestedFilterPerson>;
  favorites?: InputMaybe<NestedFilterPerson>;
  id?: InputMaybe<FilterId>;
  members?: InputMaybe<NestedFilterPerson>;
  name?: InputMaybe<FilterString>;
  not?: InputMaybe<FilterOrganization>;
  or?: InputMaybe<Array<FilterOrganization>>;
  owned_favorites?: InputMaybe<NestedFilterEvaluable>;
  owned_tags?: InputMaybe<NestedFilterTag>;
  related_by?: InputMaybe<NestedFilterRelatable>;
  related_to?: InputMaybe<NestedFilterRelatable>;
  up?: InputMaybe<NestedFilterPerson>;
  updated_at?: InputMaybe<FilterString>;
};

export type FilterPerson = {
  and?: InputMaybe<Array<FilterPerson>>;
  created_at?: InputMaybe<FilterString>;
  down?: InputMaybe<NestedFilterPerson>;
  favorites?: InputMaybe<NestedFilterPerson>;
  id?: InputMaybe<FilterId>;
  name?: InputMaybe<FilterString>;
  not?: InputMaybe<FilterPerson>;
  or?: InputMaybe<Array<FilterPerson>>;
  owned_favorites?: InputMaybe<NestedFilterEvaluable>;
  owned_tags?: InputMaybe<NestedFilterTag>;
  related_by?: InputMaybe<NestedFilterRelatable>;
  related_to?: InputMaybe<NestedFilterRelatable>;
  up?: InputMaybe<NestedFilterPerson>;
  updated_at?: InputMaybe<FilterString>;
};

export type FilterPublisher = {
  and?: InputMaybe<Array<FilterPublisher>>;
  books?: InputMaybe<NestedFilterBook>;
  domain?: InputMaybe<FilterString>;
  down?: InputMaybe<NestedFilterPerson>;
  favorites?: InputMaybe<NestedFilterPerson>;
  id?: InputMaybe<FilterId>;
  name?: InputMaybe<FilterString>;
  not?: InputMaybe<FilterPublisher>;
  or?: InputMaybe<Array<FilterPublisher>>;
  related_by?: InputMaybe<NestedFilterRelatable>;
  related_to?: InputMaybe<NestedFilterRelatable>;
  up?: InputMaybe<NestedFilterPerson>;
};

export type FilterRelatable = {
  and?: InputMaybe<Array<FilterRelatable>>;
  id?: InputMaybe<FilterId>;
  not?: InputMaybe<FilterRelatable>;
  or?: InputMaybe<Array<FilterRelatable>>;
  related_by?: InputMaybe<NestedFilterRelatable>;
  related_to?: InputMaybe<NestedFilterRelatable>;
};

export type FilterString = {
  eq?: InputMaybe<Scalars['String']['input']>;
  exists?: InputMaybe<Scalars['Boolean']['input']>;
  gt?: InputMaybe<Scalars['String']['input']>;
  gte?: InputMaybe<Scalars['String']['input']>;
  ilike?: InputMaybe<Scalars['String']['input']>;
  in?: InputMaybe<Array<Scalars['String']['input']>>;
  like?: InputMaybe<Scalars['String']['input']>;
  lt?: InputMaybe<Scalars['String']['input']>;
  lte?: InputMaybe<Scalars['String']['input']>;
  neq?: InputMaybe<Scalars['String']['input']>;
};

export type FilterTag = {
  and?: InputMaybe<Array<FilterTag>>;
  created_at?: InputMaybe<FilterString>;
  id?: InputMaybe<FilterId>;
  name?: InputMaybe<FilterString>;
  not?: InputMaybe<FilterTag>;
  or?: InputMaybe<Array<FilterTag>>;
  owner?: InputMaybe<NestedFilterPerson>;
  related_by?: InputMaybe<NestedFilterRelatable>;
  related_to?: InputMaybe<NestedFilterRelatable>;
  type?: InputMaybe<FilterString>;
  updated_at?: InputMaybe<FilterString>;
};

export type FilterThread = {
  and?: InputMaybe<Array<FilterThread>>;
  author?: InputMaybe<NestedFilterPerson>;
  content?: InputMaybe<FilterString>;
  created_at?: InputMaybe<FilterString>;
  down?: InputMaybe<NestedFilterPerson>;
  favorites?: InputMaybe<NestedFilterPerson>;
  id?: InputMaybe<FilterId>;
  name?: InputMaybe<FilterString>;
  not?: InputMaybe<FilterThread>;
  or?: InputMaybe<Array<FilterThread>>;
  related_by?: InputMaybe<NestedFilterRelatable>;
  related_to?: InputMaybe<NestedFilterRelatable>;
  replies?: InputMaybe<NestedFilterThread>;
  up?: InputMaybe<NestedFilterPerson>;
  updated_at?: InputMaybe<FilterString>;
};

export type FilterUser = {
  and?: InputMaybe<Array<FilterUser>>;
  created_at?: InputMaybe<FilterString>;
  description?: InputMaybe<FilterString>;
  down?: InputMaybe<NestedFilterPerson>;
  email?: InputMaybe<FilterString>;
  favorites?: InputMaybe<NestedFilterPerson>;
  friends?: InputMaybe<NestedFilterUser>;
  id?: InputMaybe<FilterId>;
  name?: InputMaybe<FilterString>;
  not?: InputMaybe<FilterUser>;
  or?: InputMaybe<Array<FilterUser>>;
  owned_favorites?: InputMaybe<NestedFilterEvaluable>;
  owned_tags?: InputMaybe<NestedFilterTag>;
  related_by?: InputMaybe<NestedFilterRelatable>;
  related_to?: InputMaybe<NestedFilterRelatable>;
  up?: InputMaybe<NestedFilterPerson>;
  updated_at?: InputMaybe<FilterString>;
};

export type InsertAuthor = {
  books?: InputMaybe<Array<NestedInsertBook>>;
  description?: InputMaybe<Scalars['String']['input']>;
  down?: InputMaybe<Array<NestedInsertPerson>>;
  favorites?: InputMaybe<Array<NestedInsertPerson>>;
  name: Scalars['String']['input'];
  related_to?: InputMaybe<Array<NestedInsertRelatable>>;
  up?: InputMaybe<Array<NestedInsertPerson>>;
  user?: InputMaybe<NestedInsertPerson>;
};

export type InsertBook = {
  cover?: InputMaybe<Scalars['String']['input']>;
  created_at?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  down?: InputMaybe<Array<NestedInsertPerson>>;
  favorites?: InputMaybe<Array<NestedInsertPerson>>;
  grabbed_from: Scalars['String']['input'];
  length: Scalars['Int64']['input'];
  name: Scalars['String']['input'];
  related_to?: InputMaybe<Array<NestedInsertRelatable>>;
  up?: InputMaybe<Array<NestedInsertPerson>>;
  updated_at?: InputMaybe<Scalars['String']['input']>;
};

export type InsertChapter = {
  book: NestedInsertBook;
  down?: InputMaybe<Array<NestedInsertPerson>>;
  favorites?: InputMaybe<Array<NestedInsertPerson>>;
  name: Scalars['String']['input'];
  order: Scalars['Float']['input'];
  parent?: InputMaybe<NestedInsertChapter>;
  related_to?: InputMaybe<Array<NestedInsertRelatable>>;
  up?: InputMaybe<Array<NestedInsertPerson>>;
};

export type InsertOrganization = {
  created_at?: InputMaybe<Scalars['String']['input']>;
  down?: InputMaybe<Array<NestedInsertPerson>>;
  favorites?: InputMaybe<Array<NestedInsertPerson>>;
  members?: InputMaybe<Array<NestedInsertPerson>>;
  name: Scalars['String']['input'];
  related_to?: InputMaybe<Array<NestedInsertRelatable>>;
  up?: InputMaybe<Array<NestedInsertPerson>>;
  updated_at?: InputMaybe<Scalars['String']['input']>;
};

export type InsertPublisher = {
  books?: InputMaybe<Array<NestedInsertBook>>;
  domain: Scalars['String']['input'];
  down?: InputMaybe<Array<NestedInsertPerson>>;
  favorites?: InputMaybe<Array<NestedInsertPerson>>;
  name: Scalars['String']['input'];
  related_to?: InputMaybe<Array<NestedInsertRelatable>>;
  up?: InputMaybe<Array<NestedInsertPerson>>;
};

export type InsertTag = {
  created_at?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  owner: Array<NestedInsertPerson>;
  related_to?: InputMaybe<Array<NestedInsertRelatable>>;
  type: Scalars['String']['input'];
  updated_at?: InputMaybe<Scalars['String']['input']>;
};

export type InsertThread = {
  author: NestedInsertPerson;
  content: Scalars['String']['input'];
  created_at?: InputMaybe<Scalars['String']['input']>;
  down?: InputMaybe<Array<NestedInsertPerson>>;
  favorites?: InputMaybe<Array<NestedInsertPerson>>;
  name: Scalars['String']['input'];
  related_to?: InputMaybe<Array<NestedInsertRelatable>>;
  replies?: InputMaybe<Array<NestedInsertThread>>;
  up?: InputMaybe<Array<NestedInsertPerson>>;
  updated_at?: InputMaybe<Scalars['String']['input']>;
};

export type InsertUser = {
  created_at?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  down?: InputMaybe<Array<NestedInsertPerson>>;
  email: Scalars['String']['input'];
  favorites?: InputMaybe<Array<NestedInsertPerson>>;
  friends?: InputMaybe<Array<NestedInsertUser>>;
  name: Scalars['String']['input'];
  related_to?: InputMaybe<Array<NestedInsertRelatable>>;
  up?: InputMaybe<Array<NestedInsertPerson>>;
  updated_at?: InputMaybe<Scalars['String']['input']>;
};

export enum JsonEmpty {
  DeleteKey = 'DeleteKey',
  Error = 'Error',
  ReturnEmpty = 'ReturnEmpty',
  ReturnTarget = 'ReturnTarget',
  UseNull = 'UseNull'
}

export type Mutation = {
  __typename?: 'Mutation';
  delete_Author?: Maybe<Array<Author_Type>>;
  delete_Book?: Maybe<Array<Book_Type>>;
  delete_Chapter?: Maybe<Array<Chapter_Type>>;
  delete_Organization?: Maybe<Array<Organization_Type>>;
  delete_Publisher?: Maybe<Array<Publisher_Type>>;
  delete_Tag?: Maybe<Array<Tag_Type>>;
  delete_Thread?: Maybe<Array<Thread_Type>>;
  delete_User?: Maybe<Array<User_Type>>;
  insert_Author?: Maybe<Array<Author_Type>>;
  insert_Book?: Maybe<Array<Book_Type>>;
  insert_Chapter?: Maybe<Array<Chapter_Type>>;
  insert_Organization?: Maybe<Array<Organization_Type>>;
  insert_Publisher?: Maybe<Array<Publisher_Type>>;
  insert_Tag?: Maybe<Array<Tag_Type>>;
  insert_Thread?: Maybe<Array<Thread_Type>>;
  insert_User?: Maybe<Array<User_Type>>;
  update_Auditable?: Maybe<Array<Auditable>>;
  update_Author?: Maybe<Array<Author>>;
  update_Book?: Maybe<Array<Book>>;
  update_Chapter?: Maybe<Array<Chapter>>;
  update_Evaluable?: Maybe<Array<Evaluable>>;
  update_Nameable?: Maybe<Array<Nameable>>;
  update_Organization?: Maybe<Array<Organization>>;
  update_Person?: Maybe<Array<Person>>;
  update_Publisher?: Maybe<Array<Publisher>>;
  update_Relatable?: Maybe<Array<Relatable>>;
  update_Tag?: Maybe<Array<Tag>>;
  update_Thread?: Maybe<Array<Thread>>;
  update_User?: Maybe<Array<User>>;
};


export type MutationDelete_AuthorArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterAuthor>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderAuthor>;
};


export type MutationDelete_BookArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterBook>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderBook>;
};


export type MutationDelete_ChapterArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterChapter>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderChapter>;
};


export type MutationDelete_OrganizationArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterOrganization>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderOrganization>;
};


export type MutationDelete_PublisherArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPublisher>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPublisher>;
};


export type MutationDelete_TagArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterTag>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderTag>;
};


export type MutationDelete_ThreadArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterThread>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderThread>;
};


export type MutationDelete_UserArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterUser>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderUser>;
};


export type MutationInsert_AuthorArgs = {
  data: Array<InsertAuthor>;
};


export type MutationInsert_BookArgs = {
  data: Array<InsertBook>;
};


export type MutationInsert_ChapterArgs = {
  data: Array<InsertChapter>;
};


export type MutationInsert_OrganizationArgs = {
  data: Array<InsertOrganization>;
};


export type MutationInsert_PublisherArgs = {
  data: Array<InsertPublisher>;
};


export type MutationInsert_TagArgs = {
  data: Array<InsertTag>;
};


export type MutationInsert_ThreadArgs = {
  data: Array<InsertThread>;
};


export type MutationInsert_UserArgs = {
  data: Array<InsertUser>;
};


export type MutationUpdate_AuditableArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  data: UpdateAuditable;
  filter?: InputMaybe<FilterAuditable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderAuditable>;
};


export type MutationUpdate_AuthorArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  data: UpdateAuthor;
  filter?: InputMaybe<FilterAuthor>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderAuthor>;
};


export type MutationUpdate_BookArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  data: UpdateBook;
  filter?: InputMaybe<FilterBook>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderBook>;
};


export type MutationUpdate_ChapterArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  data: UpdateChapter;
  filter?: InputMaybe<FilterChapter>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderChapter>;
};


export type MutationUpdate_EvaluableArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  data: UpdateEvaluable;
  filter?: InputMaybe<FilterEvaluable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderEvaluable>;
};


export type MutationUpdate_NameableArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  data: UpdateNameable;
  filter?: InputMaybe<FilterNameable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderNameable>;
};


export type MutationUpdate_OrganizationArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  data: UpdateOrganization;
  filter?: InputMaybe<FilterOrganization>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderOrganization>;
};


export type MutationUpdate_PersonArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  data: UpdatePerson;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type MutationUpdate_PublisherArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  data: UpdatePublisher;
  filter?: InputMaybe<FilterPublisher>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPublisher>;
};


export type MutationUpdate_RelatableArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  data: UpdateRelatable;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type MutationUpdate_TagArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  data: UpdateTag;
  filter?: InputMaybe<FilterTag>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderTag>;
};


export type MutationUpdate_ThreadArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  data: UpdateThread;
  filter?: InputMaybe<FilterThread>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderThread>;
};


export type MutationUpdate_UserArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  data: UpdateUser;
  filter?: InputMaybe<FilterUser>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderUser>;
};

export type Nameable = {
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type NestedFilterAuthor = {
  books?: InputMaybe<NestedFilterBook>;
  description?: InputMaybe<FilterString>;
  down?: InputMaybe<NestedFilterPerson>;
  exists?: InputMaybe<Scalars['Boolean']['input']>;
  favorites?: InputMaybe<NestedFilterPerson>;
  id?: InputMaybe<FilterId>;
  name?: InputMaybe<FilterString>;
  related_by?: InputMaybe<NestedFilterRelatable>;
  related_to?: InputMaybe<NestedFilterRelatable>;
  up?: InputMaybe<NestedFilterPerson>;
  user?: InputMaybe<NestedFilterPerson>;
};

export type NestedFilterBook = {
  author?: InputMaybe<NestedFilterAuthor>;
  chapters?: InputMaybe<NestedFilterChapter>;
  cover?: InputMaybe<FilterString>;
  created_at?: InputMaybe<FilterString>;
  description?: InputMaybe<FilterString>;
  down?: InputMaybe<NestedFilterPerson>;
  exists?: InputMaybe<Scalars['Boolean']['input']>;
  favorites?: InputMaybe<NestedFilterPerson>;
  grabbed_from?: InputMaybe<FilterString>;
  id?: InputMaybe<FilterId>;
  length?: InputMaybe<FilterInt64>;
  name?: InputMaybe<FilterString>;
  publishers?: InputMaybe<NestedFilterPublisher>;
  related_by?: InputMaybe<NestedFilterRelatable>;
  related_to?: InputMaybe<NestedFilterRelatable>;
  up?: InputMaybe<NestedFilterPerson>;
  updated_at?: InputMaybe<FilterString>;
};

export type NestedFilterChapter = {
  book?: InputMaybe<NestedFilterBook>;
  children?: InputMaybe<NestedFilterChapter>;
  down?: InputMaybe<NestedFilterPerson>;
  exists?: InputMaybe<Scalars['Boolean']['input']>;
  favorites?: InputMaybe<NestedFilterPerson>;
  id?: InputMaybe<FilterId>;
  name?: InputMaybe<FilterString>;
  order?: InputMaybe<FilterFloat>;
  parent?: InputMaybe<NestedFilterChapter>;
  related_by?: InputMaybe<NestedFilterRelatable>;
  related_to?: InputMaybe<NestedFilterRelatable>;
  up?: InputMaybe<NestedFilterPerson>;
};

export type NestedFilterEvaluable = {
  down?: InputMaybe<NestedFilterPerson>;
  exists?: InputMaybe<Scalars['Boolean']['input']>;
  favorites?: InputMaybe<NestedFilterPerson>;
  id?: InputMaybe<FilterId>;
  up?: InputMaybe<NestedFilterPerson>;
};

export type NestedFilterPerson = {
  created_at?: InputMaybe<FilterString>;
  down?: InputMaybe<NestedFilterPerson>;
  exists?: InputMaybe<Scalars['Boolean']['input']>;
  favorites?: InputMaybe<NestedFilterPerson>;
  id?: InputMaybe<FilterId>;
  name?: InputMaybe<FilterString>;
  owned_favorites?: InputMaybe<NestedFilterEvaluable>;
  owned_tags?: InputMaybe<NestedFilterTag>;
  related_by?: InputMaybe<NestedFilterRelatable>;
  related_to?: InputMaybe<NestedFilterRelatable>;
  up?: InputMaybe<NestedFilterPerson>;
  updated_at?: InputMaybe<FilterString>;
};

export type NestedFilterPublisher = {
  books?: InputMaybe<NestedFilterBook>;
  domain?: InputMaybe<FilterString>;
  down?: InputMaybe<NestedFilterPerson>;
  exists?: InputMaybe<Scalars['Boolean']['input']>;
  favorites?: InputMaybe<NestedFilterPerson>;
  id?: InputMaybe<FilterId>;
  name?: InputMaybe<FilterString>;
  related_by?: InputMaybe<NestedFilterRelatable>;
  related_to?: InputMaybe<NestedFilterRelatable>;
  up?: InputMaybe<NestedFilterPerson>;
};

export type NestedFilterRelatable = {
  exists?: InputMaybe<Scalars['Boolean']['input']>;
  id?: InputMaybe<FilterId>;
  related_by?: InputMaybe<NestedFilterRelatable>;
  related_to?: InputMaybe<NestedFilterRelatable>;
};

export type NestedFilterTag = {
  created_at?: InputMaybe<FilterString>;
  exists?: InputMaybe<Scalars['Boolean']['input']>;
  id?: InputMaybe<FilterId>;
  name?: InputMaybe<FilterString>;
  owner?: InputMaybe<NestedFilterPerson>;
  related_by?: InputMaybe<NestedFilterRelatable>;
  related_to?: InputMaybe<NestedFilterRelatable>;
  type?: InputMaybe<FilterString>;
  updated_at?: InputMaybe<FilterString>;
};

export type NestedFilterThread = {
  author?: InputMaybe<NestedFilterPerson>;
  content?: InputMaybe<FilterString>;
  created_at?: InputMaybe<FilterString>;
  down?: InputMaybe<NestedFilterPerson>;
  exists?: InputMaybe<Scalars['Boolean']['input']>;
  favorites?: InputMaybe<NestedFilterPerson>;
  id?: InputMaybe<FilterId>;
  name?: InputMaybe<FilterString>;
  related_by?: InputMaybe<NestedFilterRelatable>;
  related_to?: InputMaybe<NestedFilterRelatable>;
  replies?: InputMaybe<NestedFilterThread>;
  up?: InputMaybe<NestedFilterPerson>;
  updated_at?: InputMaybe<FilterString>;
};

export type NestedFilterUser = {
  created_at?: InputMaybe<FilterString>;
  description?: InputMaybe<FilterString>;
  down?: InputMaybe<NestedFilterPerson>;
  email?: InputMaybe<FilterString>;
  exists?: InputMaybe<Scalars['Boolean']['input']>;
  favorites?: InputMaybe<NestedFilterPerson>;
  friends?: InputMaybe<NestedFilterUser>;
  id?: InputMaybe<FilterId>;
  name?: InputMaybe<FilterString>;
  owned_favorites?: InputMaybe<NestedFilterEvaluable>;
  owned_tags?: InputMaybe<NestedFilterTag>;
  related_by?: InputMaybe<NestedFilterRelatable>;
  related_to?: InputMaybe<NestedFilterRelatable>;
  up?: InputMaybe<NestedFilterPerson>;
  updated_at?: InputMaybe<FilterString>;
};

export type NestedInsertBook = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  data?: InputMaybe<InsertBook>;
  filter?: InputMaybe<FilterBook>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderBook>;
};

export type NestedInsertChapter = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  data?: InputMaybe<InsertChapter>;
  filter?: InputMaybe<FilterChapter>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderChapter>;
};

export type NestedInsertPerson = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};

export type NestedInsertRelatable = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};

export type NestedInsertThread = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  data?: InputMaybe<InsertThread>;
  filter?: InputMaybe<FilterThread>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderThread>;
};

export type NestedInsertUser = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  data?: InputMaybe<InsertUser>;
  filter?: InputMaybe<FilterUser>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderUser>;
};

export type NestedUpdateBook = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterBook>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderBook>;
};

export type NestedUpdateChapter = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterChapter>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderChapter>;
};

export type NestedUpdatePerson = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};

export type NestedUpdateRelatable = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};

export type NestedUpdateThread = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterThread>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderThread>;
};

export type NestedUpdateUser = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterUser>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderUser>;
};

/** Root object type for user-defined types */
export type Object = {
  id: Scalars['ID']['output'];
};

export type OrderAuditable = {
  created_at?: InputMaybe<Ordering>;
  id?: InputMaybe<Ordering>;
  updated_at?: InputMaybe<Ordering>;
};

export type OrderAuthor = {
  description?: InputMaybe<Ordering>;
  id?: InputMaybe<Ordering>;
  name?: InputMaybe<Ordering>;
  user?: InputMaybe<OrderPerson>;
};

export type OrderBaseObject = {
  id?: InputMaybe<Ordering>;
};

export type OrderBook = {
  cover?: InputMaybe<Ordering>;
  created_at?: InputMaybe<Ordering>;
  description?: InputMaybe<Ordering>;
  grabbed_from?: InputMaybe<Ordering>;
  id?: InputMaybe<Ordering>;
  length?: InputMaybe<Ordering>;
  name?: InputMaybe<Ordering>;
  updated_at?: InputMaybe<Ordering>;
};

export type OrderChapter = {
  book?: InputMaybe<OrderBook>;
  id?: InputMaybe<Ordering>;
  name?: InputMaybe<Ordering>;
  order?: InputMaybe<Ordering>;
  parent?: InputMaybe<OrderChapter>;
};

export type OrderEvaluable = {
  id?: InputMaybe<Ordering>;
};

export type OrderNameable = {
  id?: InputMaybe<Ordering>;
  name?: InputMaybe<Ordering>;
};

export type OrderObject = {
  id?: InputMaybe<Ordering>;
};

export type OrderOrganization = {
  created_at?: InputMaybe<Ordering>;
  id?: InputMaybe<Ordering>;
  name?: InputMaybe<Ordering>;
  updated_at?: InputMaybe<Ordering>;
};

export type OrderPerson = {
  created_at?: InputMaybe<Ordering>;
  id?: InputMaybe<Ordering>;
  name?: InputMaybe<Ordering>;
  updated_at?: InputMaybe<Ordering>;
};

export type OrderPublisher = {
  domain?: InputMaybe<Ordering>;
  id?: InputMaybe<Ordering>;
  name?: InputMaybe<Ordering>;
};

export type OrderRelatable = {
  id?: InputMaybe<Ordering>;
};

export type OrderTag = {
  created_at?: InputMaybe<Ordering>;
  id?: InputMaybe<Ordering>;
  name?: InputMaybe<Ordering>;
  type?: InputMaybe<Ordering>;
  updated_at?: InputMaybe<Ordering>;
};

export type OrderThread = {
  author?: InputMaybe<OrderPerson>;
  content?: InputMaybe<Ordering>;
  created_at?: InputMaybe<Ordering>;
  id?: InputMaybe<Ordering>;
  name?: InputMaybe<Ordering>;
  updated_at?: InputMaybe<Ordering>;
};

export type OrderUser = {
  created_at?: InputMaybe<Ordering>;
  description?: InputMaybe<Ordering>;
  email?: InputMaybe<Ordering>;
  id?: InputMaybe<Ordering>;
  name?: InputMaybe<Ordering>;
  updated_at?: InputMaybe<Ordering>;
};

export type Ordering = {
  dir: DirectionEnum;
  nulls?: InputMaybe<NullsOrderingEnum>;
};

export type Organization = {
  created_at: Scalars['String']['output'];
  down?: Maybe<Array<Person>>;
  favorites?: Maybe<Array<Person>>;
  id: Scalars['ID']['output'];
  members?: Maybe<Array<Person>>;
  name: Scalars['String']['output'];
  owned_favorites?: Maybe<Array<Evaluable>>;
  owned_tags?: Maybe<Array<Tag>>;
  related_by?: Maybe<Array<Relatable>>;
  related_to?: Maybe<Array<Relatable>>;
  up?: Maybe<Array<Person>>;
  updated_at: Scalars['String']['output'];
};


export type OrganizationDownArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type OrganizationFavoritesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type OrganizationMembersArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type OrganizationOwned_FavoritesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterEvaluable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderEvaluable>;
};


export type OrganizationOwned_TagsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterTag>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderTag>;
};


export type OrganizationRelated_ByArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type OrganizationRelated_ToArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type OrganizationUpArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};

export type Organization_Type = Auditable & BaseObject & Evaluable & Nameable & Object & Organization & Person & Relatable & {
  __typename?: 'Organization_Type';
  created_at: Scalars['String']['output'];
  down?: Maybe<Array<Person>>;
  favorites?: Maybe<Array<Person>>;
  id: Scalars['ID']['output'];
  members?: Maybe<Array<Person>>;
  name: Scalars['String']['output'];
  owned_favorites?: Maybe<Array<Evaluable>>;
  owned_tags?: Maybe<Array<Tag>>;
  related_by?: Maybe<Array<Relatable>>;
  related_to?: Maybe<Array<Relatable>>;
  up?: Maybe<Array<Person>>;
  updated_at: Scalars['String']['output'];
};


export type Organization_TypeDownArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type Organization_TypeFavoritesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type Organization_TypeMembersArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type Organization_TypeOwned_FavoritesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterEvaluable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderEvaluable>;
};


export type Organization_TypeOwned_TagsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterTag>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderTag>;
};


export type Organization_TypeRelated_ByArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type Organization_TypeRelated_ToArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type Organization_TypeUpArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};

export type Person = {
  created_at: Scalars['String']['output'];
  down?: Maybe<Array<Person>>;
  favorites?: Maybe<Array<Person>>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  owned_favorites?: Maybe<Array<Evaluable>>;
  owned_tags?: Maybe<Array<Tag>>;
  related_by?: Maybe<Array<Relatable>>;
  related_to?: Maybe<Array<Relatable>>;
  up?: Maybe<Array<Person>>;
  updated_at: Scalars['String']['output'];
};


export type PersonDownArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type PersonFavoritesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type PersonOwned_FavoritesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterEvaluable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderEvaluable>;
};


export type PersonOwned_TagsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterTag>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderTag>;
};


export type PersonRelated_ByArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type PersonRelated_ToArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type PersonUpArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};

export type Publisher = {
  books?: Maybe<Array<Book>>;
  domain: Scalars['String']['output'];
  down?: Maybe<Array<Person>>;
  favorites?: Maybe<Array<Person>>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  related_by?: Maybe<Array<Relatable>>;
  related_to?: Maybe<Array<Relatable>>;
  up?: Maybe<Array<Person>>;
};


export type PublisherBooksArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterBook>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderBook>;
};


export type PublisherDownArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type PublisherFavoritesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type PublisherRelated_ByArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type PublisherRelated_ToArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type PublisherUpArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};

export type Publisher_Type = BaseObject & Evaluable & Nameable & Object & Publisher & Relatable & {
  __typename?: 'Publisher_Type';
  books?: Maybe<Array<Book>>;
  domain: Scalars['String']['output'];
  down?: Maybe<Array<Person>>;
  favorites?: Maybe<Array<Person>>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  related_by?: Maybe<Array<Relatable>>;
  related_to?: Maybe<Array<Relatable>>;
  up?: Maybe<Array<Person>>;
};


export type Publisher_TypeBooksArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterBook>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderBook>;
};


export type Publisher_TypeDownArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type Publisher_TypeFavoritesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type Publisher_TypeRelated_ByArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type Publisher_TypeRelated_ToArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type Publisher_TypeUpArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};

export type Query = {
  __typename?: 'Query';
  Auditable?: Maybe<Array<Auditable>>;
  Author?: Maybe<Array<Author>>;
  BaseObject?: Maybe<Array<BaseObject>>;
  Book?: Maybe<Array<Book>>;
  Chapter?: Maybe<Array<Chapter>>;
  Evaluable?: Maybe<Array<Evaluable>>;
  Nameable?: Maybe<Array<Nameable>>;
  Object?: Maybe<Array<Object>>;
  Organization?: Maybe<Array<Organization>>;
  Person?: Maybe<Array<Person>>;
  Publisher?: Maybe<Array<Publisher>>;
  Relatable?: Maybe<Array<Relatable>>;
  Tag?: Maybe<Array<Tag>>;
  Thread?: Maybe<Array<Thread>>;
  User?: Maybe<Array<User>>;
};


export type QueryAuditableArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterAuditable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderAuditable>;
};


export type QueryAuthorArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterAuthor>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderAuthor>;
};


export type QueryBaseObjectArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterBaseObject>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderBaseObject>;
};


export type QueryBookArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterBook>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderBook>;
};


export type QueryChapterArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterChapter>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderChapter>;
};


export type QueryEvaluableArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterEvaluable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderEvaluable>;
};


export type QueryNameableArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterNameable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderNameable>;
};


export type QueryObjectArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterObject>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderObject>;
};


export type QueryOrganizationArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterOrganization>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderOrganization>;
};


export type QueryPersonArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type QueryPublisherArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPublisher>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPublisher>;
};


export type QueryRelatableArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type QueryTagArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterTag>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderTag>;
};


export type QueryThreadArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterThread>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderThread>;
};


export type QueryUserArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterUser>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderUser>;
};

export type Relatable = {
  id: Scalars['ID']['output'];
  related_by?: Maybe<Array<Relatable>>;
  related_to?: Maybe<Array<Relatable>>;
};


export type RelatableRelated_ByArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type RelatableRelated_ToArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};

export type Tag = {
  created_at: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  owner: Array<Person>;
  related_by?: Maybe<Array<Relatable>>;
  related_to?: Maybe<Array<Relatable>>;
  type: Scalars['String']['output'];
  updated_at: Scalars['String']['output'];
};


export type TagOwnerArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type TagRelated_ByArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type TagRelated_ToArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};

export type Tag_Type = Auditable & BaseObject & Nameable & Object & Relatable & Tag & {
  __typename?: 'Tag_Type';
  created_at: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  owner: Array<Person>;
  related_by?: Maybe<Array<Relatable>>;
  related_to?: Maybe<Array<Relatable>>;
  type: Scalars['String']['output'];
  updated_at: Scalars['String']['output'];
};


export type Tag_TypeOwnerArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type Tag_TypeRelated_ByArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type Tag_TypeRelated_ToArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};

export type Thread = {
  author: Person;
  content: Scalars['String']['output'];
  created_at: Scalars['String']['output'];
  down?: Maybe<Array<Person>>;
  favorites?: Maybe<Array<Person>>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  related_by?: Maybe<Array<Relatable>>;
  related_to?: Maybe<Array<Relatable>>;
  replies?: Maybe<Array<Thread>>;
  up?: Maybe<Array<Person>>;
  updated_at: Scalars['String']['output'];
};


export type ThreadAuthorArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type ThreadDownArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type ThreadFavoritesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type ThreadRelated_ByArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type ThreadRelated_ToArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type ThreadRepliesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterThread>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderThread>;
};


export type ThreadUpArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};

export type Thread_Type = Auditable & BaseObject & Evaluable & Nameable & Object & Relatable & Thread & {
  __typename?: 'Thread_Type';
  author: Person;
  content: Scalars['String']['output'];
  created_at: Scalars['String']['output'];
  down?: Maybe<Array<Person>>;
  favorites?: Maybe<Array<Person>>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  related_by?: Maybe<Array<Relatable>>;
  related_to?: Maybe<Array<Relatable>>;
  replies?: Maybe<Array<Thread>>;
  up?: Maybe<Array<Person>>;
  updated_at: Scalars['String']['output'];
};


export type Thread_TypeAuthorArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type Thread_TypeDownArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type Thread_TypeFavoritesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type Thread_TypeRelated_ByArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type Thread_TypeRelated_ToArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type Thread_TypeRepliesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterThread>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderThread>;
};


export type Thread_TypeUpArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};

export type UpdateAuditable = {
  updated_at?: InputMaybe<UpdateOp_Updated_At_Auditable>;
};

export type UpdateAuthor = {
  books?: InputMaybe<UpdateOp_Books_Author>;
  description?: InputMaybe<UpdateOp_Description_Author>;
  down?: InputMaybe<UpdateOp_Down_Author>;
  favorites?: InputMaybe<UpdateOp_Favorites_Author>;
  name?: InputMaybe<UpdateOp_Name_Author>;
  related_to?: InputMaybe<UpdateOp_Related_To_Author>;
  up?: InputMaybe<UpdateOp_Up_Author>;
  user?: InputMaybe<UpdateOp_User_Author>;
};

export type UpdateBook = {
  cover?: InputMaybe<UpdateOp_Cover_Book>;
  description?: InputMaybe<UpdateOp_Description_Book>;
  down?: InputMaybe<UpdateOp_Down_Book>;
  favorites?: InputMaybe<UpdateOp_Favorites_Book>;
  grabbed_from?: InputMaybe<UpdateOp_Grabbed_From_Book>;
  length?: InputMaybe<UpdateOp_Length_Book>;
  name?: InputMaybe<UpdateOp_Name_Book>;
  related_to?: InputMaybe<UpdateOp_Related_To_Book>;
  up?: InputMaybe<UpdateOp_Up_Book>;
  updated_at?: InputMaybe<UpdateOp_Updated_At_Book>;
};

export type UpdateChapter = {
  book?: InputMaybe<UpdateOp_Book_Chapter>;
  down?: InputMaybe<UpdateOp_Down_Chapter>;
  favorites?: InputMaybe<UpdateOp_Favorites_Chapter>;
  name?: InputMaybe<UpdateOp_Name_Chapter>;
  order?: InputMaybe<UpdateOp_Order_Chapter>;
  parent?: InputMaybe<UpdateOp_Parent_Chapter>;
  related_to?: InputMaybe<UpdateOp_Related_To_Chapter>;
  up?: InputMaybe<UpdateOp_Up_Chapter>;
};

export type UpdateEvaluable = {
  down?: InputMaybe<UpdateOp_Down_Evaluable>;
  favorites?: InputMaybe<UpdateOp_Favorites_Evaluable>;
  up?: InputMaybe<UpdateOp_Up_Evaluable>;
};

export type UpdateNameable = {
  name?: InputMaybe<UpdateOp_Name_Nameable>;
};

export type UpdateOp_Author_Thread = {
  set?: InputMaybe<NestedUpdatePerson>;
};

export type UpdateOp_Book_Chapter = {
  set?: InputMaybe<NestedUpdateBook>;
};

export type UpdateOp_Books_Author = {
  add?: InputMaybe<Array<NestedUpdateBook>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdateBook>>;
  set?: InputMaybe<Array<NestedUpdateBook>>;
};

export type UpdateOp_Books_Publisher = {
  add?: InputMaybe<Array<NestedUpdateBook>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdateBook>>;
  set?: InputMaybe<Array<NestedUpdateBook>>;
};

export type UpdateOp_Content_Thread = {
  append?: InputMaybe<Scalars['String']['input']>;
  prepend?: InputMaybe<Scalars['String']['input']>;
  set?: InputMaybe<Scalars['String']['input']>;
  slice?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type UpdateOp_Cover_Book = {
  append?: InputMaybe<Scalars['String']['input']>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  prepend?: InputMaybe<Scalars['String']['input']>;
  set?: InputMaybe<Scalars['String']['input']>;
  slice?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type UpdateOp_Description_Author = {
  append?: InputMaybe<Scalars['String']['input']>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  prepend?: InputMaybe<Scalars['String']['input']>;
  set?: InputMaybe<Scalars['String']['input']>;
  slice?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type UpdateOp_Description_Book = {
  append?: InputMaybe<Scalars['String']['input']>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  prepend?: InputMaybe<Scalars['String']['input']>;
  set?: InputMaybe<Scalars['String']['input']>;
  slice?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type UpdateOp_Description_User = {
  append?: InputMaybe<Scalars['String']['input']>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  prepend?: InputMaybe<Scalars['String']['input']>;
  set?: InputMaybe<Scalars['String']['input']>;
  slice?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type UpdateOp_Domain_Publisher = {
  append?: InputMaybe<Scalars['String']['input']>;
  prepend?: InputMaybe<Scalars['String']['input']>;
  set?: InputMaybe<Scalars['String']['input']>;
  slice?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type UpdateOp_Down_Author = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Down_Book = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Down_Chapter = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Down_Evaluable = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Down_Organization = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Down_Person = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Down_Publisher = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Down_Thread = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Down_User = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Email_User = {
  append?: InputMaybe<Scalars['String']['input']>;
  prepend?: InputMaybe<Scalars['String']['input']>;
  set?: InputMaybe<Scalars['String']['input']>;
  slice?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type UpdateOp_Favorites_Author = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Favorites_Book = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Favorites_Chapter = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Favorites_Evaluable = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Favorites_Organization = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Favorites_Person = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Favorites_Publisher = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Favorites_Thread = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Favorites_User = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Friends_User = {
  add?: InputMaybe<Array<NestedUpdateUser>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdateUser>>;
  set?: InputMaybe<Array<NestedUpdateUser>>;
};

export type UpdateOp_Grabbed_From_Book = {
  append?: InputMaybe<Scalars['String']['input']>;
  prepend?: InputMaybe<Scalars['String']['input']>;
  set?: InputMaybe<Scalars['String']['input']>;
  slice?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type UpdateOp_Length_Book = {
  decrement?: InputMaybe<Scalars['Int64']['input']>;
  increment?: InputMaybe<Scalars['Int64']['input']>;
  set?: InputMaybe<Scalars['Int64']['input']>;
};

export type UpdateOp_Members_Organization = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Name_Author = {
  append?: InputMaybe<Scalars['String']['input']>;
  prepend?: InputMaybe<Scalars['String']['input']>;
  set?: InputMaybe<Scalars['String']['input']>;
  slice?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type UpdateOp_Name_Book = {
  append?: InputMaybe<Scalars['String']['input']>;
  prepend?: InputMaybe<Scalars['String']['input']>;
  set?: InputMaybe<Scalars['String']['input']>;
  slice?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type UpdateOp_Name_Chapter = {
  append?: InputMaybe<Scalars['String']['input']>;
  prepend?: InputMaybe<Scalars['String']['input']>;
  set?: InputMaybe<Scalars['String']['input']>;
  slice?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type UpdateOp_Name_Nameable = {
  append?: InputMaybe<Scalars['String']['input']>;
  prepend?: InputMaybe<Scalars['String']['input']>;
  set?: InputMaybe<Scalars['String']['input']>;
  slice?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type UpdateOp_Name_Organization = {
  append?: InputMaybe<Scalars['String']['input']>;
  prepend?: InputMaybe<Scalars['String']['input']>;
  set?: InputMaybe<Scalars['String']['input']>;
  slice?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type UpdateOp_Name_Person = {
  append?: InputMaybe<Scalars['String']['input']>;
  prepend?: InputMaybe<Scalars['String']['input']>;
  set?: InputMaybe<Scalars['String']['input']>;
  slice?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type UpdateOp_Name_Publisher = {
  append?: InputMaybe<Scalars['String']['input']>;
  prepend?: InputMaybe<Scalars['String']['input']>;
  set?: InputMaybe<Scalars['String']['input']>;
  slice?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type UpdateOp_Name_Tag = {
  append?: InputMaybe<Scalars['String']['input']>;
  prepend?: InputMaybe<Scalars['String']['input']>;
  set?: InputMaybe<Scalars['String']['input']>;
  slice?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type UpdateOp_Name_Thread = {
  append?: InputMaybe<Scalars['String']['input']>;
  prepend?: InputMaybe<Scalars['String']['input']>;
  set?: InputMaybe<Scalars['String']['input']>;
  slice?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type UpdateOp_Name_User = {
  append?: InputMaybe<Scalars['String']['input']>;
  prepend?: InputMaybe<Scalars['String']['input']>;
  set?: InputMaybe<Scalars['String']['input']>;
  slice?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type UpdateOp_Order_Chapter = {
  decrement?: InputMaybe<Scalars['Float']['input']>;
  increment?: InputMaybe<Scalars['Float']['input']>;
  set?: InputMaybe<Scalars['Float']['input']>;
};

export type UpdateOp_Owner_Tag = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Parent_Chapter = {
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  set?: InputMaybe<NestedUpdateChapter>;
};

export type UpdateOp_Related_To_Author = {
  add?: InputMaybe<Array<NestedUpdateRelatable>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdateRelatable>>;
  set?: InputMaybe<Array<NestedUpdateRelatable>>;
};

export type UpdateOp_Related_To_Book = {
  add?: InputMaybe<Array<NestedUpdateRelatable>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdateRelatable>>;
  set?: InputMaybe<Array<NestedUpdateRelatable>>;
};

export type UpdateOp_Related_To_Chapter = {
  add?: InputMaybe<Array<NestedUpdateRelatable>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdateRelatable>>;
  set?: InputMaybe<Array<NestedUpdateRelatable>>;
};

export type UpdateOp_Related_To_Organization = {
  add?: InputMaybe<Array<NestedUpdateRelatable>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdateRelatable>>;
  set?: InputMaybe<Array<NestedUpdateRelatable>>;
};

export type UpdateOp_Related_To_Person = {
  add?: InputMaybe<Array<NestedUpdateRelatable>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdateRelatable>>;
  set?: InputMaybe<Array<NestedUpdateRelatable>>;
};

export type UpdateOp_Related_To_Publisher = {
  add?: InputMaybe<Array<NestedUpdateRelatable>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdateRelatable>>;
  set?: InputMaybe<Array<NestedUpdateRelatable>>;
};

export type UpdateOp_Related_To_Relatable = {
  add?: InputMaybe<Array<NestedUpdateRelatable>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdateRelatable>>;
  set?: InputMaybe<Array<NestedUpdateRelatable>>;
};

export type UpdateOp_Related_To_Tag = {
  add?: InputMaybe<Array<NestedUpdateRelatable>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdateRelatable>>;
  set?: InputMaybe<Array<NestedUpdateRelatable>>;
};

export type UpdateOp_Related_To_Thread = {
  add?: InputMaybe<Array<NestedUpdateRelatable>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdateRelatable>>;
  set?: InputMaybe<Array<NestedUpdateRelatable>>;
};

export type UpdateOp_Related_To_User = {
  add?: InputMaybe<Array<NestedUpdateRelatable>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdateRelatable>>;
  set?: InputMaybe<Array<NestedUpdateRelatable>>;
};

export type UpdateOp_Replies_Thread = {
  add?: InputMaybe<Array<NestedUpdateThread>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdateThread>>;
  set?: InputMaybe<Array<NestedUpdateThread>>;
};

export type UpdateOp_Type_Tag = {
  append?: InputMaybe<Scalars['String']['input']>;
  prepend?: InputMaybe<Scalars['String']['input']>;
  set?: InputMaybe<Scalars['String']['input']>;
  slice?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type UpdateOp_Up_Author = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Up_Book = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Up_Chapter = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Up_Evaluable = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Up_Organization = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Up_Person = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Up_Publisher = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Up_Thread = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Up_User = {
  add?: InputMaybe<Array<NestedUpdatePerson>>;
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  remove?: InputMaybe<Array<NestedUpdatePerson>>;
  set?: InputMaybe<Array<NestedUpdatePerson>>;
};

export type UpdateOp_Updated_At_Auditable = {
  set?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateOp_Updated_At_Book = {
  set?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateOp_Updated_At_Organization = {
  set?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateOp_Updated_At_Person = {
  set?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateOp_Updated_At_Tag = {
  set?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateOp_Updated_At_Thread = {
  set?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateOp_Updated_At_User = {
  set?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateOp_User_Author = {
  clear?: InputMaybe<Scalars['Boolean']['input']>;
  set?: InputMaybe<NestedUpdatePerson>;
};

export type UpdateOrganization = {
  down?: InputMaybe<UpdateOp_Down_Organization>;
  favorites?: InputMaybe<UpdateOp_Favorites_Organization>;
  members?: InputMaybe<UpdateOp_Members_Organization>;
  name?: InputMaybe<UpdateOp_Name_Organization>;
  related_to?: InputMaybe<UpdateOp_Related_To_Organization>;
  up?: InputMaybe<UpdateOp_Up_Organization>;
  updated_at?: InputMaybe<UpdateOp_Updated_At_Organization>;
};

export type UpdatePerson = {
  down?: InputMaybe<UpdateOp_Down_Person>;
  favorites?: InputMaybe<UpdateOp_Favorites_Person>;
  name?: InputMaybe<UpdateOp_Name_Person>;
  related_to?: InputMaybe<UpdateOp_Related_To_Person>;
  up?: InputMaybe<UpdateOp_Up_Person>;
  updated_at?: InputMaybe<UpdateOp_Updated_At_Person>;
};

export type UpdatePublisher = {
  books?: InputMaybe<UpdateOp_Books_Publisher>;
  domain?: InputMaybe<UpdateOp_Domain_Publisher>;
  down?: InputMaybe<UpdateOp_Down_Publisher>;
  favorites?: InputMaybe<UpdateOp_Favorites_Publisher>;
  name?: InputMaybe<UpdateOp_Name_Publisher>;
  related_to?: InputMaybe<UpdateOp_Related_To_Publisher>;
  up?: InputMaybe<UpdateOp_Up_Publisher>;
};

export type UpdateRelatable = {
  related_to?: InputMaybe<UpdateOp_Related_To_Relatable>;
};

export type UpdateTag = {
  name?: InputMaybe<UpdateOp_Name_Tag>;
  owner?: InputMaybe<UpdateOp_Owner_Tag>;
  related_to?: InputMaybe<UpdateOp_Related_To_Tag>;
  type?: InputMaybe<UpdateOp_Type_Tag>;
  updated_at?: InputMaybe<UpdateOp_Updated_At_Tag>;
};

export type UpdateThread = {
  author?: InputMaybe<UpdateOp_Author_Thread>;
  content?: InputMaybe<UpdateOp_Content_Thread>;
  down?: InputMaybe<UpdateOp_Down_Thread>;
  favorites?: InputMaybe<UpdateOp_Favorites_Thread>;
  name?: InputMaybe<UpdateOp_Name_Thread>;
  related_to?: InputMaybe<UpdateOp_Related_To_Thread>;
  replies?: InputMaybe<UpdateOp_Replies_Thread>;
  up?: InputMaybe<UpdateOp_Up_Thread>;
  updated_at?: InputMaybe<UpdateOp_Updated_At_Thread>;
};

export type UpdateUser = {
  description?: InputMaybe<UpdateOp_Description_User>;
  down?: InputMaybe<UpdateOp_Down_User>;
  email?: InputMaybe<UpdateOp_Email_User>;
  favorites?: InputMaybe<UpdateOp_Favorites_User>;
  friends?: InputMaybe<UpdateOp_Friends_User>;
  name?: InputMaybe<UpdateOp_Name_User>;
  related_to?: InputMaybe<UpdateOp_Related_To_User>;
  up?: InputMaybe<UpdateOp_Up_User>;
  updated_at?: InputMaybe<UpdateOp_Updated_At_User>;
};

export type User = {
  created_at: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  down?: Maybe<Array<Person>>;
  email: Scalars['String']['output'];
  favorites?: Maybe<Array<Person>>;
  friends?: Maybe<Array<User>>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  owned_favorites?: Maybe<Array<Evaluable>>;
  owned_tags?: Maybe<Array<Tag>>;
  related_by?: Maybe<Array<Relatable>>;
  related_to?: Maybe<Array<Relatable>>;
  up?: Maybe<Array<Person>>;
  updated_at: Scalars['String']['output'];
};


export type UserDownArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type UserFavoritesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type UserFriendsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterUser>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderUser>;
};


export type UserOwned_FavoritesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterEvaluable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderEvaluable>;
};


export type UserOwned_TagsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterTag>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderTag>;
};


export type UserRelated_ByArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type UserRelated_ToArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type UserUpArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};

export type User_Type = Auditable & BaseObject & Evaluable & Nameable & Object & Person & Relatable & User & {
  __typename?: 'User_Type';
  created_at: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  down?: Maybe<Array<Person>>;
  email: Scalars['String']['output'];
  favorites?: Maybe<Array<Person>>;
  friends?: Maybe<Array<User>>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  owned_favorites?: Maybe<Array<Evaluable>>;
  owned_tags?: Maybe<Array<Tag>>;
  related_by?: Maybe<Array<Relatable>>;
  related_to?: Maybe<Array<Relatable>>;
  up?: Maybe<Array<Person>>;
  updated_at: Scalars['String']['output'];
};


export type User_TypeDownArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type User_TypeFavoritesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};


export type User_TypeFriendsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterUser>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderUser>;
};


export type User_TypeOwned_FavoritesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterEvaluable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderEvaluable>;
};


export type User_TypeOwned_TagsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterTag>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderTag>;
};


export type User_TypeRelated_ByArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type User_TypeRelated_ToArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterRelatable>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderRelatable>;
};


export type User_TypeUpArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterPerson>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<OrderPerson>;
};

/** Enum value used to specify ordering direction. */
export enum DirectionEnum {
  Asc = 'ASC',
  Desc = 'DESC'
}

/** Enum value used to specify how nulls are ordered. */
export enum NullsOrderingEnum {
  Biggest = 'BIGGEST',
  Smallest = 'SMALLEST'
}
