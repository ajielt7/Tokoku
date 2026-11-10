# Ongkir dan Pembayaran

**Status:** Implementasi lokal mendukung RajaOngkir, Gojek Same Day, transfer manual, bukti privat ImageKit, dan pemeriksaan pembayaran admin. D1 production masih kosong. Pencarian tujuan RajaOngkir berhasil; validasi API ImageKit read-only mengembalikan HTTP 403 pada 9 November 2026, sehingga upload bukti belum tervalidasi. Berat paket disepakati 650 gram. Pilihan kurir dan rumus Gojek mengacu pada proyek `C:\Users\Ajiee\OneDrive\Dokumen\Pemesanan`; tarif RajaOngkir tetap harus diverifikasi pada rute dan akun Ruma. Pengujian transfer/refund direncanakan lokal tanpa uang sungguhan.

## Alur yang dipakai

1. Pelanggan mencari dan memilih kecamatan/kelurahan tujuan dari RajaOngkir.
2. Worker menghitung tarif kurir ekspedisi menggunakan tujuan terpilih, kode kurir, dan berat produk dari D1.
3. Pelanggan memilih layanan; checkout menampilkan subtotal, ongkir, dan total.
4. Saat pesanan dikirim, Worker meminta tarif terbaru lagi dan menyimpan layanan serta tarif aktual ke D1. Nilai dari browser tidak dipercaya.
5. Pembayaran awal berupa transfer bank manual. Kode pesanan menjadi referensi transfer; admin mencocokkan pembayaran secara manual.
6. Pelanggan mengunggah JPG/PNG/WebP maksimal 5 MB. Worker memvalidasi kode pesanan dan nomor telepon, memeriksa signature file, lalu mengirim file sebagai private asset ke ImageKit. D1 hanya menyimpan file ID/path dan waktu unggah.

## Pengaturan ongkir

- Asal awal: Cimekar, Cileunyi, Bandung, ID RajaOngkir `5052`, sesuai dokumen sumber.
- Berat paket produk: 650 gram sesuai kesepakatan. Timbang ulang contoh paket sebelum rilis untuk memastikan kemasan sesuai angka ongkir. D1 menyediakan `products.shipping_weight_grams`.
- Kurir pilihan toko: Gojek, JNE, J&T, SPX, SiCepat, Wahana, dan Anteraja. RajaOngkir hanya mengembalikan layanan yang tersedia untuk akun dan rute tersebut; pilihan ini perlu diuji pada akun Ruma.
- Gojek Same Day tersedia untuk jarak jalan di bawah 30 km; ongkir Rp10.000 untuk 4 km pertama, lalu tambah Rp2.500 per km berikutnya dengan pembulatan ke atas. Pelanggan memilih titik pada peta; Worker menghitung ulang rute saat checkout dan hanya menyimpan jarak, bukan koordinat alamat.
- API key RajaOngkir disimpan sebagai Worker secret `RAJAONGKIR_API_KEY`; ImageKit private key sebagai Worker secret `IMAGEKIT_PRIVATE_KEY`. Jangan simpan kunci dalam frontend atau repository. ID asal ada di `RAJAONGKIR_ORIGIN_ID`.
- Endpoint RajaOngkir V2 memakai pencarian `destination/domestic-destination` dan kalkulasi `calculate/domestic-cost`. Panggilan kalkulasi dikirim dari Worker dengan header `key`, asal, tujuan, berat dalam gram, dan kode kurir. Dokumentasi: [pencarian tujuan](https://www.rajaongkir.com/docs/shipping-cost/endpoint-rajaongkir-for-search-base/search-destination-rajaongkir) dan [kalkulasi ongkir domestik](https://www.rajaongkir.com/docs/shipping-cost/endpoint-rajaongkir-for-search-base/calculate-domestic-cost).

## Yang tersisa untuk penerapan online

- Periksa private API key dan status akun di ImageKit Dashboard > Developer > API Keys. Dokumentasi ImageKit menyebut HTTP 403 dapat berarti akun tidak dapat diautentikasi dengan key, key kedaluwarsa, atau akun dinonaktifkan; batas upload berlaku pada API upload. API memakai Basic Auth dengan private key sebagai username dan password kosong ([dokumentasi API ImageKit](https://imagekit.io/docs/api-overview)). Jangan menaruh key di chat, Git, frontend, atau log.
- Setelah masalah HTTP 403 dibereskan, validasi API ImageKit read-only dan lakukan uji upload bukti terbatas sebelum membuka checkout.
- Secret RajaOngkir, ImageKit, dan admin serta migrasi D1 cloud sudah dikonfigurasi. Jangan mengganti secret dengan nilai baru kecuali key yang benar sudah diambil dari dashboard masing-masing layanan.
- Tinjau endpoint rute publik OSRM/Valhalla yang dipakai prototipe; pilih penyedia rute yang sesuai sebelum checkout publik.
- Isi bobot katalog 650 gram dan verifikasi kembali dengan contoh kemasan final serta ID asal `5052`.
- Masukkan nama bank, nomor rekening, dan nama pemilik rekening.
- Uji pencarian tujuan dan tarif nyata, transfer, unggah bukti privat, URL admin bertanda tangan, pembersihan saat ditolak, serta persetujuan admin pada lingkungan yang sudah dikonfigurasi.
