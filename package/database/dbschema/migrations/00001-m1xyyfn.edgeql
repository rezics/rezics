CREATE MIGRATION m1xyyfndnuylkgldoyvjkkv7nfwiw7w3ewh5jzdudr7cq4jsntjdxq
    ONTO initial
{
  CREATE EXTENSION pgcrypto VERSION '1.3';
  CREATE EXTENSION edgeql_http VERSION '1.0';
  CREATE EXTENSION graphql VERSION '1.0';
  CREATE SCALAR TYPE default::long_str EXTENDING std::str {
      CREATE CONSTRAINT std::max_len_value(10000);
  };
  CREATE SCALAR TYPE default::short_str EXTENDING std::str {
      CREATE CONSTRAINT std::max_len_value(100);
  };
  CREATE FUTURE simple_scoping;
  CREATE ABSTRACT TYPE default::Auditable {
      CREATE REQUIRED PROPERTY created_at: std::datetime {
          SET default := (std::datetime_of_statement());
          SET readonly := true;
          CREATE REWRITE
              INSERT 
              USING (std::datetime_of_statement());
      };
      CREATE REQUIRED PROPERTY updated_at: std::datetime {
          SET default := (std::datetime_of_statement());
          CREATE REWRITE
              INSERT 
              USING (std::datetime_of_statement());
          CREATE REWRITE
              UPDATE 
              USING (std::datetime_of_statement());
      };
  };
  CREATE ABSTRACT TYPE default::Base {
      CREATE REQUIRED PROPERTY _id: std::uuid {
          SET readonly := true;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE INDEX ON (._id);
  };
  CREATE ABSTRACT TYPE default::Nameable EXTENDING default::Base {
      CREATE REQUIRED PROPERTY name: default::short_str;
      CREATE INDEX ON (.name);
  };
  CREATE ABSTRACT TYPE default::Evaluable;
  CREATE ABSTRACT TYPE default::Relatable {
      CREATE MULTI LINK related_to: default::Relatable;
      CREATE LINK related_by := (.<related_to[IS default::Relatable]);
  };
  CREATE TYPE default::Book EXTENDING default::Nameable, default::Auditable, default::Evaluable, default::Relatable {
      CREATE REQUIRED PROPERTY length: std::int64;
      CREATE INDEX ON (.length);
      CREATE PROPERTY cover: std::str;
      CREATE PROPERTY description: default::long_str;
      CREATE REQUIRED PROPERTY grabbed_from: std::str;
  };
  CREATE TYPE default::Identity EXTENDING default::Auditable {
      CREATE REQUIRED PROPERTY password: std::str;
  };
  CREATE ABSTRACT TYPE default::Person EXTENDING default::Nameable, default::Auditable, default::Evaluable, default::Relatable {
      CREATE MULTI LINK owned_down: default::Evaluable;
      CREATE MULTI LINK owned_favorites: default::Evaluable;
      CREATE MULTI LINK owned_up: default::Evaluable;
  };
  CREATE TYPE default::Organization EXTENDING default::Person {
      CREATE MULTI LINK members: default::Person {
          CREATE PROPERTY power: std::int32 {
              SET default := 99;
              CREATE CONSTRAINT std::max_value(99);
              CREATE CONSTRAINT std::min_value(0);
          };
      };
  };
  ALTER TYPE default::Evaluable {
      CREATE MULTI LINK down := (.<owned_down[IS default::Person]);
      CREATE MULTI LINK favorites := (.<owned_favorites[IS default::Person]);
      CREATE MULTI LINK up := (.<owned_up[IS default::Person]);
  };
  CREATE TYPE default::User EXTENDING default::Person {
      CREATE REQUIRED PROPERTY email: default::short_str;
      CREATE INDEX ON (.email);
      CREATE MULTI LINK friends: default::User;
      CREATE PROPERTY description: default::long_str;
  };
  CREATE TYPE default::Tag EXTENDING default::Nameable, default::Auditable, default::Relatable {
      CREATE REQUIRED PROPERTY type: default::short_str;
      CREATE INDEX ON (.type);
  };
  CREATE TYPE default::Thread EXTENDING default::Nameable, default::Auditable, default::Evaluable, default::Relatable {
      CREATE REQUIRED LINK author: default::Person;
      CREATE MULTI LINK replies: default::Thread;
      CREATE REQUIRED PROPERTY content: default::long_str;
  };
  CREATE TYPE default::Author EXTENDING default::Nameable, default::Evaluable, default::Relatable {
      CREATE MULTI LINK books: default::Book;
      CREATE PROPERTY description: default::long_str;
  };
  ALTER TYPE default::Book {
      CREATE MULTI LINK authors := (.<books[IS default::Author]);
  };
  ALTER TYPE default::User {
      CREATE MULTI LINK authors: default::Author {
          CREATE CONSTRAINT std::exclusive;
      };
  };
  ALTER TYPE default::Author {
      CREATE LINK user := (.<authors[IS default::User]);
  };
  CREATE TYPE default::Chapter EXTENDING default::Nameable, default::Evaluable, default::Relatable {
      CREATE REQUIRED SINGLE LINK book: default::Book;
  };
  CREATE TYPE default::Publisher EXTENDING default::Nameable, default::Evaluable, default::Relatable {
      CREATE MULTI LINK books: default::Book {
          CREATE PROPERTY date: std::datetime;
          CREATE PROPERTY isbn: default::short_str;
      };
  };
  CREATE TYPE default::ChapterOrder {
      CREATE REQUIRED SINGLE LINK book: default::Book;
      CREATE REQUIRED PROPERTY content: std::json;
  };
  ALTER TYPE default::Book {
      CREATE LINK chapter_order := (.<book[IS default::ChapterOrder]);
      CREATE MULTI LINK chapters := (.<book[IS default::Chapter]);
      CREATE MULTI LINK publishers := (.<books[IS default::Publisher]);
  };
  ALTER TYPE default::Identity {
      CREATE REQUIRED SINGLE LINK user: default::User;
      CREATE INDEX ON (.user);
  };
  ALTER TYPE default::Person {
      CREATE MULTI LINK owned_tags: default::Tag;
  };
  ALTER TYPE default::Tag {
      CREATE MULTI LINK owners := (.<owned_tags[IS default::Person]);
  };
};
