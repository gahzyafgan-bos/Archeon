# Matriks Uji Mode VR Lintas Perangkat

Dokumen ini dipakai **sebelum rilis**, setiap kali ada perubahan yang menyentuh
`src/components/vr/`, `src/utils/vrOptics.ts`, `src/utils/vrViewport.ts`,
`src/utils/graphicsPresets.ts`, atau blok `--vr-side-inset` di `src/index.css`.

Alasannya sederhana: Mode VR sudah lima kali rusak (kuning, layar hitam,
framing/FOV, jejak berulang, asimetri kiri-kanan) dan **tidak satu pun**
ketahuan dari membaca kode atau dari menjalankan aplikasi di desktop. Semuanya
ketahuan dari seseorang yang memegang HP tertentu. Jadi daftar di bawah bukan
formalitas — ia adalah satu-satunya alat deteksi yang pernah berhasil.

---

## Yang bisa dan tidak bisa dijanjikan

Yang **bisa** dijanjikan: kelas kesalahan yang sudah pernah terjadi akan
berbunyi sendiri begitu muncul lagi, lewat pemeriksaan otomatis di mode dev
(lihat `src/utils/vrInvariants.ts`), dan matriks di bawah dijalankan sebelum
rilis.

Yang **tidak bisa** dijanjikan: nol bug di semua HP Android dan iPhone yang
pernah dibuat. Tidak ada yang bisa memverifikasi klaim itu — jumlah kombinasi
GPU, versi WebKit, rasio layar dan produsen terlalu besar. Yang jujur adalah
mencatat perangkat mana yang **sudah** diuji dan mana yang **belum**, dan
dokumen ini menyediakan tempatnya.

---

## Pemeriksaan otomatis (mode dev)

Tiga invarian diperiksa setiap frame / setiap 0,5 detik selama Mode VR aktif di
`npm run dev`. Ketiganya hilang total dari build produksi (`import.meta.env.DEV`
diganti `false` oleh Vite, lalu tree-shaking membuang modulnya).

| Invarian | Toleransi | Kalau gagal |
|---|---|---|
| `eye-viewport-width` — lebar viewport mata kiri = kanan | 0 px | Dua gambar beda ukuran; mata tidak bisa menyatukannya |
| `hud-symmetry-x` / `-y` — reticle simetris terhadap pusat masing-masing mata | 1 px | Titik yang justru diminta dipandang berada di sumbu yang salah |
| `pose-per-frame` — matriks kepala tidak berubah antara render mata kiri dan kanan | 0 (bit-identik) | Dunia terlihat robek saat kepala berputar |
| `auto-clear` — `renderer.autoClear` masih menyala saat frame VR dimulai | — | Buffer tidak dibersihkan; jejak berulang |

Pelanggaran muncul di dua tempat: `console.warn` (dibatasi 1× per 3 detik per
invarian, supaya console tidak tenggelam) **dan** baris merah di readout dalam
headset — karena console tidak bisa dibaca dari dalam Cardboard tanpa kabel.

Dump lengkap dengan angka: buka console lalu jalankan `dumpVrDiag("label")`.
Dump itu sekarang selalu memuat `userAgent`, ukuran layar, orientasi, dan
**keempat nilai `safe-area-inset`** — jadi laporan bug dari HP yang tidak
dimiliki siapa pun di tim tetap bisa ditindaklanjuti.

---

## Matriks minimum

Setiap sel diuji pada **ketiga preset grafis** (Rendah, Sedang, Tinggi).

| # | Perangkat | Peramban | Yang khusus diperiksa |
|---|---|---|---|
| 1 | iPhone berponi / Dynamic Island | Safari | Landscape **kedua arah putar** (poni di kiri, lalu di kanan) |
| 2 | iPhone berponi / Dynamic Island | Chrome iOS | Sama. Chrome iOS memakai WebKit — hasil beda dari Safari = temuan yang wajib dilaporkan |
| 3 | iPhone tanpa poni (SE / generasi lama) | Safari | Inset nol; pastikan perbaikan poni tidak merugikan HP yang tidak punya poni |
| 4 | Android layar panjang (20:9 atau lebih) | Chrome | Lebar buffer ganjil → kolom sambungan |
| 5 | Android layar standar (16:9) | Chrome | Baseline |

### Yang dilihat di tiap sel

1. **Jejak berulang.** Putar kepala **cepat** kiri-kanan, lalu atas-bawah,
   masing-masing ±5 detik. Diam saja tidak cukup — bug ini hanya terlihat saat
   bergerak. Tidak boleh ada salinan objek yang tertinggal.
2. **Simetri.** Teks HUD dan lingkaran reticle harus berada di posisi yang sama
   di kedua mata, dan tidak ada teks yang terpotong di salah satu sisi.
3. **Fusi.** Lihat lewat viewer 10-15 detik. Gambar harus menyatu tanpa usaha.
   Kalau mata terasa "menarik", berhenti — itu bukan sesuatu yang dibiasakan.
4. **Masuk-keluar VR 5×.** Gejala tidak boleh kembali di percobaan kedua dan
   seterusnya (ini bentuk khas kebocoran listener/loop; hitungannya ada di
   `dumpVrLifecycle()`).
5. **FPS sebelum vs sesudah**, dari readout di dalam headset.

### Format catatan hasil

Salin blok ini per perangkat, isi apa adanya:

```
Perangkat   : iPhone 13, iOS 18.5
Peramban    : Safari
Tanggal     :
Preset      : rendah / sedang / tinggi
safe-area   : kiri __ px, kanan __ px  (dari dumpVrDiag)
MSAA        : diminta __×, terpakai __×
FPS         : rendah __ / sedang __ / tinggi __
Jejak       : ada / tidak
Simetri     : lolos / gagal (__ px)
Masuk-keluar VR 5× : lolos / gagal
Catatan     :
```

---

## Status pengujian saat ini

Diisi jujur; baris yang belum diuji **tidak boleh dihapus atau diklaim aman**.

| Perangkat | Peramban | Status | Tanggal |
|---|---|---|---|
| iPhone berponi | Safari | **belum diuji** | — |
| iPhone berponi | Chrome iOS | **belum diuji** | — |
| iPhone tanpa poni | Safari | **belum diuji** | — |
| Android layar panjang | Chrome | **belum diuji** | — |
| Android 16:9 | Chrome | **belum diuji** | — |
| Desktop (Chrome, simulasi) | Chrome | build + lint + typecheck lolos; jalur render dibaca statis | 2026-08-20 |

---

## Cara menguji dari HP di jaringan yang sama

`vite.config.ts` sudah memasang `@vitejs/plugin-basic-ssl`. Mode VR butuh HTTPS:
`deviceorientation` dan `Fullscreen` tidak akan aktif di `http://` pada HP.

```
npm run dev -- --host
```

Buka alamat `https://<IP-laptop>:5173` dari HP, terima peringatan sertifikat
sekali. Karena ini build dev, seluruh pemeriksaan invarian di atas menyala dan
readout diagnostik tampil di dalam headset.
