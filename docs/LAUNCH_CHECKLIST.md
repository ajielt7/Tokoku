# Checklist Persiapan Peluncuran

Checklist ini adalah gerbang sebelum toko dibuka untuk pelanggan. Pratinjau demo boleh tayang tanpa indeks; rilis toko untuk pelanggan menunggu identitas toko, katalog, domain, layanan, dan rekening final.

## Status yang sudah terlihat di workspace

- [x] SEO situs masih nonaktif (`indexable: false`, `contentReady: false`). Build belum bisa menerbitkan canonical atau sitemap publik.
- [x] Pratinjau lokal dibangun dari 2 kategori dan 3 produk contoh; halaman berstatus `noindex,nofollow`, menampilkan catatan data contoh, dan `frontend/dist/` diabaikan Git. D1 cloud tetap kosong setelah seed lokal.
- [x] Alur lokal diverifikasi ulang melalui API dan server Pages: API menyediakan 2 kategori/3 produk, halaman beranda dan produk tampil dengan `noindex`, dan konten contoh terlihat. Saat `CONTENT_READY=true` dicoba pada data tersebut, build ditolak karena foto HTTPS/alt belum ada dan berkas pratinjau sebelumnya tidak berubah.
- [x] Delapan migrasi SQL lulus diterapkan berurutan pada SQLite sementara. D1 produksi sudah dimigrasikan; latihan ekspor/pemulihan lokal SQLite juga lulus, tetapi bukan pemulihan D1 cloud.
- [x] Checkout backend menghitung ulang harga/ongkir dan memerlukan API; konfigurasi lokal memakai URL localhost.
- [x] Token admin dan kunci layanan tidak ditanam di frontend atau APK.
- [x] Pemindaian statis frontend/backend tidak menemukan `innerHTML`, `outerHTML`, `document.write`, `eval`, atau `new Function`; keranjang memakai node DOM dan `textContent` untuk nilai katalog.
- [x] Environment produksi Wrangler mewajibkan `ADMIN_TOKEN`, `RAJAONGKIR_API_KEY`, dan `IMAGEKIT_PRIVATE_KEY` sebelum deploy berhasil.
- [x] Request berbiaya dan operasi tulis diberi rate limit Worker; production menolak request jika binding limiter hilang.
- [x] Endpoint baca katalog/produk mengirim CORS untuk origin Pages yang diizinkan dan menolak origin asing; sudah diverifikasi dengan konfigurasi production secara lokal.
- [x] Kode backend di `main` sudah diperketat: error upstream/database hanya mencatat nama operasi dan tipe error; kegagalan upload ImageKit mencatat status serta request ID, tanpa isi bukti atau pesan upstream.
- [x] Alur RajaOngkir diselaraskan dengan panduan lokal `Pemesanan/worker/README.md`: pencarian tujuan dicache 30 hari, tarif multi-kurir dihitung langsung dengan asal Cimekar `5052`, lalu backend menghitung ulang tarif saat order dibuat. Verifikasi tarif nyata dari Worker Ruma masih menunggu secret API key khusus Ruma.
- [x] Build Pages memiliki workflow yang menolak rilis bila variabel produksi dan persetujuan indeks belum ada.
- [x] D1 produksi `ruma-store` sudah dibuat di APAC, ID terpasang pada kedua binding Wrangler, dan migrasi 0001–0008 tercatat di `d1_migrations`; belum ada seed demo atau data toko.
- [x] URL Pages `https://ajielt7.github.io/Tokoku/` dan API `https://ruma-api-production.ajielt7.workers.dev` sudah tayang. API merespons HTTP 200; katalog D1 produksi masih kosong.
- [ ] Katalog, harga, bobot, foto asli, rekening, dan kebijakan toko belum final; D1 production masih kosong.
- [x] Repo publik `ajielt7/Tokoku` terhubung pada branch `main`; Pages memakai sumber GitHub Actions dan workflow demo preview berhasil.
- [x] Situs demo sudah terbit, memakai `noindex`, data contoh lokal, dan tidak menerima checkout. Rilis indeks tetap menunggu konten final.

## Batas anggaran

Audit paket resmi per 9 November 2026: peluncuran kecil dapat memakai paket gratis selama kuota dipatuhi. Jangan mengaktifkan Workers Paid, paket ImageKit berbayar, atau layanan pembayaran otomatis tanpa persetujuan pemilik.

- GitHub Pages tersedia gratis untuk repository publik dengan GitHub Free ([dokumentasi GitHub](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)).
- Workers Free mencakup 100.000 request/hari; D1 Free mencakup 5 juta baris baca/hari, 100.000 baris tulis/hari, dan 5 GB total ([harga Cloudflare](https://developers.cloudflare.com/workers/platform/pricing/)). Akun saat ini mencatat satu database D1 (`ruma-store`). Batas gratis yang terlampaui membuat operasi terkait gagal; Workers Paid memiliki minimum US$5/bulan per akun, jadi jangan upgrade otomatis.
- Paket Workers Free akun belum dapat dikonfirmasi: koneksi Cloudflare yang tersedia tidak punya izin Billing Read. Sebelum produksi, pemilik perlu memastikan paket akun tetap Free di dashboard. Sampling log Worker diturunkan menjadi 10% (traces 5%); mulai 1 Desember 2026, log dan trace memakai kuota Observability gratis 0,5 GB/hari tanpa tambahan ingest berbayar di paket Free ([kuota Observability](https://developers.cloudflare.com/observability/pricing/)).
- RajaOngkir Starter tercantum gratis dengan 100 HIT cek ongkir per hari ([paket RajaOngkir](https://www.rajaongkir.com/pricing)). Integrasi toko ini memakai cek ongkir; fitur pembayaran otomatis memiliki biaya transaksi terpisah dan tidak diaktifkan.
- ImageKit Forever Free tercantum $0 dengan batas 20 GB bandwidth bulanan dan 3 GB penyimpanan DAM ([paket ImageKit](https://imagekit.io/plans/)). Pertahankan akun di paket gratis; hentikan upload/penggunaan bila mendekati batas.

Kuota dan harga dapat berubah. Periksa kembali halaman resmi sebelum mengaktifkan fitur berbayar atau mengubah paket.

## A. Domain dan GitHub Pages

- [x] URL publik dipilih: `https://ajielt7.github.io/Tokoku/`. `SITE_URL` menggunakan URL proyek dengan subpath repositori. Domain custom tidak dipakai.
- [x] Worker `ruma-api-production` aktif di `https://ruma-api-production.ajielt7.workers.dev`; `GET /api/catalog` terverifikasi HTTP 200 dengan 0 kategori dan 0 produk.
- [x] Pages memakai sumber **GitHub Actions** dan workflow menargetkan branch `main`.
- [x] Gate indeks/kesiapan tetap tertutup sampai konten final siap; pratinjau Pages tetap `noindex`.
- [x] GitHub Pages melaporkan `https_enforced: true`.
- [ ] Setelah katalog D1 berubah, jalankan workflow **Build and deploy store** secara manual agar HTML statis, halaman produk, dan sitemap dibangun ulang dari katalog terbaru.
- [x] Pemindaian file terlacak tidak menemukan `.dev.vars`, `.env`, `google-services.json`, private key, dump database, atau pola token umum. Pertahankan aturan ini pada perubahan selanjutnya.

## B. Cloudflare Worker dan D1

- [x] Buat database produksi terpisah dari database lokal; ID D1 produksi sudah terpasang pada kedua binding `DB` di `backend/wrangler.jsonc`.
- [x] Tinjau dan terapkan migrasi 0001–0008 ke D1 produksi tanpa seed demo; urutan tercatat dan `PRAGMA foreign_key_check` kosong. Latihan backup/restore SQLite lokal lulus (8 migrasi, integritas OK, foreign key bersih); D1 staging cloud tidak dibuat agar tidak menambah resource yang berpotensi biaya.
- [x] `ALLOWED_ORIGINS` production sudah memakai origin GitHub Pages `https://ajielt7.github.io` (tanpa subpath); `APP_ENV=production` sudah ditetapkan.
- [x] Wrangler production `deploy --dry-run` lulus; Worker production sudah diunggah dan subdomain workers.dev aktif.
- [x] `IMAGEKIT_PRIVATE_KEY`, `RAJAONGKIR_API_KEY`, dan `ADMIN_TOKEN` terpasang sebagai Worker secrets; nilainya tidak masuk Git atau frontend.
- [x] Pencarian tujuan RajaOngkir dan GET admin orders berhasil melalui Worker; uji hanya membaca data, D1 masih kosong.
- [x] `IMAGEKIT_URL_ENDPOINT` dan `RAJAONGKIR_ORIGIN_ID=5052` tersedia sebagai production vars; endpoint memakai HTTPS.
- [ ] Deploy Worker production belum memuat perubahan logging pada commit terbaru; Wrangler dry-run lulus, tetapi sesi CLI belum terautentikasi. Setelah login, deploy ulang lalu verifikasi endpoint dan log Worker.
- [ ] Validasi ImageKit read-only ke API daftar berkas mengembalikan HTTP 403 pada 9 November 2026. Dokumentasi ImageKit menyebut 403 dapat berarti akun tidak terautentikasi dengan key, key kedaluwarsa, atau akun dinonaktifkan; batas upload hanya relevan bagi API upload. Periksa Dashboard ImageKit > Developer > API Keys dan status akun, lalu ulangi validasi setelah penyebab diperbaiki. Jangan mengunggah bukti pembayaran sebelum lolos ([dokumentasi API ImageKit](https://imagekit.io/docs/api-overview)).
- [x] Worker production memuat binding D1 produksi `ruma-store` serta empat rate limiter; katalog API runtime merespons HTTP 200.
- [ ] Tinjau log/error Worker production melalui dashboard Cloudflare tanpa mencatat bukti pembayaran, alamat, nomor telepon, token, atau kredensial. Pemeriksaan sumber kode sudah dilakukan, tetapi log runtime belum dapat diperiksa pada sesi ini.

## C. Produk, transaksi, dan kebijakan toko

- [ ] Ganti seluruh produk demo dengan barang yang benar: nama, deskripsi, harga, ukuran, batas personalisasi, stok/ketersediaan, berat paket, dan foto milik toko.
- [x] `RAJAONGKIR_API_KEY` dari berkas lokal yang diabaikan Git terpasang pada Worker; pencarian tujuan merespons HTTP 200. Pastikan tarif/kurir dan titik asal `5052` sesuai operasional sebelum menerima pesanan.
- [ ] Isi bank, nomor rekening, nama pemilik rekening, waktu konfirmasi, pembatalan, refund, dan cara menghubungi toko.
- [ ] Siapkan kebijakan privasi dan syarat pembelian yang ditinjau pemilik toko; jangan menampilkan alamat/data pribadi pesanan pada halaman publik.
- [ ] Uji transfer nyata dengan nominal kecil dan rekonsiliasi manual. Jangan menyatakan pembayaran otomatis terverifikasi.
- [ ] Pastikan unggah bukti hanya ke ImageKit privat, URL admin bertanda tangan singkat, penolakan membersihkan file aktif, dan kebijakan retensi ImageKit jelas.
- [ ] Verifikasi pengiriman, resi, tracking, notifikasi FCM, dan akses admin memakai akun/perangkat yang benar.
- [ ] Periksa DXF melalui alur CAD/CAM dan lakukan uji bahan/mesin; gambar tahap 11 bukan toolpath siap mesin.

## D. SEO dan mutu halaman

- [x] `SITE_URL` sudah memakai HTTPS `https://ajielt7.github.io/Tokoku`; HTML demo tetap `noindex` tanpa canonical publik. Canonical menunggu katalog final.
- [ ] Bangun ulang dari katalog produksi. `check-release.mjs` harus lulus dan semua halaman publik harus memiliki satu H1, title, description, canonical, tautan lokal valid, dan konten bukan demo.
- [ ] Pastikan cart, checkout, dan lacak pesanan tetap `noindex` dan tidak ada di sitemap; jangan blok crawler pada robots.txt untuk halaman yang perlu dibaca noindex-nya.
- [ ] Periksa produk dan harga pada HTML hasil build, gambar/alt text, mobile layout, keyboard, kontras, dan pesan error.
- [x] Build produk siap membuat JSON-LD `Product`/`Offer` hanya saat indeks diaktifkan; build memeriksa foto HTTPS, alt text, harga, mata uang, dan URL Offer. Data contoh tetap lokal/noindex. Validasi hasil pada URL yang diterbitkan dan Google Rich Results Test masih menunggu data toko final serta deployment.
- [ ] Uji semua URL publik setelah deployment, termasuk 404 dan subpath Pages. Jalankan pemeriksaan Lighthouse seluler dan tinjau Core Web Vitals setelah data lapangan tersedia.
- [ ] Verifikasi properti domain di Google Search Console, periksa URL dengan URL Inspection, lalu kirim sitemap. Pengiriman sitemap membantu penemuan URL tetapi tidak menjamin pengindeksan atau peringkat.

## E. Backup, pemulihan, dan peluncuran bertahap

- [x] D1 produksi memakai versi `production`; API mengembalikan bookmark Time Travel. Fitur aktif otomatis dengan retensi 30 hari dan tanpa biaya tambahan. Tetap siapkan ekspor terenkripsi terpisah sebelum transaksi untuk perlindungan di luar jendela/akun Cloudflare.
- [ ] Ekspor D1 ke lokasi terenkripsi di luar repositori dan batasi akses. Buat salinan terpisah untuk bukti ImageKit jika kebijakan layanan memerlukannya.
- [x] Latihan pemulihan lokal SQLite lulus untuk skema kosong; ini tidak membuktikan pemulihan D1 cloud atau file ImageKit. D1 staging cloud tidak dibuat karena pemilik memilih tanpa resource tambahan berpotensi biaya. Sebelum transaksi nyata, pastikan ekspor D1 produksi dapat dibuat dan simpan salinan terenkripsi; jadwalkan latihan cloud terpisah bila kelak ada lingkungan gratis yang sesuai.
- [ ] Catat kontak pemulihan akun GitHub, Cloudflare, ImageKit, RajaOngkir, dan Firebase di password manager organisasi, bukan di repositori.
- [ ] Rilis dahulu ke kelompok kecil; pantau pesanan gagal, ongkir, upload bukti, notifikasi, dan log selama periode awal.
- [ ] Simpan artifact/rilis sebelumnya dan prosedur rollback. Jangan pulihkan database produksi tanpa menentukan titik waktu serta membuat cadangan keadaan saat ini.

## Syarat lulus

Peluncuran toko untuk pelanggan baru hanya dimulai setelah semua kotak bagian A sampai E ditinjau dan disetujui pemilik toko. Worker dan demo noindex sudah tayang. Checklist **belum lulus** karena katalog D1 kosong, validasi ImageKit menerima HTTP 403 dan alur bukti belum diuji end-to-end, serta produk, rekening, dan kebijakan toko belum final.
