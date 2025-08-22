with book := (insert Book {
    _id := <uuid>$id,
    name := <short_str>$name,
    grabbed_from := <str>$grabbed_from,
    length := <int64>$length,
    cover := <optional short_str>$cover,
}),
authors := array_unpack(<array<tuple<id: uuid, name:short_str>>>$authors),
existingAuthors := (select Author filter .name in authors.name),
insertedAuthors := (
    for an in authors
    union (
        (insert Author {
                _id := an.id,
                name := an.name,
        }) if not an.name in existingAuthors.name else {}
    )
),
publishers := array_unpack(<array<tuple<id: uuid, name:short_str>>>$publishers),
existingPublishers := (select Publisher filter .name in publishers.name),
insertedPublishers := (
    for publisher in publishers
    union (
        (insert Publisher {
                _id := publisher.id,
                name := publisher.name,
        }) if not publisher.name in existingPublishers.name else {}
    )
),
chapters := array_unpack(<array<tuple<id: uuid, name: short_str>>>$chapters),
insertedChapters := (
    for cp in chapters
    union (
        insert Chapter {
            _id := cp.id,
            name := cp.name,
            book := book
        }
    )
),
insertedChapterOrder := (insert ChapterOrder { content := <json>$chapter_order, book := book }),
linkedAuthors := (update Author
    filter .id in existingAuthors.id or .id in insertedAuthors.id
    set {
        books += book,
    }
),
linkedChapters := (update Publisher
    filter .id in existingPublishers.id or .id in insertedPublishers.id
    set {
        books += book,
    }
)

select book;
