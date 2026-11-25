# DESIGN.md

Arah desain aplikasi kasir. Dibaca sebelum mengerjakan UI apa pun, lalu disaring dengan aturan antislop.

## Dari pemilik (25 Nov 2026)

- **Karakter:** toko kelontong yang hangat. Akrab dan bersahabat, terasa seperti toko lokal, bukan software korporat.
- **Warna inti:** biru tua (navy).
- **Tema:** terang sebagai default (toko biasanya terang), dengan toggle mode gelap yang berfungsi penuh.

## Usulan turunan (diusulkan Claude, boleh diganti pemilik)

Bagian ini bukan keputusan pemilik. Ditulis supaya setiap pilihan punya alasan yang bisa dicek.

### Palet

| Token | Terang | Gelap | Alasan |
|---|---|---|---|
| Latar | `#FAF6EF` krem | `#1A1814` arang hangat | Putih bersih terasa klinis; krem memberi kesan kertas dan rak toko |
| Teks | `#1C2333` tinta navy | `#F3EEE4` | Teks condong ke navy supaya senada dengan warna inti |
| Inti (navy) | `#1F3A60` | `#9CB6E0` | Warna pilihan pemilik; versi gelap dinaikkan supaya kontras tetap AA |
| Aksen (kunyit) | `#E9A23B` | `#F0B252` | Satu aksen hangat khusus momen terpenting: tombol **Bayar** dan angka **TOTAL**. Tidak dipakai di tempat lain |

Netral (krem, arang, abu hangat) tidak dihitung sebagai warna inti. Merah hanya untuk error/void, hijau hanya untuk status lunas.

### Tipografi

- **Plus Jakarta Sans** untuk seluruh UI. Alasan: dirancang oleh studio Indonesia untuk identitas kota Jakarta, bentuknya ramah dan membulat sehingga cocok dengan karakter toko lokal, dan punya angka tabular untuk kolom harga.
- Angka uang selalu `tabular-nums` dan rata kanan supaya mudah dibandingkan sekilas.
- Monospace hanya untuk struk (meniru printer thermal), tidak untuk UI.

### Motif identitas

**Tenda toko bergaris.** Strip navy dan krem tipis di tepi atas layar, seperti tenda di depan warung. Muncul di satu tempat per layar (header atau panel login), tidak diulang di kartu atau tombol.

### Bentuk

- Radius 8px untuk tombol dan input, 12px untuk panel. Tidak ada elemen berbentuk pil kecuali penanda status kecil.
- Bayangan hanya untuk lapisan yang benar-benar melayang (dropdown, modal). Panel biasa cukup garis tepi.
- Ikon: **Phosphor** dengan bobot regular. Alasan: punya ikon yang relevan dengan toko (Storefront, Barcode, Receipt, Basket), dan sudutnya yang membulat lebih hangat dibanding garis tipis default.

### Dial

`Dial: ENERGY 2 / RHYTHM 1 / MOTION 1`

- **ENERGY 2:** ramah dan berkarakter, tapi tetap alat kerja yang dipakai seharian.
- **RHYTHM 1:** layar aplikasi sengaja seragam. Kasir dan admin butuh pola yang bisa ditebak supaya cepat.
- **MOTION 1:** hanya transisi hover/fokus dan umpan balik aksi. Tidak ada animasi dekoratif yang memperlambat kasir.
