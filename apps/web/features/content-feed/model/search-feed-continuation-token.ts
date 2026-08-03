declare const SearchFeedContinuationTokenBrand: unique symbol;

/**
 * An opaque continuation token proven to originate from a Search Feed response.
 *
 * The client may only return this value unchanged to the same Feed request.
 */
export type SearchFeedContinuationToken = string & {
	readonly [SearchFeedContinuationTokenBrand]: true;
};
