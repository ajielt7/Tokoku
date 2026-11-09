# Checklist Persiapan Peluncuran

Checklist ini adalah gerbang sebelum toko dibuka untuk pelanggan. Kode lokal siap diperiksa, tetapi rilis publik tetap harus gagal sampai identitas toko, katalog, domain, layanan, dan rekening benar-benar disiapkan.

## Status yang sudah terlihat di workspace

- [x] SEO situs masih nonaktif (`indexable: false`, `contentReady: false`). Build belum bisa menerbitkan canonical atau sitemap publik.
- [x] Delapan migrasi SQL lulus diterapkan berurutan pada SQLite sementara. D1 produksi sudah dimigrasikan; latihan ekspor/pemulihan lokal SQLite juga lulus, tetapi bukan pemulihan D1 cloud.
- [x] Checkout backend menghitung ulang harga/ongkir dan memerlukan API; konfigurasi lokal memakai URL localhost.
- [x] Token admin dan kunci layanan tidak ditanam di frontend atau APK.
- [x] Environment produksi Wrangler mewajibkan `ADMIN_TOKEN`, `RAJAONGKIR_API_KEY`, dan `IMAGEKIT_PRIVATE_KEY` sebelum deploy berhasil.
- [x] Request berbiaya dan operasi tulis diberi rate limit Worker; production menolak request jika binding limiter hilang.
- [x] Build Pages memiliki workflow yang menolak rilis bila variabel produksi dan persetujuan indeks belum ada.
- [x] D1 produksi `ruma-store` sudah dibuat di APAC, ID terpasang pada kedua binding Wrangler, dan migrasi 0001–0008 tercatat di `d1_migrations`; belum ada seed demo atau data toko.
- [x] URL publik default Pages dipilih: `https://ajielt7.github.io/Tokoku/`; origin frontend production sudah diatur ke `https://ajielt7.github.io`. URL API target sudah disiapkan, tetapi Worker belum dideploy.
- [ ] Katalog, harga, bobot, foto asli, rekening, kebijakan toko, serta kredensial layanan masih contoh/belum diisi.
- [x] Repo publik `ajielt7/Tokoku` terhubung pada branch `main`; Pages memakai sumber GitHub Actions. Workflow berhasil, tetapi deployment dilewati karena gate rilis belum siap.
- [x] Sumber GitHub Pages sudah diatur ke **GitHub Actions**. Belum ada situs terbit sampai gate rilis dibuka.

## A. Domain dan GitHub Pages

- [x] URL publik dipilih: `https://ajielt7.github.io/Tokoku/`. `SITE_URL` menggunakan URL proyek dengan subpath repositori. Domain custom tidak dipakai.
- [ ] Siapkan Worker API HTTPS dan isi `PUBLIC_API_BASE_URL` di Variables repositori GitHub.
- [ ] Atur Pages dengan sumber **GitHub Actions**. Workflow memakai branch `main`; ubah trigger bila branch utama berbeda.
- [ ] Tambahkan repository variables `SITE_URL`, `PUBLIC_API_BASE_URL`, `SEO_INDEXABLE=true`, dan `CONTENT_READY=true` hanya setelah semua pemeriksaan di bawah lulus.
- [ ] Pastikan HTTPS diwajibkan pada pengaturan GitHub Pages.
- [ ] Setelah katalog D1 berubah, jalankan workflow **Build and deploy store** secara manual agar HTML statis, halaman produk, dan sitemap dibangun ulang dari katalog terbaru.
- [ ] Jangan commit `.dev.vars`, `.env`, `google-services.json`, token, private key, database export, atau data pelanggan.

## B. Cloudflare Worker dan D1

- [x] Buat database produksi terpisah dari database lokal; ID D1 produksi sudah terpasang pada kedua binding `DB` di `backend/wrangler.jsonc`.
- [x] Tinjau dan terapkan migrasi 0001–0008 ke D1 produksi tanpa seed demo; urutan tercatat dan `PRAGMA foreign_key_check` kosong. Latihan backup/restore SQLite lokal lulus (8 migrasi, integritas OK, foreign key bersih); D1 staging cloud tidak dibuat agar tidak menambah resource yang berpotensi biaya.
- [x] `ALLOWED_ORIGINS` production sudah memakai origin GitHub Pages `https://ajielt7.github.io` (tanpa subpath); `APP_ENV=production` sudah ditetapkan.
- [ ] Pasang Worker secrets: `ADMIN_TOKEN`, `RAJAONGKIR_API_KEY`, `IMAGEKIT_PRIVATE_KEY`; pasang FCM secrets hanya jika notifikasi admin akan dipakai.
- [ ] Isi `IMAGEKIT_URL_ENDPOINT`, `RAJAONGKIR_ORIGIN_ID`, dan pastikan semua URL API memakai HTTPS.
- [ ] Verifikasi empat binding rate limiter dan pastikan setiap `namespace_id` unik di akun Cloudflare. Limit Worker ini per lokasi dan bersifat perkiraan; pantau trafik dan sesuaikan setelah penggunaan nyata.
- [ ] Pastikan Worker production memakai binding `DB` ke database produksi, bukan database lokal atau database proyek lain.
- [ ] Tinjau log/error tanpa mencatat bukti pembayaran, alamat, nomor telepon, token, atau kredensial.

## C. Produk, transaksi, dan kebijakan toko

- [ ] Ganti seluruh produk demo dengan barang yang benar: nama, deskripsi, harga, ukuran, batas personalisasi, stok/ketersediaan, berat paket, dan foto milik toko.
- [ ] Verifikasi tarif RajaOngkir untuk tujuan dan kurir yang benar. Pastikan titik asal `5052` dan ketentuan Gojek sesuai operasional toko.
- [ ] Isi bank, nomor rekening, nama pemilik rekening, waktu konfirmasi, pembatalan, refund, dan cara menghubungi toko.
- [ ] Siapkan kebijakan privasi dan syarat pembelian yang ditinjau pemilik toko; jangan menampilkan alamat/data pribadi pesanan pada halaman publik.
- [ ] Uji transfer nyata dengan nominal kecil dan rekonsiliasi manual. Jangan menyatakan pembayaran otomatis terverifikasi.
- [ ] Pastikan unggah bukti hanya ke ImageKit privat, URL admin bertanda tangan singkat, penolakan membersihkan file aktif, dan kebijakan retensi ImageKit jelas.
- [ ] Verifikasi pengiriman, resi, tracking, notifikasi FCM, dan akses admin memakai akun/perangkat yang benar.
- [ ] Periksa DXF melalui alur CAD/CAM dan lakukan uji bahan/mesin; gambar tahap 11 bukan toolpath siap mesin.

## D. SEO dan mutu halaman

- [ ] Isi `SITE_URL` dengan URL kanonis HTTPS dan pastikan URL tidak berubah-ubah antara `www`/non-`www` atau subpath Pages.
- [ ] Bangun ulang dari katalog produksi. `check-release.mjs` harus lulus dan semua halaman publik harus memiliki satu H1, title, description, canonical, tautan lokal valid, dan konten bukan demo.
- [ ] Pastikan cart, checkout, dan lacak pesanan tetap `noindex` dan tidak ada di sitemap; jangan blok crawler pada robots.txt untuk halaman yang perlu dibaca noindex-nya.
- [ ] Periksa produk dan harga pada HTML hasil build, gambar/alt text, mobile layout, keyboard, kontras, dan pesan error.
- [ ] Uji semua URL publik setelah deployment, termasuk 404 dan subpath Pages. Jalankan pemeriksaan Lighthouse seluler dan tinjau Core Web Vitals setelah data lapangan tersedia.
- [ ] Verifikasi properti domain di Google Search Console, periksa URL dengan URL Inspection, lalu kirim sitemap. Pengiriman sitemap membantu penemuan URL tetapi tidak menjamin pengindeksan atau peringkat.

## E. Backup, pemulihan, dan peluncuran bertahap

- [ ] Pastikan versi backend D1 yang dipakai mendukung Time Travel; periksa retensi akun sebelum menjadikannya satu-satunya perlindungan.
- [ ] Ekspor D1 ke lokasi terenkripsi di luar repositori dan batasi akses. Buat salinan terpisah untuk bukti ImageKit jika kebijakan layanan memerlukannya.
- [x] Latihan pemulihan lokal SQLite lulus untuk skema kosong; ini tidak membuktikan pemulihan D1 cloud atau file ImageKit. D1 staging cloud tidak dibuat karena pemilik memilih tanpa resource tambahan berpotensi biaya. Sebelum transaksi nyata, pastikan ekspor D1 produksi dapat dibuat dan simpan salinan terenkripsi; jadwalkan latihan cloud terpisah bila kelak ada lingkungan gratis yang sesuai.
- [ ] Catat kontak pemulihan akun GitHub, Cloudflare, ImageKit, RajaOngkir, dan Firebase di password manager organisasi, bukan di repositori.
- [ ] Rilis dahulu ke kelompok kecil; pantau pesanan gagal, ongkir, upload bukti, notifikasi, dan log selama periode awal.
- [ ] Simpan artifact/rilis sebelumnya dan prosedur rollback. Jangan pulihkan database produksi tanpa menentukan titik waktu serta membuat cadangan keadaan saat ini.

## Syarat lulus

Peluncuran baru boleh dimulai setelah semua kotak pada bagian A–E ditinjau dan disetujui pemilik toko. Saat ini checklist **belum lulus** karena Worker belum dideploy, secret layanan dan pengaturan ImageKit belum lengkap, serta katalog, rekening, dan kebijakan toko belum final.
