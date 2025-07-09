begin transaction;

define table auth schemafull type normal;

define field username on auth type string assert string::len($value) < 100;
define field email    on auth type string assert string::is::email($value);
define field password on auth type string;
define field created_at on auth type datetime value datetime::now() readonly;
define field updated_at on auth type datetime value datetime::now();

commit transaction;
