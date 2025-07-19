begin transaction;

define database if not exists library;

define table unit       schemafull type normal;
define field title      on unit type string;
define field children   on unit type option<array<record<unit>>>;
define field updated_at on unit type datetime value time::now();
define field created_at on unit type datetime value time::now() readonly;

define table book         schemafull type normal;
define field grabbed_from on book type string assert string::is::url($value);
define field cover        on book type string assert string::is::url($value);
define field title        on book type string assert (
    string::len($value) > 0
    and string::len($value) < 1000
);
define field description  on book type string assert (
    string::len($value) > 0
    and string::len($value) < 10000
);
define field release      on book type datetime;
define field last_update  on book type datetime;
define field unit         on book type array<record<unit>>;
define field length       on book type int;
define field created_at   on book type datetime value time::now() readonly;
define field updated_at   on book type datetime value time::now();

define table tag        schemafull type normal;
define field name       on tag type string assert (
    string::len($value) > 0
    and string::len($value) < 100
);
define field created_at on tag type datetime value time::now() readonly;

define table r_tag     schemafull type relation from book to tag;
define field created_at on tagged type datetime value time::now() readonly;

define table platform   schemafull type normal;
define field name       on platform type string;
define field domain     on platform type string assert string::is::domain($value);
define field created_at on platform type datetime value time::now() readonly;

define table r_platform schemafull type relation from book to platform;
define field created_at on platformed type datetime value time::now() readonly;

define table author schemafull type normal;
define field name on author type string;

define table r_author schemafull type relation from book to author;
define field created_at on author type datetime value time::now() readonly;

commit transaction;
