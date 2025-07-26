select (
    insert Tag {
        name := <str>$name,
        type := <str>$type,
        owner := (
            select User
            filter (.id in array_unpack(<array<uuid>>$owner))
        )
    }
) { 
    id,
    created_at,
    updated_at,
    owner: {
        id
    },
    name,
    type,
    related_to: {
        id
    },
    related_by: {
        id
    }
}
