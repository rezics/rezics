SELECT 'CREATE DATABASE rezics_server'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rezics_server')\gexec

SELECT 'CREATE DATABASE rezics_auth'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rezics_auth')\gexec

SELECT 'CREATE DATABASE rezics_jobs'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rezics_jobs')\gexec

SELECT 'CREATE DATABASE rezics_history'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rezics_history')\gexec

SELECT 'CREATE DATABASE rezics_notify'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rezics_notify')\gexec

SELECT 'CREATE DATABASE rezics_reaction'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rezics_reaction')\gexec

SELECT 'CREATE DATABASE rezics_ranking'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rezics_ranking')\gexec
