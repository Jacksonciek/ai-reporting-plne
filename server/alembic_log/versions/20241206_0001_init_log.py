"""Initial schema for ai_reporting_log (user, room, messages, excel_exports)."""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20241206_0001_log"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "user",
        sa.Column("user_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_name", sa.String(length=100), nullable=False),
        sa.Column("password", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
            server_onupdate=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("user_name", name="uq_user_user_name"),
        mysql_charset="utf8mb4",
        mysql_engine="InnoDB",
    )

    op.create_table(
        "room",
        sa.Column("room_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("room_name", sa.Text(), nullable=True),
        sa.Column("date_created", sa.DateTime(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
            server_onupdate=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user.user_id"],
            name="fk_room_user",
            ondelete="CASCADE",
        ),
        mysql_charset="utf8mb4",
        mysql_engine="InnoDB",
    )

    op.create_table(
        "messages",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("room_id", sa.Integer(), nullable=False),
        sa.Column("timestamp", sa.DateTime(), nullable=True),
        sa.Column("data_type", sa.String(length=50), nullable=False),
        sa.Column("image_url", sa.String(length=255), nullable=True),
        sa.Column("document_url", sa.String(length=255), nullable=True),
        sa.Column("excel_url", sa.String(length=255), nullable=True),
        sa.Column("df", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
            server_onupdate=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["room_id"],
            ["room.room_id"],
            name="fk_messages_room",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user.user_id"],
            name="fk_messages_user",
            ondelete="CASCADE",
        ),
        mysql_charset="utf8mb4",
        mysql_engine="InnoDB",
    )

    op.create_index("ix_messages_room_id", "messages", ["room_id"])
    op.create_index("ix_messages_user_id", "messages", ["user_id"])


def downgrade():
    op.drop_index("ix_messages_user_id", table_name="messages")
    op.drop_index("ix_messages_room_id", table_name="messages")
    op.drop_table("messages")
    op.drop_table("room")
    op.drop_table("user")
