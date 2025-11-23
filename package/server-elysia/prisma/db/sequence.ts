export const sequence = {
  init: ['enable_extensions_and_index'],
  book: [
    'update_book_search_vector_function',
    'book_search_trigger',
    'author_press_producer_triggers',
    'join_table_triggers',
  ],
};

export const keyOrder = ['init', 'book'];
