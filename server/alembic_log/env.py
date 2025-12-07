import os
from logging.config import fileConfig
from urllib.parse import quote_plus

from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlalchemy import text as sql_text
from dotenv import load_dotenv

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

load_dotenv()


def _build_db_url() -> str:
    """
    Compose the SQLAlchemy URL for the chat/log database.
    """
    user = os.getenv("MSG_DB_USER", "")
    password = quote_plus(os.getenv("MSG_DB_PASSWORD", ""))
    host = os.getenv("MSG_DB_HOST", "127.0.0.1")
    port = os.getenv("MSG_DB_PORT", "3306")
    name = os.getenv("MSG_DB_NAME", "ai_reporting_log")
    return f"mysql+pymysql://{user}:{password}@{host}:{port}/{name}"


target_metadata = None


def run_migrations_offline() -> None:
    url = _build_db_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = _build_db_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        future=True,
    )

    with connectable.connect() as connection:
        db_name = os.getenv("MSG_DB_NAME", "ai_reporting_log")
        connection.execute(sql_text(f"CREATE DATABASE IF NOT EXISTS `{db_name}`"))
        connection.execute(sql_text(f"USE `{db_name}`"))

        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
