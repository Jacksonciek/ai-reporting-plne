"""Seed default admin user for chatbot access."""

import os

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20241206_0002_seed_admin_user"
down_revision = "20241206_0001_log"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    admin_username = os.getenv("ADMIN_USERNAME", "admin-pln")

    # Insert admin user if missing so chatbot/admin share the same user_id
    conn.execute(
        sa.text(
            """
            INSERT INTO user (user_name, created_at, updated_at)
            SELECT :username, NOW(), NOW()
            WHERE NOT EXISTS (
                SELECT 1 FROM user WHERE user_name = :username
            )
            """
        ),
        {"username": admin_username},
    )


def downgrade():
    conn = op.get_bind()
    admin_username = os.getenv("ADMIN_USERNAME", "admin-pln")
    conn.execute(sa.text("DELETE FROM user WHERE user_name = :username"), {"username": admin_username})
