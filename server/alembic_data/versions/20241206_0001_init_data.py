"""Initial schema for ai_reporting_data (transaksi & ocr_history)."""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20241206_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "transaksi",
        sa.Column("id_transaksi", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tanggal", sa.Date(), nullable=True),
        sa.Column("nama_produk", sa.String(length=255), nullable=True),
        sa.Column("kategori", sa.String(length=50), nullable=True),
        sa.Column("jumlah_terjual", sa.Integer(), nullable=True),
        sa.Column("harga_satuan", sa.Numeric(15, 2), nullable=True),
        sa.Column("total_penjualan", sa.Numeric(15, 2), nullable=True),
        sa.Column("kota", sa.String(length=100), nullable=True),
        sa.Column("salesperson", sa.String(length=100), nullable=True),
        sa.Column("status_pembayaran", sa.String(length=20), nullable=True),
        sa.Column("metode_pembayaran", sa.String(length=50), nullable=True),
        sa.Column("konsumen", sa.String(length=100), nullable=True),
        mysql_charset="utf8mb4",
        mysql_engine="InnoDB",
    )

    op.create_table(
        "ocr_history",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("transaksi_id", sa.Integer(), nullable=True),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("filesize_bytes", sa.BigInteger(), nullable=False),
        sa.Column("page_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("fields_json", sa.Text(), nullable=True),
        sa.Column("ocr_preview", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
            server_onupdate=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["transaksi_id"],
            ["transaksi.id_transaksi"],
            name="fk_ocr_transaksi",
            ondelete="SET NULL",
        ),
        mysql_charset="utf8mb4",
        mysql_engine="InnoDB",
    )

    op.create_index("idx_status", "ocr_history", ["status"])
    op.create_index("idx_transaksi", "ocr_history", ["transaksi_id"])

    op.create_table(
        "transaksi_source",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("id_transaksi", sa.Integer(), nullable=False),
        sa.Column("source_type", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(
            ["id_transaksi"],
            ["transaksi.id_transaksi"],
            name="fk_source_transaksi",
            ondelete="CASCADE",
        ),
        mysql_charset="utf8mb4",
        mysql_engine="InnoDB",
    )
    op.create_index("ix_transaksi_source_tx", "transaksi_source", ["id_transaksi"])


def downgrade():
    op.drop_index("ix_transaksi_source_tx", table_name="transaksi_source")
    op.drop_table("transaksi_source")
    op.drop_index("idx_transaksi", table_name="ocr_history")
    op.drop_index("idx_status", table_name="ocr_history")
    op.drop_table("ocr_history")
    op.drop_table("transaksi")
