# Aturan bahasa dan terjemahan

## Format wajib

- Semua teks antarmuka dan konten terjemahan disimpan dalam berkas JSON UTF-8. Jangan menulis teks khusus bahasa langsung di template HTML, JavaScript, atau CSS.
- Gunakan locale BCP 47, misalnya `id-ID`, `en-US`, `en-GB`, dan `fr-FR`. Bahasa (`en`) dan wilayah (`US`) adalah informasi berbeda.
- Setiap locale memakai susunan key JSON yang sama. Gunakan key stabil dan deskriptif seperti `navigation.products` atau `checkout.submit`.
- Teks dengan nilai dinamis memakai placeholder bernama, misalnya `"cart.itemCount": "{count} items"`. Dokumentasikan placeholder dan jangan mengubah namanya antar-locale.
- Simpan teks aksesibilitas, judul halaman, deskripsi SEO, pesan validasi/error, dan teks yang dibuat JavaScript di katalog JSON juga.
- JSON harus valid, UTF-8, tanpa komentar dan tanpa koma terakhir. Lakukan validasi saat proses build.

## Bahasa dan negara

Format ini harus bisa menerima locale untuk bahasa dan negara mana pun tanpa perubahan skema atau database. Buat satu katalog JSON per locale yang benar-benar disediakan, contohnya `id-ID.json` dan `en-US.json`. “Semua bahasa/negara” berarti sistem dapat diperluas ke locale mana pun; itu tidak berarti semua terjemahan sudah tersedia atau otomatis benar.

Informasi pasar yang bukan terjemahan—mata uang, negara tujuan, ongkos/waktu kirim, pajak, metode pembayaran, dan aturan penjualan—disimpan sebagai konfigurasi JSON terpisah per negara/wilayah. Jangan menebak harga atau kebijakan dari bahasa pengguna.

## Pemilihan dan fallback

- Pertahankan `id-ID` sebagai locale default sampai locale lain selesai diterjemahkan dan ditinjau.
- Sediakan pemilih bahasa/wilayah yang dapat diubah pengunjung; simpan pilihannya secara lokal bila sesuai.
- Jika suatu key belum diterjemahkan, fallback ke `id-ID` dan catat key yang hilang saat build. Jangan tampilkan `undefined` atau key mentah kepada pengunjung.
- Jangan menerjemahkan nama merek, SKU, atau data produk yang memang harus tetap persis. Ukuran, tanggal, angka, dan mata uang diformat menurut locale/negara.

## URL dan SEO internasional

- Beri URL yang berbeda untuk tiap versi bahasa, misalnya `/` untuk Indonesia dan `/en/` untuk bahasa Inggris. Pertahankan URL Indonesia yang sudah ada.
- Setiap halaman versi bahasa harus menunjuk canonical yang sesuai serta alternate `hreflang` untuk locale yang benar-benar tersedia, termasuk referensi balik.
- Jangan memaksa pengalihan berdasarkan IP atau bahasa browser. Tawarkan pilihan bahasa agar pengguna dan mesin pencari dapat membuka versi yang diinginkan.

## Bentuk katalog JSON

Gunakan bentuk berikut sebagai dasar; `messages` adalah satu-satunya sumber teks terjemahan. Katalog aktif perlu memiliki daftar key lengkap yang sama untuk semua locale.

```json
{
  "locale": "en-US",
  "language": "en",
  "region": "US",
  "direction": "ltr",
  "messages": {
    "navigation.products": "Products",
    "navigation.about": "About us",
    "cart.itemCount": "{count} items",
    "checkout.submit": "Continue to checkout"
  }
}
```

Konfigurasi pasar disimpan terpisah, misalnya:

```json
{
  "region": "US",
  "currency": "USD",
  "shippingCountries": ["US"],
  "shippingPolicyKey": "shipping.us"
}
```
