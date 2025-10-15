/**
 * Frontend Book API Usage Examples
 *
 * This file demonstrates how to use the refactored Book API
 * in React components using TanStack Query.
 */

import {
  useQuery,
  useSuspenseQuery,
  useInfiniteQuery,
} from '@tanstack/react-query';
import {
  bookQueries,
  useCreateBookMutation,
  useUpdateBookMutation,
  useDeleteBookMutation,
  type CreateBookInput,
  type UpdateBookInput,
} from '../book';

/**
 * ANCHOR Example 1: Basic book list
 */
export function BookListExample() {
  const {data, isLoading, error} = useQuery(bookQueries.list());

  if (isLoading) return <div>Loading books...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Books ({data?.total})</h2>
      {data?.books.map(book => (
        <div key={book.postId}>
          <h3>{book.title}</h3>
          <p>{book.authors?.map(a => a.name).join(', ')}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * ANCHOR Example 2: Filtered book list
 */
export function FilteredBookListExample() {
  const {data} = useQuery(
    bookQueries.list({
      start: 1,
      limit: 20,
      // tags: 'fiction,scifi',
      q: 'Vorago',
    }),
  );

  return (
    <div>
      {data?.books.map(book => (
        <BookCard key={book.postId} book={book} />
      ))}
    </div>
  );
}

/**
 * ANCHOR Example 3: Single book detail with Suspense
 */
export function BookDetailExample({postId}: {postId: string}) {
  const {data: book} = useSuspenseQuery(bookQueries.detail(postId));

  return (
    <div>
      <h1>{book.title}</h1>
      <img src={book.coverUrl} alt={book.title} />
      <p>Authors: {book.authors?.map(a => a.name).join(', ')}</p>
      <p>ISBN: {book.isbn}</p>
      {book.extra && (
        <div>
          <h3>Additional Info</h3>
          <pre>{JSON.stringify(book.extra, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

/**
 * ANCHOR Example 4: Search books
 */
export function BookSearchExample() {
  const [searchQuery, setSearchQuery] = React.useState('');

  const {data, isFetching} = useQuery(
    bookQueries.search(searchQuery, {limit: 10}),
  );

  return (
    <div>
      <input
        type="text"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="Search books..."
      />
      {isFetching && <span>Searching...</span>}
      {data?.books.map(book => (
        <div key={book.postId}>{book.title}</div>
      ))}
    </div>
  );
}

/**
 * ANCHOR Example 5: Create a book
 */
export function CreateBookExample() {
  const createBook = useCreateBookMutation({
    onSuccess: book => {
      console.log('Book created:', book.postId);
      alert(`Book "${book.title}" created successfully!`);
    },
    onError: error => {
      console.error('Failed to create book:', error);
      alert(`Error: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const input: CreateBookInput = {
      userId: 'current-user-id', // Should come from auth context
      title: formData.get('title') as string,
      isbn: formData.get('isbn') as string,
      coverUrl: formData.get('coverUrl') as string,
    };

    createBook.mutate(input);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="title" placeholder="Book title" required />
      <input name="isbn" placeholder="ISBN" />
      <input name="coverUrl" placeholder="Cover URL" />
      <button type="submit" disabled={createBook.isPending}>
        {createBook.isPending ? 'Creating...' : 'Create Book'}
      </button>
    </form>
  );
}

/**
 * ANCHOR Example 6: Update a book
 */
export function UpdateBookExample({postId}: {postId: string}) {
  const {data: book} = useQuery(bookQueries.detail(postId));
  const updateBook = useUpdateBookMutation();

  const handleUpdate = () => {
    const updates: UpdateBookInput = {
      title: 'Updated Title',
      coverUrl: 'https://example.com/new-cover.jpg',
    };

    updateBook.mutate({postId, input: updates});
  };

  return (
    <div>
      <h2>{book?.title}</h2>
      <button onClick={handleUpdate} disabled={updateBook.isPending}>
        Update Book
      </button>
    </div>
  );
}

/**
 * ANCHOR Example 7: Delete a book
 */
export function DeleteBookExample({postId}: {postId: string}) {
  const deleteBook = useDeleteBookMutation({
    onSuccess: () => {
      alert('Book deleted successfully!');
      // Navigate away or update UI
    },
  });

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this book?')) {
      deleteBook.mutate(postId);
    }
  };

  return (
    <button onClick={handleDelete} disabled={deleteBook.isPending}>
      {deleteBook.isPending ? 'Deleting...' : 'Delete Book'}
    </button>
  );
}

/**
 * ANCHOR Example 8: Infinite scroll
 */
export function InfiniteBookListExample() {
  const {data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading} =
    useInfiniteQuery(bookQueries.infiniteList({limit: 20}));

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {data?.pages.map((page, i) => (
        <React.Fragment key={i}>
          {page.books.map(book => (
            <BookCard key={book.postId} book={book} />
          ))}
        </React.Fragment>
      ))}

      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? 'Loading more...' : 'Load More'}
        </button>
      )}
    </div>
  );
}

/**
 * ANCHOR Example 9: Books by user
 */
export function UserBooksExample({userId}: {userId: string}) {
  const {data} = useQuery(bookQueries.byUser(userId));

  return (
    <div>
      {/* eslint-disable-next-line react/no-unescaped-entities */}
      <h2>User's Books</h2>
      {data?.books.map(book => (
        <div key={book.postId}>{book.title}</div>
      ))}
    </div>
  );
}

/**
 * ANCHOR Example 10: Books by author
 */
export function AuthorBooksExample({authorId}: {authorId: string}) {
  const {data} = useQuery(bookQueries.byAuthor(authorId));

  return (
    <div>
      <h2>Books by this Author</h2>
      {data?.books.map(book => (
        <div key={book.postId}>{book.title}</div>
      ))}
    </div>
  );
}

/**
 * ANCHOR Example 11: ISBN lookup
 */
export function IsbnLookupExample() {
  const [isbn, setIsbn] = React.useState('');
  const {data, isFetching} = useQuery(bookQueries.byIsbn(isbn));

  return (
    <div>
      <input
        type="text"
        value={isbn}
        onChange={e => setIsbn(e.target.value)}
        placeholder="Enter ISBN..."
      />
      {isFetching && <span>Looking up...</span>}
      {data?.books[0] && (
        <div>
          <h3>Found: {data.books[0].title}</h3>
        </div>
      )}
    </div>
  );
}

/**
 * ANCHOR Example 12: Optimistic update
 */
export function OptimisticUpdateExample({postId}: {postId: string}) {
  const queryClient = useQueryClient();

  const updateBook = useUpdateBookMutation({
    onMutate: async ({postId, input}) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({queryKey: bookKeys.detail(postId)});

      // Snapshot previous value
      const previousBook = queryClient.getQueryData(bookKeys.detail(postId));

      // Optimistically update
      queryClient.setQueryData(bookKeys.detail(postId), (old: any) => ({
        ...old,
        ...input,
      }));

      return {previousBook};
    },
    onError: (err, variables, context: any) => {
      // Rollback on error
      if (context?.previousBook) {
        queryClient.setQueryData(
          bookKeys.detail(variables.postId),
          context.previousBook,
        );
      }
    },
  });

  return <div>{/* Component implementation */}</div>;
}

/**
 * Dummy BookCard component for examples
 */
function BookCard({book}: {book: any}) {
  return (
    <div className="book-card">
      <h3>{book.title}</h3>
      <p>{book.authors?.map((a: any) => a.name).join(', ')}</p>
    </div>
  );
}

// React import (for examples)
import * as React from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {bookKeys} from './book.keys';
import {Divider, Chip} from '@mui/material';

function ExampleChipDivider() {
  return (
    <Divider>
      <Chip label="Chip" size="small" />
    </Divider>
  );
}

/** Main component to showcase all examples
 * ANCHOR All Examples
 */
export function BookExamples() {
  return (
    <div>
      <h1>Book API Examples</h1>
      <BookListExample />
      <ExampleChipDivider />
      <FilteredBookListExample />
      <ExampleChipDivider />
      <BookDetailExample postId="8e3c577b-64cf-41a3-82bb-c3371f41378c" />
      <ExampleChipDivider />
      <BookSearchExample />
      <ExampleChipDivider />
      <CreateBookExample />
      <div className="mt-100" />
    </div>
  );
}
