# Jalur API Cloudflare dengan fallback Netlify

Situs menghubungi Cloudflare Worker secara langsung terlebih dahulu. Jika koneksi
gagal atau Worker mengembalikan 502, 503, atau 504, klien mencoba Netlify Function
sebagai jalur cadangan. Ini mengurangi pemakaian Netlify saat Cloudflare dapat
dijangkau, sambil mempertahankan jalur alternatif untuk jaringan seluler tertentu.
D1, secret RajaOngkir, dan ImageKit tetap berada di Cloudflare.

## Pengaturan Netlify

Hubungkan repo ini sebagai situs Netlify dengan base directory root repo. File
`netlify.toml` sudah menunjuk publish directory `netlify/public` dan fungsi
`netlify/functions`.

URL Worker sudah memiliki nilai default di fungsi. Jika alamat Worker berubah, atur
`CLOUDFLARE_WORKER_URL` dengan scope **Functions** di Netlify, lalu deploy ulang:

Untuk menjaga batas request tetap per-pengunjung, buat secret acak minimal 32
karakter dan simpan sebagai `NETLIFY_PROXY_SECRET` di Netlify serta Cloudflare Worker.
Worker akan mempercayai alamat IP dari Netlify hanya jika secret yang diteruskan cocok;
request langsung tetap menggunakan alamat IP Cloudflare. Pasang di Worker dengan
`npx wrangler secret put NETLIFY_PROXY_SECRET --env production` lalu deploy ulang.
Masukkan nilainya saat Wrangler meminta input; jangan menaruh nilainya di argumen,
chat, atau repository. Tanpa secret ini, proxy tetap dapat meneruskan request, tetapi
rate limit Worker memakai alamat egress Netlify yang bisa dipakai bersama.

Pastikan `ALLOWED_ORIGINS` Worker tetap memuat origin toko, saat ini
`https://zieus.gt.tc`.

## Urutan koneksi klien

`frontend/src/data/site.json` menyimpan `apiBaseUrl` Cloudflare sebagai jalur utama
dan `apiFallbackUrl` Netlify sebagai cadangan. Workflow GitHub Actions menetapkan
keduanya secara eksplisit. Fallback otomatis berlaku untuk GET, pencarian status,
kutipan ongkir, permintaan refund, dan pembuatan pesanan yang memakai
`Idempotency-Key`. Unggahan bukti pembayaran tidak diulang otomatis untuk mencegah
unggahan ganda. Setelah kegagalan koneksi Cloudflare, tab yang sama memakai Netlify
selama 30 detik sebelum mencoba Cloudflare lagi.

Android admin juga memakai Cloudflare sebagai jalur utama dan Netlify sebagai
cadangan untuk permintaan baca. Aksi tulis dan unggahan Android tidak dicoba ulang
otomatis agar tidak menggandakan perubahan.

## Catatan unggah bukti

Netlify membatasi ukuran request Function. Bukti pembayaran saat ini boleh sampai
5 MB; file di sekitar batas itu perlu dicoba melalui proxy Netlify karena batas
payload efektif dapat lebih kecil daripada batas upload Worker.
