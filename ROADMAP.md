# Roadmap

Roadmap ini menggambarkan urutan kerja tingkat tinggi, bukan jadwal atau janji rilis. Tahapan dapat disesuaikan setelah kebutuhan dan rancangan tiap bagian ditinjau.

**Status terkini:** tahap 1 sampai 11 selesai di kode lokal. Tahap 11 menambahkan preview personalisasi, snapshot aturan template pada pesanan, serta pembuatan dan unduhan gambar DXF berversi dari aplikasi admin. D1 produksi `ruma-store` sudah tersedia di APAC dan migrasi 0001–0008 sudah diterapkan; database masih kosong. Worker production, kredensial layanan, data produk final, penerapan rate limit produksi, dan spesifikasi mesin/CAM belum siap; gambar DXF lokal adalah gambar CAD 2D dasar, bukan toolpath siap mesin.

Tahap 12 sedang dikerjakan dengan progres checklist berbobot 47,2% per 9 November 2026. Demo `noindex` merespons HTTP 200 di `https://ajielt7.github.io/Tokoku/`; Worker production aktif di `https://ruma-api-production.ajielt7.workers.dev`, versi `df440313-c47f-4594-a0df-6d3a175b3c50`. GET katalog setelah deploy merespons HTTP 200 dengan katalog kosong, dan perubahan logging sudah diterapkan. Pencarian tujuan RajaOngkir dan akses admin sebelumnya terverifikasi; tiga secret inti tercatat terpasang. Validasi ImageKit read-only merespons HTTP 403, sehingga key/izin dan uji bukti belum lolos. Gerbang transaksi dan SEO tetap tertutup sampai katalog, rekening, kebijakan toko, dan uji bukti ImageKit siap.

| Tahap | Fokus | Hasil yang dituju | Status |
|---|---|---|---|
| 1 | Fondasi frontend | Template HTML semantik, CSS responsif, sumber di `src/`, dan build ke `dist/` | Selesai |
| 2 | Halaman dasar | Beranda, navigasi, promo, hero, katalog ringkas, cara pesan, dan footer | Selesai |
| 3 | Katalog produk | Halaman kategori dan detail produk dari data katalog dengan URL stabil | Selesai |
| 4 | Fondasi SEO | Metadata, tautan internal, sitemap, dan structured data yang sesuai | Selesai |
| 5 | Backend dan database | Worker baca dasar, migrasi D1, dan model data awal | Selesai |
| 6 | Integrasi katalog | Build halaman produk dari sumber data backend | Selesai |
| 7 | Keranjang dan checkout | Pelanggan dapat membuat pesanan dengan data tervalidasi | Selesai |
| 8 | Ongkir dan pembayaran | RajaOngkir, Gojek Same Day, transfer manual, bukti privat ImageKit, dan API review admin | Selesai di kode lokal; konfigurasi online menyusul |
| 9 | Aplikasi admin | Android untuk melihat pesanan, memeriksa pembayaran, dan memperbarui status pesanan/produksi | Selesai di kode lokal; konfigurasi online menyusul |
| 10 | Operasional toko | Produksi, pengiriman, tracking publik, dan notifikasi pesanan baru via FCM ke Android admin | Selesai di kode lokal; kredensial layanan menyusul |
| 11 | Produk custom dan DXF | Preview, snapshot konfigurasi, dan gambar DXF dasar berversi yang terhubung ke item pesanan | Selesai di kode lokal; konfigurasi produksi mesin/CAM menyusul |
| 12 | Persiapan peluncuran | Cek keamanan, backup/pemulihan, SEO, performa, dan deployment Pages dengan gate otomatis | Sedang dikerjakan; demo dan Worker tayang, transaksi/SEO menunggu data final dan validasi ImageKit (HTTP 403) |

## Cara memperbarui roadmap

- Tandai tahap sebagai **Belum dimulai**, **Sedang dikerjakan**, atau **Selesai**.
- Pecah tahap menjadi tugas lebih kecil hanya saat tahap tersebut akan dikerjakan.
- Catat perubahan urutan bila ada ketergantungan atau keputusan baru.
- Pindahkan hal yang belum disepakati ke dokumen kebutuhan, bukan menetapkannya diam-diam sebagai keputusan.
