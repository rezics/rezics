CREATE MIGRATION m1m7nsztdcghqafz6af3wqxomefgrjxe3kbb4lvh7gelbpmotjlqxq
    ONTO initial
{
  CREATE EXTENSION pgvector VERSION '0.7';
  CREATE EXTENSION pgcrypto VERSION '1.3';
  CREATE EXTENSION auth VERSION '1.0';
  CREATE EXTENSION ai VERSION '1.0';
  CREATE SCALAR TYPE default::email EXTENDING std::str {
      CREATE CONSTRAINT std::max_len_value(1000);
      CREATE CONSTRAINT std::min_len_value(4);
      CREATE CONSTRAINT std::regexp(r'\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b');
  };
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
  CREATE ABSTRACT TYPE default::Entity {
      CREATE REQUIRED PROPERTY name: default::medium_str;
      CREATE INDEX ON (.name);
  };
  CREATE TYPE default::Author EXTENDING default::Entity {
      ALTER INDEX ON (.name) SET OWNED;
      CREATE SINGLE LINK user: default::Entity;
      CREATE REQUIRED PROPERTY description: default::medium_str;
  };
  CREATE ABSTRACT TYPE default::Logger {
      CREATE REQUIRED PROPERTY created_at: std::datetime {
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
  CREATE TYPE default::Book EXTENDING default::Entity, default::Logger {
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
  CREATE TYPE default::Platform EXTENDING default::Entity {
      ALTER INDEX ON (.name) SET OWNED;
      CREATE REQUIRED PROPERTY domain: default::medium_str;
      CREATE INDEX ON (.domain);
  };
  ALTER TYPE default::Book {
      CREATE MULTI LINK platforms: default::Platform;
  };
  ALTER TYPE default::Platform {
      CREATE MULTI LINK books := (.<platforms[IS default::Book]);
  };
  CREATE TYPE default::Tag EXTENDING default::Entity;
  ALTER TYPE default::Book {
      CREATE MULTI LINK tags: default::Tag;
  };
  ALTER TYPE default::Tag {
      CREATE MULTI LINK books := (.<tags[IS default::Book]);
  };
  CREATE TYPE default::Unit EXTENDING default::Entity {
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
  CREATE ABSTRACT TYPE default::Person EXTENDING default::Entity;
  CREATE TYPE default::Thread EXTENDING default::Entity, default::Logger {
      CREATE MULTI LINK related: default::Entity;
      CREATE REQUIRED LINK author: default::Person;
      CREATE MULTI LINK down: default::Person;
      CREATE MULTI LINK up: default::Person;
      CREATE MULTI LINK replies: default::Thread;
      CREATE REQUIRED PROPERTY content: default::long_str;
  };
  CREATE TYPE default::UserProfile EXTENDING default::Person, default::Logger {
      CREATE REQUIRED PROPERTY email: default::email;
      CREATE INDEX ON (.email);
      CREATE MULTI LINK friends: default::UserProfile;
      CREATE PROPERTY description: default::long_str;
  };
  CREATE TYPE default::UserGroup EXTENDING default::Person, default::Logger {
      CREATE MULTI LINK members: default::UserProfile {
          CREATE PROPERTY power: std::int32 {
              SET default := 99;
              CREATE CONSTRAINT std::max_value(99);
              CREATE CONSTRAINT std::min_value(0);
          };
      };
  };
  CREATE TYPE default::Message EXTENDING default::Logger {
      CREATE REQUIRED LINK receiver: default::Person;
      CREATE MULTI LINK replies: default::Message;
      CREATE REQUIRED LINK sender: default::Person;
      CREATE REQUIRED PROPERTY content: default::long_str;
  };
};
