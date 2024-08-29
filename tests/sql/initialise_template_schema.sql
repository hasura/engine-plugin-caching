SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity
WHERE pg_stat_activity.datname = 'postgres' AND pid <> pg_backend_pid();

CREATE DATABASE template_schema WITH TEMPLATE postgres;
