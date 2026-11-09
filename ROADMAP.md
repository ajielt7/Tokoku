# Roadmap

Roadmap ini menggambarkan urutan kerja tingkat tinggi, bukan jadwal atau janji rilis. Tahapan dapat disesuaikan setelah kebutuhan dan rancangan tiap bagian ditinjau.

**Status terkini:** tahap 1 sampai 11 selesai di kode lokal. Tahap 11 menambahkan preview personalisasi, snapshot aturan template pada pesanan, serta pembuatan dan unduhan gambar DXF berversi dari aplikasi admin. D1 produksi `ruma-store` sudah tersedia di APAC dan migrasi 0001–0008 sudah diterapkan; database masih kosong. Worker production, kredensial layanan, data produk final, penerapan rate limit produksi, dan spesifikasi mesin/CAM belum siap; gambar DXF lokal adalah gambar CAD 2D dasar, bukan toolpath siap mesin.

Tahap 12 sedang disiapkan. Repo publik `ajielt7/Tokoku` sudah tersambung pada branch `main`, dan workflow Pages berhasil berjalan tetapi melewati deployment karena konfigurasi rilis belum siap. URL target adalah `https://ajielt7.github.io/Tokoku/`; Sumber Pages sudah dikonfigurasi ke GitHub Actions, tetapi belum ada deployment; gate rilis tetap tertutup. Worker belum dideploy, dan kredensial/katalog produksi belum tersedia. Gerbang rilis publik tetap tertutup.

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
| 12 | Persiapan peluncuran | Cek keamanan, backup/pemulihan, SEO, performa, dan deployment Pages dengan gate otomatis | Sedang dikerjakan; fondasi lokal tersedia, gerbang produksi belum lulus |

## Cara memperbarui roadmap

- Tandai tahap sebagai **Belum dimulai**, **Sedang dikerjakan**, atau **Selesai**.
- Pecah tahap menjadi tugas lebih kecil hanya saat tahap tersebut akan dikerjakan.
- Catat perubahan urutan bila ada ketergantungan atau keputusan baru.
- Pindahkan hal yang belum disepakati ke dokumen kebutuhan, bukan menetapkannya diam-diam sebagai keputusan.
