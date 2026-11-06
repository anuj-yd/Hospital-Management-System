-- Create hms_test database alongside the default hms_dev database
SELECT 'CREATE DATABASE hms_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'hms_test')\gexec

GRANT ALL PRIVILEGES ON DATABASE hms_test TO hms_user;

