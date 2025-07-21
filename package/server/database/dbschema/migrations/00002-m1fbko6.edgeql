CREATE MIGRATION m1fbko6sidvselt3vj4odxzsjatx6pmdl464ymjypew76fei576pwq
    ONTO m1aktssn6uu4ssxf2epynqoenpls62hl3ed3bwaw4tshnyzykab5eq
{
  ALTER TYPE default::Book {
      ALTER LINK units {
          CREATE CONSTRAINT std::exclusive;
      };
  };
  ALTER TYPE default::Unit {
      CREATE LINK book := (.<units[IS default::Book]);
  };
  ALTER TYPE default::Platform {
      CREATE MULTI LINK books := (.<platforms[IS default::Book]);
  };
  ALTER TYPE default::Tag {
      CREATE MULTI LINK books := (.<tags[IS default::Book]);
  };
  ALTER TYPE default::Unit {
      ALTER PROPERTY level {
          RENAME TO order;
      };
  };
};
