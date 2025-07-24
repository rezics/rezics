CREATE MIGRATION m1fzj3ldubpkbntoabcamji3g6hntxofpncwx4ebjtioiuqyuhrsdq
    ONTO initial
{
  CREATE EXTENSION pgvector VERSION '0.7';
  CREATE EXTENSION pgcrypto VERSION '1.3';
  CREATE EXTENSION auth VERSION '1.0';
  CREATE EXTENSION ai VERSION '1.0';
  CREATE SCALAR TYPE default::long_str EXTENDING std::str {
      CREATE CONSTRAINT std::max_len_value(10000);
  };
  CREATE SCALAR TYPE default::medium_str EXTENDING std::str {
      CREATE CONSTRAINT std::max_len_value(1000);
  };
  CREATE SCALAR TYPE default::short_str EXTENDING std::str {
      CREATE CONSTRAINT std::max_len_value(100);
  };
  CREATE FUTURE simple_scoping;
  CREATE ABSTRACT TYPE default::Nameable {
      CREATE REQUIRED PROPERTY name: default::medium_str;
      CREATE INDEX ON (.name);
  };
  CREATE ABSTRACT TYPE default::Evaluable;
  CREATE ABSTRACT TYPE default::Tagable;
  CREATE TYPE default::Author EXTENDING default::Nameable, default::Evaluable, default::Tagable {
      CREATE PROPERTY description: default::long_str;
  };
  CREATE ABSTRACT TYPE default::Volatile {
      CREATE REQUIRED PROPERTY created_at: std::datetime {
          SET readonly := true;
          CREATE REWRITE
              INSERT 
              USING (std::datetime_of_statement());
      };
      CREATE REQUIRED PROPERTY updated_at: std::datetime {
          CREATE REWRITE
              INSERT 
              USING (std::datetime_of_statement());
          CREATE REWRITE
              UPDATE 
              USING (std::datetime_of_statement());
      };
  };
  CREATE TYPE default::Book EXTENDING default::Nameable, default::Volatile, default::Evaluable, default::Tagable {
      CREATE REQUIRED MULTI LINK author: default::Author;
      CREATE REQUIRED PROPERTY length: std::bigint;
      CREATE PROPERTY real_updated_at: std::datetime;
      CREATE PROPERTY released_at: std::datetime;
      CREATE INDEX ON ((.length, .released_at, .real_updated_at));
      CREATE PROPERTY cover: std::str;
      CREATE REQUIRED PROPERTY description: default::long_str;
      CREATE REQUIRED PROPERTY grabbed_from: std::str;
  };
  ALTER TYPE default::Author {
      CREATE MULTI LINK books := (.<author[IS default::Book]);
  };
  CREATE ABSTRACT TYPE default::Person EXTENDING default::Nameable, default::Volatile, default::Evaluable, default::Tagable;
  ALTER TYPE default::Evaluable {
      CREATE MULTI LINK down: default::Person;
      CREATE MULTI LINK up: default::Person;
  };
  CREATE TYPE default::Tag EXTENDING default::Nameable;
  ALTER TYPE default::Tagable {
      CREATE MULTI LINK tags: default::Tag;
  };
  ALTER TYPE default::Author {
      CREATE SINGLE LINK user: default::Person;
  };
  CREATE TYPE default::Platform EXTENDING default::Nameable, default::Evaluable, default::Tagable {
      CREATE REQUIRED PROPERTY domain: default::short_str;
      CREATE INDEX ON (.domain);
  };
  ALTER TYPE default::Book {
      CREATE MULTI LINK platforms: default::Platform;
  };
  ALTER TYPE default::Platform {
      CREATE MULTI LINK books := (.<platforms[IS default::Book]);
  };
  ALTER TYPE default::Tag {
      CREATE MULTI LINK books := (.<tags[IS default::Book]);
  };
  CREATE TYPE default::Unit EXTENDING default::Nameable, default::Evaluable, default::Tagable {
      CREATE REQUIRED PROPERTY order: std::int32;
      CREATE INDEX ON (.order);
      CREATE MULTI LINK children: default::Unit {
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE LINK parent := (.<children[IS default::Unit]);
  };
  ALTER TYPE default::Book {
      CREATE MULTI LINK units: default::Unit {
          CREATE CONSTRAINT std::exclusive;
      };
  };
  ALTER TYPE default::Unit {
      CREATE LINK book := (.<units[IS default::Book]);
  };
  CREATE TYPE default::UserProfile EXTENDING default::Person {
      CREATE REQUIRED PROPERTY email: default::short_str;
      CREATE INDEX ON (.email);
      CREATE MULTI LINK friends: default::UserProfile;
      CREATE PROPERTY description: default::long_str;
  };
  CREATE TYPE default::UserGroup EXTENDING default::Person {
      CREATE MULTI LINK members: default::UserProfile {
          CREATE PROPERTY power: std::int32 {
              SET default := 99;
              CREATE CONSTRAINT std::max_value(99);
              CREATE CONSTRAINT std::min_value(0);
          };
      };
  };
  CREATE TYPE default::Thread EXTENDING default::Nameable, default::Volatile, default::Evaluable, default::Tagable {
      CREATE MULTI LINK related: default::Nameable;
      CREATE REQUIRED LINK author: default::Person;
      CREATE MULTI LINK replies: default::Thread;
      CREATE REQUIRED PROPERTY content: default::long_str;
  };
  CREATE TYPE default::Message EXTENDING default::Volatile, default::Tagable {
      CREATE REQUIRED LINK receiver: default::Person;
      CREATE MULTI LINK replies: default::Message;
      CREATE REQUIRED LINK sender: default::Person;
      CREATE REQUIRED PROPERTY content: default::long_str;
  };
};
