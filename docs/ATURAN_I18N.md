# Aturan bahasa, pasar, dan terjemahan

## Bahasa yang digunakan

Gunakan dua katalog bahasa untuk tahap awal:

- `id-ID`: Bahasa Indonesia untuk pasar Indonesia.
- `en`: Bahasa Inggris beraksara Latin untuk pasar internasional.

Jangan membuat katalog Jepang, Mandarin, Korea, atau bahasa lain dulu. Bahasa Inggris menjadi versi internasional sampai kebutuhan bisnis berubah.

## Format terjemahan

- Semua teks antarmuka dan konten terjemahan wajib berada dalam berkas JSON UTF-8, bukan ditulis khusus per bahasa di template HTML atau JavaScript.
- Simpan katalog di `frontend/src/data/i18n/id-ID.json` dan `frontend/src/data/i18n/en.json` dengan key yang sama.
- Pakai key stabil seperti `navigation.products` atau `checkout.submit`.
- Nilai dinamis menggunakan placeholder bernama, misalnya `{count}`. Nama placeholder harus sama di setiap bahasa.
- Teks aksesibilitas, judul dan deskripsi SEO, validasi/error, serta teks JavaScript juga masuk katalog JSON.
- JSON harus valid dan divalidasi saat build.

## Pengaturan dua pasar

Konfigurasi pasar disimpan di `frontend/src/data/markets.json`:

- `ID`: Indonesia, katalog `id-ID`, mata uang IDR, harga katalog rupiah, dan checkout domestik.
- `INTL`: pasar internasional, katalog `en`, mata uang USD, dan harga perkiraan yang dikonversi dari harga IDR memakai satu kurs referensi tetap.

Kurs USD harus mencatat sumber dan tanggal. Kurs awal yang dipakai adalah kurs jual transaksi USD Bank Indonesia tanggal 18 November 2026: Rp18.355,32 per USD. Perkiraan USD bukan jumlah tagihan final; tampilkan catatan bahwa harga akhir dan pengiriman internasional dikonfirmasi sebelum pemesanan. Perbarui kurs referensi secara manual saat harga ditinjau, bukan mengambil kurs baru pada setiap kunjungan.

Checkout dan pembayaran internasional tetap dalam mode permintaan penawaran sampai backend mendukung pembayaran dan pengiriman internasional. Jangan mengirim harga USD ke endpoint checkout IDR.

Negara menentukan mata uang, tujuan pengiriman, pajak, metode pembayaran, dan aturan penjualan. Bahasa dan negara adalah pengaturan berbeda.

## Pemilihan pasar dan SEO

- Pertahankan URL Indonesia yang sudah ada; buat URL berbeda untuk halaman Inggris, misalnya `/en/`.
- Gunakan canonical sesuai URL setiap bahasa dan `hreflang` dua arah untuk `id-ID` dan `en`.
- Selalu sediakan pemilih pasar yang bisa diubah pengunjung. Deteksi lokasi hanya untuk memberi saran; jangan paksa redirect berdasarkan IP atau bahasa browser.
- Jika sebuah terjemahan belum tersedia, fallback ke Bahasa Indonesia dan catat key yang hilang saat build. Jangan tampilkan `undefined` atau key mentah.

## Contoh katalog

```json
{
  "locale": "en",
  "language": "en",
  "direction": "ltr",
  "messages": {
    "navigation.products": "Products",
    "navigation.about": "About us",
    "cart.itemCount": "{count} items",
    "market.usdEstimate": "USD prices are estimates; final pricing and international shipping are confirmed before ordering."
  }
}
```
