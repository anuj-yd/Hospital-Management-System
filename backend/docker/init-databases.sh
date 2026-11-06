#!/usr/bin/env bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE hms_test'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'hms_test')\gexec
    GRANT ALL PRIVILEGES ON DATABASE hms_test TO "$POSTGRES_USER";
EOSQL

