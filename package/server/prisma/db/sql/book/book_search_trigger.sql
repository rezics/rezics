-- 先删掉旧的（如果有）
DROP TRIGGER IF EXISTS book_search_vector_update ON "Book";

-- 当 Book 行 INSERT / UPDATE 时，自动调用 update_book_search_vector()
CREATE TRIGGER book_search_vector_update
BEFORE INSERT OR UPDATE ON "Book"
FOR EACH ROW
EXECUTE FUNCTION update_book_search_vector();
