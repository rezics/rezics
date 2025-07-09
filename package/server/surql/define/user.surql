begin transaction;

define table user schemafull type normal;

define field auth       on user type record<auth>;
define field name       on user type string assert string::len($value) < 100;
define field avatar     on user type string assert string::is::url($value);
define field created_at on user type datetime value $auth.created_at readonly;
define field updated_at on user type datetime value datetime::now();

commit transaction;
