------------------------------------------------------------
-- User(name) 修改时，刷新相关 Book 的 searchVector
-- 只对 type 为 AUTHOR / PRESS / PRODUCER 的用户生效
------------------------------------------------------------

CREATE OR REPLACE FUNCTION refresh_book_search_vector_on_user_change()
RETURNS trigger AS $$
BEGIN
    -- 仅当 name 实际发生变化时才执行更新
    IF NEW.name IS DISTINCT FROM OLD.name THEN

        -- 作者（User.type = 'AUTHOR'）
        IF NEW."type" = 'AUTHOR' THEN
            UPDATE "Book" b
            SET title = b.title   -- 触发 update_book_search_vector()
            FROM "_BookAuthor" ba
            WHERE ba."B" = NEW."unitId"
              AND ba."A" = b."unitId";
        END IF;

        -- 出版社（User.type = 'PRESS'）
        IF NEW."type" = 'PRESS' THEN
            UPDATE "Book" b
            SET title = b.title
            FROM "_BookPress" bp
            WHERE bp."B" = NEW."unitId"
              AND bp."A" = b."unitId";
        END IF;

        -- 出品方（User.type = 'PRODUCER'）
        IF NEW."type" = 'PRODUCER' THEN
            UPDATE "Book" b
            SET title = b.title
            FROM "_BookProducer" bpr
            WHERE bpr."B" = NEW."unitId"
              AND bpr."A" = b."unitId";
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_update_book_search_vector ON "User";

CREATE TRIGGER user_update_book_search_vector
AFTER UPDATE OF name ON "User"
FOR EACH ROW
EXECUTE FUNCTION refresh_book_search_vector_on_user_change();
