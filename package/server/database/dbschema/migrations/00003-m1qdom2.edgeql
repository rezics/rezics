CREATE MIGRATION m1qdom2575vvczpdd6n7avnqaw574jncqiosmh7iqik6vwnhknfbva
    ONTO m1fbko6sidvselt3vj4odxzsjatx6pmdl464ymjypew76fei576pwq
{
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
  CREATE ABSTRACT TYPE default::Logger;
  ALTER TYPE default::Book {
      DROP PROPERTY created_at;
      DROP PROPERTY updated_at;
  };
  ALTER TYPE default::Logger {
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
  ALTER TYPE default::Book {
      CREATE PROPERTY created_at: std::datetime {
          SET REQUIRED USING (<std::datetime>{});
      };
  };
  ALTER TYPE default::Book {
      CREATE PROPERTY updated_at: std::datetime {
          SET REQUIRED USING (<std::datetime>{});
      };
      EXTENDING default::Logger LAST;
  };
  CREATE ABSTRACT TYPE default::UserEntity {
      CREATE REQUIRED PROPERTY name: default::short_str;
  };
  CREATE TYPE default::Thread EXTENDING default::Logger {
      CREATE MULTI LINK related: (default::Book | default::Tag);
      CREATE REQUIRED LINK author: default::UserEntity;
      CREATE MULTI LINK replies: default::Thread;
      CREATE REQUIRED PROPERTY content: default::long_str;
  };
  ALTER TYPE default::Author {
      CREATE SINGLE LINK user: default::UserEntity;
      CREATE REQUIRED PROPERTY description: default::medium_str {
          SET REQUIRED USING (<default::medium_str>{});
      };
      ALTER PROPERTY name {
          SET TYPE default::short_str;
      };
  };
  ALTER TYPE default::Book {
      ALTER LINK author {
          SET MULTI;
      };
      ALTER PROPERTY created_at {
          RESET OPTIONALITY;
          DROP OWNED;
          RESET TYPE;
      };
      ALTER PROPERTY description {
          SET TYPE default::long_str;
      };
      ALTER PROPERTY title {
          SET TYPE default::medium_str;
      };
      ALTER PROPERTY updated_at {
          RESET OPTIONALITY;
          DROP OWNED;
          RESET TYPE;
      };
  };
  CREATE TYPE default::Message EXTENDING default::Logger {
      CREATE REQUIRED LINK receiver: default::UserEntity;
      CREATE REQUIRED LINK sender: default::UserEntity;
      CREATE REQUIRED PROPERTY content: default::long_str;
  };
  ALTER TYPE default::Platform {
      ALTER PROPERTY domain {
          SET TYPE default::medium_str;
      };
      ALTER PROPERTY name {
          SET TYPE default::medium_str;
      };
  };
  ALTER TYPE default::Tag {
      ALTER PROPERTY name {
          SET TYPE default::short_str;
      };
  };
  ALTER TYPE default::Unit {
      ALTER PROPERTY title {
          SET TYPE default::medium_str;
      };
  };
  CREATE TYPE default::UserProfile EXTENDING default::UserEntity, default::Logger {
      CREATE MULTI LINK friends: default::UserProfile;
      CREATE PROPERTY description: default::long_str;
      CREATE REQUIRED PROPERTY email: default::email;
  };
  CREATE TYPE default::UserGroup EXTENDING default::UserEntity, default::Logger {
      CREATE MULTI LINK members: default::UserProfile {
          CREATE PROPERTY power: std::int32 {
              SET default := 99;
              CREATE CONSTRAINT std::max_value(99);
              CREATE CONSTRAINT std::min_value(0);
          };
      };
  };
};
