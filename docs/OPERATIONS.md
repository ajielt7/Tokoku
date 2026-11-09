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

## Rilis dan rollback aplikasi

Rollback aplikasi mengembalikan versi kode, bukan isi D1. Hentikan checkout lebih dulu, pastikan penyebab insiden dan versi target, lalu uji endpoint baca setelah rollback. Jangan rollback melewati migrasi D1 yang membuat kode lama tidak kompatibel.

### Cloudflare Worker

Versi Worker production yang aktif per 9 November 2026 adalah `df440313-c47f-4594-a0df-6d3a175b3c50`. Versi tepat sebelumnya adalah `d23b36d7-2e60-4f25-9523-78551eb01c68`; verifikasi daftar versi lagi sebelum menggunakannya. Jalankan dari folder `backend/` dengan Wrangler lokal:

```powershell
nvm use 23.9.0
npx wrangler versions list --env production
npx wrangler rollback d23b36d7-2e60-4f25-9523-78551eb01c68 --env production --message "Rollback after production incident"
```

Perintah `rollback` langsung membuat deployment baru yang mengarahkan traffic ke versi pilihan. Setelah itu periksa daftar deployment, `GET /api/catalog`, GET admin, dan kecocokan binding sebelum membuka checkout. Worker rollback tidak mengubah D1; perubahan schema atau data perlu prosedur pemulihan D1 terpisah. Lihat [Cloudflare Worker rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/) dan [Wrangler rollback command](https://developers.cloudflare.com/workers/wrangler/commands/workers/#rollback).

### GitHub Pages

Pages memakai GitHub Actions, bukan Cloudflare Pages. Rilis demo terakhir yang berhasil dibangun memakai commit `60b5e6f9e4649cc3d83bd62c5210c55cf68b0785` (workflow run `42576560129`). Untuk mengembalikan situs, buat commit baru yang mengembalikan hanya sumber `frontend/` ke rilis yang sehat, push ke `main`, jalankan workflow **Build and deploy store**, lalu cek URL Pages, `noindex`, dan subpath `/Tokoku/`. Jangan force-push branch.

Artifact `github-pages` dari run tersebut memiliki ID `13655227226` dan masa simpan sampai 10 November 2026 pukul 14.00 WIB. Salinannya sudah disimpan di `%LOCALAPPDATA%\Ruma\release-archive\github-pages-demo-60b5e6f.zip` (21.735 byte; SHA-256 `720A2D7ECC9061575AA2E9E7A03D83C7B7F75123F3D47FC17017433CACFAC37D`). Artifact Actions asli bersifat sementara; riwayat Git tetap menjadi sumber untuk membangun ulang situs. Lihat [GitHub Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Insiden rahasia atau akun

- Cabut/ganti secret Worker atau token admin yang diduga bocor; jangan menyalin nilai rahasia ke laporan insiden.
- Jika token admin bersama diganti, masukkan token baru ke perangkat admin yang sah dan pastikan akses lama ditolak.
- Jika akun ImageKit atau Firebase terdampak, rotasi key/service account dan periksa akses file/token perangkat.
- Catat waktu kejadian, endpoint terdampak, tindakan, dan hasil dengan metadata minimum. Hapus token, bukti, alamat, dan nomor telepon dari log/tiket.

## Referensi resmi

- [D1 Time Travel dan pemulihan](https://developers.cloudflare.com/d1/reference/time-travel/) (retensi 30 hari; selalu aktif; tanpa biaya tambahan, diperiksa 9 November 2026)
- [Ekspor dan impor D1](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
