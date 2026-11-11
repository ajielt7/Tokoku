# Deploy ke InfinityFree

Frontend tetap berupa HTML, CSS, dan vanilla JavaScript statis. Backend pesanan, katalog, ongkir, dan bukti pembayaran tetap memakai Cloudflare Workers, D1, dan ImageKit.

## Pengaturan GitHub

Di `Settings → Secrets and variables → Actions`, tambahkan repository secrets berikut dari bagian FTP Details akun InfinityFree:

- `INFINITYFREE_FTP_SERVER`
- `INFINITYFREE_FTP_USERNAME`
- `INFINITYFREE_FTP_PASSWORD`
- `CLOUDFLARE_API_TOKEN` dengan izin mengedit Worker untuk akun terkait

Aktifkan deploy otomatis dengan repository variable `INFINITYFREE_DEPLOY_ENABLED=true`. Workflow FTP menggunakan FTPS eksplisit port 21 dan mengunggah hasil build ke `htdocs/`.

## Rilis frontend

Workflow `Build and deploy InfinityFree site` membangun situs dari katalog API produksi. Sebelum `INFINITYFREE_DEPLOY_ENABLED` diaktifkan, workflow hanya menghasilkan artifact `toqoku-infinityfree-site` agar file dapat diunduh dan ditinjau.

Setelah secret FTP terpasang dan deploy diaktifkan, perubahan di `frontend/` pada branch `main` akan membangun ulang dan mengunggah situs. Workflow menargetkan `https://toqoku.gt.tc` dan menjaga halaman tetap `noindex` selama foto produk masih berupa ilustrasi Unsplash.

## Izin API untuk origin baru

Konfigurasi production Worker mengizinkan origin `https://toqoku.gt.tc`. Untuk menerapkan perubahan ini, jalankan workflow `Deploy Cloudflare API production` setelah secret `CLOUDFLARE_API_TOKEN` tersedia. Workflow tidak menjalankan migrasi D1.

Alamat situs perlu sudah aktif dengan HTTPS sebelum pelanggan mengirim checkout. Origin HTTP tidak termasuk daftar izin API.
