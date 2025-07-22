CREATE MIGRATION m14pzyz5ooqn4ja644xduqtqpt25elxz3jib6i6jvra6rmv2ab3bba
    ONTO m1fzj3ldubpkbntoabcamji3g6hntxofpncwx4ebjtioiuqyuhrsdq
{
  ALTER TYPE default::Evaluable {
      CREATE MULTI LINK favorites: default::Person;
  };
  ALTER TYPE default::Tagable {
      ALTER LINK tags {
          SET TYPE default::Nameable USING (<default::Nameable>{});
      };
  };
  ALTER TYPE default::Book {
      ALTER PROPERTY description {
          RESET OPTIONALITY;
      };
  };
  CREATE TYPE default::CustomTag EXTENDING default::Nameable {
      CREATE REQUIRED SINGLE LINK owner: default::Person;
  };
  ALTER TYPE default::Person {
      CREATE LINK owned_favorites := (.<favorites[IS default::Evaluable]);
      CREATE LINK owned_tags := (.<owner[IS default::Nameable]);
  };
  DROP TYPE default::Message;
  DROP TYPE default::UserGroup;
  DROP TYPE default::UserProfile;
  ALTER TYPE default::Volatile RENAME TO default::Auditable;
  CREATE TYPE default::Organization EXTENDING default::Person {
      CREATE MULTI LINK members: default::Person {
          CREATE PROPERTY power: std::int32 {
              SET default := 99;
              CREATE CONSTRAINT std::max_value(99);
              CREATE CONSTRAINT std::min_value(0);
          };
      };
  };
  DROP TYPE default::Tag;
  ALTER TYPE default::Thread {
      DROP LINK related;
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
};
