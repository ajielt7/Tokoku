# Backend API dan D1

Backend memakai Cloudflare Workers untuk API dan Cloudflare D1 untuk data transaksi. API menyediakan katalog, ongkir RajaOngkir dan Gojek Same Day, checkout transfer manual, unggah bukti privat ke ImageKit, pengelolaan pesanan/pengiriman, status lacak publik tanpa data pribadi, dan notifikasi pesanan baru ke perangkat admin melalui FCM HTTP v1.

## Struktur

```text
backend/
├── migrations/
│   ├── 0001_initial_schema.sql
│   ├── 0002_product_image_alt.sql
│   ├── 0003_order_idempotency.sql
│   ├── 0004_shipping_manual_payments.sql
│   ├── 0005_imagekit_payment_proofs.sql
│   ├── 0006_local_shipping_distance.sql
│   ├── 0007_admin_devices.sql
│   └── 0008_custom_production_files.sql
├── seeds/demo.sql
├── package.json
├── package-lock.json
├── src/index.js
└── wrangler.jsonc
```

Skema mencakup kategori/produk, template dan bidang custom, pesanan beserta snapshot item, pembayaran, pengiriman, file, perangkat admin FCM, dan riwayat status. Migrasi `0006_local_shipping_distance.sql` menyimpan jarak rute ongkir lokal tanpa koordinat alamat pelanggan. Migrasi `0007_admin_devices.sql` menyimpan token FCM perangkat admin. Migrasi `0008_custom_production_files.sql` menyimpan snapshot definisi bidang custom dan gambar DXF teks berukuran kecil yang terkait dengan item pesanan. Tidak ada data contoh di dalam migrasi. `seeds/demo.sql` berisi data dan harga ilustrasi yang hanya boleh dipakai di database lokal.

## Menyiapkan D1 lokal

1. Gunakan Node.js 22 atau lebih baru dan pasang dependensi dari folder `backend/` dengan `npm ci`. Versi Wrangler dicatat di `package-lock.json`; [Cloudflare merekomendasikan instalasi lokal](https://developers.cloudflare.com/workers/wrangler/install-and-update/).
2. `wrangler dev` menggunakan penyimpanan D1 lokal dan tidak memerlukan akses database remote. `database_id` pada konfigurasi sekarang menunjuk ke D1 production; jangan mengganti target itu untuk mengembangkan atau menjalankan seed lokal.
3. Terapkan migrasi ke database lokal:

   ```sh
   npm run db:migrate:local
   ```

4. (Opsional) Masukkan katalog contoh untuk pratinjau lokal:

   ```sh
   npm run db:seed:demo:local
   ```

   Jangan jalankan seed demo terhadap database cloud.

5. Jalankan API lokal:

   ```sh
   npm run dev
   ```

Dari folder `backend/`, salin `.dev.vars.example` menjadi `.dev.vars`, lalu isi kredensial lokal yang diperlukan. File `.dev.vars` tidak boleh di-commit. Untuk penerapan online, pasang nilai rahasia sebagai secret Worker. `ADMIN_TOKEN` harus acak dan minimal 32 karakter. `IMAGEKIT_URL_ENDPOINT` adalah URL publik ImageKit, bukan kunci rahasia. Jangan simpan secret di source/config. `RAJAONGKIR_ORIGIN_ID` diset ke `5052` dari proyek Pemesanan dan boleh diganti jika titik asal berubah.

`wrangler dev` memakai database lokal. Jangan menambahkan flag `--remote` saat menyiapkan atau mencoba skema lokal. D1 production `ruma-store` sekarang dibuat terpisah di APAC; migrasi 0001–0008 sudah diterapkan dan dicatat pada `d1_migrations`. Kedua binding `DB` pada `wrangler.jsonc` memakai ID production yang sama. Database belum berisi katalog atau pesanan; jangan jalankan seed demo ke database remote.

## Deploy production setelah akun siap

Jangan jalankan langkah ini sebelum domain frontend, URL Worker, katalog, konfigurasi pembayaran, dan rahasia layanan sudah ditinjau. Semua perintah dijalankan dari folder `backend/` dengan Wrangler lokal proyek. Jangan pernah memakai seed demo pada database remote.

1. Pastikan akun CLI yang aktif benar dengan `npx wrangler whoami`. Database produksi `ruma-store` sudah ada; cocokkan ID di kedua binding `DB` pada `wrangler.jsonc` dengan database akun tersebut sebelum deploy. Jangan membuat database produksi kedua dan jangan gunakan database produksi untuk pengembangan lokal.
2. Pastikan `ALLOWED_ORIGINS` pada `env.production.vars` adalah `https://ajielt7.github.io` (origin situs, tanpa `/Tokoku`), isi `IMAGEKIT_URL_ENDPOINT`, dan pastikan `RAJAONGKIR_ORIGIN_ID` serta semua namespace rate limiter sesuai akun.
3. Database produksi saat ini sudah mencatat migrasi `0001` sampai `0008`. Cocokkan catatan migrasi dan siapkan backup sebelum perubahan skema. Jika ada migrasi baru, tinjau lalu terapkan hanya migrasi yang belum tercatat:

   ```sh
   npx wrangler d1 migrations apply ruma-store --remote --env production
   ```

4. Siapkan file rahasia format `.env` di lokasi aman di luar repository, dengan minimal `ADMIN_TOKEN`, `RAJAONGKIR_API_KEY`, dan `IMAGEKIT_PRIVATE_KEY`; tambahkan `FCM_PROJECT_ID`, `FCM_SERVICE_ACCOUNT_EMAIL`, dan `FCM_PRIVATE_KEY` hanya jika notifikasi dipakai. Batasi akses file dan hapus setelah deploy. Jangan masukkan nilainya ke argumen perintah, log, atau repository.
5. Deploy Worker dan rahasia dalam satu versi dengan environment eksplisit:

   ```sh
   npx wrangler deploy --env production --secrets-file "C:\lokasi-aman\ruma-worker.production.env"
   ```

6. Worker production tersedia di `https://ruma-api-production.ajielt7.workers.dev`; `GET /api/catalog` dan pencarian tujuan RajaOngkir merespons HTTP 200. GET admin orders juga berhasil memakai `ADMIN_TOKEN`. Ketiga secret production terpasang, tetapi D1 masih kosong dan upload bukti ImageKit belum diuji end-to-end. Jangan menerima pesanan atau mengaktifkan SEO sebelum katalog dan kebijakan toko final tersedia. Lihat [checklist peluncuran](../docs/LAUNCH_CHECKLIST.md).

Migrasi remote dan deploy di atas mengubah resource produksi. Jangan menjalankannya sebelum target akun, database, dan konfigurasi diverifikasi kembali. Lihat [dokumentasi migrasi D1](https://developers.cloudflare.com/d1/reference/migrations/), [environment Wrangler](https://developers.cloudflare.com/workers/wrangler/environments/), dan [rahasia Worker](https://developers.cloudflare.com/workers/configuration/secrets/) untuk perilaku perintah dan environment. Opsi `--secrets-file` mengunggah rahasia bersama versi Worker, sehingga tidak ada deploy per secret.

## Endpoint saat ini

Endpoint admin memakai `Authorization: Bearer <ADMIN_TOKEN>`: `GET /api/admin/orders?order_status=new&q=nama&limit=100` menampilkan daftar, `GET /api/admin/orders/:code` menampilkan detail, dan `POST /api/admin/orders/:code/status` menerima `{ "status_type": "order" | "production", "status": "...", "note": "..." }`. Backend menolak transisi yang tidak sesuai, pesanan yang belum lunas untuk diterima/diproduksi, serta penyelesaian sebelum produksi selesai. Pembatalan pesanan yang sudah lunas ditolak sampai kebijakan refund ditetapkan. Review pembayaran memakai `GET /api/admin/payments?status=pending`, `GET /api/admin/payments/:reference/proof` (URL ImageKit bertanda tangan berlaku 5 menit), dan `POST /api/admin/payments/:reference/review` dengan JSON `{ "decision": "approve" | "reject", "note": "..." }`. Persetujuan mencatat pembayaran lunas; penolakan menghapus bukti aktif agar pelanggan dapat mengunggah ulang.

Pembuatan gambar produksi dasar memakai `POST /api/admin/orders/:code/items/:itemId/production-files/dxf`; endpoint hanya menerima admin dan mensyaratkan pembayaran lunas serta pesanan berstatus diterima. File tersimpan dengan nomor versi per item. Unduh melalui `GET /api/admin/orders/:code/production-files/:fileId`, juga dengan autentikasi admin. DXF R12 menggunakan koordinat yang dihitung dalam mm, garis batas pada layer `OUTLINE`, dan teks CAD pada layer `ENGRAVE`. Karena DXF R12 tidak menyimpan metadata satuan, saat impor pilih skala 1 unit = 1 mm. Generator ini belum menghasilkan toolpath atau menetapkan material, toleransi, kompensasi alat, font mesin, maupun parameter CAM; periksa dan siapkan di perangkat CAD/CAM sebelum produksi.
Endpoint admin memakai `Authorization: Bearer <ADMIN_TOKEN>`: `GET /api/admin/orders?order_status=new&q=nama&limit=100` menampilkan daftar, `GET /api/admin/orders/:code` menampilkan detail, dan `POST /api/admin/orders/:code/status` memperbarui status pesanan/produksi. Pesanan hanya dapat dituntaskan jika produksi selesai dan pengiriman berstatus diterima. `POST /api/admin/orders/:code/shipment` menerima `{ "carrier": "JNE", "tracking_number": "...", "tracking_url": "https://...", "status": "shipped|delivered|failed|returned", "note": "..." }`. Pengiriman hanya diizinkan jika pesanan lunas, diterima, dan produksinya selesai; perubahan masuk ke riwayat. `POST /api/admin/devices` mendaftarkan token perangkat FCM dan `POST /api/admin/devices/remove` melepas token. Endpoint review pembayaran tetap memakai `GET /api/admin/payments?status=pending`, `GET /api/admin/payments/:reference/proof`, dan `POST /api/admin/payments/:reference/review`.

Pelanggan melacak pesanan lewat `POST /api/orders/status` dengan JSON `{ "order_code": "RUMA-...", "phone": "..." }`. API mencocokkan kode dan nomor telepon checkout, lalu hanya mengembalikan status, kurir/resi, tautan tracking, dan waktu riwayat. Nama, kontak, alamat, catatan admin, item, serta bukti pembayaran tidak dikembalikan. Kode pesanan acak memiliki 80 bit entropi; aktifkan rate limit Cloudflare sebelum membuka endpoint ini ke publik.

Notifikasi pesanan baru menggunakan FCM HTTP v1. Isi `FCM_PROJECT_ID`, `FCM_SERVICE_ACCOUNT_EMAIL`, dan `FCM_PRIVATE_KEY` di `.dev.vars` untuk lokal atau sebagai Worker secrets saat online. Service account perlu izin mengirim FCM pada proyek target. Kredensial FCM tidak boleh masuk ke frontend atau APK; token perangkat disimpan terbatas di D1. Jika FCM belum dikonfigurasi, checkout tetap berhasil dan notifikasi dilewati.

- `GET /api/health` — memeriksa apakah Worker merespons.
- `GET /api/catalog` — mengambil kategori dan produk aktif untuk proses build frontend.
- `GET /api/products?limit=24` — daftar produk aktif beserta kategori; batas `limit` 1–100.
- `GET /api/products/:slug` — detail produk aktif.
- `POST /api/orders` — validasi dan mencatat pesanan tamu, harga dihitung ulang dari D1.
- `POST /api/orders/proof` — validasi pesanan dan unggah bukti secara privat ke ImageKit.
- `GET /api/shipping/destinations?search=<tujuan>` — pencarian tujuan domestik RajaOngkir.
- `POST /api/shipping/quotes` — hitung tarif kurir dari berat produk pada D1.

Checkout menerima data kontak, alamat, tujuan terpilih, kode layanan kurir, slug produk, jumlah, dan nilai custom. Sertakan header `Idempotency-Key` UUID versi 4. Worker menghitung ulang ongkir saat checkout: RajaOngkir untuk ekspedisi, atau jarak jalan dan tarif Gojek Same Day untuk rute di bawah 30 km. Worker menyimpan harga/ongkir/total, kode referensi transfer, jarak rute tanpa koordinat rumah pelanggan, snapshot produk/custom, serta riwayat dalam satu batch D1. D1 batch bersifat transaksional; bila satu perintah gagal, seluruh batch dibatalkan ([dokumentasi D1](https://developers.cloudflare.com/d1/worker-api/d1-database/)).

API tidak menerima harga atau tarif ongkir dari browser sebagai sumber kebenaran. RajaOngkir dipanggil dari Worker memakai secret `RAJAONGKIR_API_KEY`. Asal awal `RAJAONGKIR_ORIGIN_ID=5052`; berat prototipe bawaan ialah 500 gram per produk dan perlu diperbarui setelah produk/kemasan ditimbang. Balasan checkout memuat kode referensi transfer dan total. Detail kontak dan alamat tidak pernah dikembalikan oleh endpoint publik.

CORS checkout hanya mengizinkan request browser dari origin yang tercantum di `ALLOWED_ORIGINS`; request tanpa origin juga ditolak. Daftar lokal sudah berisi `localhost:5500` dan `127.0.0.1:5500`; tambahkan domain frontend publik sebelum deploy. Endpoint admin juga menggunakan allowlist untuk browser dan tetap mewajibkan token Bearer. Pembatasan origin bukan pengganti rate limit atau perlindungan spam.

Untuk memakai checkout lokal, sajikan `frontend/dist/` melalui server web pada port `5500` setelah build selesai. Jangan buka `index.html` lewat `file://`, karena browser tidak mengizinkan permintaan checkout lintas origin dari skema tersebut. Pastikan Worker lokal tetap berjalan di port `8787`.

Rate limit memakai binding Worker pada endpoint yang dapat disalahgunakan atau memanggil layanan eksternal: pesanan/bukti 10 request per menit per IP dan path, lacak 20/menit, ongkir 30/menit, serta admin 120/menit. Limit Worker ini perkiraan per lokasi Cloudflare, bukan penghitung global yang ketat. Bila produksi tidak memiliki binding atau IP Cloudflare, endpoint dilindungi menolak request dengan 503. `APP_ENV` lokal bernilai `local`; environment produksi memakai `production`. Pilih `namespace_id` unik untuk tiap binding pada akun Cloudflare. Tambahkan aturan WAF bila domain API memakai zone Cloudflare.

## Batas keamanan

- Data kontak dan alamat pesanan bersifat pribadi. API publik belum memiliki endpoint untuk membacanya.
- Harga harus dihitung dan divalidasi di backend ketika fitur pesanan dibuat; jangan percaya nilai dari browser.
- Pembayaran awal berupa transfer manual; jangan tandai lunas dari browser. Admin perlu mencocokkan transfer secara manual sebelum mengubah status.
- ID pesanan dan kode publik harus dibuat secara acak oleh backend. Skema ini tidak membuat kode tersebut secara otomatis.
- Sebelum membuka checkout ke publik, tetapkan domain CORS, pembatasan spam/rate, dan aturan masa simpan data pelanggan.
- Jangan simpan kredensial, token, data kartu, atau file biner di D1.
- Jangan pernah masukkan `ADMIN_TOKEN` atau kunci ImageKit ke JavaScript frontend. Aplikasi admin harus memanggil endpoint backend dan menyimpan token secara aman.
