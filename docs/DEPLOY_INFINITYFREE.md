# Deploy ke InfinityFree

Frontend tetap berupa HTML, CSS, dan vanilla JavaScript statis. Backend pesanan, katalog, ongkir, dan bukti pembayaran tetap memakai Cloudflare Workers, D1, dan ImageKit.

## Pengaturan GitHub

Di `Settings → Secrets and variables → Actions`, tambahkan repository secrets berikut dari bagian FTP Details akun InfinityFree:

- `INFINITYFREE_FTP_SERVER`
- `INFINITYFREE_FTP_USERNAME`
- `INFINITYFREE_FTP_PASSWORD`
- `CLOUDFLARE_API_TOKEN` dengan izin mengedit Worker untuk akun terkait

Aktifkan deploy otomatis dengan repository variable `INFINITYFREE_DEPLOY_ENABLED=true`. Domain `zieus.gt.tc` memakai document root `zieus.gt.tc/htdocs/` sesuai panel InfinityFree. Pastikan direktori tersebut sudah dibuat sebelum deploy. Workflow FTP menggunakan FTPS eksplisit port 21.

## Rilis frontend

Workflow `Build and deploy InfinityFree site` membangun situs dari katalog API produksi. Sebelum `INFINITYFREE_DEPLOY_ENABLED` diaktifkan, workflow hanya menghasilkan artifact `zieus-infinityfree-site` agar file dapat diunduh dan ditinjau.

Setelah secret FTP terpasang dan deploy diaktifkan, perubahan di `frontend/` pada branch `main` akan membangun ulang dan mengunggah situs. Workflow menerbitkan halaman publik `https://zieus.gt.tc` dengan indeks aktif dan sitemap. Keranjang, checkout, dan pelacakan pesanan tetap `noindex` serta tidak dimasukkan ke sitemap. Foto katalog masih ilustrasi Unsplash; ganti dengan foto produk asli dan tinjau informasi toko sebelum mengandalkan listing produk untuk pelanggan.

## Izin API untuk origin baru

Konfigurasi production Worker disiapkan untuk mengizinkan origin `https://zieus.gt.tc`. Untuk menerapkan perubahan ini, jalankan workflow `Deploy Cloudflare API production` setelah secret `CLOUDFLARE_API_TOKEN` tersedia dan subdomain telah aktif. Workflow tidak menjalankan migrasi D1.

Alamat situs perlu sudah aktif dengan HTTPS sebelum pelanggan mengirim checkout. Origin HTTP tidak termasuk daftar izin API.
