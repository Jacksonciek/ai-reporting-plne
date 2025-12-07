"""Seed/refresh admin user with hashed password from env."""

import os

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20241206_0003_seed_admin_password"
down_revision = "20241206_0002_seed_admin_user"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    admin_username = os.getenv("ADMIN_USERNAME", "admin-pln")
    admin_password_hash = os.getenv("ADMIN_PASSWORD_HASH") or ""

    if not admin_password_hash:
        print("[WARN] ADMIN_PASSWORD_HASH is empty; skipping admin password seed.")
        return

    conn.execute(
        sa.text(
            """
            INSERT INTO user (user_name, password, created_at, updated_at)
            VALUES (:username, :pwd, NOW(), NOW())
            ON DUPLICATE KEY UPDATE password = VALUES(password), updated_at = NOW()
            """
        ),
        {"username": admin_username, "pwd": admin_password_hash},
    )


def downgrade():
    # No-op: keep admin user/password as-is on downgrade.
    pass
