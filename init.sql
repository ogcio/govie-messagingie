-- Service databases (must match POSTGRES_DB_NAME / POSTGRES_DATABASE in each app's .env)
CREATE DATABASE messaging;
CREATE DATABASE upload;
CREATE DATABASE scheduler;
CREATE DATABASE profile;

-- Setup Extensions
CREATE EXTENSION "uuid-ossp";
CREATE EXTENSION "pgcrypto";
