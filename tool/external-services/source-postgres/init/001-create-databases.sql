SELECT 'CREATE DATABASE rezics_booklib'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rezics_booklib')\gexec

SELECT 'CREATE DATABASE rezics_auth'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rezics_auth')\gexec

SELECT 'CREATE DATABASE rezics_jobs'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rezics_jobs')\gexec

SELECT 'CREATE DATABASE rezics_history'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rezics_history')\gexec

SELECT 'CREATE DATABASE rezics_notify'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rezics_notify')\gexec

SELECT 'CREATE DATABASE reaction'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'reaction')\gexec
