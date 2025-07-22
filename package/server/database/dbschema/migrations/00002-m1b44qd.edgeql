CREATE MIGRATION m1b44qdismubw3gby7dwa47jg6eem4h54h5d4hq4h35zptox3egcxa
    ONTO m1evd2th4gj2wi6wn5kvjdkun4uvgbhxz7wu5u7zm2v2wchmcsk75a
{
  CREATE ABSTRACT TYPE default::Tagable {
      CREATE MULTI LINK tags: default::Tag;
  };
  ALTER TYPE default::Author EXTENDING default::Tagable LAST;
  ALTER TYPE default::Book EXTENDING default::Tagable LAST;
  ALTER TYPE default::Book {
      ALTER LINK tags {
          RESET CARDINALITY;
          DROP OWNED;
          RESET TYPE;
      };
  };
  ALTER TYPE default::Unit EXTENDING default::Tagable LAST;
  ALTER TYPE default::Platform EXTENDING default::Tagable LAST;
  ALTER TYPE default::Message EXTENDING default::Tagable LAST;
  ALTER TYPE default::Person EXTENDING default::Tagable LAST;
  ALTER TYPE default::Thread EXTENDING default::Tagable LAST;
};
