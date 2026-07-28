# Cara Mengganti Foto Penyambut

Di zona **Selamat Datang** (Aula Nusantara Kuno) berdiri dua orang penyambut.
Masing-masing punya papan berbingkai di sampingnya, dan papan itu punya satu
slot foto potret.

Mengisi fotonya **tidak perlu mengubah kode**. Cukup taruh berkasnya di folder
yang benar dengan nama yang benar, lalu muat ulang halaman.

---

## Langkah singkat

1. Siapkan foto potret sesuai ketentuan di bawah.
2. Beri nama `greeter-1.webp` dan `greeter-2.webp`.
3. Salin ke folder `public/images/greeters/`.
4. Muat ulang halaman (`Ctrl`/`Cmd` + `R`). Foto langsung tampil.

Kalau aplikasi sudah di-*build* dan di-*hosting*, berkasnya ditaruh di folder
`images/greeters/` di dalam hasil build (`dist/`) — sama persis, tanpa perlu
build ulang.

---

## Ketentuan berkas

| Hal | Ketentuan |
| --- | --- |
| Lokasi | `public/images/greeters/` |
| Nama berkas | `greeter-1`, `greeter-2` — sesuai `id` di `src/data/greeters.ts` |
| Format | `.webp` (utama). `.jpg` / `.jpeg` / `.png` juga diterima |
| Rasio | Potret **3:4** |
| Resolusi | Maksimal **768 × 1024 px** |
| Ukuran berkas | Usahakan di bawah **200 KB** per foto |

Urutan pencarian berkasnya: `.webp` → `.jpg` → `.jpeg` → `.png`. Jadi kalau ada
`greeter-1.webp` **dan** `greeter-1.jpg`, yang dipakai adalah yang `.webp`.

**Kenapa dibatasi segitu.** Aplikasi ini dipakai dari HP. Foto 3000 px tidak
terlihat lebih tajam di papan selebar 45 cm dalam ruang 3D, tapi memakan
memori GPU dan waktu decode yang nyata di HP kelas menengah. `.webp` biasanya
1/3 ukuran `.jpg` pada kualitas yang sama; `.png` dihindari untuk foto karena
besar tanpa keuntungan apa pun.

**Kalau rasionya tidak persis 3:4.** Foto tidak akan melar. Ia diperbesar
sampai memenuhi bingkai, lalu kelebihan sisinya dipotong (*cover crop*). Supaya
wajah tidak ikut terpotong, letakkan wajah di sepertiga bagian atas foto dan
sisakan sedikit ruang di kiri-kanan.

---

## Nama dan peran

Nama serta peran (dan satu kalimat sambutan, kalau mau) diisi di
`src/data/greeters.ts`:

```ts
{
  id: "greeter-1",
  name: "Nama Lengkap",
  role: "Pemandu Museum",
  caption: "Selamat datang di Mpu Tantular.",
  ...
}
```

Kalau ketiganya dikosongkan, papan namanya **tidak dirender sama sekali** —
tidak ada strip kosong, tidak ada tulisan sementara. Begitu juga saat fotonya
belum ada: bingkai tetap terisi bidang polos warna *sand* dari palet museum,
tanpa tulisan apa pun.

---

## Kalau fotonya belum ada

Bingkainya tetap terisi bidang polos warna *sand*, dan aplikasi tidak
menampilkan error apa pun. Yang mungkin terlihat hanyalah percobaan pengambilan
berkas yang gagal di tab **Network** DevTools — itu catatan browser saat mencari
berkas, bukan error aplikasi, dan hilang sendiri begitu fotonya ditaruh.

---

## Mengubah posisi atau menambah orang

Semua tentang penyambut ada di `src/data/greeters.ts` — posisi, arah hadap,
warna baju, dan sisi papan foto. Menambah orang ketiga cukup menambah satu
entri di array; tidak ada kode yang perlu disalin.

Penyambut **bukan artefak**. Datanya sengaja dipisah dari `artifacts.json`
supaya mereka tidak ikut terhitung di MiniMap, di daftar koleksi, di hitungan
"x dari y artefak dikunjungi", maupun di `scripts/validate-artifacts.mjs`.
