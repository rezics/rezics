import { Surreal } from "surrealdb";
import { type Book } from "./schema.js";

export const write = async (book: Book) => {
    const database = new Surreal();
    await database.connect(process.env["SURREAL_URL"] as string, {
        namespace: process.env["SURREAL_NAMESPACE"] as string,
        database: process.env["SURREAL_DATABASE"] as string,
        auth: {
            scope: process.env["SURREAL_SCOPE"] as string,
            user: process.env["SURREAL_USER"] as string,
            pass: process.env["SURREAL_PASS"] as string,
        },
    });

    const {
        authors,
        tags,
        platform,
        link,
        units,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        id,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        completed,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        rating,
        ...restOfBook
    } = book;

    const bookContent = {
        ...restOfBook,
        unit: units,
        grabbed_from: link,
    };

    const platformDomain = new URL(link).hostname;

    await database.query(
        `
        begin transaction;
        let $authors = (for $name in $p_authors {
            return create author set name = $name on duplicate key update name = $name;
        });
        let $tags = (for $name in $p_tags {
            return create tag set name = $name on duplicate key update name = $name;
        });
        let $platform = (create platform set name = $p_platform_name, domain = $p_platform_domain on duplicate key update name = $p_platform_name);
        let $book = (create only book content $p_book_content)[0];
        relate $book->r_author->$authors;
        relate $book->r_tag->$tags;
        relate $book->r_platform->$platform;
        commit transaction;
        return $book;
        `,
        {
            p_authors: authors,
            p_tags: tags,
            p_platform_name: platform,
            p_platform_domain: platformDomain,
            p_book_content: bookContent,
        },
    );

    await database.close();
};
