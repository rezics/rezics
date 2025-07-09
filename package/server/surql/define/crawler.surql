begin transaction;

define db crawler;

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
define field author       on book type record<user>;
define field platform     on book type record<platform>;
define field release      on book type datetime;
define field last_update  on book type datetime;
define field unit         on book type array<string>;
define field tag          on book type array<record<tag>>;
define field length       on book type int;
define field created_at   on book type datetime value time::now() readonly;
define field updated_at   on book type datetime value time::now();

define table tag        schemafull type normal;
define field name       on tag type string assert (
    string::len($value) > 0
    and string::len($value) < 100
);
define field created_at on tag type datetime value time::now() readonly;

define table platform   schemafull type normal;
define field name       on platform type string;
define field domain     on platform type string assert string::is::domain($value);
define field created_at on platform type datetime value time::now() readonly;

define table user schemafull type normal;
define field name on user type string;

commit transaction;