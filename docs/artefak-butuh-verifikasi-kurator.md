# Artefak yang Butuh Verifikasi Kurator

Dokumen ini **hanya untuk tim internal**. Isinya tidak pernah ditampilkan ke pengunjung
aplikasi, dan tidak boleh disalin ke `artifacts.json`.

Deskripsi artefak di aplikasi ditulis dengan satu aturan keras: **tidak mengarang fakta**.
Kalau sebuah data tidak bisa diverifikasi dari sumber yang ada di repo, data itu tidak
ditulis — deskripsinya dibuat tetap informatif lewat pengamatan visual, fungsi umum jenis
benda, dan konteks zaman. Dokumen ini mencatat data apa saja yang idealnya dilengkapi
pihak museum agar deskripsinya bisa lebih kaya, plus beberapa klaim yang sudah terlanjur
ada di data dan sebaiknya dikonfirmasi.

---

# 0. PERTANYAAN DARI NASKAH KURATOR BARU — PALING MENDESAK

Pemilik repo mengirim naskah deskripsi resmi untuk 11 artefak, dan naskah itu sudah
dipasang ke `artifacts.json`. Aturan yang dipakai: **kalau naskah kurator berbeda dengan
data lama, naskah kurator menang.** Tapi beberapa perbedaannya cukup besar sehingga perlu
dikonfirmasi balik — kalau ternyata datanya yang benar, teksnya harus dikoreksi lagi.

Diurutkan dari yang paling berisiko.

## 0.1 — ⚠️ `r3-sepeda-motor-uap`: benda ini sebenarnya apa?

**Ini pertanyaan terpenting di seluruh dokumen.** Data lama dan naskah kurator menyebut dua
benda yang secara fisik tidak mungkin sama:

| | Data lama | Naskah kurator |
|---|---|---|
| Nama | Sepeda Motor Uap | Sepeda Daimler |
| Tenaga | **Mesin uap** — tungku dan ketel menyatu di rangka | **Mesin bensin** |
| Kecepatan | ±30 km/jam | 12 km/jam |
| Rujukan | — | Daimler Reitwagen 1885 |

Naskah bahkan menyebut kendaraan roda dua bertenaga uap (Roper, 1867) sebagai **benda lain
yang terpisah** — jadi naskah ini secara eksplisit *bukan* sedang mendeskripsikan sepeda
motor uap.

**Yang sudah dilakukan:** naskah kurator dipakai. `nama` diubah dari "Sepeda Motor Uap"
menjadi **"Sepeda Daimler"**, dan deskripsinya ditulis ulang mengikuti naskah. Nama file
model 3D-nya (`sepeda-daimler.glb`) juga mendukung pembacaan ini. **`id`-nya tidak diubah**
(`r3-sepeda-motor-uap`) sesuai aturan — jadi mulai sekarang `id` itu tidak lagi
menggambarkan isinya, dan itu memang tidak apa-apa; `id` cuma pegangan teknis.

**Yang perlu dikonfirmasi:**

1. Benda di ruang pamer ini **Reitwagen (bensin) atau sepeda motor uap**? Kalau ternyata
   benar-benar bermesin uap, seluruh deskripsi barunya salah dan harus dikembalikan.
2. Kalau Reitwagen: **unit asli, replika, atau rekonstruksi?** Deskripsinya sengaja ditulis
   netral ("Benda yang dipajang di sini menghadirkan kembali rancangan tersebut") dan
   **tidak mengklaim** benda ini unit 1885. Kalau museum punya keterangan resmi, kalimat itu
   bisa dipertegas.
3. Angka **±30 km/jam** dari data lama sudah dihapus. Kalau angka itu punya sumber museum,
   tolong beri tahu — mungkin justru datanya yang benar.

> Catatan pendukung: unit Reitwagen yang asli musnah dalam kebakaran pabrik Daimler di
> Cannstatt tahun 1903, sehingga semua Reitwagen yang ada di dunia hari ini adalah
> pembuatan ulang. Ini **tidak dipakai untuk menyimpulkan** status benda di museum —
> hanya konteks agar pertanyaan nomor 2 bisa dijawab dengan enak.

## 0.2 — ⚠️ `r2-surya-stambha`: batu atau logam?

Sama seriusnya, dan arahnya jelas.

- **Data lama** menulisnya sebagai **tugu batu** dari tradisi Hindu-Buddha, dengan
  "permukaan yang aus" dan "pahatan yang samar".
- **Naskah kurator** menulisnya sebagai **pilar/tongkat logam** dari **Masa Perundagian**
  (prasejarah) asal **Pulau Sawu, Nusa Tenggara Timur**.

Naskah kurator cocok dengan sumber luar: Surya Stambha Museum Mpu Tantular adalah artefak
**perunggu** dari Pulau Sawu, Sabu Raijua, NTT, koleksi masterpiece, berukuran sekitar
**150 x 30 cm** ([detikBali](https://www.detik.com/bali/budaya/d-8450623/surya-stambha-artefak-langka-dari-pulau-sawu-ntt)).
Deskripsinya sudah diganti mengikuti naskah, dan semua penyebutan "batu" dihapus.

**Tiga konsekuensi yang tidak bisa diselesaikan lewat teks, mohon diputuskan:**

1. **Zona.** Artefak ini berdiri di zona `hindu-buddha`, sementara teksnya sekarang
   menyebutnya peninggalan prasejarah. Pengunjung yang teliti akan melihat
   ketidakcocokannya. Pindah ke zona `prasejarah`? *(Perubahan posisi/zona di luar
   lingkup pekerjaan ini — tidak disentuh.)*
2. **Ukuran.** `real_world_size` di data menyebut tinggi **2,15 m**; sumber menyebut
   **1,5 m**. *(Skala tidak disentuh.)*
3. **Model 3D.** `surya-stambha.glb` kemungkinan dimodelkan sebagai benda batu. Kalau
   aslinya perunggu, materialnya perlu ditinjau.

## 0.3 — `r3-telepon-antik`: telepon meja atau telepon dinding?

- **Data lama:** "Telepon Genggam/Meja Antik" — pesawat bergaya meja dengan gagang bicara
  yang diangkat dari dudukannya.
- **Naskah kurator:** pesawat **dinding**, dipasang permanen, penggunanya harus berdiri,
  alat dengar dan corong bicara terpisah, ada tuas engkol untuk memanggil operator.

Dua deskripsi ini tidak bisa dua-duanya benar untuk satu benda. Naskah dipakai; `nama`
diubah menjadi **"Pesawat Telepon Dinding"** (Title Case, sesuai permintaan). Nama lamanya
memang sudah lama terasa janggal ("genggam/meja" sekaligus).

**Mohon dipastikan jenisnya**, dan kalau ternyata koleksinya ada dua (satu meja, satu
dinding), beri tahu — mungkin justru perlu dua artefak, bukan satu.

## 0.4 — Tahun 1882 pada telepon dinding: maksudnya apa?

Naskah menulis *"Ditemukan pada tahun 1882"*. Ini bisa berarti dua hal yang sangat berbeda:

- alat **jenis ini** diciptakan/dipatenkan tahun 1882; atau
- **benda ini** ditemukan/diperoleh museum tahun 1882.

Tidak ditebak. Teksnya ditulis netral: *"...yang tercatat bertahun 1882..."* — yang tidak
mengklaim keduanya. **Kalau museum tahu maksudnya yang mana, kalimat itu bisa langsung
diperjelas** dan hasilnya akan jauh lebih informatif.

## 0.5 — "Letusan purba" pada fosil kepala kerbau

Naskah menulis: *"...merupakan fosil dari area kawasan bersejarah yang sangat lekat dengan
letusan purba."* Tidak jelas letusan apa, gunung apa, atau kaitannya dengan Sungai Porong.

**Klaim ini tidak ditulis di deskripsi** — sengaja, karena menebak isinya berarti mengarang.
Paragraf 2-nya sekarang jadi pendek (dua kalimat). **Kalau maksudnya bisa dijelaskan,
paragraf itu bisa dilengkapi** dan akan menjadi jauh lebih menarik.

## 0.6 — Dua klaim "satu-satunya"

| Artefak | Klaim di naskah | Hasil pengecekan | Yang ditulis sekarang |
|---|---|---|---|
| `r3-simponion` Symphonion | "objek **satu-satunya** yang berada di Indonesia" | **Berlawanan dengan sumber.** Rujukan yang ada menyebut ada **dua** kotak musik setua ini di Indonesia, dan yang di Mpu Tantular adalah tipe *double comb* ([Museums Victoria](https://collections.museumsvictoria.com.au/articles/2771)) | Dilunakkan: *"termasuk yang sangat langka di Indonesia"* |
| `r2-surya-stambha` Surya Stambha | "**satu-satunya** peninggalan prasejarah berbentuk pilar logam" | **Mendekati benar.** Sumber menyebut *"sejauh ini belum ada temuan di Indonesia yang menyerupai artefak ini"* — kuat, tapi bukan klaim absolut | Dilunakkan seperlunya: *"sejauh ini belum ada temuan lain di Indonesia yang menyerupainya"* |

**Kalau museum punya sumber resmi untuk klaim "satu-satunya" versi Symphonion, teks bisa
dikembalikan.** Untuk sekarang klaim absolut itu terlalu berisiko — satu pengunjung yang
tahu ada unit kedua sudah cukup untuk merusak kredibilitas seluruh label.

## 0.7 — `r1-manusia-purba`: entri paling lemah dari 11 naskah

Naskah untuk "Manusia Purba" paragraf 2-nya berbunyi: *"Memberikan wawasan unik mengenai
sejarah evolusi dan proses adaptasi nenek moyang kita, langsung melalui bukti fisik berupa
fosil dan artefak."* Kalimat itu bisa ditempel ke fosil mana pun di dunia — tidak ada satu
detail pun yang khusus untuk benda ini.

Paragraf 1-nya juga terpotong tanpa titik (*"Mereka dikenal sebagai fosil penting petunjuk
evolusi"*), dan sedikit janggal: naskah menyebut "fosil", padahal benda di ruang pamer
adalah **rekonstruksi sosok**, bukan fosil. Teksnya sudah dirapikan seadanya tanpa menambah
fakta, dan artefak ini **sengaja tidak diberi `fakta_menarik`.**

**Yang akan sangat membantu:** rekonstruksi ini didasarkan pada temuan yang mana? Dibuat
oleh siapa dan tahun berapa? Satu kalimat saja sudah mengubah entri ini dari generik menjadi
spesifik.

## 0.8 — Keputusan ejaan yang diambil

Aturannya: **ejaan museum menang atas ejaan lazim.** Karena `artifacts.json` adalah data
museum yang sudah berjalan, ejaan di sanalah yang dipertahankan. Semuanya konsisten di
seluruh aplikasi (panel info normal, panel info VR, dan prompt "Lihat …" pada HUD — tidak
ada daftar koleksi maupun label MiniMap di aplikasi ini).

| Di naskah | Ejaan lazim | Yang dipakai | Alasan |
|---|---|---|---|
| `Arca Durga Mahisurmardini` | `Mahisasuramardini` | **`Arca Durga Mahisasuramardhini`** (ejaan data, tidak diubah) | Ejaan naskah tidak konsisten dengan isinya sendiri (paragraf 2 menulis "Mahisasura" dengan benar). Ejaan data sudah benar secara etimologis dan sudah dipakai di `id`. |
| `Simphonion` | `Symphonion` | **`Symphonion (Kotak Musik Mekanik)`** (ejaan data, tidak diubah) | Sesuai nama pabrikan Jerman. Catatan: `id`-nya `r3-simponion` — **tidak diubah**, sesuai aturan. |
| `PESAWAT TELEPON DINDING` | Title Case | **`Pesawat Telepon Dinding`** (nama diubah) | Kapital semua bukan format nama artefak; sekarang dijaga otomatis oleh validator. |
| `Hiasan Garudeya` | — | **`Garudeya Emas 22 Karat`** (ejaan data, tidak diubah) | Bukan soal ejaan melainkan penamaan. Nama data lebih deskriptif dan sudah mapan. **Kalau museum lebih suka "Hiasan Garudeya", tinggal bilang.** |

## 0.9 — Konflik fakta lain antara naskah dan data lama

| Artefak | Data lama | Naskah kurator | Yang dipakai |
|---|---|---|---|
| `r2-garudeya-emas` | "satu-satunya artefak emas 22 karat di Indonesia" | Tidak menyebut klaim ini | **Klaim dihapus** — tidak ada di naskah dan tidak terverifikasi |
| `r2-garudeya-emas` | Tidak menyebut periode | "era Kerajaan **Airlangga** (abad ke-11 s.d. ke-12 M)" | Naskah. ⚠️ Sebagian sumber luar justru menyebutnya **temuan era Singasari** — mohon dipastikan. |
| `r2-garudeya-emas` | "Desa Plaosan" | "Desa Plaosan, Kediri" | Naskah (dilengkapi: Kabupaten Kediri) |
| `r3-sepeda-tinggi` | Pembuat tidak disebut (nama "Michael Kesler" pernah dihapus karena tak terverifikasi) | "dirancang oleh **James Starley** di Inggris" | Naskah. Nama Starley memang lazim dikaitkan dengan sepeda roda tinggi Inggris. |
| `r1-fosil-kepala-buaya` / `r1-fosil-kepala-kerbau` | Situs & umur tidak disebut | "**Sungai Porong**", "**800.000 tahun**" | Naskah — dua kolom "data yang dibutuhkan" di bagian B jadi terjawab |

## 0.10 — Yang dibersihkan dari naskah sebelum tayang

Dicatat supaya jelas apa yang berubah dari naskah aslinya, dan kenapa.

| Artefak | Kalimat asli di naskah | Alasan dibersihkan |
|---|---|---|
| `r2-arca-ganesha` | *"...yang dimana sangat relevan pada **santri SMP Sains Tebuireng**."* | Menyapa audiens satu sekolah. Gagasan intinya (Ganesha sebagai dewa ilmu pengetahuan & penyingkir rintangan, bermakna bagi siapa pun yang menuntut ilmu) **dipertahankan penuh**. |
| `r3-sepeda-tinggi` | *"...bertolak belakang dengan kehidupan **santri**... setelah kehidupannya selaras dengan arca Ganesha"* | Sama — plus merujuk urutan kunjungan yang tidak berlaku di museum virtual. Gagasan intinya (kontras sosial masa kolonial) **dipertahankan penuh**, ditulis sebagai pengamatan sejarah. |
| `r3-sepeda-motor-uap` | *"...rangka kayunya yang estetik **untuk tampilan 3D**..."* | Catatan produksi internal. Pengamatan bahwa rangka kayunya menarik secara visual **dipertahankan**. |
| `r2-garudeya-emas` | (dari data lama) *"Di **ruang virtual** ini ukurannya sengaja diperbesar agar ukirannya terbaca"* | Catatan produksi yang sudah terlanjur tayang di data lama. Ikut terhapus saat deskripsinya diganti. |
| `r2-arca-ganesha` | *"penghalang rintangan"* | Terbalik artinya — Ganesha **menyingkirkan** rintangan, bukan menghalangi. Diperbaiki jadi "penyingkir rintangan". |
| beberapa | `diatas`, `dimana`, `eropa`, `belanda` | Ejaan → `di atas`, struktur kalimat diubah, `Eropa`, `Belanda`. |

**Ketiga kebocoran di atas sekarang dijaga otomatis** — `npm run validate:artifacts`
menggagalkan build kalau `santri`, `SMP`, `Tebuireng`, `tampilan 3D`, `model 3D`, `render`,
`aplikasi ini`, atau `ruang virtual` muncul lagi di teks pengunjung mana pun.

---

## A. Klaim yang sudah ada di data dan perlu dikonfirmasi

Semuanya berupa klaim spesifik yang tidak punya sumber di dalam repo, jadi perlu dicek ke
pihak museum. Kalau ternyata keliru, tinggal koreksi teksnya.

| ID | Artefak | Klaim yang perlu dikonfirmasi |
|---|---|---|
| `r2-garudeya-emas` | Garudeya Emas 22 Karat | Ditemukan di **Desa Plaosan, Kediri** pada **1989**, era **Airlangga**, **1,2 kg** emas 22 karat, **64 permata** yang tersisa **48**. Sekarang berasal dari naskah kurator; sebagian angkanya cocok dengan sumber luar, periode Airlangga vs Singasari masih berbeda antar sumber (lihat 0.9). |
| `r2-arca-durga-mahisasuramardhini` | Arca Durga Mahisasuramardhini | Berasal dari **Candi Jawi, Pasuruan**. |
| `r3-sepeda-tinggi` | Sepeda Tinggi | Dirancang **James Starley**; dibawa **elit Belanda** ke Indonesia (dari naskah kurator). |
| `r1-fosil-kepala-buaya` | Fosil Kepala Buaya | Ditemukan di **Sungai Porong**, usia **>800.000 tahun** (dari naskah kurator). |
| `r1-fosil-kepala-kerbau` | Fosil Kepala Kerbau | Ditemukan di **Sungai Porong**, usia **±800.000 tahun** (dari naskah kurator). |

### Klaim yang sengaja dihapus

| ID | Yang dihapus | Alasan |
|---|---|---|
| `r2-garudeya-emas` | "satu-satunya artefak emas 22 karat di Indonesia" | Tidak ada di naskah kurator dan tidak terverifikasi. Lihat 0.9. |
| `r3-sepeda-motor-uap` | "kecepatan ±30 km/jam" (sepeda motor uap) | Identitas bendanya berubah mengikuti naskah kurator. Lihat 0.1. |
| `r1-fosil-kepala-kerbau` | "kawasan yang lekat dengan letusan purba" | Rujukannya tidak jelas. Lihat 0.5. |
| `r2-prasasti-sangguran-info` | "repatriasi dari **Belanda**" | Negara tempat prasasti ini berada sekarang tidak dapat diverifikasi dari repo. Teksnya diganti menjadi "berada di luar negeri". **Mohon dipastikan negaranya.** |
| `r3-sepeda-tinggi` | "ciptaan **Michael Kesler**" | Sudah dihapus pada pekerjaan sebelumnya. Naskah kurator sekarang menyebut **James Starley** — kemungkinan besar inilah nama yang dimaksud. |

---

## B. Artefak yang datanya paling tipis

Deskripsi untuk artefak di bawah ini bertumpu pada pengamatan visual dan fungsi umum jenis
bendanya, karena tidak ada data spesifik yang tersedia. Semuanya layak baca apa adanya —
tapi akan jauh lebih bernilai kalau museum bisa melengkapi kolom "data yang dibutuhkan".

> **Daftar lengkap 21 artefak yang belum punya naskah kurator sekarang ada di
> [`artefak-butuh-naskah-kurator.md`](./artefak-butuh-naskah-kurator.md)** — dokumen itu
> yang sebaiknya dikirim ke kurator. Bagian ini dipertahankan untuk pertanyaan yang lebih
> rinci per artefak.

### Sudah terjawab sebagian oleh naskah kurator

| ID | Artefak | Yang masih dibutuhkan |
|---|---|---|
| `r1-fosil-kepala-buaya` | Fosil Kepala Buaya | Situs & umur sudah terjawab (Sungai Porong, >800.000 th). Masih perlu: **spesies, ukuran sebenarnya, tahun penemuan** |
| `r1-fosil-kepala-kerbau` | Fosil Kepala Kerbau | Situs & umur sudah terjawab. Masih perlu: **spesies, tahun penemuan**, dan penjelasan "letusan purba" (lihat 0.5) |
| `r1-manusia-purba` | Rekonstruksi Manusia Purba | Belum terjawab sama sekali — **didasarkan pada temuan yang mana? Dibuat oleh siapa/tahun berapa?** Lihat 0.7. |
| `r2-surya-stambha` | Surya Stambha | Asal & periode sudah terjawab (Pulau Sawu, Masa Perundagian). Masih perlu: **konfirmasi bahan (perunggu?), tinggi sebenarnya, dan keputusan soal zona** — lihat 0.2 |
| `r3-telepon-antik` | Pesawat Telepon Dinding | Jenis sudah terjawab (dinding). Masih perlu: **merek/pabrikan, arti tahun 1882** — lihat 0.3 dan 0.4 |
| `r3-sepeda-tinggi` | Sepeda Tinggi | Perancang sudah terjawab (James Starley). Masih perlu: **perkiraan tahun unit ini, asal, bahan rangka** |
| `r3-sepeda-motor-uap` | Sepeda Daimler | **Identitas bendanya sendiri belum pasti** — lihat 0.1 |
| `r3-simponion` | Symphonion | Masih perlu: **pabrikan, perkiraan tahun, jumlah piringan yang tersimpan**, dan konfirmasi klaim "satu-satunya di Indonesia" (lihat 0.6) |
| `r2-garudeya-emas` | Garudeya Emas 22 Karat | Masih perlu: **kepastian periode (Airlangga atau Singasari)** — lihat 0.9 |
| `r2-arca-ganesha` | Arca Ganesha | Masih perlu: **asal candi/situs, perkiraan abad, bahan** |
| `r2-arca-durga-mahisasuramardhini` | Arca Durga Mahisasuramardhini | Masih perlu: **konfirmasi asal Candi Jawi, perkiraan abad** |

### Belum punya naskah sama sekali

| ID | Artefak | Data yang dibutuhkan |
|---|---|---|
| `r1-kapak-persegi` | Kapak Persegi (Beliung Persegi) | Situs penemuan, jenis batuan, ukuran, nomor inventaris |
| `r1-kapak-perimbas` | Kapak Perimbas | Situs penemuan yang spesifik (sekarang hanya "beberapa situs Jawa Timur") |
| `r1-kapak-genggam` | Kapak Genggam | Situs penemuan, jenis batuan |
| `r1-nekara-perunggu` | Nekara Perunggu | Asal, ukuran, motif spesifik pada bidang pukulnya |
| `r1-koleksi-batuan` | Koleksi Batuan Prasejarah | Asal tiap jenis batuan dalam vitrin |
| `r2-prasasti-loceret` | Prasasti Loceret | **Isi prasastinya apa?** Penanggalan, aksara & bahasa yang dipakai, asal situs. Teks lama hanya menyebut "mencatat peristiwa penting" tanpa menyebut peristiwanya. |
| `r2-prasasti-sangguran-info` | Info Prasasti Sangguran | Lokasi keberadaan sekarang, status terkini upaya repatriasi, isi prasasti |
| `r2-relief-bentang-alam` | Relief Batu Bentang Alam & Perumahan | Asal situs, perkiraan periode |
| `r3-jam-matahari` | Jam Matahari | Asal, bahan, apakah dikalibrasi untuk garis lintang tertentu |
| `r3-teleskop` | Teleskop | Merek/pabrikan, perkiraan tahun, spesifikasi lensa |
| `r3-model-plta` | Model Peraga PLTA Kuno | Model ini merepresentasikan PLTA yang mana? Dibuat kapan & untuk keperluan apa? |
| `r3-senjata-api-kolonial` | Koleksi Senjata Api Kolonial | Perkiraan tahun tiap pucuk, asal, konteks penggunaan |

---

## C. Model 3D yang belum bertekstur — SELESAI

**Status: sudah beres.** Kedua sepeda sekarang memakai ekspor bertekstur yang dikirim pemilik repo.

| Artefak | File lama | File baru |
|---|---|---|
| Sepeda Tinggi | `r3-sepeda-tinggi.glb` (30 KB, 0 gambar) | `sepeda-tinggi.glb` (2,43 MB, 3 tekstur **KTX2** 1024x1024) |
| Sepeda Daimler (dulu "Sepeda Motor Uap", lihat 0.1) | `r3-sepeda-daimler.glb` (40 KB, 0 gambar) | `sepeda-daimler.glb` (2,48 MB, 3 tekstur **PNG** 1024x1024) |

Geometrinya sama persis (jumlah triangle dan bounding box identik) — yang bertambah cuma
UV + tekstur baseColor/normal/metallicRoughness. Nama material duplikat yang dulu jadi petunjuk
(`sepeda-daimler-mat.001` di file sepeda tinggi) juga sudah dibetulkan jadi `sepeda-tinggi-mat`.

Field `material_override` **sudah dihapus** dari kedua artefak sesuai instruksi lama di bagian
ini — kalau dibiarkan, `color: "#6E4A2B"` akan dikalikan ke tekstur baseColor yang baru dan
menggelapkan seluruh model. Mekanisme `material_override` sendiri tetap ada di kode
(`types/artifact.ts`) untuk aset polos berikutnya; saat ini tidak ada artefak yang memakainya.

File lama sudah dihapus dari `public/models/`.

**Catatan format tekstur — satu pekerjaan yang belum tuntas.** Standar aset proyek ini adalah
KTX2 (Basis UASTC) lewat `scripts/encode-ktx2.mjs`; semua model berat lain sudah memakainya.
`sepeda-tinggi.glb` berhasil dikonversi dan bersih. `sepeda-daimler.glb` **sengaja dibiarkan
PNG**: hasil konversinya membuat WebGL melempar `INVALID_VALUE: bufferSubData: srcOffset +
length too large` berulang tiap frame selama hall-2 aktif, dan jumlah triangle-nya ikut berubah
(7818 -> 7786) — round-trip Draco di gltf-transform tampaknya merusak buffer geometrinya.
Diverifikasi dengan mengembalikan file itu ke PNG: peringatan hilang total, sementara
sepeda-tinggi tetap KTX2 tanpa peringatan.

Konsekuensinya `sepeda-daimler.glb` memakai ~12 MB VRAM tekstur (3 x 1024x1024 RGBA8 + mipmap)
dibanding ~4 MB kalau KTX2. Layak dibereskan, tapi butuh perbaikan di pipeline-nya dulu —
bukan dengan memaksakan aset yang menghasilkan error.

**Ini menutup laporan bug "Sepeda Tinggi jadi putih saat di-interact".** Penyebabnya asetnya,
bukan logika highlight: material objek tidak disentuh sama sekali saat fokus (diverifikasi
dengan membandingkan uuid + seluruh properti material sebelum dan sesudah `focusArtifact`,
keduanya identik). Yang dulu terlihat "putih" adalah `baseColorFactor` 0.8 abu-abu bawaan glTF.

## D. Yang masih kosong di seluruh dataset

**`transkrip_audio` kosong untuk ke-32 artefak, dan `url_audio` juga kosong.** Artinya
fitur Audio Guide dan tampilan Transkrip Audio di panel informasi tidak pernah punya isi
untuk ditampilkan. Ini bukan bug pada kode — datanya memang belum ada. Kalau museum
menyediakan rekaman narasi, dua kolom itu tinggal diisi dan fiturnya langsung hidup.

---

## Cara menjaga agar tidak terulang

`npm run validate:artifacts` (ikut jalan otomatis pada `npm run build`) akan **menggagalkan
build** kalau menemukan di `artifacts.json`:

- teks boilerplate: `DRAFT`, `perlu dilengkapi`, `kurator`, `TODO`, `TBD`, `FIXME`,
  `lorem ipsum`, `placeholder`, `dummy`, `data menyusul`, `belum tersedia`, `coming soon`;
- istilah desain pameran yang bukan untuk pengunjung: `terminating vista`,
  `signature piece`, `centerpiece`, `sumbu pandang`, `dijadikan vitrine`, `plint`;
- **penyebutan audiens spesifik & catatan produksi**: `santri`, `SMP`, `Tebuireng`,
  `tampilan 3D`, `model 3D`, `render`, `aplikasi ini`, `ruang virtual` — penjaga yang
  ditambahkan setelah naskah kurator ternyata membawa kalimat dari proposal kunjungan
  sekolah dan satu catatan produksi 3D (lihat 0.10);
- `deskripsi_singkat` kosong, lebih pendek dari 40 karakter, atau lebih dari 30 kata;
- `deskripsi` kosong, lebih pendek dari 100 karakter, atau identik antar dua artefak;
- `nama` kosong atau ditulis kapital semua;
- paragraf yang berakhir tanpa titik, spasi ganda, atau spasi di akhir baris;
- `fakta_menarik` yang ada tapi kosong, atau yang isinya cuma mengulang `deskripsi`;
- `id` duplikat, `id` baru yang belum terdaftar, atau `id` lama yang hilang — daftar
  resminya ada di `KNOWN_IDS` dalam `scripts/validate-artifacts.mjs`.

Catatan hasil dari dokumen ini **tidak boleh** dipindahkan ke `artifacts.json`. Kalau sebuah
data belum tersedia, biarkan deskripsinya berhenti di kalimat terakhir yang valid — jangan
menambahkan kalimat penutup semacam "data sedang dilengkapi".
