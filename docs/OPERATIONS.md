# Operasional dan Pemulihan Data

Panduan ini berlaku untuk D1 production `ruma-store` yang telah dibuat dan dimigrasikan. Database saat ini masih kosong dan belum digunakan untuk transaksi. Database lokal Wrangler bukan cadangan produksi. Jangan masukkan dump, token, data pesanan, atau bukti pembayaran ke Git.

## Sebelum ada pesanan nyata

1. D1 produksi `ruma-store` sudah disiapkan dan masih kosong; tidak ada D1 staging cloud agar tidak menambah resource yang berpotensi biaya. Simulasi backup/restore SQLite lokal lulus, sedangkan pemulihan cloud belum diuji. Time Travel D1 aktif otomatis (30 hari, tanpa biaya tambahan menurut dokumentasi Cloudflare).
2. Terapkan migrasi secara berurutan dan catat nama/ID database, waktu, dan hasil migrasi di password manager atau catatan operasional privat.
3. D1 `ruma-store` terverifikasi memakai `version: production` dan API mengembalikan bookmark Time Travel saat ini. Dokumentasi Cloudflare menyatakan Time Travel selalu aktif, dapat memulihkan database ke menit dalam 30 hari terakhir, dan tidak menambah biaya. Ini bukan ekspor mandiri dan tidak melindungi dari hilangnya akses akun.
4. Tentukan frekuensi ekspor SQL tambahan dan lokasi simpan terenkripsi. Ekspor dapat berisi nama, nomor telepon, alamat, serta metadata transaksi.
5. Tentukan cara mempertahankan file bukti di ImageKit secara terpisah. D1 hanya memuat referensi file; pemulihan D1 saja tidak mengembalikan berkas ImageKit.
6. Sebelum transaksi nyata, lakukan ekspor D1 produksi dan simpan secara terenkripsi di luar repositori. Jangan uji restore ke produksi. Latihan lokal hanya memverifikasi skema SQLite; latihan pemulihan cloud memerlukan target terpisah yang aman.

## Ekspor manual

Jalankan dari `backend/` setelah memeriksa kembali nama dan target database:

```powershell
npx wrangler d1 info ruma-store
npx wrangler d1 export ruma-store --remote --output="C:\secure-backups\ruma-store-YYYY-MM-DD.sql"
```

Ganti folder dengan lokasi terenkripsi yang aksesnya dibatasi. Jangan gunakan folder repo, `frontend/dist`, folder sinkronisasi publik, atau lampiran chat/email untuk dump pelanggan. Setelah ekspor, catat ukuran file dan hasil checksum pada catatan privat; jangan tulis data SQL ke log CI.

## Titik pemulihan D1

Sebelum tindakan tulis besar atau migrasi, catat bookmark/time-travel yang tersedia:

```powershell
npx wrangler d1 time-travel info ruma-store
```

Jangan pulihkan bookmark ke database produksi sebagai latihan. Saat tersedia target staging yang aman, pulihkan bookmark di sana sesuai panduan Cloudflare dan pastikan data yang diharapkan ada. Simulasi lokal yang sudah lulus tidak menggantikan pemulihan D1 cloud. Pemulihan Time Travel menimpa database target; jangan jalankan perintah restore pada produksi sebagai uji coba. Setelah pemulihan staging, panggil health/catalog dan periksa migrasi serta jumlah baris.

Jika produksi perlu dipulihkan, hentikan sementara checkout, ekspor kondisi saat ini, tentukan titik waktu bersama pemilik data, pulihkan sesuai panduan resmi, verifikasi transaksi, lalu aktifkan kembali checkout. Simpan bookmark sebelum restore agar pemulihan dapat dibatalkan bila titik waktu keliru.

## Insiden rahasia atau akun

- Cabut/ganti secret Worker atau token admin yang diduga bocor; jangan menyalin nilai rahasia ke laporan insiden.
- Jika token admin bersama diganti, masukkan token baru ke perangkat admin yang sah dan pastikan akses lama ditolak.
- Jika akun ImageKit atau Firebase terdampak, rotasi key/service account dan periksa akses file/token perangkat.
- Catat waktu kejadian, endpoint terdampak, tindakan, dan hasil dengan metadata minimum. Hapus token, bukti, alamat, dan nomor telepon dari log/tiket.

## Referensi resmi

- [D1 Time Travel dan pemulihan](https://developers.cloudflare.com/d1/reference/time-travel/) (retensi 30 hari; selalu aktif; tanpa biaya tambahan, diperiksa 9 November 2026)
- [Ekspor dan impor D1](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
