# Aturan bahasa dan terjemahan

## Bahasa yang digunakan

Untuk menjaga situs tetap sederhana, gunakan hanya dua katalog bahasa:

- `id-ID`: Bahasa Indonesia untuk pengunjung Indonesia.
- `en`: Bahasa Inggris beraksara Latin untuk pengunjung internasional.

Jangan membuat katalog terpisah untuk bahasa atau aksara lain seperti Jepang, Mandarin, atau Korea untuk saat ini. Bahasa Inggris menjadi versi internasional bagi negara yang belum memiliki terjemahan khusus. Aturan ini dapat ditinjau kembali jika kebutuhan bisnis berubah.

## Format wajib

- Semua teks antarmuka dan konten terjemahan disimpan dalam berkas JSON UTF-8. Jangan menulis teks khusus bahasa langsung di template HTML, JavaScript, atau CSS.
- Simpan katalog di `id-ID.json` dan `en.json` dengan susunan key yang sama.
- Gunakan key stabil dan deskriptif seperti `navigation.products` atau `checkout.submit`.
- Teks dengan nilai dinamis memakai placeholder bernama, misalnya `"cart.itemCount": "{count} items"`. Dokumentasikan placeholder dan jangan mengubah namanya antar-katalog.
- Simpan teks aksesibilitas, judul halaman, deskripsi SEO, pesan validasi/error, dan teks yang dibuat JavaScript di katalog JSON juga.
- JSON harus valid, UTF-8, tanpa komentar dan tanpa koma terakhir. Validasi JSON saat proses build.

## Pengaturan negara

Bahasa dan negara adalah pengaturan berbeda. Teks situs memakai dua katalog di atas. Informasi pasar yang berbeda antarnegara—seperti mata uang, negara tujuan, ongkos/waktu kirim, pajak, metode pembayaran, dan aturan penjualan—disimpan sebagai konfigurasi JSON negara yang terpisah. Jangan menebak harga atau kebijakan dari bahasa pengguna.

## Pemilihan dan fallback

- Gunakan `id-ID` sebagai versi default di Indonesia dan `en` sebagai versi internasional.
- Sediakan pemilih bahasa yang dapat diubah pengunjung; jangan memaksa pengalihan berdasarkan IP atau bahasa browser.
- Jika ada key yang belum tersedia di katalog aktif, gunakan padanan `id-ID` dan catat key yang hilang saat build. Jangan tampilkan `undefined` atau key mentah.
- Nama merek, SKU, dan data produk yang perlu tetap persis tidak diterjemahkan. Format angka, tanggal, dan mata uang mengikuti pengaturan locale atau negara.

## URL dan SEO internasional

- Pertahankan URL Indonesia yang sudah ada. Sediakan URL berbeda untuk bahasa Inggris, misalnya `/en/`.
- Setiap versi halaman memakai canonical yang sesuai dan alternate `hreflang` untuk `id-ID` dan `en`, dengan tautan balik antarversi.
- Tawarkan pilihan bahasa; jangan memaksa pengalihan otomatis berdasarkan lokasi atau bahasa browser.

## Bentuk katalog JSON

Gunakan bentuk berikut sebagai dasar. Buat versi Indonesia dengan key yang sama di `id-ID.json`.

```json
{
  "locale": "en",
  "language": "en",
  "direction": "ltr",
  "messages": {
    "navigation.products": "Products",
    "navigation.about": "About us",
    "cart.itemCount": "{count} items",
    "checkout.submit": "Continue to checkout"
  }
}
```

Contoh konfigurasi pasar terpisah:

```json
{
  "country": "US",
  "currency": "USD",
  "shippingCountries": ["US"],
  "shippingPolicyKey": "shipping.us"
}
```
