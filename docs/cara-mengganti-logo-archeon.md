# Cara Menaruh Logo Archeon

Baris kredit **"Museum Mpu Tantular Virtual — by Archeon"** muncul di tiga
tempat: panel perkenalan (onboarding), layar loading, dan bagian **Tentang** di
panel Pengaturan.

Di samping teksnya sudah disediakan slot logo kecil. Selama berkas logonya
belum ada, slot itu **tidak merender apa pun** — tidak ada kotak kosong dan
tidak ada ikon gambar rusak.

---

## Langkah singkat

1. Siapkan logo sesuai ketentuan di bawah.
2. Beri nama `archeon-logo.webp`.
3. Salin ke folder `public/images/brand/`.
4. Muat ulang halaman. Logo langsung tampil di sebelah kiri teks kredit.

---

## Ketentuan berkas

| Hal | Ketentuan |
| --- | --- |
| Lokasi | `public/images/brand/` |
| Nama berkas | `archeon-logo.webp` |
| Format | `.webp` dengan latar transparan (`.png` transparan juga bisa, ubah `TEAM_LOGO_PATH`) |
| Tinggi tampil | 16–18 px (diatur otomatis, lebarnya menyesuaikan) |
| Resolusi berkas | Tinggi 64 px sudah cukup untuk layar 3× |
| Ukuran berkas | Di bawah 20 KB |

Logonya ditampilkan dengan opacity 0.75 supaya hadir tanpa berebut perhatian
dengan nama museum. Pakai versi logo satu warna terang; logo penuh warna di
atas latar gelap biasanya terlihat kotor pada ukuran sekecil ini.

---

## Kalau nama berkas atau formatnya berbeda

Path-nya ada di satu tempat: `src/constants/credits.ts`.

```ts
export const TEAM_LOGO_PATH = "/images/brand/archeon-logo.webp";
```

File yang sama juga memegang seluruh teks kredit (`CREDIT_LINE`, `TEAM_NAME`,
`MUSEUM_NAME`, `APP_VERSION`). Mengubahnya di sini otomatis mengubah semua
tempat yang menampilkannya — tidak ada string kredit yang diketik ulang di
komponen mana pun.

Satu pengecualian yang harus diubah manual: `<title>` dan `<meta name="author">`
di `index.html`, karena berkas itu di luar jangkauan modul TypeScript.
