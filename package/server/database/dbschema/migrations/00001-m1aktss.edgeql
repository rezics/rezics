CREATE MIGRATION m1aktssn6uu4ssxf2epynqoenpls62hl3ed3bwaw4tshnyzykab5eq
    ONTO initial
{
  CREATE EXTENSION pgvector VERSION '0.7';
  CREATE EXTENSION pgcrypto VERSION '1.3';
  CREATE EXTENSION auth VERSION '1.0';
  CREATE EXTENSION ai VERSION '1.0';
  CREATE FUTURE simple_scoping;
  CREATE TYPE default::Author {
      CREATE REQUIRED PROPERTY name: std::str;
  };
  CREATE TYPE default::Platform {
      CREATE REQUIRED PROPERTY domain: std::str;
      CREATE REQUIRED PROPERTY name: std::str;
  };
  CREATE TYPE default::Tag {
      CREATE REQUIRED PROPERTY name: std::str;
  };
  CREATE TYPE default::Book {
      CREATE REQUIRED LINK author: default::Author;
      CREATE MULTI LINK platforms: default::Platform;
      CREATE MULTI LINK tags: default::Tag;
      CREATE PROPERTY cover: std::str;
      CREATE PROPERTY created_at: std::datetime {
          CREATE REWRITE
              INSERT 
              USING (std::datetime_current());
      };
      CREATE REQUIRED PROPERTY description: std::str;
      CREATE REQUIRED PROPERTY grabbed_from: std::str;
      CREATE PROPERTY last_update: std::datetime;
      CREATE REQUIRED PROPERTY length: std::bigint;
      CREATE PROPERTY released_at: std::datetime;
      CREATE REQUIRED PROPERTY title: std::str;
      CREATE PROPERTY updated_at: std::datetime {
          CREATE REWRITE
              INSERT 
              USING (std::datetime_of_statement());
          CREATE REWRITE
              UPDATE 
              USING (std::datetime_of_statement());
      };
  };
  ALTER TYPE default::Author {
      CREATE MULTI LINK books := (.<author[IS default::Book]);
  };
  CREATE TYPE default::Unit {
      CREATE MULTI LINK children: default::Unit {
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE LINK parent := (.<children[IS default::Unit]);
      CREATE REQUIRED PROPERTY level: std::int32;
      CREATE REQUIRED PROPERTY title: std::str;
  };
  ALTER TYPE default::Book {
      CREATE MULTI LINK units: default::Unit;
  };
};
