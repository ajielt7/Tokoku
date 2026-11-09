# Panduan Struktur Frontend dan SEO

Frontend direncanakan sebagai situs statis yang diterbitkan melalui GitHub Pages. Struktur ini menyiapkan fondasi SEO; keberhasilan indeks tetap bergantung pada konten yang bermanfaat, halaman yang dapat diakses, dan pemeriksaan setelah situs dipublikasikan.

## Arah desain dan bahasa

Desain toko harus terasa sederhana, jelas, dan nyaman dipakai. Arah halaman utama memakai struktur Material Design 3 dengan tombol dan kartu bergaya flat. Palet sasaran: sekitar 60% putih cerah/putih kebiruan, 30% hijau, dan 10% oranye. Tidak memakai mode gelap pada desain utama. Roboto dipakai untuk teks umum; Inter dipakai pada tombol dan kartu.

- Gunakan tata letak yang rapi dan rapat dengan jarak konsisten berbasis kelipatan 8 px, navigasi konsisten, serta satu tindakan utama yang jelas pada setiap bagian.
- Tampilkan informasi penting produk dengan urutan yang mudah dipindai: nama, foto, harga, ukuran tetap, opsi custom, lalu cara memesan.
- Hindari terlalu banyak warna, jenis huruf, animasi, pop-up, pilihan sekaligus, dan elemen dekoratif yang tidak membantu keputusan.
- Beranda harus langsung menampilkan produk: sediakan pilihan promo atau produk unggulan sebelum hero, lanjutkan dengan katalog seperti produk terbaru/terlaris, lalu tampilkan rekomendasi produk yang relevan setelah informasi seperti cara pemesanan.
- Setiap blok penjelasan produk atau layanan sebaiknya menghubungkan pelanggan ke produk terkait agar mereka mudah melihat pilihan dan melanjutkan belanja.
- Gunakan jenis huruf sans-serif yang jelas. Pada contoh saat ini, Roboto dipakai untuk teks umum dan Inter untuk tombol/kartu, dengan Arial sebagai cadangan. Pilihan final dapat ditinjau setelah contoh produk asli tersedia.
- Jaga ukuran teks isi nyaman dibaca di ponsel, panjang baris tidak terlalu lebar, jarak antarbaris cukup, dan kontras teks terhadap latar memadai.
- Hindari tulisan kecil untuk informasi yang perlu dibaca. Sasaran awal: teks isi minimal 17 px di desktop dan 16 px di ponsel; label/keterangan sekunder minimal 14 px. Teks dekoratif pada ilustrasi tidak boleh menjadi satu-satunya sumber informasi.
- Gunakan bahasa Indonesia yang alami dan sederhana. Pilih kalimat pendek, kata sehari-hari, label tombol yang menyebut tindakan, dan hindari jargon teknis.
- Jelaskan batasan produk secara langsung dan jujur, misalnya ukuran yang tetap dan bagian desain yang bisa diubah.
- Berikan umpan balik yang jelas saat formulir salah, pesanan berhasil, atau jaringan bermasalah; jelaskan apa yang terjadi dan tindakan yang bisa dilakukan.
- Bangun rasa percaya melalui informasi nyata seperti bahan, ukuran, harga, cara pemesanan, pembayaran, dan pengiriman. Hindari klaim berlebihan, kelangkaan palsu, atau pola antarmuka yang menekan pelanggan.

Warna merek, logo, dan pilihan font final **belum ditentukan**. Tetapkan setelah identitas toko dan contoh produk awal tersedia.

## Pola halaman dan URL

Gunakan satu direktori dengan `index.html` untuk setiap halaman utama, kategori, dan produk:

```text
frontend/
├── src/
│   ├── templates/
│   │   ├── home.html
│   │   ├── category.html
│   │   └── product.html
│   ├── data/site.json
│   ├── assets/
│   │   ├── images/
│   │   │   ├── brand/
│   │   │   ├── kategori/
│   │   │   └── produk/
│   │   ├── icons/
│   │   ├── css/site.css
│   │   └── js/
│   └── scripts/build-site.mjs
└── dist/                           # Hasil build; jangan diedit manual
    ├── index.html
    ├── kategori/<slug>/index.html
    ├── produk/<slug>/index.html
    └── assets/css/site.css
```

Sumber halaman ada di `src/templates/`, konfigurasi publikasi ada di `src/data/site.json`, stylesheet di `src/assets/css/site.css`, dan `src/scripts/build-site.mjs` mengambil katalog dari endpoint `/api/catalog` Worker sebelum membuat halaman serta file SEO di `dist/`. Database menjadi sumber data produk; HTML yang dibangun tetap memuat konten statis sehingga dapat dibaca tanpa JavaScript browser.

Konfigurasi awal memakai `indexable: false` dan `contentReady: false`. Build memberi halaman `noindex,nofollow`; `robots.txt` tetap mengizinkan perayapan agar mesin pencari dapat membaca arahan `noindex`. Sebelum peluncuran, isi `siteUrl` dengan URL HTTPS situs (termasuk subpath repositori jika memakai GitHub Pages), pastikan data katalog final, lalu ubah kedua nilai kesiapan menjadi `true`. Build publik akan menambahkan canonical, Open Graph, BreadcrumbList, `robots.txt` yang mengizinkan perayapan dan mengumumkan sitemap, serta `sitemap.xml` dari URL halaman yang dibuat. Build menolak aktivasi indeks jika URL publik atau konfirmasi kesiapan konten belum diisi.

Jalankan Worker lokal dan isi D1 demo sesuai [panduan backend](../backend/README.md), lalu build dari akar repositori saat API lokal aktif:

```sh
node frontend/src/scripts/build-site.mjs
node frontend/src/scripts/check-release.mjs --preview
```

Untuk pratinjau interaktif di browser, biarkan Worker lokal tetap berjalan di terminal pertama. Build situs di terminal kedua, lalu jalankan server Pages lokal dari folder `backend/` di terminal ketiga:

```powershell
cd backend
npx wrangler pages dev ../frontend/dist --ip 127.0.0.1 --port 5500
```

Buka `http://localhost:5500`. Origin ini sudah diizinkan oleh konfigurasi lokal Worker untuk permintaan ongkir, checkout, dan pelacakan. Hentikan server dengan `Ctrl+C`. Pratinjau memakai D1 lokal dan tetap `noindex`; jangan gunakan seed demo pada D1 cloud.

Build memakai `http://127.0.0.1:8787/api/catalog` secara default. Untuk pipeline publik, isi `CATALOG_API_URL` dengan endpoint HTTPS Worker yang terhubung ke D1 berisi katalog final. Build berhenti dengan pesan yang jelas bila API tidak dapat dijangkau atau mengembalikan data yang tidak sesuai.

Untuk build publik, `SITE_URL`, `PUBLIC_API_BASE_URL`, `SEO_INDEXABLE=true`, dan `CONTENT_READY=true` dapat diberikan lewat environment. Nilai ini dipakai workflow Pages; konfigurasi `site.json` tetap nonaktif secara default. Jalankan `node frontend/src/scripts/check-release.mjs --preview` untuk audit keluaran lokal. Build publik menjalankan pemeriksaan tanpa `--preview`; periksa [checklist peluncuran](../docs/LAUNCH_CHECKLIST.md) sebelum mengaktifkan indeks.

Produk dapat ditambahkan ke keranjang. Checkout mencari tujuan, menampilkan tarif RajaOngkir dan Gojek Same Day dari pin peta, lalu mencatat pesanan transfer manual melalui Worker. Harga, berat, dan tarif ongkir divalidasi/dihitung ulang oleh backend. Kode pesanan menjadi referensi transfer; pelanggan dapat mengunggah bukti privat ke ImageKit dan melacak status lewat `/lacak-pesanan/` dengan kode pesanan serta nomor telepon checkout. Halaman lacak berstatus `noindex` dan tidak masuk sitemap. UI admin Android mengelola produksi, resi, dan status pengiriman. Untuk origin publik, isi `apiBaseUrl` di `src/data/site.json` dan sesuaikan `ALLOWED_ORIGINS` di konfigurasi Worker.

Halaman produk bertemplate menampilkan preview personalisasi langsung dari input pelanggan. Preview hanya ilustrasi posisi teks; konfigurasi sebenarnya divalidasi Worker dan disimpan bersama versi serta snapshot aturan template saat checkout. Jangan menganggap gambar preview sebagai bukti warna, bahan, ukuran huruf, atau hasil mesin.

Build akan membuat ulang `frontend/dist/`. Jangan mengedit file di `dist/` secara langsung.

Template kategori, produk, keranjang, checkout, dan pelacakan menghasilkan URL direktori yang stabil, misalnya `/kategori/plang-nama/`, `/produk/nomor-rumah-minimal/`, `/keranjang/`, `/checkout/`, dan `/lacak-pesanan/`. Keranjang, checkout, dan halaman lacak selalu diberi `noindex` serta tidak masuk sitemap.

Slug URL sebaiknya pendek, deskriptif, huruf kecil, dan stabil. Jika URL yang sudah dipublikasikan berubah, siapkan pengalihan dari URL lama.

## Ketentuan halaman yang akan dibuat

- Setiap halaman penting memiliki `title`, meta description, canonical URL, satu `h1`, dan konten yang sesuai dengan halaman tersebut.
- Konten utama produk (nama, deskripsi, harga, ukuran tetap, dan informasi custom) ditulis di HTML. JavaScript boleh menambah interaksi, tetapi jangan menjadi satu-satunya cara untuk menampilkan informasi utama.
- Kategori dan produk saling terhubung dengan tautan HTML biasa yang dapat diikuti perayap.
- Gambar memakai nama deskriptif, ukuran yang sesuai, dimensi eksplisit, dan teks `alt` yang menjelaskan gambar bagi pengguna.
- Structured data `Product`/`Offer` hanya memuat informasi yang benar-benar tampak dan akurat di halaman.
- `robots.txt` memberi petunjuk perayapan, bukan perlindungan data. `sitemap.xml` hanya memuat URL publik kanonis yang ingin diindeks.
- Halaman checkout, admin, dan hasil cek status pesanan tidak dimasukkan ke sitemap. Data pribadi tetap harus dilindungi backend.
- Tautan CSS, gambar, canonical, dan sitemap perlu mempertimbangkan domain serta kemungkinan GitHub Pages memakai subpath repositori.

## Aturan penulisan HTML

Gunakan HTML semantik (HTML Living Standard/HTML5) agar struktur dokumen menggambarkan fungsi konten, mudah dinavigasi dengan teknologi bantu, dan jelas bagi perayap. Pilih elemen berdasarkan maknanya; jangan membangun seluruh halaman hanya dari `<div>`.

- Setiap halaman memakai `<!doctype html>`, `<html lang="id">`, `<head>` dengan charset dan viewport, serta satu `<body>`.
- Susun halaman dengan landmark yang sesuai: `<header>`, `<nav>`, `<main>`, dan `<footer>`. Umumnya satu `<main>` untuk konten utama halaman.
- Gunakan `<section>` untuk kelompok konten bertema yang memiliki judul; gunakan `<article>` untuk konten mandiri seperti kartu/halaman produk atau artikel yang dapat dipahami sendiri.
- Gunakan heading secara berurutan sesuai hierarki isi (`<h1>` lalu subbagian `<h2>` dan seterusnya), bukan untuk mengatur ukuran teks.
- Gunakan `<a>` untuk navigasi dan `<button>` untuk menjalankan aksi. Jangan memakai elemen non-interaktif yang diberi klik sebagai pengganti tanpa alasan aksesibilitas yang kuat.
- Gunakan `<form>`, `<label>`, dan tipe `<input>` yang sesuai untuk masukan pelanggan. Setiap kolom input harus memiliki label yang jelas.
- Gunakan `<figure>` dan `<figcaption>` bila gambar memiliki keterangan; setiap `<img>` informatif memiliki `alt` yang sesuai. Gambar dekoratif memakai `alt=""`.
- Gunakan `<ul>`/`<ol>` untuk daftar, `<table>` hanya untuk data tabular, dan `<div>`/`<span>` untuk pengelompokan atau styling saat tidak ada elemen semantik yang lebih tepat.
- Gunakan atribut HTML sesuai tujuan; jangan memakai elemen usang seperti `<font>`, `<center>`, atau atribut presentasi lama.
- Untuk prototipe, Unsplash boleh dipakai sebagai gambar suasana/lifestyle sementara. Jangan menyajikannya sebagai foto asli produk; ganti dengan foto barang yang benar sebelum katalog diluncurkan.
- Font Awesome boleh dipakai untuk ikon antarmuka yang membantu pemahaman. Ikon dekoratif disembunyikan dari pembaca layar dan tidak menggantikan label teks pada tombol.

Contoh kerangka halaman:

```html
<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Nama halaman | Nama Toko</title>
    <meta name="description" content="Ringkasan halaman yang sesuai dengan isinya.">
  </head>
  <body>
    <header>
      <a href="/" aria-label="Nama Toko, beranda">Nama Toko</a>
      <nav aria-label="Navigasi utama">
        <ul>
          <li><a href="/kategori/">Produk</a></li>
          <li><a href="/tentang/">Tentang kami</a></li>
        </ul>
      </nav>
    </header>

    <main>
      <h1>Judul utama halaman</h1>
      <!-- Konten halaman -->
    </main>

    <footer>
      <p>&copy; Nama Toko</p>
    </footer>
  </body>
</html>
```

## Aturan penulisan JavaScript

JavaScript mendukung fungsi toko, tetapi bukan sumber tunggal untuk konten SEO. Google dapat merender JavaScript, tetapi HTML yang sudah berisi konten utama lebih mudah ditemukan dan diproses oleh berbagai perayap.

- Nama produk, deskripsi, harga, kategori, heading, dan tautan internal harus tersedia pada HTML hasil build tanpa menunggu JavaScript.
- Gunakan JavaScript untuk interaksi seperti preview custom, validasi awal, menu, dan keranjang. Validasi serta aturan bisnis tetap ditegakkan oleh backend.
- Gunakan tautan `<a href>` untuk berpindah halaman; jangan menggantinya dengan navigasi JavaScript yang hanya bekerja setelah klik atau mengandalkan URL fragment.
- JavaScript boleh memperbarui tampilan, tetapi perubahan konten penting harus tetap memiliki fallback HTML yang masuk akal.
- Muat skrip dengan `defer` atau `type="module"` bila sesuai. Hindari skrip sinkron di `<head>` yang menunda tampilan halaman.
- Pisahkan kode ke berkas berdasarkan tanggung jawab, gunakan nama variabel/fungsi yang menjelaskan maksudnya, dan hindari global yang tidak perlu.
- Tangani keadaan gagal, misalnya API tidak tersedia, tanpa menghapus informasi produk yang sudah tampil.
- Jangan memasukkan konten tersembunyi khusus untuk perayap atau membuat konten JavaScript berbeda bagi mesin pencari dan pelanggan.
- Hindari dependensi dan skrip pihak ketiga yang tidak diperlukan; ukur dampaknya terhadap kinerja.

## Aturan penulisan CSS

CSS mengatur presentasi dan tata letak; jangan mengandalkannya untuk menyampaikan informasi yang tidak tersedia pada HTML.

- Gunakan berkas CSS eksternal yang terorganisasi. Hindari inline style berulang dan `@import` untuk stylesheet utama.
- Gunakan nama class yang menggambarkan komponen atau tujuan, misalnya `.product-card` dan `.site-nav`, bukan nama yang hanya menjelaskan warna atau posisi.
- Terapkan pendekatan mobile-first dengan layout responsif; pastikan konten dan fungsi utama tetap nyaman digunakan pada layar kecil.
- Jangan menyembunyikan teks produk, heading, navigasi, atau tautan penting dengan `display: none`, `visibility: hidden`, atau teknik serupa hanya demi SEO.
- Gunakan HTML `<img>` untuk gambar produk dan konten informatif; `background-image` hanya untuk dekorasi.
- Tetapkan ukuran atau rasio aspek media agar ruangnya tersedia sebelum gambar dimuat dan tata letak tidak banyak bergeser.
- Pastikan kontras teks, fokus keyboard, indikator hover/focus, dan ukuran target interaktif tetap memadai.
- Kurangi CSS yang tidak dipakai dan hindari animasi berat. Hormati `prefers-reduced-motion` untuk animasi yang bukan esensial.
- Gunakan custom properties untuk nilai desain yang dipakai berulang, seperti warna, jarak, dan lebar konten.

## Prioritas SEO saat implementasi

Urutan prioritas halaman adalah: konten bermanfaat dan akurat, URL stabil serta tautan yang dapat dirayapi, HTML semantik dengan konten utama yang sudah tersedia, metadata/structured data yang sesuai, lalu kinerja dan pengalaman pengguna. CSS dan JavaScript harus mendukung halaman yang sama untuk pelanggan dan perayap; keduanya tidak menggantikan konten atau struktur HTML.

Saat `SEO_INDEXABLE=true` dan `CONTENT_READY=true`, halaman produk juga memuat structured data `Product` dan `Offer` (nama, deskripsi, foto HTTPS, harga, mata uang, serta URL produk). Build publik menolak produk tanpa foto HTTPS/teks alt atau harga yang valid; pemeriksa rilis memeriksa JSON-LD produk. Markup ini harus cocok dengan informasi yang tampak di halaman dan tidak menjamin cuplikan khusus atau penayangan di Google Shopping. Ikuti [panduan Google untuk listing produk](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing) dan [cuplikan produk](https://developers.google.com/search/docs/appearance/structured-data/product-snippet), lalu validasi URL produk yang sudah terbit sebelum mendaftarkan feed atau mengirim sitemap.

## File teknis SEO

`robots.txt` dan `sitemap.xml` ditempatkan di akar situs yang diterbitkan. Isi finalnya dibuat saat domain dan URL publik sudah ditetapkan; jangan mengirim sitemap berisi alamat contoh ke mesin pencari.

Sebelum peluncuran, periksa URL halaman langsung, status 404, metadata, tautan, tampilan seluler, ukuran gambar, sitemap, serta konfigurasi domain di Google Search Console.
