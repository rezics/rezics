CREATE MIGRATION m1cz5s5hgwc2jsjmwmfhqb7rxqhp7nlgketxrxvvygmyhnqpz4rj6q
    ONTO m1qdom2575vvczpdd6n7avnqaw574jncqiosmh7iqik6vwnhknfbva
{
  CREATE ABSTRACT TYPE default::Entity;
  ALTER TYPE default::Author {
      DROP PROPERTY name;
  };
  ALTER TYPE default::Tag {
      DROP PROPERTY name;
  };
  ALTER TYPE default::Entity {
      CREATE REQUIRED PROPERTY name: default::medium_str;
      CREATE INDEX ON (.name);
  };
  ALTER TYPE default::Thread {
      CREATE PROPERTY name: default::medium_str {
          SET REQUIRED USING (<default::medium_str>{});
      };
      EXTENDING default::Entity BEFORE default::Logger;
  };
  CREATE ABSTRACT TYPE default::Person EXTENDING default::Entity;
  ALTER TYPE default::UserProfile {
      DROP EXTENDING default::UserEntity;
      EXTENDING default::Person BEFORE default::Logger;
  };
  ALTER TYPE default::Book {
      ALTER PROPERTY last_update {
          RENAME TO real_updated_at;
      };
  };
  ALTER TYPE default::Book {
      CREATE PROPERTY name: default::medium_str {
          SET REQUIRED USING (<default::medium_str>{});
      };
  };
  ALTER TYPE default::Book {
      DROP PROPERTY title;
      EXTENDING default::Entity BEFORE default::Logger;
  };
  ALTER TYPE default::UserGroup {
      DROP EXTENDING default::UserEntity;
      EXTENDING default::Person BEFORE default::Logger;
  };
  ALTER TYPE default::Platform EXTENDING default::Entity LAST;
  ALTER TYPE default::Unit {
      CREATE PROPERTY name: default::medium_str {
          SET REQUIRED USING (<default::medium_str>{});
      };
  };
  ALTER TYPE default::Unit {
      DROP PROPERTY title;
      EXTENDING default::Entity LAST;
      CREATE INDEX ON (.order);
      ALTER PROPERTY name {
          RESET OPTIONALITY;
          DROP OWNED;
          RESET TYPE;
      };
  };
  ALTER TYPE default::Author {
      CREATE PROPERTY name: default::medium_str {
          SET REQUIRED USING (<default::medium_str>{});
      };
      EXTENDING default::Entity LAST;
      ALTER INDEX ON (.name) SET OWNED;
  };
  ALTER TYPE default::Tag {
      CREATE PROPERTY name: default::medium_str {
          SET REQUIRED USING (<default::medium_str>{});
      };
      EXTENDING default::Entity LAST;
  };
  ALTER TYPE default::Thread {
      ALTER LINK related {
          SET TYPE default::Entity USING (<default::Entity>{});
      };
      ALTER LINK author {
          SET TYPE default::Person USING (<default::Person>{});
      };
      CREATE MULTI LINK down: default::Person;
      CREATE MULTI LINK up: default::Person;
      ALTER PROPERTY name {
          RESET OPTIONALITY;
          DROP OWNED;
          RESET TYPE;
      };
  };
  ALTER TYPE default::Author {
      ALTER LINK user {
          SET TYPE default::Entity USING (<default::Entity>{});
      };
      ALTER PROPERTY name {
          RESET OPTIONALITY;
          DROP OWNED;
          RESET TYPE;
      };
  };
  ALTER TYPE default::Book {
      CREATE INDEX ON ((.length, .released_at, .real_updated_at));
      ALTER PROPERTY name {
          RESET OPTIONALITY;
          DROP OWNED;
          RESET TYPE;
      };
  };
  ALTER TYPE default::Message {
      ALTER LINK receiver {
          SET TYPE default::Person USING (<default::Person>{});
      };
      ALTER LINK sender {
          SET TYPE default::Person USING (<default::Person>{});
      };
      CREATE MULTI LINK replies: default::Message;
  };
  ALTER TYPE default::Platform {
      ALTER INDEX ON (.name) SET OWNED;
      CREATE INDEX ON (.domain);
      ALTER PROPERTY name {
          RESET OPTIONALITY;
          DROP OWNED;
          RESET TYPE;
      };
  };
  ALTER TYPE default::Tag {
      ALTER PROPERTY name {
          RESET OPTIONALITY;
          DROP OWNED;
          RESET TYPE;
      };
  };
  DROP TYPE default::UserEntity;
  ALTER TYPE default::UserProfile {
      CREATE INDEX ON (.email);
  };
};
