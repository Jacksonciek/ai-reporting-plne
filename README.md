# AI Reporting PLNE

Aplikasi **AI Reporting PLNE** adalah sistem end‑to‑end yang menggabungkan:

- Frontend **Next.js** (dashboard, chatbot, dan admin console)
- Backend **Flask + LangChain + OpenAI GPT‑4o**
- Database relasional (MySQL)
- **Redis** untuk caching skema SQL & autentikasi
- **Cloudinary** untuk penyimpanan gambar/berkas (plot, Excel, dll.)

Tujuannya adalah membantu analisis dan pelaporan transaksi/keuangan secara interaktif melalui chatbot dan antarmuka admin.

---

## Arsitektur Proyek

Struktur direktori utama:

```text
.
├─ client/        # Next.js 14 + React (UI, dashboard, chatbot, admin)
├─ server/        # Flask API, LangChain agents, transaksi & OCR
└─ laporan_pembukuan_dummy_1.pdf  # Contoh dokumen laporan pembukuan
```

Ringkasan komponen:

- `client/`
  - Next.js 14 (App Router) dengan TypeScript & Tailwind CSS.
  - Halaman utama: splash screen "AI Reporting" (`/`), login, register, dashboard, chatbot, admin-login, dan admin.
  - Mengkonsumsi REST API backend menggunakan `fetch`/`axios` dengan `API_BASE_URL`.
  - Menyimpan sesi pengguna & admin di `localStorage`.

- `server/`
  - Aplikasi Flask (`main.py`) dengan CORS.
  - Menggunakan `langchain_openai.ChatOpenAI` (GPT‑4o) untuk:
    - Chatbot berbasis skema database (SQL schema + sample rows).
    - Ekstraksi data transaksi dari teks/PDF (via `PyPDF2` dan LLM).
  - `SQLChatHistoryManager` untuk manajemen user, room, dan riwayat chat.
  - `transaction_service.py` untuk CRUD transaksi dan pencatatan riwayat OCR.
  - Redis untuk cache skema SQL (`sql_schema`) dan cache password lama.
  - Cloudinary untuk upload gambar (plot) dan file Excel hasil ekspor.
  - Database MySQL untuk data transaksi dan log/aktivitas.

---

## Fitur Utama

- **Autentikasi pengguna**
  - Register & login pengguna biasa (`/api/auth/register`, `/api/auth/login`).
  - Login admin terpisah (`/api/admin/login`) dengan username khusus (default di `.env`).

- **Chatbot AI Reporting**
  - Pengguna dapat membuat room chat (`/api/new_room`) dan mengirim prompt ke bot (`/api/rooms/<room_id>/messages/bot`).
  - Bot membangun konteks dari skema database + sampel data yang di‑reflect dengan SQLAlchemy, lalu menjawab menggunakan GPT‑4o.
  - Hasil bisa berupa:
    - Jawaban teks
    - Plot (disimpan sebagai image di Cloudinary)
    - File Excel (export data via `pandas` + `xlsxwriter` ke Cloudinary)

- **Analytics & aktivitas**
  - Endpoint `GET /api/analytics/weekly_activity` mengembalikan agregasi aktivitas chat 7 hari terakhir per pengguna.
  - Digunakan di dashboard frontend untuk visualisasi aktivitas.

- **Manajemen transaksi (Admin)**
  - CRUD transaksi via:
    - `GET/POST /api/admin/transactions`
    - `PUT/DELETE /api/admin/transactions/<trans_id>`
  - Upload dokumen transaksi (misalnya laporan pembukuan PDF):
    - `POST /api/admin/transactions/upload` untuk ekstraksi transaksi (tanpa simpan).
    - `POST /api/admin/transactions/upload/confirm` untuk menyimpan hasil ekstraksi ke database.
  - Riwayat OCR disimpan & dapat diakses melalui:
    - `GET /api/admin/ocr-history`

- **Manajemen user & rooms**
  - `POST /api/create_user` untuk membuat user baru dari username.
  - `GET /api/<user_id>/rooms` untuk mendapatkan daftar room chat (dengan pagination).
  - `GET /api/rooms/<room_id>/messages` untuk mengambil riwayat pesan di sebuah room.

---

## Teknologi yang Digunakan

- **Frontend**
  - Next.js 14, React 18
  - TypeScript
  - Tailwind CSS
  - Framer Motion, GSAP, Lucide Icons

- **Backend**
  - Python 3.13 (di Docker)
  - Flask, Flask‑CORS, Flask‑SQLAlchemy, Flask‑Migrate
  - SQLAlchemy, Alembic
  - LangChain, langchain_openai, langgraph
  - OpenAI API (GPT‑4o)
  - Redis
  - Cloudinary
  - Pandas, Matplotlib, XlsxWriter
  - PyPDF2, OpenCV (opencv‑python‑headless)

- **Infrastructure**
  - Dockerfile terpisah untuk `client` dan `server`
  - Migrasi database via `flask db upgrade`

Rincian lebih lengkap dependency ada di:

- `client/package.json`
- `server/requirements.txt`

---

## Menyiapkan Lingkungan

### Prasyarat

- Node.js 18+ dan npm
- Python 3.11+ (disarankan, Docker menggunakan 3.13)
- MySQL (untuk data transaksi & log)
- Redis
- Akun OpenAI (API key)
- Akun Cloudinary

---

## Konfigurasi Backend (`server/`)

1. Masuk ke direktori server:

   ```bash
   cd server
   ```

2. Buat file `.env` berdasarkan `.env.example`:

   ```bash
   cp .env.example .env  # atau salin manual di Windows
   ```

3. Isi variabel penting di `.env`:

   - Aplikasi
     - `FLASK_APP=main.py`
     - `FLASK_ENV=development` atau `production`
     - `ADMIN_USERNAME`, `ADMIN_PASSWORD` atau `ADMIN_PASSWORD_HASH`
   - OpenAI
     - `OPENAI_API_KEY=...`
   - Database utama (transaksi):
     - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`
   - Database log (jika digunakan):
     - `MSG_DB_HOST`, `MSG_DB_USER`, `MSG_DB_PASSWORD`, `MSG_DB_NAME`, `MSG_DB_PORT`
   - Redis:
     - `REDIS_HOST`, `REDIS_PORT`
   - Cloudinary:
     - `CLOUDINARY_CLOUD_NAME`
     - `CLOUDINARY_API_KEY`
     - `CLOUDINARY_API_SECRET`
     - `CLOUDINARY_URL` (jika diperlukan)

4. Buat dan aktifkan virtual environment, lalu install dependency:

   ```bash
   python -m venv .venv
   .venv\Scripts\activate  # Windows
   # source .venv/bin/activate  # Linux/macOS

   pip install --upgrade pip
   pip install -r requirements.txt
   ```

5. Jalankan migrasi database:

   ```bash
   flask db upgrade
   ```

6. Menjalankan server Flask (lokal):

   Mode pengembangan:

   ```bash
   flask run --host=0.0.0.0 --port=5000
   ```

   Atau langsung:

   ```bash
   python main.py
   ```

Server akan berjalan di `http://127.0.0.1:5000`.

---

## Konfigurasi Frontend (`client/`)

1. Masuk ke direktori client:

   ```bash
   cd client
   ```

2. Buat file `.env` berdasarkan `.env.example`:

   ```bash
   cp .env.example .env  # atau salin manual di Windows
   ```

3. Isi variabel penting di `.env`:

   - `NEXT_PUBLIC_API_URL=http://127.0.0.1:5000`
   - (opsional) `NEXT_PUBLIC_ADMIN_USERNAME`, `NEXT_PUBLIC_ADMIN_PASSWORD`

4. Install dependency dan jalankan app:

   ```bash
   npm install
   npm run dev
   ```

   Secara default, Next.js akan berjalan di `http://localhost:3000`.

5. Build & run untuk production (opsional):

   ```bash
   npm run build
   npm start
   ```

---

## Menjalankan dengan Docker

### Backend (server)

Di dalam direktori `server/`:

```bash
docker build -t ai-reporting-server .
docker run -d -p 5000:5000 --env-file .env ai-reporting-server
```

Pastikan `.env` sudah berisi konfigurasi OpenAI, database, Redis, dan Cloudinary.

### Frontend (client)

Di dalam direktori `client/`:

```bash
docker build -t ai-next-client .
docker run -d -p 3000:3000 --env-file .env ai-next-client
```

`client/README.md` juga berisi contoh perintah build & run dengan Docker.

---

## Alur Penggunaan Singkat

1. Jalankan backend Flask di port `5000` dan pastikan terhubung ke MySQL, Redis, dan OpenAI.
2. Jalankan frontend Next.js di port `3000`.
3. Akses `http://localhost:3000`:
   - Buat akun baru atau login (user biasa).
   - Setelah login, gunakan chatbot untuk bertanya seputar data/reporting yang ada di database.
4. Login sebagai admin (via admin login) untuk:
   - Mengelola transaksi (CRUD).
   - Mengupload file laporan pembukuan/PDF, mengekstrak transaksi dengan AI, dan menyimpannya.
   - Melihat riwayat OCR dan aktivitas pengguna.

---

## Catatan Pengembangan

- Endpoint dan logika detail dapat dilihat di:
  - Backend: `server/main.py`, `server/transaction_service.py`, `server/auth.py`, `server/chat_agent.py`, dan `server/SQLChatManager.py`.
  - Frontend: direktori `client/src/app/`, `client/src/components/`, dan `client/src/services/`.
- Notebook pengujian bot berada di `server/tests/tests.ipynb`.

Jika Anda ingin README ini diperluas (misalnya diagram arsitektur, contoh payload API, atau panduan deployment ke cloud), silakan beritahu bagian mana yang perlu diperdalam.

