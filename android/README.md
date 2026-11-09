# Ruma Admin Android

Aplikasi Android admin untuk mencari dan meninjau pesanan, melihat bukti transfer privat, memeriksa pembayaran, dan memperbarui status pesanan serta produksi. Aplikasi memakai Android SDK dan Java bawaan platform; tidak ada token admin yang ditanam di APK atau disimpan permanen.

## Menjalankan aplikasi

1. Buka folder `android/` di Android Studio dan tunggu Gradle Sync selesai. Project memakai Gradle 9.3.1, Android Gradle Plugin 9.1.0, Java 17, dan Android SDK 36.
2. Jalankan backend lokal dengan D1 lokal yang sudah dimigrasikan. Untuk akses lokal, siapkan `ADMIN_TOKEN` di `backend/.dev.vars`; token harus acak minimal 32 karakter. Untuk FCM, tambahkan `android/app/google-services.json` dari aplikasi Firebase ber-ID `id.ruma.admin` dan isi secret Worker seperti di panduan backend.
3. Pilih emulator Android. Alamat API awal di aplikasi ialah `http://10.0.2.2:8787`, yang meneruskan ke komputer host emulator. Masukkan token admin di layar masuk.
4. Untuk server publik, gunakan alamat HTTPS. Aplikasi menolak HTTP selain `localhost`, `127.0.0.1`, dan alamat host emulator `10.0.2.2`.

## Fitur

- Daftar 100 pesanan terbaru, filter status pesanan/pembayaran, dan pencarian kode pesanan/nama pelanggan.
- Detail kontak, alamat, produk, custom, ongkir, pembayaran, dan riwayat status.
- Label personalisasi dan versi template dibaca dari snapshot pesanan.
- Buat gambar DXF 2D berversi untuk item pesanan yang sudah lunas dan diterima, lalu simpan file melalui pemilih dokumen Android. Koordinat DXF dihitung dalam mm pada layer OUTLINE/ENGRAVE; karena format R12 tidak menyimpan metadata satuan, pilih skala 1 unit = 1 mm saat impor. Pemeriksaan font dan pembuatan toolpath tetap dilakukan di CAD/CAM.
- Tampilan bukti ImageKit melalui URL bertanda tangan yang hanya diminta saat admin membuka bukti.
- Setujui/tolak pembayaran dengan konfirmasi dan catatan admin.
- Perbarui status pesanan dan produksi. Backend memvalidasi urutan perubahan serta menulis riwayat secara transaksional.
- Catat kurir, resi, tautan HTTPS, dan status pengiriman. Pengiriman hanya dibuka setelah pesanan lunas dan produksi selesai.
- Terima notifikasi FCM saat pesanan baru masuk. Token perangkat terdaftar saat admin login dan dilepas saat logout.
- Muat ulang data dan tampilkan pesan ketika koneksi/API gagal.

Status pesanan yang didukung: baru → diterima → selesai. Status produksi: menunggu → diproses → selesai. Status kirim: menunggu → dikirim → diterima, atau bermasalah/dikembalikan. Pembatalan tersedia sebelum pembayaran lunas dan meminta alasan. Pembatalan pesanan lunas ditolak sampai kebijakan refund ditetapkan. FCM memerlukan Firebase Android config dan secret Worker.

## Endpoint yang dipakai

Semua endpoint admin memakai header `Authorization: Bearer <ADMIN_TOKEN>`:

- `GET /api/admin/orders?limit=100&order_status=new&payment_status=pending&q=...`
- `GET /api/admin/orders/:code`
- `POST /api/admin/orders/:code/status`
- `POST /api/admin/orders/:code/shipment`
- `POST /api/admin/devices` dan `/api/admin/devices/remove`
- `GET /api/admin/payments/:reference/proof`
- `POST /api/admin/payments/:reference/review`
- `POST /api/admin/orders/:code/items/:itemId/production-files/dxf`
- `GET /api/admin/orders/:code/production-files/:fileId`

Detail kontrak dan validasi backend ada di [panduan backend](../backend/README.md). Pelanggan dapat melacak pesanan di halaman `/lacak-pesanan/` menggunakan kode pesanan dan nomor telepon checkout.
