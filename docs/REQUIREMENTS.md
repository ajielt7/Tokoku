# Kebutuhan Proyek Toko Online

**Status:** kebutuhan awal yang diperbarui mengikuti implementasi lokal hingga tahap 11; aturan operasional dan spesifikasi produksi mesin masih perlu difinalkan sebelum peluncuran.

## 1. Tujuan

Membangun toko online mandiri yang ringan dan mudah dikembangkan. Toko perlu mendukung katalog produk, pemesanan, pengelolaan pesanan oleh admin, dan secara bertahap produk custom berbasis template serta alur produksi.

## 2. Pengguna

- **Pelanggan:** melihat produk, membuat pesanan, dan memeriksa perkembangannya.
- **Admin:** mengelola produk dan pesanan, memantau pembayaran, produksi, serta pengiriman melalui aplikasi Android.

## 3. Kebutuhan fungsional

### Website pelanggan

- Menampilkan halaman utama, katalog, dan halaman detail produk.
- Menampilkan informasi produk seperti deskripsi, harga, foto, serta ukuran tetap bila berlaku.
- Menyediakan keranjang dan alur checkout.
- Checkout awal memakai pesanan tamu tanpa akun; harga dihitung ulang di backend.
- Pelanggan mengunggah bukti transfer JPG/PNG/WebP maksimal 5 MB; Worker memvalidasi pesanan dan menyimpan gambar sebagai private file ImageKit.
- Menyediakan halaman cek status pesanan menggunakan kode dan nomor telepon checkout; hanya status aman dan tautan tracking yang ditampilkan, tanpa data pribadi. Halaman ini tidak diindeks.

### Produk custom

- Mendukung produk yang memakai desain/template yang disiapkan admin.
- Membatasi pelanggan untuk mengubah hanya bidang yang diizinkan, misalnya angka atau nama.
- Menampilkan preview dan memvalidasi input sesuai aturan produk.
- Menyimpan konfigurasi dan versi template bersama pesanan agar pesanan lama tetap konsisten.
- Membuat gambar CAD 2D DXF setelah pembayaran lunas dan pesanan diterima; file terkait dengan item pesanan dan memiliki versi yang jelas.
- Menyimpan snapshot nilai personalisasi, label/aturan field, dan versi template saat checkout agar pesanan lama tidak berubah ketika template diperbarui.
- Menjelaskan bahwa koordinat gambar DXF dasar dihitung dalam mm, tetapi DXF R12 tidak menyimpan metadata satuan sehingga pengguna harus memilih skala 1 unit = 1 mm saat impor. File berisi garis luar dan teks CAD; belum memuat bahan, toleransi, kompensasi alat, atau toolpath mesin.

### Pesanan dan operasional

- Mencatat pesanan dan rincian item.
- Memisahkan status pesanan, pembayaran, produksi, dan pengiriman.
- Admin memeriksa bukti transfer dan mengubah status pembayaran melalui endpoint yang dilindungi autentikasi.
- Menyediakan aplikasi Android untuk admin meninjau pesanan, mengelola proses, dan melihat riwayat.
- Mengirim notifikasi pesanan baru ke admin melalui FCM; aplikasi mengambil status terkini dari backend.
- Menyimpan informasi kurir, URL pelacakan, status, dan waktu pengiriman jika tersedia.
- Mengizinkan admin mencatat resi setelah pembayaran lunas dan produksi selesai; status selesai menunggu paket ditandai diterima.

## 4. Aturan bisnis yang sudah disepakati

- Satu desain custom adalah satu produk tersendiri; ukuran produk ditentukan admin dan bukan pilihan pelanggan.
- Harga ditetapkan admin untuk produk tersebut.
- Backend memvalidasi data penting; validasi browser hanya membantu pengalaman pengguna.
- Status pembayaran tidak boleh dipercaya hanya dari browser atau isi notifikasi.
- Halaman cek status hanya menampilkan informasi yang aman dan tidak membocorkan data pribadi pelanggan.
- Setiap file produksi harus terhubung ke pesanan yang tepat; revisi dibedakan versinya.
- DXF hanya dapat dibuat admin untuk item yang sudah dibayar lunas dan pesanan diterima; unduhan memerlukan autentikasi admin.

## 5. Kebutuhan kualitas

- **Keamanan dan privasi:** batasi data publik, validasi input di backend, dan lindungi akses admin.
- **Keandalan:** tangani timeout dan kegagalan jaringan secara wajar; uji API pada Wi-Fi dan jaringan seluler.
- **Kinerja dan aksesibilitas:** halaman nyaman digunakan di ponsel, gambar dioptimalkan, dan struktur HTML jelas.
- **SEO:** halaman produk memiliki URL stabil, konten yang dapat ditemukan, serta metadata yang sesuai.
- **Kemudahan pemeliharaan:** perubahan dicatat dan dokumentasi diperbarui mengikuti keputusan serta implementasi.
- **Pemulihan data:** siapkan backup dan uji pemulihan database sebelum peluncuran.

## 6. Batasan dan keputusan arsitektur awal

- GitHub Pages direncanakan untuk frontend publik.
- Cloudflare Workers menjadi backend utama dan Cloudflare D1 menjadi sumber data utama.
- ImageKit digunakan untuk media produk dan bukti pembayaran privat.
- Android menjadi aplikasi admin utama pada tahap awal; dashboard admin web tidak direncanakan.
- Netlify hanya dipertimbangkan sebagai jalur API tambahan bila ada kebutuhan dan hasil pengujian mendukungnya.
- Google Sheets bukan database transaksi; FCM hanya untuk notifikasi.

## 7. Belum diputuskan

- Nama toko, domain, identitas visual, daftar produk awal, harga, dan foto asli.
- Nomor rekening dan nama pemilik rekening; pembayaran awal mengikuti transfer manual.
- Berat aktual tiap produk dan aturan kurir lokal.
- Login/role admin individual. MVP lokal menggunakan `ADMIN_TOKEN` Worker bersama; pengelolaan akun dan hak akses per admin belum ditetapkan.
- Refund diperbolehkan sebelum produksi dimulai; setelah produksi berjalan tidak ada pengembalian dana. Pelanggan mengajukan pembatalan dari halaman lacak; permintaan muncul di tab refund Android. Admin mengirim refund terlebih dahulu, lalu menekan “Proses” agar status tampil di web. Setelah produksi dimulai, pelanggan diarahkan ke chat. Retensi kedaluwarsa pembayaran: pesanan tanpa bukti dihapus setelah 24 jam; pesanan dengan bukti menunggu admin.
- Refund hanya dikirim ke rekening asal pengirim pembayaran, bukan rekening alternatif. Target penyelesaian maksimal 3 × 24 jam (72 jam) setelah admin menyetujui permintaan.
- Spesifikasi mesin/CAM, bahan, toleransi, kompensasi alat, font/konversi teks menjadi kurva, dan uji kompatibilitas DXF untuk produksi nyata.
- Detail biaya layanan serta kebutuhan kapasitas saat peluncuran.

Hal-hal di atas perlu diputuskan sebelum membangun fitur yang bergantung padanya. Perbarui dokumen ini ketika ada keputusan baru.
