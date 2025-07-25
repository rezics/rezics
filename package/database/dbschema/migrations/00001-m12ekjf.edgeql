CREATE MIGRATION m12ekjfjllwwo3jc7wkgpen6mfl5enc6mkheau3e3djmydlopdvhea
    ONTO initial
{
  CREATE EXTENSION pgvector VERSION '0.7';
  CREATE EXTENSION pgcrypto VERSION '1.3';
  CREATE EXTENSION auth VERSION '1.0';
  CREATE EXTENSION ai VERSION '1.0';
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
  CREATE ABSTRACT TYPE default::Nameable {
      CREATE REQUIRED PROPERTY name: default::short_str;
      CREATE INDEX ON (.name);
  };
  CREATE ABSTRACT TYPE default::Relatable {
      CREATE MULTI LINK related_to: default::Nameable;
  };
  CREATE ABSTRACT TYPE default::Evaluable;
  CREATE TYPE default::Book EXTENDING default::Nameable, default::Auditable, default::Evaluable, default::Relatable {
      CREATE REQUIRED PROPERTY length: std::int64;
      CREATE PROPERTY released_at: std::datetime;
      CREATE INDEX ON ((.length, .released_at));
      CREATE PROPERTY cover: std::str;
      CREATE PROPERTY description: default::long_str;
      CREATE REQUIRED PROPERTY grabbed_from: std::str;
  };
  CREATE ABSTRACT TYPE default::Person EXTENDING default::Nameable, default::Auditable, default::Evaluable, default::Relatable;
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
      CREATE MULTI LINK down: default::Person;
      CREATE MULTI LINK favorites: default::Person;
      CREATE MULTI LINK up: default::Person;
  };
  ALTER TYPE default::Person {
      CREATE LINK owned_favorites := (.<favorites[IS default::Evaluable]);
  };
  CREATE TYPE default::Tag EXTENDING default::Nameable, default::Relatable {
      CREATE REQUIRED MULTI LINK owner: default::Person;
      CREATE REQUIRED PROPERTY type: default::short_str;
      CREATE INDEX ON (.type);
  };
  ALTER TYPE default::Person {
      CREATE LINK owned_tags := (.<owner[IS default::Tag]);
  };
  CREATE TYPE default::User EXTENDING default::Person {
      CREATE REQUIRED PROPERTY email: default::short_str;
      CREATE INDEX ON (.email);
      CREATE MULTI LINK friends: default::User;
      CREATE REQUIRED LINK identity: ext::auth::Identity {
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE PROPERTY description: default::long_str;
  };
  CREATE TYPE default::Thread EXTENDING default::Nameable, default::Auditable, default::Evaluable, default::Relatable {
      CREATE REQUIRED LINK author: default::Person;
      CREATE MULTI LINK replies: default::Thread;
      CREATE REQUIRED PROPERTY content: default::long_str;
  };
  CREATE TYPE default::Author EXTENDING default::Nameable, default::Evaluable, default::Relatable {
      CREATE SINGLE LINK user: default::Person;
      CREATE PROPERTY description: default::long_str;
  };
  ALTER TYPE default::Book {
      CREATE REQUIRED MULTI LINK author: default::Author;
  };
  ALTER TYPE default::Author {
      CREATE MULTI LINK books := (.<author[IS default::Book]);
  };
  CREATE TYPE default::Chapter EXTENDING default::Nameable, default::Evaluable, default::Relatable {
      CREATE REQUIRED SINGLE LINK book: default::Book;
      CREATE SINGLE LINK parent: default::Chapter;
      CREATE MULTI LINK children := (.<parent[IS default::Chapter]);
      CREATE REQUIRED PROPERTY order: std::float64;
  };
  ALTER TYPE default::Book {
      CREATE MULTI LINK chapters := (.<book[IS default::Chapter]);
  };
  CREATE TYPE default::Publisher EXTENDING default::Nameable, default::Evaluable, default::Relatable {
      CREATE MULTI LINK books: default::Book {
          CREATE PROPERTY date: std::datetime;
          CREATE PROPERTY isbn: default::short_str;
      };
      CREATE REQUIRED PROPERTY domain: default::short_str;
      CREATE INDEX ON (.domain);
  };
  ALTER TYPE default::Book {
      CREATE MULTI LINK publishers := (.<books[IS default::Publisher]);
  };
};
