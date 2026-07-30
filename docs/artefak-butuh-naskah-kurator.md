# Artefak yang Belum Punya Naskah Kurator

Dokumen ini **hanya untuk tim internal**, dan dibuat supaya bisa dikirim apa adanya ke
pihak museum untuk dilengkapi.

Naskah resmi yang dikirim pemilik repo mencakup **11 artefak**. Aplikasi punya **32**.
Dokumen ini mendaftar **21 sisanya**.

## Kondisi mereka sekarang: aman, bukan darurat

Perlu ditegaskan di awal, karena premis di brief berbeda dengan kondisi sebenarnya:
**tidak ada satu pun dari 21 artefak ini yang masih menampilkan teks `DRAFT`,
`perlu dilengkapi kurator`, `TODO`, `TBD`, `Lorem`, atau `placeholder`.** Sisa-sisa teks
itu sudah dibersihkan pada pekerjaan sebelumnya dan sejak itu dijaga otomatis oleh
`npm run validate:artifacts`, yang ikut jalan pada `npm run build`. Sudah diverifikasi
ulang dengan grep, bukan dengan melihat sekilas.

Artinya **tidak ada yang perlu buru-buru diperbaiki** di sini. Deskripsi mereka ditulis
dengan aturan yang sama seperti sekarang: pengamatan visual objektif, fungsi umum jenis
bendanya, dan konteks zamannya — tanpa tahun presisi, nama penemu, lokasi temuan, nomor
inventaris, atau klaim superlatif yang tidak bisa diverifikasi. Layak baca, hanya tidak
sekaya artefak yang punya naskah kurator.

Yang **ditambahkan** pada pekerjaan ini untuk ke-21 artefak: field `deskripsi_singkat`
(satu kalimat ringkas, dipakai panel VR). Kalimat itu diturunkan dari deskripsi yang sudah
ada — **tidak ada fakta baru yang ditambahkan ke satu pun dari mereka.**

---

## Daftar 21 artefak

| ID | Nama | Zona | Kondisi deskripsi sekarang | Yang dibutuhkan dari kurator |
|---|---|---|---|---|
| `r1-fosil-pithecanthropus-erectus` | Fosil Tengkorak Pithecanthropus Erectus | prasejarah | Layak — 3 paragraf, pengamatan visual + konteks penamaan | Ini replika atau asli? Replika dari temuan yang mana (Trinil/Sangiran)? Dibuat kapan? |
| `r1-fosil-homo-erectus` | Fosil Tengkorak Homo Erectus | prasejarah | Layak — 3 paragraf | Situs & tahun penemuan, perkiraan umur/lapisan, nomor inventaris |
| `r1-kapak-perimbas` | Kapak Perimbas | prasejarah | Cukup — 1 paragraf pendek | Situs penemuan yang spesifik (sekarang hanya "beberapa situs Jawa Timur"), jenis batuan, ukuran |
| `r1-kapak-genggam` | Kapak Genggam | prasejarah | Cukup — 1 paragraf pendek | Situs penemuan, jenis batuan, perkiraan periode |
| `r1-nekara-perunggu` | Nekara Perunggu | prasejarah | Cukup — 1 paragraf pendek | Asal, ukuran, motif spesifik pada bidang pukulnya, tipe (Heger I/II/…) |
| `r1-koleksi-batuan` | Koleksi Batuan Prasejarah | prasejarah | Layak — 3 paragraf | Asal tiap jenis batuan dalam vitrin |
| `r1-kapak-persegi` | Kapak Persegi (Beliung Persegi) | prasejarah | Layak — 3 paragraf | Situs penemuan, jenis batuan, ukuran, nomor inventaris |
| `r2-arca-siwa-mahadewa` | Arca Siwa Mahadewa | hindu-buddha | Cukup — 1 paragraf pendek | Asal candi/situs, perkiraan abad, bahan batu, tinggi sebenarnya |
| `r2-arca-wisnu` | Arca Wisnu | hindu-buddha | Cukup — 1 paragraf pendek | Asal candi/situs, perkiraan abad, bahan |
| `r2-arca-brahma` | Arca Brahma | hindu-buddha | Cukup — 1 paragraf pendek | Asal candi/situs, perkiraan abad, bahan |
| `r2-arca-parwati` | Arca Parwati | hindu-buddha | Cukup — 1 paragraf pendek | Asal candi/situs, perkiraan abad, bahan |
| `r2-nandi` | Nandi | hindu-buddha | Layak — 3 paragraf | Asal candi/situs, perkiraan abad |
| `r2-dwarapala-1` | Arca Dwarapala (Kiri) | hindu-buddha | Layak — 3 paragraf | Asal candi/situs, perkiraan abad, tinggi sebenarnya |
| `r2-dwarapala-2` | Arca Dwarapala (Kanan) | hindu-buddha | Layak — 3 paragraf | Sama dengan pasangannya |
| `r2-relief-bentang-alam` | Relief Batu Bentang Alam & Perumahan | hindu-buddha | Cukup — 1 paragraf pendek | Asal situs, perkiraan periode, apa yang persisnya digambarkan |
| `r2-prasasti-loceret` | Prasasti Loceret | hindu-buddha | Layak — 3 paragraf | **Isi prasastinya apa?** Penanggalan, aksara & bahasa, asal situs |
| `r2-prasasti-sangguran-info` | Info Prasasti Sangguran | hindu-buddha | Layak — 3 paragraf | Lokasi keberadaan sekarang (negaranya belum bisa dipastikan), status terkini upaya repatriasi, isi prasasti |
| `r3-jam-matahari` | Jam Matahari | transisi-iptek | Layak — 3 paragraf | Asal, bahan, apakah dikalibrasi untuk garis lintang tertentu |
| `r3-teleskop` | Teleskop | transisi-iptek | Layak — 3 paragraf | Merek/pabrikan, perkiraan tahun, spesifikasi lensa |
| `r3-model-plta` | Model Peraga PLTA Kuno | transisi-iptek | Layak — 3 paragraf | Model ini merepresentasikan PLTA yang mana? Dibuat kapan & untuk keperluan apa? |
| `r3-senjata-api-kolonial` | Koleksi Senjata Api Kolonial | transisi-iptek | Layak — 3 paragraf | Perkiraan tahun tiap pucuk, asal, konteks penggunaan |

---

## Prioritas kalau harus memilih

Kalau kurator hanya sempat mengerjakan sebagian, urutan yang paling berdampak:

1. **`r2-prasasti-loceret`** — satu-satunya artefak yang deskripsinya menjelaskan *apa itu
   prasasti* tanpa bisa menyebut *apa isi prasasti ini*. Paling terasa kosong bagi
   pengunjung yang berhenti membaca.
2. **Empat arca tanpa asal** (`siwa-mahadewa`, `wisnu`, `brahma`, `parwati`) — deskripsinya
   sekarang murni ikonografis. Satu baris asal candi dan perkiraan abad saja sudah
   mengubahnya dari "arca Hindu pada umumnya" menjadi "benda ini".
3. **`r2-prasasti-sangguran-info`** — panel ini bercerita tentang repatriasi tapi tidak
   bisa menyebut negaranya. Detail itu justru inti ceritanya.
4. **`r1-fosil-pithecanthropus-erectus`** — status replika/asli sebaiknya dinyatakan
   eksplisit, bukan tersirat.

## Aturan kalau naskah baru masuk

- Tulis dengan pola yang sama seperti 11 naskah sebelumnya: **paragraf 1 = apa benda ini,
  paragraf 2 = kenapa benda ini penting.**
- **Jangan menyebut audiens tertentu** (sekolah, rombongan, kelompok usia). Naskah lama
  sempat menyapa satu sekolah secara langsung, dan itu harus dibersihkan belakangan.
  `npm run validate:artifacts` sekarang menggagalkan build kalau kata `santri`, `SMP`, atau
  `Tebuireng` muncul lagi.
- **Jangan menyertakan catatan produksi** — apa pun yang membahas model 3D, render,
  tampilan, atau aplikasinya, bukan bendanya. Ini juga dijaga otomatis.
- Field `fakta_menarik` **opsional**. Kalau tidak ada fakta yang bisa disumberkan, kosongkan
  saja; jangan diisi demi keseragaman. Aturan lengkapnya di `sumber-fakta-menarik.md`.
