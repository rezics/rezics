with 
    tag := (select (
        insert Tag {
            name := <str>$name,
            type := <str>$type,
        }
    ) { ** })
update User
filter (.id in array_unpack(<array<uuid>>$owner))
set {
    owned_tags += tag
};
