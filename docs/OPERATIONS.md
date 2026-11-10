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

### Status dan persiapan backup saat ini

Pemeriksaan baca-saja pada 9 November 2026 menemukan 0 baris pada tabel kategori, produk, pesanan, pembayaran, pengiriman, file, riwayat status, dan perangkat admin di D1 production. Percobaan ekspor belum menghasilkan file: sesi Wrangler memerlukan scope `d1:write`, dan tujuan penyimpanan terenkripsi belum disetujui. Jangan menambahkan scope atau menjalankan ekspor sampai pemilik menyetujuinya. Ekspor awal dapat memakai `--no-data` untuk menyimpan skema saja; sebelum transaksi nyata, ekspor penuh harus disimpan pada tujuan terenkripsi yang dapat dipulihkan.

Jangan menganggap folder lokal otomatis terenkripsi. Status BitLocker pada perangkat ini belum dapat diverifikasi dari sesi non-admin. Perlindungan DPAPI `CurrentUser` hanya dapat dibuka oleh profil Windows yang membuatnya dan bukan cadangan luar perangkat; gunakan hanya sebagai salinan lokal tambahan, lalu siapkan salinan terenkripsi kedua sebelum ada data pelanggan.

## Verifikasi ImageKit sebelum menerima bukti

Validasi read-only API daftar berkas pada 9 November 2026 merespons HTTP 403. Jangan mengulang request atau mengunggah bukti sebelum pemilik memeriksa akun dan key.

1. Masuk ke Dashboard ImageKit dan pastikan akun aktif, paket tetap **Forever Free**, serta pemakaian bandwidth dan penyimpanan belum melewati batas paket.
2. Buka bagian **Developer / API Keys** dan pastikan private key yang dipakai masih aktif. Jangan menempelkan key ke chat, Git, tangkapan layar, atau log.
3. Jika key perlu diganti, perbarui Worker secret `IMAGEKIT_PRIVATE_KEY` melalui Wrangler saat pemilik siap; jangan masukkan key ke frontend atau file terlacak.
4. Setelah itu minta persetujuan pemilik untuk satu validasi GET read-only. HTTP 200 mengonfirmasi autentikasi API; 401/403 berarti hentikan uji bukti dan periksa status akun/key lagi.
5. Jangan mengaktifkan upload bukti pembayaran sampai validasi lolos dan alur upload/penghapusan sudah diuji secara end-to-end.

## Titik pemulihan D1

Sebelum tindakan tulis besar atau migrasi, catat bookmark/time-travel yang tersedia:

```powershell
npx wrangler d1 time-travel info ruma-store
```

Jangan pulihkan bookmark ke database produksi sebagai latihan. Saat tersedia target staging yang aman, pulihkan bookmark di sana sesuai panduan Cloudflare dan pastikan data yang diharapkan ada. Simulasi lokal yang sudah lulus tidak menggantikan pemulihan D1 cloud. Pemulihan Time Travel menimpa database target; jangan jalankan perintah restore pada produksi sebagai uji coba. Setelah pemulihan staging, panggil health/catalog dan periksa migrasi serta jumlah baris.

Jika produksi perlu dipulihkan, hentikan sementara checkout, ekspor kondisi saat ini, tentukan titik waktu bersama pemilik data, pulihkan sesuai panduan resmi, verifikasi transaksi, lalu aktifkan kembali checkout. Simpan bookmark sebelum restore agar pemulihan dapat dibatalkan bila titik waktu keliru.

## Rilis dan rollback aplikasi

Rollback aplikasi mengembalikan versi kode, bukan isi D1. Hentikan checkout lebih dulu, pastikan penyebab insiden dan versi target, lalu uji endpoint baca setelah rollback. Jangan rollback melewati migrasi D1 yang membuat kode lama tidak kompatibel.

## Rencana uji toko bertahap

Rencana ini belum memberi izin untuk membuka checkout atau melakukan transaksi. Mulai hanya setelah katalog, rekening, ongkir, kebijakan, dan validasi ImageKit siap serta pemilik menyetujui biaya barang/ongkir yang mungkin timbul.

1. **Kelompok awal:** pemilik sebagai admin dan paling banyak dua orang tepercaya sebagai pembeli uji. Jangan mengundang pelanggan umum atau memakai data pelanggan lain.
2. **Cakupan:** satu order bernilai rendah dari katalog final; hitung ongkir ke tujuan uji yang disetujui; periksa ringkasan, total server, instruksi transfer manual, unggah bukti privat, tindakan admin, status order, notifikasi, dan informasi resi bila pengiriman diuji.
3. **Kriteria lulus:** harga/ongkir pada server cocok dengan sumbernya; order tidak terduplikasi; bukti hanya bisa dilihat admin berwenang; status dan notifikasi sesuai tindakan; pembeli melihat informasi yang benar; tidak ada secret atau data pribadi pada log.
4. **Hentikan uji segera** jika jumlah berubah tanpa penjelasan, ongkir tidak cocok, order ganda, bukti dapat diakses publik, akses admin salah, data pribadi masuk log, notifikasi/status keliru, atau muncul biaya yang belum disetujui.
5. Setelah satu order uji, hentikan pembuatan order baru. Catat hasil tanpa menyimpan rekening, alamat lengkap, nomor telepon, token, atau isi bukti; perbaiki temuan dan minta tinjauan pemilik sebelum uji berikutnya atau pembukaan toko.

Gunakan checklist bagian C dan E.4 sebagai catatan hasil. Pengujian ini belum dilakukan; rencana hanya menjadi prosedur awal.

### Simulasi pembayaran dan refund tanpa uang sungguhan

Simulasi berjalan hanya pada Wrangler lokal dan D1 lokal dengan data contoh. Jangan memakai `--remote`, D1 production, rekening toko untuk transfer uji, atau mengunggah file ke ImageKit production. Skrip menghapus database dan file lingkungan sementaranya setelah selesai. Pengujian manual berbasis uang sungguhan adalah langkah terpisah yang baru dipertimbangkan menjelang rilis.

Jalankan skenario yang sudah diotomasi dari folder `backend/` dengan `npm run test:payments` (membutuhkan Node.js 22+ dan dependensi hasil `npm ci`). Skrip mengunci Worker ke environment `test`, D1 lokal sementara, katalog contoh, dan penyimpanan bukti tiruan. Jangan menambahkan `--remote`, memakai rekening sungguhan, atau mengirim bukti ke ImageKit production.

Urutan skenario:

1. **Checkout transfer:** order lokal tercatat `pending`, nominal dan kode pembayaran dihitung server, pembayaran kedaluwarsa setelah 24 jam, dan order tanpa bukti masuk antrean hapus. Uji waktu kedaluwarsa dengan jam/data simulasi, bukan menunggu atau mengubah jam komputer.
2. **Bukti valid:** file contoh lolos validasi format dan ukuran, tercatat sebagai bukti privat, dan order tampil di antrean admin. Sampai ImageKit lolos validasi, skenario ini harus memakai penyimpanan tiruan yang hanya tersedia di test lokal.
3. **Pembayaran disetujui:** hanya admin terautentikasi yang dapat menyetujui bukti; status menjadi lunas, status terlihat di tracking, dan pesanan baru dapat masuk proses.
4. **Bukti ditolak:** bukti tiruan dihapus, status penolakan tersimpan, percobaan unggah kedua ditolak, dan pelanggan mendapat arahan untuk chat.
5. **Refund sebelum produksi:** pelanggan meminta pembatalan pada order lunas yang belum diproduksi; permintaan muncul di antrean admin. Setelah admin mencatat pengembalian manual ke rekening asal, admin menekan “Proses”; status web berubah menjadi dibatalkan/refund.
6. **Batas refund:** permintaan setelah produksi dimulai ditolak dan halaman mengarahkan ke chat. Admin tidak dapat menandai refund selesai sebelum ada konfirmasi transfer manual.
7. **Batas waktu dan privasi:** periksa target refund 72 jam sejak persetujuan, pemeriksaan bukti maksimal 24 jam, autentikasi semua tindakan admin, serta tidak ada rekening, bukti, alamat, nomor telepon, atau token dalam log.

**Batas verifikasi:** simulasi lokal memvalidasi alur backend dan D1 dengan bukti tiruan. Simulasi tidak memvalidasi ImageKit, transfer bank, ongkir live RajaOngkir, atau notifikasi FCM. ImageKit pernah membalas HTTP 403; unggah production tetap ditunda sampai konfigurasi akun diperiksa dan validasi layanan dilakukan menjelang rilis.

**Hasil verifikasi terakhir:** simulasi pembayaran/refund dan compile Java aplikasi Android admin lulus pada GitHub Actions, commit `1768461`. Simulasi mencakup checkout, bukti tiruan, review admin, refund, larangan refund setelah produksi, serta cleanup/retensi order. Mesin lokal Node.js 20.13.1 belum dapat menjalankan Wrangler yang mensyaratkan Node.js 22+; Android compile dijalankan dengan Java 17 dan Android SDK 36.

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
