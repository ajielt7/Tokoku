# Laporan GA4 dan Cloudflare di aplikasi admin Android

## Status implementasi lokal

- Aplikasi admin Android meminta laporan saat halaman **Pengunjung** dibuka, saat rentang waktu diubah, atau saat **Muat ulang** ditekan. Respons hanya berada di memori halaman; laporan tidak ditulis ke SQLite, SharedPreferences, atau file.
- Endpoint `GET /api/admin/analytics/report?period=day|week|month|year` sudah ditambahkan di Cloudflare Worker dan dilindungi `Authorization: Bearer <ADMIN_TOKEN>`.
- GA4 memakai Google Analytics Data API melalui service account. Backend mengambil metrik pengguna aktif, sesi, tampilan halaman, tren sesuai rentang, dan pengguna per negara. Waktu laporan menggunakan Asia/Jakarta.
- Cloudflare menampilkan request dan error untuk Worker `ruma-api-production` sebagai kartu terpisah. Ini bukan jumlah pengunjung situs, dan angka ini tidak digabungkan dengan GA4.
- Android masih memakai URL API Netlify yang sudah ada. Proxy meneruskan request ke Worker; perubahan ini tidak memerlukan Netlify build untuk memperoleh laporan, tetapi perubahan frontend/backend yang lain tetap mengikuti pipeline proyek.

## Persiapan kredensial yang masih diperlukan

Kode siap menerima konfigurasi berikut melalui Cloudflare Worker secrets/vars. Nilainya tidak boleh disimpan di repo, APK, atau `.dev.vars`.

1. `GA4_PROPERTY_ID` — ID numerik properti GA4 (bukan ID akun Windsor dan bukan Measurement ID `G-...`). Atur sebagai production Worker var. Tambahkan service account sebagai **Viewer** di properti GA4 dan aktifkan Google Analytics Data API di Google Cloud project service account tersebut. Pastikan zona waktu pelaporan properti GA4 adalah Asia/Jakarta agar batas hari cocok dengan label laporan.
2. `GA4_SERVICE_ACCOUNT_EMAIL` dan `GA4_SERVICE_ACCOUNT_PRIVATE_KEY` — identitas dan private key service account. Private key disimpan sebagai secret Worker; format baris baru PEM diterima.
3. `CLOUDFLARE_ANALYTICS_API_TOKEN` — token Cloudflare dengan izin baca Analytics untuk query GraphQL akun. Simpan sebagai Worker secret. Jangan gunakan token deployment yang tidak memiliki izin Analytics Read.
4. `CLOUDFLARE_ACCOUNT_ID` dan `CLOUDFLARE_WORKER_NAME` sudah ditambahkan sebagai production Worker vars.

Setelah secrets dan vars dipasang, endpoint siap membaca data. Saat konfigurasi provider belum ada atau provider gagal, API tetap mengembalikan laporan parsial dan Android menunjukkan status provider yang belum tersedia.

## Batas data Cloudflare

Domain `zieus.gt.tc` tidak berada sebagai zone pada akun Cloudflare yang terhubung. Karena itu akun tersebut tidak bisa memberikan Cloudflare HTTP Analytics dan peta negara untuk seluruh pengunjung domain. Worker GraphQL hanya menunjukkan penggunaan API yang melewati Worker. Pengunjung/negara situs tetap dihitung oleh GA4. Untuk laporan Cloudflare HTTP per negara, domain perlu memakai Cloudflare sebagai DNS/proxy zone atau dipasang Cloudflare Web Analytics; itu adalah perubahan infrastruktur dan belum dilakukan.

Koneksi Windsor.ai GA4 di ChatGPT sudah terdeteksi untuk akun bernama `zieus-61c10`, tetapi laporan 7 hari terakhir dari konektor tersebut saat pemeriksaan kosong. Koneksi aplikasi ChatGPT tidak dapat digunakan sebagai kredensial backend. Service account GA4 diperlukan agar Android dapat memuat laporan server-side.

## Belum dilakukan

- Belum memasang secret/ID provider karena kredensial Google Analytics dan token Analytics Cloudflare tidak tersedia di repo dan rahasia yang ada tidak dibaca atau disalin.
- Belum deploy/push. Setelah secrets disiapkan dan kredit Netlify kembali, perubahan dapat dipush. Perlu diingat statistik Android memanggil Worker melalui API yang sudah ada; dashboard ini sendiri tidak memerlukan Netlify build baru.
