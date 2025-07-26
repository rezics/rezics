CREATE MIGRATION m1kqadms7r3qailr3ur3oon2ed6jpkbxf5mupethzq6w4t6dsps2iq
    ONTO m13elogea45aq3gijluf4olj7jl77bnxbzzt5kizfoprde3q2tplmq
{
  ALTER TYPE default::User {
      DROP LINK identity;
  };
  DROP EXTENSION ai;
  DROP EXTENSION auth;
  DROP EXTENSION pgcrypto;
  DROP EXTENSION pgvector;
};
