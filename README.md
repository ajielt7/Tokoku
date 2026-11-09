# Toko Online

Proyek toko online mandiri untuk menjual produk, termasuk produk custom berbasis template. Pengembangan dilakukan bertahap agar fondasi toko, pengelolaan pesanan, dan proses produksi dapat diuji sebelum fitur yang lebih kompleks ditambahkan.

## Status proyek

Tahap 12 sedang dikerjakan. Pratinjau demo `noindex` sudah tayang di GitHub Pages dan Worker production aktif. API katalog dan pencarian tujuan RajaOngkir merespons HTTP 200; admin GET juga berhasil. Secret `ADMIN_TOKEN`, `RAJAONGKIR_API_KEY`, dan `IMAGEKIT_PRIVATE_KEY` sudah terpasang di Worker. Validasi ImageKit read-only mengembalikan HTTP 403, jadi key/izin belum tervalidasi. D1 production `ruma-store` di APAC memiliki migrasi 0001–0008 tanpa seed demo; katalog masih kosong. Toko belum siap menerima pesanan: data produk, rekening, dan kebijakan belum final, serta upload bukti ImageKit belum diuji end-to-end.

Tahap 8 sampai 11 selesai di kode lokal. Tahap 11 menambahkan preview personalisasi, snapshot konfigurasi pada pesanan, serta gambar DXF dasar berversi yang dapat dibuat dan disimpan melalui aplikasi admin Android. Koordinat gambar dihitung dalam mm; DXF R12 tidak mencatat metadata satuan, jadi saat impor pilih skala 1 unit = 1 mm. File ini gambar CAD 2D, bukan toolpath siap mesin. APK debug lokal tersedia di `android/app/build/outputs/apk/debug/app-debug.apk`. Transaksi online menunggu data toko final, rekening, bobot produk, kebijakan, verifikasi bukti ImageKit, konfigurasi Firebase/FCM bila dipakai, serta spesifikasi produksi mesin/CAM. Database produksi saat ini hanya berisi skema; data produk lokal masih contoh.

## Rencana teknologi

- **Website pelanggan:** GitHub Pages
- **Backend/API:** Cloudflare Workers
- **Database utama:** Cloudflare D1
- **Media produk:** ImageKit
- **Aplikasi admin:** Android
- **Notifikasi admin:** Firebase Cloud Messaging (FCM)
- **Kode dan riwayat perubahan:** GitHub

Workers dan D1 direncanakan sebagai backend serta sumber data utama. Netlify dapat dipertimbangkan sebagai jalur API tambahan jika diperlukan dan sudah diuji. Detail implementasi masih akan ditentukan.

## Dokumentasi

- [Checklist persiapan peluncuran](docs/LAUNCH_CHECKLIST.md) — gerbang keamanan, transaksi, SEO, dan rilis.
- [Operasional dan pemulihan data](docs/OPERATIONS.md) — ekspor D1, Time Travel, latihan pemulihan, dan penanganan secret.

- [Aplikasi admin Android](android/README.md) — setup lokal dan fitur admin.

- [Panduan backend](backend/README.md) — Workers, endpoint baca, dan migrasi D1 lokal.
- [Rancangan database awal](docs/DATABASE.md) — relasi data dan aturan migrasi.

- [Roadmap](ROADMAP.md) — tahapan dan status pengerjaan.
- [Kebutuhan proyek](docs/REQUIREMENTS.md) — pengguna, fitur, aturan, dan kebutuhan kualitas.
- [Dokumentasi analisis awal](Dokumentasi_Toko_Online_v0_2_ulang.md) — konteks dan gagasan awal proyek.

## Struktur folder awal

```text
.
├── README.md
├── ROADMAP.md
├── Dokumentasi_Toko_Online_v0_2_ulang.md
├── docs/
│   └── REQUIREMENTS.md
├── frontend/              # Website publik pelanggan
│   ├── src/
│   │   ├── templates/
│   │   ├── assets/
│   │   │   ├── images/
│   │   │   │   ├── brand/
│   │   │   │   ├── kategori/
│   │   │   │   └── produk/
│   │   │   ├── icons/
│   │   │   ├── css/
│   │   │   └── js/
│   │   └── scripts/
│   └── dist/               # Hasil build, diterbitkan ke GitHub Pages
├── backend/               # API Cloudflare Workers dan data D1
│   ├── src/
│   └── migrations/
└── android/                # Aplikasi admin Android
```

Frontend memiliki halaman beranda, kategori, produk, dan fondasi SEO di `frontend/src/`; skrip build membuat hasil di `frontend/dist/`. Backend memakai Worker dan D1; aplikasi admin Android berada di `android/`. Isi `dist/` dibuat ulang dari sumber. Lihat [panduan frontend dan SEO](frontend/README.md), [panduan backend](backend/README.md), [aplikasi admin](android/README.md), dan [rancangan database](docs/DATABASE.md).

## Prinsip pengembangan

1. Selesaikan pekerjaan dalam bagian kecil yang dapat ditinjau.
2. Uji setiap bagian sebelum menjadikannya dasar tahap berikutnya.
3. Validasi aturan dan perubahan data penting di backend.
4. Perbarui dokumentasi ketika keputusan atau implementasi berubah.
5. Jangan menyimpan password, token, private key, atau rahasia lain di repositori.

## Memulai

Untuk membuat pratinjau situs, jalankan Worker dan D1 lokal sesuai [panduan backend](backend/README.md), lalu jalankan `node frontend/src/scripts/build-site.mjs` dan `node frontend/src/scripts/check-release.mjs --preview`. Buka `frontend/dist/index.html` untuk melihat hasilnya. Untuk menjalankan aplikasi admin, ikuti [panduan Android](android/README.md).
