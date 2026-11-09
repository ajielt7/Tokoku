# Operasional dan Pemulihan Data

Panduan ini berlaku untuk D1 production `ruma-store` yang telah dibuat dan dimigrasikan. Database saat ini masih kosong dan belum digunakan untuk transaksi. Database lokal Wrangler bukan cadangan produksi. Jangan masukkan dump, token, data pesanan, atau bukti pembayaran ke Git.

## Sebelum ada pesanan nyata

1. Buat database staging dan produksi yang terpisah; pastikan `backend/wrangler.jsonc` menunjuk ke target yang tepat.
2. Terapkan migrasi secara berurutan dan catat nama/ID database, waktu, dan hasil migrasi di password manager atau catatan operasional privat.
3. Pastikan database memakai storage D1 production yang mendukung Time Travel. Retensi bergantung pada plan Cloudflare; halaman D1 saat ini menyatakan hingga 7 hari pada Workers Free dan 30 hari pada Workers Paid.
4. Tentukan frekuensi ekspor SQL tambahan dan lokasi simpan terenkripsi. Ekspor dapat berisi nama, nomor telepon, alamat, serta metadata transaksi.
5. Tentukan cara mempertahankan file bukti di ImageKit secara terpisah. D1 hanya memuat referensi file; pemulihan D1 saja tidak mengembalikan berkas ImageKit.
6. Uji pemulihan ke database staging terlebih dahulu, bukan langsung ke produksi.

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

Untuk latihan, pulihkan bookmark ke database staging sesuai panduan Cloudflare dan pastikan data yang diharapkan ada. Pemulihan Time Travel menimpa database target; jangan jalankan perintah restore pada produksi sebagai uji coba. Setelah pemulihan staging, panggil health/catalog, periksa migrasi dan jumlah baris, lalu minta admin meninjau data sampel.

Jika produksi perlu dipulihkan, hentikan sementara checkout, ekspor kondisi saat ini, tentukan titik waktu bersama pemilik data, pulihkan sesuai panduan resmi, verifikasi transaksi, lalu aktifkan kembali checkout. Simpan bookmark sebelum restore agar pemulihan dapat dibatalkan bila titik waktu keliru.

## Insiden rahasia atau akun

- Cabut/ganti secret Worker atau token admin yang diduga bocor; jangan menyalin nilai rahasia ke laporan insiden.
- Jika token admin bersama diganti, masukkan token baru ke perangkat admin yang sah dan pastikan akses lama ditolak.
- Jika akun ImageKit atau Firebase terdampak, rotasi key/service account dan periksa akses file/token perangkat.
- Catat waktu kejadian, endpoint terdampak, tindakan, dan hasil dengan metadata minimum. Hapus token, bukti, alamat, dan nomor telepon dari log/tiket.

## Referensi resmi

- [D1 Time Travel dan pemulihan](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Ekspor dan impor D1](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
