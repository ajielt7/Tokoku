# Dokumentasi Analisis Proyek Toko Online

**Versi:** 0.2 — Dokumen analisis awal (ditambahkan bab strategi SEO)  
**Tanggal:** 7 November 2026  
**Status:** Tahap analisis; belum menjadi spesifikasi teknis final

---

## 1. Ringkasan proyek

Proyek ini bertujuan membangun toko online mandiri yang ringan, hemat biaya, mudah ditemukan melalui mesin pencari (SEO), dan dapat dikembangkan secara bertahap.

Sistem terdiri dari:
- Website publik untuk pelanggan.
- Backend dan database terpusat.
- Aplikasi Android sebagai dashboard admin utama.
- Pengelolaan pesanan, pembayaran, produksi, file DXF, dan pengiriman.
- Fitur produk custom berbasis template, ketika pelanggan hanya mengubah bagian tertentu seperti angka atau huruf.

Prinsip utama: bangun fondasi sederhana terlebih dahulu, uji setiap bagian, lalu tambahkan fitur yang lebih kompleks.

## 2. Keputusan dan kesepakatan sejauh ini

### 2.1 Arsitektur teknologi

| Bagian | Teknologi/layanan | Peran |
|---|---|---|
| Website frontend | GitHub Pages | Menyajikan toko online untuk pelanggan |
| Backend utama | Cloudflare Workers | API, validasi, autentikasi, dan logika bisnis |
| Database utama | Cloudflare D1 | Sumber data utama untuk produk, pesanan, dan status |
| Media produk | ImageKit | Penyimpanan dan penyajian foto/video produk |
| API tambahan/fallback | Netlify Functions | Jalur tambahan untuk API tertentu jika diperlukan |
| Aplikasi admin | Android | Mengelola produk, pesanan, produksi, dan pengiriman |
| Notifikasi | Firebase Cloud Messaging (FCM) | Mengirim pemberitahuan pesanan ke Android |
| Repositori kode | GitHub | Menyimpan kode dan riwayat perubahan |
| Lingkungan pengembangan | VS Code | Menulis dan mengelola kode |

**Ketentuan arsitektur:**
- Cloudflare Workers tetap menjadi backend utama.
- D1 menjadi sumber data utama; jangan membuat dua database utama yang saling berbeda.
- Netlify hanya menjadi jalur tambahan/proxy untuk kebutuhan API yang memang memerlukannya. Netlify tidak mengambil alih logika bisnis utama.
- GitHub Pages hanya menangani frontend publik.
- Google Sheets tidak digunakan sebagai database transaksi utama. Jika diperlukan, penggunaannya dibatasi untuk laporan atau ekspor.
- FCM hanya untuk notifikasi. Status pembayaran dan pesanan harus tetap diverifikasi dari backend/database, bukan dipercaya hanya dari isi notifikasi.

### 2.2 Pertimbangan jaringan seluler

Pernah ditemukan masalah akses API melalui jaringan seluler: layanan dapat berjalan di Wi-Fi tetapi gagal pada jaringan seluler tertentu, termasuk pengujian yang disebutkan pada jaringan XL.

Karena itu:
- Endpoint penting perlu diuji melalui Wi-Fi dan beberapa jaringan seluler.
- Netlify dapat dipertimbangkan sebagai jalur tambahan untuk API yang bermasalah.
- Keberhasilan Netlify sebagai jalur alternatif tidak boleh diasumsikan sebelum diuji pada operator yang digunakan.
- Aplikasi harus menangani kegagalan jaringan, timeout, dan percobaan ulang secara wajar.

### 2.3 Dashboard admin

Untuk tahap awal, dashboard admin berbasis web tidak dibuat. Pengelolaan dilakukan melalui aplikasi Android.

Website tetap tersedia untuk pelanggan sebagai toko dan halaman cek status pesanan.

## 3. Konsep produk dan katalog

Website menampilkan katalog produk dan halaman detail masing-masing produk.

Untuk prototipe:
- Ikon menggunakan Font Awesome.
- Foto sementara menggunakan Unsplash.
- Foto produk asli akan menggantikan gambar sementara setelah tersedia; ImageKit direncanakan untuk pengelolaan media produk.

Gambar Unsplash hanya untuk kebutuhan prototipe dan tidak boleh dianggap sebagai foto asli barang yang dijual.

## 4. Sistem produk custom berbasis template

Produk custom bukan editor desain bebas. Admin menyiapkan desain dasar, sedangkan pelanggan hanya dapat mengubah bidang yang diizinkan.

### 4.1 Aturan produk

- Satu desain menjadi satu produk tersendiri.
- Setiap produk memiliki satu ukuran tetap yang ditentukan admin.
- Pelanggan tidak dapat memilih atau mengubah ukuran.
- Ukuran tetap ditampilkan sebagai informasi produk.
- Harga ditentukan admin untuk produk tersebut.
- Setiap produk dapat memiliki aturan custom yang berbeda.

Contoh:

| Produk | Ukuran tetap | Bagian yang boleh diubah |
|---|---:|---|
| Nomor rumah desain A | 30 × 15 cm | Angka nomor rumah |
| Nomor rumah desain B | 25 × 12 cm | Angka nomor rumah |
| Plang nama desain C | 20 × 8 cm | Huruf/nama |

Ukuran pada tabel hanya contoh ilustrasi, bukan ukuran final produk.

### 4.2 Alur pelanggan

1. Pelanggan membuka detail produk.
2. Pelanggan mengisi angka atau huruf yang diizinkan.
3. Website menampilkan live preview.
4. Sistem memvalidasi panjang dan karakter input.
5. Pelanggan melanjutkan ke checkout.
6. Konfigurasi custom disimpan bersama pesanan.

### 4.3 Aturan teknis penting

- Validasi harus dilakukan di backend, bukan hanya di browser.
- Input pelanggan harus diamankan dari injeksi HTML/SVG atau konten berbahaya.
- Simpan snapshot konfigurasi dan versi template pada saat pesanan dibuat.
- Perubahan desain template di kemudian hari tidak boleh mengubah pesanan lama.
- Preview bukan otomatis file produksi. Sistem perlu menghasilkan atau menyediakan file final yang sesuai kebutuhan mesin/proses produksi.

## 5. File DXF dan alur produksi

Untuk pesanan produk custom, tujuan akhirnya adalah admin tidak perlu menggambar ulang desain pesanan.

Alur yang diinginkan:
1. Pelanggan mengisi custom produk dan melakukan pemesanan.
2. Sistem menyimpan konfigurasi pesanan.
3. Sistem menyiapkan file DXF untuk pesanan tersebut.
4. Admin menerima pesanan melalui aplikasi Android.
5. Admin membuka detail pesanan dan mengunduh DXF.
6. File digunakan untuk proses produksi.

Setiap file harus terkait dengan ID pesanan yang benar. Jika ada revisi, versi file perlu dibedakan agar file tidak tertukar.

**Belum diputuskan:** spesifikasi DXF, satuan dan skala gambar, layer, font/konversi teks menjadi outline, toleransi, serta proses atau mesin produksi. Hal ini perlu dianalisis sebelum implementasi generator DXF.

## 6. Aplikasi Android Admin dan status pesanan

Dashboard Android direncanakan memiliki tiga tab utama:

1. **Orderan Baru** — pesanan baru yang perlu ditinjau.
2. **Proses** — pesanan yang sedang dikerjakan atau disiapkan.
3. **Riwayat** — pesanan yang sudah selesai atau dibatalkan.

Pada detail pesanan di tab Proses, admin memiliki tindakan:
- **Selesai** — menandai tahap produksi/pengerjaan selesai.
- **Batalkan** — membatalkan pesanan sesuai aturan bisnis.

Status pesanan perlu dikelola dengan transisi yang jelas. Riwayat menyimpan status akhir dan jejak perubahan agar pesanan dapat ditelusuri.

### 6.1 Pembedaan status

Status pesanan, status produksi, status pembayaran, dan status pengiriman sebaiknya dipisahkan. Contohnya, produksi selesai tidak selalu berarti barang sudah dikirim.

FCM dapat memberi tahu admin bahwa ada pesanan baru, tetapi aplikasi harus mengambil status terbaru dari backend saat dibuka.

## 7. Pengiriman dan pelacakan

Admin perlu dapat memasukkan tautan pelacakan kurir atau ekspedisi, misalnya layanan instan seperti Gojek atau jasa ekspedisi lain yang menyediakan tautan pelacakan.

Informasi pengiriman yang direncanakan:
- Nama kurir/ekspedisi.
- URL pelacakan.
- Status pengiriman.
- Waktu barang diserahkan/dikirim, jika tersedia.

Status produksi dan pengiriman harus terpisah. Pesanan dapat selesai diproduksi tetapi belum diserahkan kepada kurir.

## 8. Halaman cek status pesanan untuk pelanggan

Website menyediakan halaman **Cek Status Pesanan**.

Alur:
1. Pelanggan membuka halaman cek status.
2. Pelanggan memasukkan kode pesanan.
3. Pelanggan menekan tombol **Lacak Pesanan**.
4. Website meminta data status kepada Cloudflare Workers.
5. Website menampilkan perkembangan pesanan.
6. Jika tautan pengiriman tersedia, tampilkan tombol **Lacak Pengiriman**.

Informasi yang dapat ditampilkan:
- Kode pesanan.
- Pesanan diterima.
- Status pembayaran yang telah diverifikasi.
- Status produksi.
- Status pengiriman.
- Tautan pelacakan kurir jika sudah tersedia.

**Keamanan:** kode pesanan harus sulit ditebak atau dilengkapi mekanisme verifikasi tambahan. Halaman publik hanya menampilkan informasi yang aman. Jangan menampilkan alamat lengkap, nomor telepon, atau data pribadi pelanggan.

## 9. Rancangan data awal

Rancangan berikut masih konseptual dan belum merupakan skema SQL final.

| Entitas/tabel | Fungsi |
|---|---|
| `products` | Data produk, harga, deskripsi, ukuran tetap, dan status aktif |
| `product_templates` | Desain dasar dan versi template produk custom |
| `customization_fields` | Bidang yang boleh diubah serta aturan validasinya |
| `orders` | Data utama pesanan dan kode pesanan |
| `order_items` | Rincian produk dan jumlah dalam pesanan |
| `order_customizations` | Snapshot input custom dan versi template pada saat order |
| `order_files` | File DXF/hasil produksi, versi, lokasi file, dan relasi pesanan |
| `payments` | Catatan pembayaran dan hasil verifikasi |
| `shipments` | Kurir, URL tracking, status, dan waktu pengiriman |
| `order_status_history` | Riwayat perubahan status pesanan |

Data media sebaiknya disimpan di layanan penyimpanan media, bukan sebagai file biner di D1. D1 menyimpan URL, metadata, dan relasi yang diperlukan.

## 10. Roadmap pengerjaan 15 tahap

Urutan ini merupakan roadmap awal. Tingkat kesulitan bersifat perkiraan dan dapat berubah setelah spesifikasi teknis dibuat.

| Tahap | Fokus pengerjaan | Kesulitan perkiraan |
|---:|---|---|
| 1 | Persiapan proyek: GitHub, VS Code, struktur folder, dan lingkungan kerja | Mudah |
| 2 | Menentukan desain visual dan komponen UI website | Mudah |
| 3 | Membuat halaman utama dan navigasi | Mudah |
| 4 | Membuat katalog dan detail produk | Mudah |
| 5 | Menyiapkan Cloudflare D1 dan struktur database awal | Mudah–sedang |
| 6 | Membuat API/backend dasar dengan Cloudflare Workers | Sedang |
| 7 | Menghubungkan website, API, dan database | Sedang |
| 8 | Membuat keranjang dan checkout | Sedang |
| 9 | Membuat pencatatan pesanan dan pengelolaan data pelanggan secara aman | Sedang |
| 10 | Integrasi pembayaran dan verifikasi pembayaran | Sedang–sulit |
| 11 | Membuat aplikasi Android Admin | Sulit |
| 12 | Mengintegrasikan notifikasi pesanan dengan FCM | Sulit |
| 13 | Membuat editor produk custom berbasis template dan live preview | Sulit |
| 14 | Membuat file DXF otomatis dan fitur unduh di Android | Sangat sulit |
| 15 | Cek status pesanan, tautan tracking, pengujian keamanan, SEO, backup, dan optimasi | Sangat sulit |

Setiap tahap harus memiliki hasil yang bisa diuji. Jangan melanjutkan terlalu jauh jika tahap sebelumnya belum stabil.

## 11. Metode pengembangan

Pendekatan yang disepakati:
- **SDLC** sebagai kerangka siklus hidup pengembangan perangkat lunak.
- **Agile** untuk mengerjakan proyek secara bertahap dan iteratif.
- **Git** untuk version control.
- **GitHub** untuk repositori, riwayat perubahan, Issues, dan Milestones.
- **VS Code** sebagai editor utama.
- **Wrangler** untuk pengembangan dan pengelolaan Cloudflare Workers/D1.
- Pengujian dilakukan pada setiap fitur dan setiap tahap.
- Perubahan kode dicatat dalam commit agar dapat ditelusuri dan dipulihkan.

## 12. Dokumentasi proyek yang disarankan

Dokumentasi teknis proyek dapat disimpan di repositori GitHub:

```text
toko-online/
├── README.md
├── docs/
│   ├── 01-requirements.md
│   ├── 02-architecture.md
│   ├── 03-database.md
│   ├── 04-api.md
│   ├── 05-testing-deployment.md
│   └── 06-user-guide.md
├── frontend/
├── backend/
├── android/
└── ...
```

Dokumen diperbarui saat keputusan atau implementasi berubah. Jangan menyimpan password, token API, private key, atau rahasia lain di repositori.

## 13. Keamanan, keandalan, dan backup

Prinsip yang harus dijaga sejak awal:
- Semua perubahan data penting divalidasi backend.
- Hak akses admin dan pelanggan harus dibedakan.
- Jangan mempercayai status pembayaran hanya dari notifikasi atau data dari browser.
- Lindungi endpoint cek pesanan dari enumerasi kode pesanan dan kebocoran data pribadi.
- Simpan snapshot konfigurasi custom untuk menjaga konsistensi pesanan lama.
- Simpan file produksi dengan relasi pesanan dan versi yang jelas.
- Buat prosedur backup dan uji pemulihan database.
- Uji website dan API di Wi-Fi serta jaringan seluler.
- Catat error penting agar masalah produksi dapat ditelusuri.

## 14. Hal yang masih perlu diputuskan

Daftar berikut adalah pertanyaan terbuka, bukan keputusan yang sudah dibuat:

1. Nama toko, domain, dan identitas visual.
2. Daftar produk awal, harga, ukuran tetap, dan foto asli.
3. Metode pembayaran dan penyedia/payment gateway.
4. Aturan ongkir dan cara menentukan kurir.
5. Apakah pelanggan perlu akun atau cukup checkout dengan data kontak.
6. Metode autentikasi dan hak akses admin Android.
7. Format final file DXF, satuan, layer, skala, dan kompatibilitas mesin.
8. Apakah file DXF dibuat langsung oleh layanan backend atau melalui proses rendering/generasi terpisah.
9. Detail status dan aturan pembatalan/refund.
10. Kebijakan retensi file, backup, dan biaya layanan setelah prototipe.

## 15. Prinsip kerja proyek

- Mulai dari prototipe yang paling sederhana.
- Gunakan Unsplash dan Font Awesome untuk mempercepat prototipe.
- Ganti aset sementara dengan foto produk asli saat tersedia.
- Selesaikan satu tahap, uji, dokumentasikan, lalu lanjut.
- Pertahankan Cloudflare Workers dan D1 sebagai backend serta sumber data utama.
- Jangan membangun fitur yang belum diperlukan sebelum fondasi toko stabil.
- Keputusan yang belum disepakati jangan dianggap sebagai spesifikasi final.

---

**Catatan status:** Dokumen ini merangkum keputusan dan gagasan yang sudah dibahas sampai 7 November 2026. Dokumen ini adalah baseline analisis proyek, bukan jaminan bahwa seluruh detail teknis, biaya layanan, atau integrasi pihak ketiga sudah diverifikasi.


## 16. Strategi SEO Toko Online

SEO (Search Engine Optimization) adalah upaya mengoptimalkan website agar halaman dan produk lebih mudah ditemukan melalui mesin pencari. SEO bukan pekerjaan yang hanya dilakukan di akhir proyek; fondasinya perlu disiapkan sejak struktur website dan halaman produk dibuat, lalu ditingkatkan setelah website memiliki konten dan data performa.

### 16.1 Tujuan SEO

- Membantu halaman toko dan produk ditemukan oleh calon pelanggan melalui pencarian organik.
- Membuat setiap produk memiliki halaman yang jelas dan dapat diindeks mesin pencari.
- Menyediakan informasi produk yang relevan, berguna, dan sesuai dengan barang yang benar-benar dijual.
- Meningkatkan pengalaman pengguna, terutama pada perangkat seluler.
- Mengukur halaman dan kata kunci yang menghasilkan kunjungan.

SEO tidak menjamin posisi tertentu di hasil pencarian atau penjualan dalam jangka waktu tertentu.

### 16.2 Riset kata kunci dan struktur halaman

Sebelum menulis judul dan deskripsi, tentukan istilah yang mungkin digunakan calon pembeli. Riset dapat dimulai dari nama produk, bahan, ukuran, kegunaan, model, dan kebutuhan pelanggan.

Contoh ilustrasi untuk produk plang nomor rumah:
- plang nomor rumah
- nomor rumah MDF
- papan nomor rumah custom

Kata kunci harus sesuai dengan produk sebenarnya. Hindari memasukkan kata kunci yang tidak relevan atau mengulangnya secara berlebihan.

Setiap produk sebaiknya memiliki URL yang stabil dan mudah dibaca, misalnya:

`/produk/plang-nomor-rumah-desain-a`

Jika nama atau slug produk berubah, rencanakan pengalihan URL (redirect) agar tautan lama tidak langsung rusak.

### 16.3 SEO halaman utama, kategori, dan produk

**Halaman utama**
- Jelaskan jenis toko dan produk yang dijual dengan bahasa yang alami.
- Tampilkan navigasi yang jelas menuju kategori dan produk.
- Gunakan judul halaman dan deskripsi yang unik.

**Halaman kategori/katalog**
- Berikan nama dan pengantar kategori yang membantu pelanggan.
- Pastikan produk dapat ditemukan melalui tautan HTML yang dapat dirayapi.
- Hindari membuat banyak halaman kategori kosong atau hampir sama.

**Halaman detail produk**
- Gunakan nama produk yang jelas dan spesifik.
- Tulis deskripsi asli yang menjelaskan bahan, ukuran tetap, fungsi, pilihan custom, cara pemesanan, dan informasi penting lainnya.
- Tampilkan harga dan ketersediaan secara konsisten.
- Gunakan foto produk yang relevan.
- Sertakan tautan menuju kategori atau produk terkait jika membantu pelanggan.

Untuk produk custom, jelaskan dengan tegas bagian yang dapat diubah pelanggan dan bagian yang sudah ditentukan oleh toko. Informasi ukuran tetap harus terlihat sebagai spesifikasi produk, bukan sebagai pilihan ukuran pelanggan.

### 16.4 Title, meta description, dan heading

Setiap halaman penting perlu memiliki:
- `title` yang unik, ringkas, dan menggambarkan isi halaman.
- `meta description` yang menjelaskan manfaat atau isi halaman secara wajar.
- Satu judul utama (`h1`) yang jelas.
- Subjudul (`h2`, `h3`) dengan urutan yang logis.

Contoh ilustrasi:
- Title: `Plang Nomor Rumah MDF Custom – Desain A`
- Meta description: `Plang nomor rumah berbahan MDF dengan ukuran tetap dan pilihan nomor sesuai ketentuan desain. Lihat detail produk dan pesan secara online.`

Judul dan deskripsi harus mencerminkan isi halaman; jangan membuat janji atau klaim yang tidak benar.

### 16.5 URL, sitemap, robots.txt, dan canonical

- Gunakan URL deskriptif, konsisten, dan sebisa mungkin permanen.
- Sediakan `sitemap.xml` yang berisi URL halaman publik yang ingin diindeks.
- Sediakan `robots.txt` untuk memberi petunjuk perayapan. `robots.txt` bukan mekanisme keamanan dan tidak boleh digunakan untuk melindungi data rahasia.
- Gunakan canonical URL ketika ada beberapa URL yang menampilkan konten yang sama atau sangat mirip.
- Jangan masukkan halaman admin, endpoint privat, halaman checkout personal, atau data pelanggan ke sitemap.
- Halaman cek status pesanan berdasarkan kode tidak perlu dipromosikan untuk indeks mesin pencari. Lindungi datanya di backend; jangan mengandalkan `robots.txt` atau `noindex` sebagai pengganti autentikasi dan kontrol akses.

### 16.6 SEO teknis untuk frontend GitHub Pages

Karena frontend publik direncanakan menggunakan GitHub Pages, implementasi perlu memperhatikan:
- Halaman produk penting memiliki konten yang dapat dibaca mesin pencari, bukan hanya muncul setelah interaksi yang tidak dapat dirayapi.
- Gunakan HTML semantik dan tautan internal yang jelas.
- Pastikan setiap produk memiliki URL yang dapat dibuka langsung.
- Atur metadata halaman secara tepat, termasuk title, description, canonical, dan Open Graph bila diperlukan untuk tampilan berbagi.
- Uji halaman pada perangkat seluler dan berbagai ukuran layar.
- Periksa tautan rusak, halaman error, dan pengalihan URL.
- Jika menggunakan rendering JavaScript untuk katalog, pastikan konten utama tetap dapat ditemukan dan dirender dengan baik oleh mesin pencari. Evaluasi pendekatan rendering bila pengindeksan menjadi kendala.

### 16.7 Kecepatan, aksesibilitas, dan pengalaman mobile

- Kompres dan ubah ukuran gambar sesuai kebutuhan tampilan.
- Gunakan format gambar modern jika didukung dengan baik.
- Tetapkan dimensi gambar agar tata letak tidak bergeser saat gambar dimuat.
- Muat gambar di bawah area awal secara lazy-load bila sesuai.
- Hindari JavaScript, animasi, dan font yang tidak diperlukan.
- Pastikan tombol, navigasi, teks, dan formulir mudah digunakan di layar kecil.
- Gunakan kontras warna yang cukup, label formulir, teks alternatif gambar, dan struktur heading yang masuk akal.

Kecepatan dan pengalaman pengguna perlu diukur, bukan hanya dinilai dari tampilan di satu perangkat.

### 16.8 Optimasi gambar produk

- Gunakan foto yang benar-benar menggambarkan produk.
- Nama file harus deskriptif, misalnya `plang-nomor-rumah-mdf.webp`.
- Isi atribut `alt` dengan deskripsi gambar yang berguna bagi pengguna pembaca layar; jangan menjejalkan kata kunci.
- Siapkan ukuran gambar yang sesuai dengan perangkat dan area tampilan.
- Pastikan gambar tidak terlalu besar sehingga memperlambat halaman.
- Saat foto asli siap, ganti gambar Unsplash prototipe dengan aset produk yang benar.
- ImageKit direncanakan untuk penyajian media; URL dan metadata aset dapat disimpan di D1.

### 16.9 Data terstruktur (structured data)

Untuk halaman produk, pertimbangkan structured data `Product` dan `Offer` sesuai data yang benar-benar tampil di halaman, seperti nama, gambar, deskripsi, harga, mata uang, dan ketersediaan bila informasinya akurat.

Jangan menambahkan rating, ulasan, stok, harga, atau atribut lain yang tidak benar-benar tersedia. Structured data membantu mesin pencari memahami halaman, tetapi tidak menjamin rich result akan ditampilkan.

### 16.10 Google Search Console dan pengukuran

Setelah domain dan website siap:
1. Verifikasi kepemilikan domain/properti di Google Search Console.
2. Kirim sitemap.
3. Pantau masalah pengindeksan dan halaman yang tidak dapat diakses.
4. Periksa kueri pencarian, tayangan, klik, dan halaman tujuan.
5. Perbaiki halaman yang memiliki masalah teknis atau informasi yang kurang.
6. Evaluasi perubahan secara berkala, bukan berdasarkan satu hari data saja.

Analytics dapat digunakan untuk memahami perilaku pengunjung, dengan memperhatikan privasi dan aturan yang berlaku. Search Console dan alat analitik memiliki fungsi berbeda: Search Console berfokus pada performa pencarian Google, sedangkan analytics membantu memahami aktivitas pengunjung di website.

### 16.11 SEO dan iklan video

SEO dan iklan video memiliki fungsi yang berbeda dan dapat digunakan bersama:
- Iklan video dapat membantu memperkenalkan produk dan menjangkau audiens dalam waktu relatif cepat, dengan biaya iklan.
- SEO berfokus pada keterlihatan halaman di hasil pencarian organik dan membutuhkan konten serta perbaikan berkelanjutan.
- Konten video produk dapat mendukung pemasaran dan membantu pelanggan memahami produk. Jika video ditampilkan di halaman produk, pastikan tidak memperlambat halaman.
- Keberhasilan keduanya perlu diukur dengan metrik yang sesuai, seperti biaya dan hasil kampanye untuk iklan, serta klik organik, tayangan, dan konversi untuk SEO.

### 16.12 Tahapan penerapan SEO dalam roadmap

SEO tidak hanya dikerjakan pada tahap terakhir. Penerapannya dibagi sepanjang proyek:

| Tahap proyek | Pekerjaan SEO |
|---|---|
| Tahap 2–4: desain dan halaman website | Struktur navigasi, URL, HTML semantik, konten halaman utama, kategori, dan produk |
| Tahap 7: integrasi website dan API | Pastikan konten produk penting dapat dirender dan diakses dengan baik |
| Tahap 13: produk custom | Pastikan halaman produk custom memiliki deskripsi yang berguna dan tidak membuat URL duplikat berlebihan |
| Tahap 15: pengujian dan optimasi | Sitemap, robots.txt, canonical, structured data, Search Console, kecepatan, dan audit teknis |
| Setelah peluncuran | Pantau performa, perbarui konten, tambah produk, dan perbaiki masalah pengindeksan |

**Prinsip:** SEO dimulai sejak struktur website dirancang dan dilanjutkan setelah toko online diluncurkan. Jangan menunggu seluruh fitur selesai untuk menyiapkan fondasi SEO.
