CREATE OR REPLACE FUNCTION update_book_search_vector()
RETURNS trigger AS $$
DECLARE
    authors_text    text;
    presses_text    text;
    producers_text  text;
BEGIN
    -- 聚合作者名称
    SELECT string_agg(a.name, ' ')
    INTO authors_text
    FROM "_BookAuthor" ba
    JOIN "User" a ON a."unitId" = ba."B"
    WHERE ba."A" = NEW."unitId";

    -- 聚合出版社名称
    SELECT string_agg(p.name, ' ')
    INTO presses_text
    FROM "_BookPress" bp
    JOIN "User" p ON p."unitId" = bp."B"
    WHERE bp."A" = NEW."unitId";

    -- 聚合出品方名称
    SELECT string_agg(pr.name, ' ')
    INTO producers_text
    FROM "_BookProducer" bpr
    JOIN "User" pr ON pr."unitId" = bpr."B"
    WHERE bpr."A" = NEW."unitId";

    -- 生成 searchVector
    NEW."searchVector" :=
        -- 书名：权重 A（最高）
        setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||

        -- ISBN：权重 B
        setweight(to_tsvector('simple', coalesce(NEW.isbn, '')), 'B') ||

        -- 作者名：权重 B（你可以改为 C）
        setweight(to_tsvector('simple', coalesce(authors_text, '')), 'B') ||

        -- 出版社名：权重 C
        setweight(to_tsvector('simple', coalesce(presses_text, '')), 'C') ||

        -- 出品方名：权重 C
        setweight(to_tsvector('simple', coalesce(producers_text, '')), 'C');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
