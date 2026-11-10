# Checklist Persiapan Peluncuran

Checklist ini adalah gerbang sebelum toko dibuka untuk pelanggan. Pratinjau demo boleh tayang tanpa indeks; rilis toko untuk pelanggan menunggu identitas toko, katalog, domain, layanan, dan rekening final.

## Pengukuran progres

Gunakan bobot tetap per bagian agar laporan progres konsisten. Nilai tiap bagian adalah `bobot × butir selesai ÷ seluruh butir` di bagian itu; total adalah jumlah kontribusi A–E. Butir ringkasan di luar bagian A–E tidak dihitung agar pekerjaan duplikat tidak menggandakan nilai.

| Bagian | Bobot |
|---|---:|
| A. Domain dan GitHub Pages | 15% |
| B. Cloudflare Worker dan D1 | 25% |
| C. Produk, transaksi, dan kebijakan toko | 25% |
| D. SEO dan mutu halaman | 20% |
| E. Backup, pemulihan, dan peluncuran | 15% |

**Progres berbobot per 10 November 2026: 53,7%** (A 6/9, B 12/15, C 9/29, D 13/22, E 5/18). Keputusan berat, kurir, identitas, pembayaran, dan refund yang sudah disepakati kini dicatat sebagai selesai; publikasi katalog dan implementasi alurnya tetap menunggu. Angka ini mengukur butir checklist yang selesai, bukan persentase kesiapan menerima pesanan. Syarat lulus pada bagian akhir tetap menjadi gerbang rilis.

### Rincian Tahap 12

Tahap 12 dibagi menjadi 5 bagian utama dan 18 subbagian. Setiap baris merangkum pekerjaan yang sudah diverifikasi dan langkah berikutnya; rincian kotak tugas tetap ada di bagian A–E di bawah. Status dihitung dari kotak pada subbagian masing-masing; bagian yang seluruh butirnya selesai ditandai **Selesai**, yang sebagian selesai **Berjalan**, dan yang belum ada butir selesai **Belum mulai**. Rincian ini tidak mengubah jumlah kotak atau angka progres.

| Subbagian | Fokus | Sudah selesai | Berikutnya | Selesai | Status |
|---|---|---|---|---:|---|
| A.1 | URL dan hosting | URL Pages/API dipilih dan aktif; HTTPS dipaksa | — | 4/4 | Selesai |
| A.2 | Gate indeks dan katalog | Demo tetap noindex; gate konten final tertutup | Jalankan workflow setelah D1 terisi, lalu cek halaman dan sitemap hasil rilis | 1/4 | Berjalan |
| A.3 | Keamanan repository | Pemindaian file terlacak tidak menemukan secret atau dump | — | 1/1 | Selesai |
| B.1 | Database dan migrasi | D1 produksi dibuat; migrasi 0001–0008 dan latihan SQLite lokal lulus | Siapkan prosedur backup D1 sebelum order nyata | 2/2 | Selesai |
| B.2 | Konfigurasi dan deploy Worker | Binding, variabel, limiter, deploy, dan endpoint katalog aktif | — | 5/5 | Selesai |
| B.3 | Secret dan akses admin | Secret dipasang di Worker; endpoint admin terverifikasi tanpa membuka nilainya | — | 2/2 | Selesai |
| B.4 | Layanan eksternal dan log | Ringkasan log/issue Worker diperiksa; tidak ada 5xx pada sampel | Pemilik cek paket dan status key ImageKit di dashboard; validasi API setelah 403 dibereskan | 3/6 | Berjalan |
| C.1 | Katalog produk | Nama, deskripsi, harga, ukuran, personalisasi, dan berat 650 g sudah disepakati | Masukkan katalog final; foto asli disiapkan menjelang rilis dan berat paket dicek saat packing final | 1/7 | Berjalan |
| C.2 | Ongkir dan pembayaran | Transaksi dasar terdokumentasi; hitung subtotal/ongkir lokal dan idempotency order teruji; asal serta pilihan kurir sudah ditetapkan | Cocokkan tarif live dengan akun RajaOngkir dan jalankan simulasi lokal setelah alur bukti/refund siap | 4/10 | Berjalan |
| C.3 | Identitas toko dan kebijakan | Nama/kontak, rekening, batas pembayaran, dan kebijakan refund sudah ditentukan | Terapkan saat rilis; tulis privasi/syarat dan periksa halaman publik | 4/6 | Berjalan |
| C.4 | Pengiriman dan produksi | Belum disiapkan untuk operasional pelanggan | Tetapkan asal/kurir, proses packing, stok, SLA, dan penanganan pesanan bermasalah | 0/6 | Belum mulai |
| D.1 | Indeks dan metadata | SITE_URL HTTPS benar; preview lulus pemeriksaan; 9 rute live punya title, description, dan H1; halaman privat noindex; robots.txt membolehkan crawler; Product/Offer schema tersedia di kode | Setelah konten final, cek canonical dan konten halaman publik, pastikan URL privat tak masuk sitemap rilis, lalu validasi Rich Results | 6/9 | Berjalan |
| D.2 | Konten dan aksesibilitas | Audit tampilan ponsel, urutan Tab, kontras, label, dan live region lulus pada preview | Masukkan konten/foto final dan uji pembelian keyboard-only | 3/6 | Berjalan |
| D.3 | Performa dan Search Console | URL demo dan 404 diperiksa; audit Lighthouse lokal dan Pages selesai | Tinjau CWV pengguna nyata, verifikasi Search Console, lalu kirim sitemap | 4/7 | Berjalan |
| E.1 | Backup dan pemulihan | Time Travel D1 aktif; pemulihan SQLite lokal lulus | Tentukan lokasi terenkripsi, buat dan cek ekspor D1; putuskan perlindungan file ImageKit | 2/6 | Berjalan |
| E.2 | Akses pemulihan akun | Belum diverifikasi | Cek akses pemulihan GitHub, Cloudflare, ImageKit/RajaOngkir, dan Firebase; simpan di password manager | 0/5 | Belum mulai |
| E.3 | Prosedur rollback | Langkah rollback Worker/Pages terdokumentasi | — | 1/1 | Selesai |
| E.4 | Arsip dan uji bertahap | Artifact demo diarsipkan; rencana uji dan kriteria berhenti tersedia | Setelah semua prasyarat siap, lakukan satu order uji, pantau, lalu tinjau hasil | 2/6 | Berjalan |

**Yang sudah selesai sepenuhnya:** A.1, A.3, B.1, B.2, B.3, dan E.3. **Bagian yang sedang dikerjakan:** A.2, B.4, C.2, D.1, D.2, D.3, E.1, dan E.4. Subbagian lain menunggu data toko atau pengujian yang belum tersedia.

## Status yang sudah terlihat di workspace

- [x] SEO situs masih nonaktif (`indexable: false`, `contentReady: false`). Build belum bisa menerbitkan canonical atau sitemap publik.
- [x] Pratinjau lokal dibangun dari 2 kategori dan 3 produk contoh; halaman berstatus `noindex,nofollow`, menampilkan catatan data contoh, dan `frontend/dist/` diabaikan Git. D1 cloud tetap kosong setelah seed lokal.
- [x] Nama kerja sementara disepakati sebagai **Toqoku by Ajielt7** dan diterapkan pada halaman preview; workflow Pages `42729690405` sukses dan 9 rute live tetap `noindex,nofollow`. Subdomain yang diinginkan `toqoku.ajielt7.id`; `siteUrl` publik tetap URL Pages sampai domain/DNS siap. Nama final, kontak, dan penelusuran merek masih perlu dipastikan, sehingga C.3 belum selesai.
- [x] Kanal kontak yang direncanakan: WhatsApp, Facebook, Instagram, dan TikTok; YouTube menyusul. Nomor WhatsApp `6283172527880` diberikan dan ditambahkan pada footer; tautan sosial lainnya menunggu akun/URL.
- [x] Slot konfigurasi dan ikon sosial Facebook, Instagram, TikTok, dan YouTube disiapkan; semua URL dibiarkan kosong sampai akun resmi siap.
- [x] Ikon UI preview memakai Font Awesome Free 6.7.2 yang dipatok dengan SRI; katalog demo memakai foto Unsplash dengan alt yang menyatakan foto hanya ilustrasi, bukan produk Toqoku.
- [x] Pemilik memilih WhatsApp melalui `wa.me`; tautan akan membuka chat dengan pesan awal singkat.
- [x] Artefak lokal `frontend/dist/` diselaraskan dari API sementara port `8789` ke port default `8787`. Pemeriksaan manual menemukan 9 halaman HTML, semuanya tetap `noindex,nofollow`, tanpa referensi `8789`. `node frontend/src/scripts/check-release.mjs --preview` lulus: 9 halaman HTML dan 6 halaman publik; build berikutnya mengambil default `8787` dari `src/data/site.json`.
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

### A.1 URL dan hosting — Selesai (4/4)

- [x] URL publik dipilih: `https://ajielt7.github.io/Tokoku/`. `SITE_URL` menggunakan URL proyek dengan subpath repositori. Domain custom tidak dipakai.
- [x] Worker `ruma-api-production` aktif di `https://ruma-api-production.ajielt7.workers.dev`; `GET /api/catalog` terverifikasi HTTP 200 dengan 0 kategori dan 0 produk.
- [x] Pages memakai sumber **GitHub Actions** dan workflow menargetkan branch `main`.
- [x] GitHub Pages melaporkan `https_enforced: true`.

### A.2 Gate indeks dan pembaruan katalog — Berjalan (1/4)

- [x] Gate indeks/kesiapan tetap tertutup sampai konten final siap; pratinjau Pages tetap `noindex`.
- [ ] Setelah katalog D1 berubah, jalankan workflow **Build and deploy store** secara manual.
- [ ] Pastikan HTML statis dan halaman produk yang diterbitkan memuat katalog terbaru.
- [ ] Pastikan sitemap yang diterbitkan memuat URL produk/kategori terbaru dan tidak memuat cart, checkout, atau lacak pesanan.

### A.3 Keamanan repository — Selesai (1/1)

- [x] Pemindaian file terlacak tidak menemukan `.dev.vars`, `.env`, `google-services.json`, private key, dump database, atau pola token umum. Pertahankan aturan ini pada perubahan selanjutnya.

## B. Cloudflare Worker dan D1

### B.1 Database dan migrasi — Selesai (2/2)

- [x] Buat database produksi terpisah dari database lokal; ID D1 produksi sudah terpasang pada kedua binding `DB` di `backend/wrangler.jsonc`.
- [x] Tinjau dan terapkan migrasi 0001–0008 ke D1 produksi tanpa seed demo; urutan tercatat dan `PRAGMA foreign_key_check` kosong. Query baca-saja pada 9 November 2026 mengonfirmasi 0 baris di 13 tabel katalog, pesanan, pembayaran, pengiriman, file, dan admin. Latihan backup/restore SQLite lokal lulus (8 migrasi, integritas OK, foreign key bersih); D1 staging cloud tidak dibuat agar tidak menambah resource yang berpotensi biaya.

### B.2 Konfigurasi dan deploy Worker — Selesai (5/5)

- [x] `ALLOWED_ORIGINS` production sudah memakai origin GitHub Pages `https://ajielt7.github.io` (tanpa subpath); `APP_ENV=production` sudah ditetapkan.
- [x] Wrangler production `deploy --dry-run` lulus; Worker production sudah diunggah dan subdomain workers.dev aktif.
- [x] `IMAGEKIT_URL_ENDPOINT` dan `RAJAONGKIR_ORIGIN_ID=5052` tersedia sebagai production vars; endpoint memakai HTTPS.
- [x] Perubahan logging pada commit `1d3570c` telah dideploy ke Worker `ruma-api-production` pada 9 November 2026 (versi `df440313-c47f-4594-a0df-6d3a175b3c50`); GET `/api/catalog` setelah deploy merespons HTTP 200.
- [x] Worker production memuat binding D1 produksi `ruma-store` serta empat rate limiter; katalog API runtime merespons HTTP 200.

### B.3 Secret dan akses admin — Selesai (2/2)

- [x] `IMAGEKIT_PRIVATE_KEY`, `RAJAONGKIR_API_KEY`, dan `ADMIN_TOKEN` terpasang sebagai Worker secrets; nilainya tidak masuk Git atau frontend.
- [x] GET admin orders setelah deploy terbaru merespons HTTP 200 dengan 0 pesanan memakai token lokal; nilai token tidak ditampilkan dan D1 tetap kosong.

### B.4 Validasi layanan dan log runtime — Berjalan (3/6)

- [ ] Di Dashboard ImageKit, periksa apakah akun aktif dan masih pada paket yang diinginkan.
- [ ] Di Dashboard ImageKit > Developer > API Keys, periksa status private key tanpa menyalin nilainya ke chat, Git, atau log.
- [ ] Setelah penyebab HTTP 403 diperbaiki, minta pemilik menjalankan validasi API daftar berkas yang aman sebelum alur upload bukti dipakai. Jangan mengulang request validasi tanpa persetujuan pemilik.
- [x] Tinjauan agregat Workers Observability untuk 7 hari sampai 9 November 2026 (sampling log 10%): pada sampel yang ditinjau, tidak ditemukan event berisi `$metadata.error` atau respons 5xx; hasil mengelompokkan 11 status 200, 10 status 404, dan dua log `d1_all OK` tanpa status HTTP. Tidak ada teks log pesanan/bukti yang diambil. Ini bukan hitungan seluruh traffic dan tidak menggantikan pemantauan rutin.
- [x] Ringkasan issue Cloudflare Observability untuk Worker diperiksa pada 9 November 2026: tidak ada issue aktif atau occurrence; ringkasan ini bukan pemeriksaan event log lengkap.
- [x] Audit kode logging memastikan bukti pembayaran, alamat, nomor telepon, token, kredensial, dan isi data pesanan tidak ditulis ke log; error dibatasi ke operasi/jenis error, status upstream, atau request ID.

## C. Produk, transaksi, dan kebijakan toko

### C.1 Katalog produk — Berjalan (1/7)

Ruang lingkup rilis awal: satu model katalog bernama **Nomor Rumah Akrilik**, dibuat dari akrilik 3 mm hasil potong laser CO₂, ukuran 20 × 12 cm posisi landscape, alas hitam dengan angka dan huruf putih dari stiker; tanpa ornamen. Nomor wajib diisi, maksimal 3 karakter, hanya huruf/angka, dan huruf dinormalisasi kapital (contoh A01). Nama area opsional, maksimal 14 karakter termasuk spasi, dengan kapitalisasi mengikuti input konsumen; nama area boleh memakai tanda baca `-`, `/`, dan `.`. Batas nama area adalah keputusan awal dan tata letaknya perlu diperiksa pada desain fisik 20 × 12 cm. Papan sementara direncanakan dipasang dengan double tape dan dibuat setelah pesanan masuk. Waktu produksi: bisa kurang dari satu jam saat antrean sepi dan maksimal dua hari kerja saat ramai, dihitung setelah detail custom dan pembayaran dikonfirmasi. Harga jual sementara ditetapkan Rp50.000 (IDR), berat paket disepakati 650 g. Deskripsi disetujui: “Nomor rumah akrilik hitam 3 mm, ukuran 20 × 12 cm. Kustom nomor hingga 3 karakter dan nama area hingga 14 karakter. Tulisan putih memakai stiker; pemasangan menggunakan double tape.” Pemilik akan memeriksa model satu per satu sebelum katalog ditambah. CNC router dan 3D printing direncanakan untuk tahap berikutnya. Foto produk asli disiapkan menjelang rilis; berat paket tetap ditimbang saat contoh kemasan final siap.

- Pemilik menyetujui konsep visual digital awal di [konsep-nomor-rumah-akrilik.svg](produk/konsep-nomor-rumah-akrilik.svg) sebagai acuan desain. Mockup memakai teks contoh `A01` dan `KAMPUNG A`; ini bukan foto produk asli atau berkas produksi laser.

- [ ] Tetapkan daftar produk yang benar dan hapus produk demo dari katalog yang akan diterbitkan.
- [ ] Isi nama, deskripsi singkat, dan kategori setiap produk.
- [ ] Tetapkan harga, mata uang, dan status stok/ketersediaan.
- [ ] Isi ukuran produk dan batas personalisasi yang benar.
- [x] Berat paket ditetapkan 650 g untuk perhitungan ongkir; timbang kembali paket contoh sebelum menerima pesanan agar angka sesuai kemasan final.
- [ ] Siapkan foto milik toko yang dapat diterbitkan dengan URL HTTPS.
- [ ] Tulis alt text yang menjelaskan foto untuk setiap produk.

### C.2 Ongkir dan pembayaran — Berjalan (4/10)

Metode pembayaran rilis awal yang dipilih: transfer bank SeaBank, batas pembayaran 24 jam sejak pesanan dibuat, lalu tampilkan pesan “Pembayaran telah kedaluwarsa”. Pemilik memilih penghapusan penuh pesanan tanpa bukti setelah batas 24 jam, termasuk order, item, customization, payment, shipment, riwayat, dan berkas terkait. Jika bukti transfer diunggah sebelum batas, pesanan dan bukti tidak dihapus otomatis; keduanya dipertahankan sampai admin memproses pesanan. Kebijakan ini belum diimplementasikan. Nama pemilik dan nomor rekening sudah diberikan untuk instruksi transfer, tetapi nilainya tidak disimpan di dokumen repo publik; masukkan ke tampilan pembayaran pada rilis terkontrol.

Bukti transfer ditargetkan diperiksa admin maksimal 1 × 24 jam sejak diunggah. Status pembayaran diperbarui setelah admin memeriksa bukti secara manual. Jika bukti ditolak, pembeli tidak mengunggah ulang dan diarahkan untuk melanjutkan lewat chat.

Kebijakan pembatalan/refund yang dipilih: refund boleh jika produksi belum dimulai; setelah produksi berjalan, dana tidak dikembalikan. Pelanggan dapat mengajukan pembatalan dari halaman lacak; permintaan masuk ke tab pembatalan/refund pada aplikasi admin Android. Admin mengirim refund lebih dahulu, lalu menekan “Proses”; statusnya diperbarui pada web. Setelah produksi dimulai, pelanggan diarahkan ke chat untuk koordinasi. Alur ini belum diimplementasikan.

Refund hanya dikirim kembali ke rekening asal yang mengirim pembayaran ke SeaBank toko; pembeli tidak dapat memilih rekening tujuan lain. Refund ditargetkan selesai maksimal 3 × 24 jam (72 jam) setelah admin menyetujui permintaan.

- [x] `RAJAONGKIR_API_KEY` dari berkas lokal yang diabaikan Git terpasang pada Worker; pencarian tujuan merespons HTTP 200.
- [x] Pemilik mengonfirmasi titik asal RajaOngkir `5052` sesuai lokasi operasional toko; verifikasi tarif kurir nyata masih perlu dilakukan.
- [x] Pemilik memilih Gojek, JNE, J&T, SPX, SiCepat, Wahana, dan Anteraja. Acuan ongkir mengikuti proyek Pemesanan: Gojek Same Day memakai rumus jarak yang didokumentasikan di sana; kurir ekspedisi meminta tarif RajaOngkir secara langsung.
- [ ] Cocokkan ketersediaan layanan dan tarif aktual pilihan kurir pada akun RajaOngkir untuk rute uji sebelum rilis; tarif dapat berbeda menurut akun, tujuan, dan layanan.
- [x] Uji API lokal dengan seed demo: backend menghitung subtotal Rp150.000 dan ongkir fixture lokal Rp10.000 dari server menjadi total Rp160.000; pengiriman ulang memakai idempotency key yang sama memberi kode yang sama, hanya satu order/item/payment tersimpan, dan endpoint tracking tidak mengembalikan nomor telepon. Rute ongkir memakai fixture 1 km; ini bukan verifikasi tarif RajaOngkir nyata atau order production.
- [ ] Jalankan simulasi checkout, unggah bukti contoh, persetujuan/penolakan admin, dan refund memakai Worker serta D1 lokal; jangan melakukan transfer atau refund sungguhan saat simulasi.
- [ ] Sebelum rilis, bila pemilik menyetujui transaksi uji berbiaya, lakukan satu transfer nominal kecil dan cocokkan mutasi secara manual. Jangan menyatakan pembayaran otomatis terverifikasi.
- [ ] Verifikasi unggah bukti hanya ke ImageKit privat setelah validasi ImageKit lolos.
- [ ] Verifikasi URL bukti untuk admin bertanda tangan dan berumur singkat.
- [ ] Pastikan bukti yang ditolak tidak dapat diunggah ulang, file aktif dibersihkan, dan pelanggan diarahkan ke chat; uji alur setelah kode disesuaikan dengan kebijakan.

### C.3 Informasi toko dan kebijakan — Berjalan (4/6)

- [x] Nama kerja toko **Toqoku by Ajielt7** dan WhatsApp `wa.me` sudah dipilih; pemeriksaan merek/domain tetap sebelum rilis.
- [x] Detail SeaBank dan pemilik rekening diterima secara privat; nilainya tidak disimpan di repo publik dan perlu dimasukkan ke tampilan pembayaran pada rilis terkontrol.
- [x] Batas pembayaran ditetapkan 24 jam; pesanan tanpa bukti dihapus setelah kedaluwarsa.
- [x] Refund sebelum produksi, rekening asal saja, dan target maksimal 72 jam setelah persetujuan admin sudah ditetapkan.
- [ ] Tulis kebijakan privasi dan syarat pembelian, lalu minta pemilik meninjaunya.
- [ ] Periksa halaman publik agar tidak menampilkan alamat atau data pribadi pelanggan.

### C.4 Pengiriman dan produksi — Belum (0/6)

- [ ] Uji alur admin mengubah status pesanan dan menyimpan nomor resi.
- [ ] Uji tautan/informasi tracking yang diterima pelanggan.
- [ ] Uji notifikasi FCM pada perangkat yang memang akan dipakai toko.
- [ ] Pastikan akses admin hanya berfungsi untuk akun/perangkat yang berwenang.
- [ ] Buka DXF di alur CAD/CAM dan periksa skala, kontur, serta satuan.
- [ ] Lakukan uji bahan/mesin sebelum produksi; gambar tahap 11 bukan toolpath siap mesin.

## D. SEO dan mutu halaman

### D.1 Indeks dan metadata — Berjalan (6/9)

- [x] `SITE_URL` sudah memakai HTTPS `https://ajielt7.github.io/Tokoku`; pemeriksaan Pages pada 9 November 2026 menemukan sembilan rute merespons HTTP 200, semuanya `noindex,nofollow`, dan belum ada canonical publik. Ini sesuai mode demo; canonical menunggu katalog final.
- [ ] Bangun ulang situs dari katalog final di D1 production.
- [x] Jalankan `node frontend/src/scripts/check-release.mjs --preview`; pemeriksaan lulus pada 9 November 2026 (9 HTML, 6 halaman publik). Ini hanya memvalidasi pratinjau `noindex`; build indeks publik masih menunggu katalog dan informasi toko final.
- [x] Periksa struktur halaman preview: sembilan rute live memiliki tepat satu H1, title, dan description; pemeriksaan lokal memastikan tautan internal valid. Pada deployment Pages run `42632783168`, kesembilan rute tetap `noindex,nofollow`, masing-masing punya satu title, description, dan H1. Pemeriksaan live pada 9 November 2026 tidak menemukan gambar tanpa atribut alt.
- [ ] Pada rilis final, periksa setiap halaman publik memiliki canonical yang benar dan tidak berisi konten demo.
- [x] Pastikan keranjang, checkout, dan lacak pesanan memiliki `noindex`. Build preview dan pemeriksaan `check-release.mjs --preview` lulus pada 9 November 2026; keluaran saat ini mencakup ketiga halaman tersebut.
- [x] Pastikan `robots.txt` preview membolehkan crawler membaca halaman noindex dan tidak menunjuk sitemap demo. Pemeriksaan `check-release.mjs --preview` lulus pada 9 November 2026.
- [ ] Pastikan keranjang, checkout, dan lacak pesanan tidak masuk sitemap rilis; jangan memblokir crawler di `robots.txt` untuk URL yang perlu membaca arahan noindex.
- [x] Build produk siap membuat JSON-LD `Product`/`Offer` hanya saat indeks diaktifkan; build memeriksa foto HTTPS, alt text, harga, mata uang, dan URL Offer. Data contoh tetap lokal/noindex. Validasi hasil pada URL yang diterbitkan dan Google Rich Results Test masih menunggu data toko final serta deployment.

### D.2 Konten produk dan aksesibilitas — Berjalan (3/6)

- [ ] Cocokkan nama, deskripsi, harga, dan ketersediaan produk pada HTML hasil build dengan katalog final.
- [ ] Periksa gambar produk tampil, URL-nya aman, dan alt text sesuai.
- [x] Periksa tata letak ponsel pada viewport 390×844 di sembilan URL pratinjau (beranda, dua kategori, tiga produk, keranjang, checkout, lacak); lebar dokumen tetap 390 px dan tidak ditemukan elemen melewati viewport.
- [x] Uji urutan Tab pada sembilan URL pratinjau: semua 153 tautan/kontrol fokus yang terlihat tercapai tepat sekali tanpa kehilangan fokus. Ini memeriksa navigasi statis; alur transaksi keyboard-only belum diuji.
- [ ] Selesaikan alur belanja end-to-end memakai keyboard saja setelah katalog dan layanan transaksi siap.
- [x] Audit statis CSS pada 9 November 2026 menghitung 23 pasangan warna teks utama: rasio 4,87–14,63:1; teks error `#a12d24` pada latar putih 7,20:1. Label formulir terhubung langsung dengan input; status dan pesan menggunakan live region, dan JavaScript menulisnya dengan `textContent`. Ini audit sumber/pratinjau, bukan pengujian seluruh keadaan visual di semua perangkat.

### D.3 Performa dan Search Console — Berjalan (4/7)

- [x] Buka seluruh URL yang ada pada deployment demo: beranda, checkout, keranjang, lacak pesanan, 2 kategori, dan 3 produk; semuanya merespons HTTP 200, diverifikasi ulang setelah run Pages `42632783168`. Worker health dan katalog masing-masing HTTP 200; katalog D1 production tetap kosong.
- [x] URL acak merespons 404; subpath proyek `/Tokoku/` berfungsi pada halaman-halaman tersebut. Sitemap merespons 404 sesuai status demo `noindex` dan katalog demo tidak dikirim sebagai sitemap publik.
- [x] Audit Lighthouse seluler pada build lokal setelah perbaikan: beranda mendapat skor performance/accessibility/best-practices 100/100/100 (LCP 1,5 dtk, CLS 0,004, TBT 0); halaman produk, kategori, keranjang, checkout, dan lacak pesanan juga mendapat accessibility/best-practices 100/100. Laporan tersimpan di luar repo pada `%LOCALAPPDATA%\Ruma\lighthouse-stage12-local.json` dan laporan halaman terkait.
- [x] Audit ulang Lighthouse seluler pada Pages publik setelah perbaikan terbit: performance 98, accessibility 100, best-practices 100; LCP 1,9 dtk, CLS 0, TBT 0 ms, tanpa mismatch label atau error konsol. Temuan untuk optimasi berikutnya: CSS render-blocking diperkirakan 650 ms dan cache aset statis berpotensi menghemat sekitar 11 KiB saat kunjungan ulang. Laporan disimpan di luar repo pada `%LOCALAPPDATA%\Ruma\lighthouse-stage12-production.json`.
- [ ] Tinjau Core Web Vitals setelah tersedia data pengguna nyata.
- [ ] Verifikasi properti situs di Google Search Console dan inspeksi beberapa URL penting.
- [ ] Kirim sitemap ke Search Console dan pantau status pembacaan. Pengiriman sitemap membantu penemuan URL tetapi tidak menjamin indeks atau peringkat.

## E. Backup, pemulihan, dan peluncuran bertahap

### E.1 Backup dan pemulihan — Berjalan (2/6)

- [x] D1 produksi memakai versi `production`; API mengembalikan bookmark Time Travel. Fitur aktif otomatis dengan retensi 30 hari dan tanpa biaya tambahan. Tetap siapkan ekspor terenkripsi terpisah sebelum transaksi untuk perlindungan di luar jendela/akun Cloudflare.
- [ ] Tentukan lokasi backup terenkripsi di luar repositori dan siapa yang boleh mengaksesnya.
- [ ] Buat ekspor D1 production dan simpan di lokasi terenkripsi; jangan masukkan dump ke Git.
- [ ] Periksa ekspor dapat dibaca/dipulihkan tanpa menimpa database production.
- [ ] Tentukan apakah kebijakan ImageKit mengharuskan backup bukti terpisah dan bagaimana aksesnya dibatasi.
- [x] Latihan pemulihan lokal SQLite lulus untuk skema kosong; ini tidak membuktikan pemulihan D1 cloud atau file ImageKit. D1 staging cloud tidak dibuat karena pemilik memilih tanpa resource tambahan berpotensi biaya. Jadwalkan latihan cloud terpisah bila kelak ada lingkungan gratis yang sesuai.

### E.2 Akses pemulihan — Belum (0/5)

- [ ] Pastikan email/nomor pemulihan akun GitHub masih dapat diakses.
- [ ] Pastikan kontak dan metode pemulihan akun Cloudflare tersedia.
- [ ] Pastikan kontak pemulihan ImageKit dan RajaOngkir tersedia.
- [ ] Pastikan kontak serta pemulihan proyek Firebase tersedia.
- [ ] Simpan informasi pemulihan di password manager, bukan di repositori; jangan menaruh password atau recovery code di checklist.

### E.3 Prosedur rollback — Selesai (1/1)

- [x] Prosedur rollback Worker dan GitHub Pages beserta versi/run target terdahulu sudah dicatat di [panduan operasional](OPERATIONS.md). Prosedur melarang force-push dan menjelaskan bahwa rollback Worker tidak memulihkan D1.

### E.4 Arsip artifact dan uji bertahap — Berjalan (2/6)

- [x] Artifact Pages workflow run `42576560129` sudah disimpan di arsip lokal luar repo `%LOCALAPPDATA%\Ruma\release-archive\github-pages-demo-60b5e6f.zip` dan checksum SHA-256 diverifikasi; jangan masukkan `dist/` atau dump data ke Git.
- [x] Rencana uji menetapkan pemilik dan maksimal dua penguji tepercaya, cakupan satu order bernilai rendah setelah persetujuan biaya, syarat lulus, serta kondisi berhenti. Rencana ada di [panduan operasional](OPERATIONS.md); transaksinya belum dijalankan.
- [ ] Jalankan uji order end-to-end setelah katalog, pembayaran, dan ImageKit siap.
- [ ] Pantau pesanan gagal, tarif ongkir, dan proses pengiriman selama periode awal.
- [ ] Pantau upload bukti, notifikasi, dan error Worker tanpa menyimpan data pelanggan di log.
- [ ] Catat masalah uji, perbaiki, lalu tinjau hasil sebelum membuka toko untuk umum.

## Syarat lulus

Peluncuran toko untuk pelanggan baru hanya dimulai setelah semua kotak bagian A sampai E ditinjau dan disetujui pemilik toko. Worker dan demo noindex sudah tayang. Checklist **belum lulus** karena katalog D1 kosong, validasi ImageKit menerima HTTP 403 dan alur bukti belum diuji end-to-end, serta produk, rekening, dan kebijakan toko belum final.
