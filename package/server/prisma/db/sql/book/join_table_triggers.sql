------------------------------------------------------------
-- _BookAuthor 插入/删除/变更时，刷新 Book.searchVector
------------------------------------------------------------

CREATE OR REPLACE FUNCTION refresh_book_search_vector_on_book_author_change()
RETURNS trigger AS $$
DECLARE
    v_book_id uuid;
BEGIN
    -- Prisma 隐式多对多表 `_BookAuthor`
    -- "A" -> "Book"."unitId"
    -- "B" -> "User"."unitId"
    v_book_id := COALESCE(NEW."A", OLD."A");

    UPDATE "Book" b
    SET title = b.title
    WHERE b."unitId" = v_book_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS book_author_change_book_search_vector ON "_BookAuthor";

CREATE TRIGGER book_author_change_book_search_vector
AFTER INSERT OR UPDATE OR DELETE ON "_BookAuthor"
FOR EACH ROW
EXECUTE FUNCTION refresh_book_search_vector_on_book_author_change();

------------------------------------------------------------
-- _BookPress 插入/删除/变更时，刷新 Book.searchVector
------------------------------------------------------------

CREATE OR REPLACE FUNCTION refresh_book_search_vector_on_book_press_change()
RETURNS trigger AS $$
DECLARE
    v_book_id uuid;
BEGIN
    -- Prisma 隐式多对多表 `_BookPress`
    -- "A" -> "Book"."unitId"
    -- "B" -> "User"."unitId"
    v_book_id := COALESCE(NEW."A", OLD."A");

    UPDATE "Book" b
    SET title = b.title
    WHERE b."unitId" = v_book_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS book_press_change_book_search_vector ON "_BookPress";

CREATE TRIGGER book_press_change_book_search_vector
AFTER INSERT OR UPDATE OR DELETE ON "_BookPress"
FOR EACH ROW
EXECUTE FUNCTION refresh_book_search_vector_on_book_press_change();

------------------------------------------------------------
-- _BookProducer 插入/删除/变更时，刷新 Book.searchVector
------------------------------------------------------------

CREATE OR REPLACE FUNCTION refresh_book_search_vector_on_book_producer_change()
RETURNS trigger AS $$
DECLARE
    v_book_id uuid;
BEGIN
    -- Prisma 隐式多对多表 `_BookProducer`
    -- "A" -> "Book"."unitId"
    -- "B" -> "User"."unitId"
    v_book_id := COALESCE(NEW."A", OLD."A");

    UPDATE "Book" b
    SET title = b.title
    WHERE b."unitId" = v_book_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS book_producer_change_book_search_vector ON "_BookProducer";

CREATE TRIGGER book_producer_change_book_search_vector
AFTER INSERT OR UPDATE OR DELETE ON "_BookProducer"
FOR EACH ROW
EXECUTE FUNCTION refresh_book_search_vector_on_book_producer_change();
