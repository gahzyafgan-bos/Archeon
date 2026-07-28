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

## A. Klaim yang sudah ada di data dan perlu dikonfirmasi

Ini bukan tulisan baru — ketiganya sudah ada di `artifacts.json` sejak awal dan
dipertahankan apa adanya. Semuanya berupa klaim spesifik yang tidak punya sumber di dalam
repo, jadi perlu dicek ke pihak museum. Kalau ternyata keliru, tinggal koreksi teksnya.

| ID | Artefak | Klaim yang perlu dikonfirmasi |
|---|---|---|
| `r2-garudeya-emas` | Garudeya Emas 22 Karat | Ditemukan di **Desa Plaosan** pada **1989**; disebut **satu-satunya artefak emas 22 karat di Indonesia**. Tahun, nama desa, dan klaim "satu-satunya" ini perlu verifikasi. |
| `r3-sepeda-motor-uap` | Sepeda Motor Uap | Kecepatan **±30 km/jam**. Sumber angkanya? |
| `r2-arca-durga-mahisasuramardhini` | Arca Durga Mahisasuramardhini | Berasal dari **Candi Jawi, Pasuruan**. |

### Klaim yang sengaja dihapus

| ID | Yang dihapus | Alasan |
|---|---|---|
| `r3-sepeda-tinggi` | "ciptaan **Michael Kesler**" | Nama pencipta tidak dapat diverifikasi dari sumber mana pun di repo. **Kalau nama ini benar, mohon dikonfirmasi supaya bisa dikembalikan.** |
| `r2-prasasti-sangguran-info` | "repatriasi dari **Belanda**" | Negara tempat prasasti ini berada sekarang tidak dapat diverifikasi dari repo. Teksnya diganti menjadi "berada di luar negeri". **Mohon dipastikan negaranya.** |

---

## B. Artefak yang datanya paling tipis

Deskripsi untuk artefak di bawah ini sekarang bertumpu pada pengamatan visual dan fungsi
umum jenis bendanya, karena tidak ada data spesifik yang tersedia. Semuanya layak baca apa
adanya — tapi akan jauh lebih bernilai kalau museum bisa melengkapi kolom "data yang
dibutuhkan".

| ID | Artefak | Data yang dibutuhkan |
|---|---|---|
| `r1-fosil-kepala-buaya` | Fosil Kepala Buaya | Situs & tahun penemuan, perkiraan umur/lapisan, spesies, ukuran sebenarnya |
| `r1-fosil-kepala-kerbau` | Fosil Kepala Kerbau | Situs & tahun penemuan, perkiraan umur/lapisan, spesies |
| `r1-manusia-purba` | Rekonstruksi Manusia Purba | Rekonstruksi ini didasarkan pada temuan yang mana? Dibuat oleh siapa/tahun berapa? |
| `r1-kapak-persegi` | Kapak Persegi (Beliung Persegi) | Situs penemuan, jenis batuan, ukuran, nomor inventaris |
| `r1-kapak-perimbas` | Kapak Perimbas | Situs penemuan yang spesifik (sekarang hanya "beberapa situs Jawa Timur") |
| `r1-kapak-genggam` | Kapak Genggam | Situs penemuan, jenis batuan |
| `r1-nekara-perunggu` | Nekara Perunggu | Asal, ukuran, motif spesifik pada bidang pukulnya |
| `r1-koleksi-batuan` | Koleksi Batuan Prasejarah | Asal tiap jenis batuan dalam vitrin |
| `r2-surya-stambha` | Surya Stambha | Asal/situs, perkiraan periode, tinggi sebenarnya, bahan batu |
| `r2-prasasti-loceret` | Prasasti Loceret | **Isi prasastinya apa?** Penanggalan, aksara & bahasa yang dipakai, asal situs. Teks lama hanya menyebut "mencatat peristiwa penting" tanpa menyebut peristiwanya. |
| `r2-prasasti-sangguran-info` | Info Prasasti Sangguran | Lokasi keberadaan sekarang, status terkini upaya repatriasi, isi prasasti |
| `r2-relief-bentang-alam` | Relief Batu Bentang Alam & Perumahan | Asal situs, perkiraan periode |
| `r3-telepon-antik` | Telepon Genggam/Meja Antik | Merek/pabrikan, perkiraan tahun, asal. Nama tampilnya juga terasa janggal ("genggam/meja") — mungkin perlu diperjelas jenisnya. |
| `r3-sepeda-tinggi` | Sepeda Tinggi | Pembuat, perkiraan tahun, asal, bahan rangka |
| `r3-jam-matahari` | Jam Matahari | Asal, bahan, apakah dikalibrasi untuk garis lintang tertentu |
| `r3-teleskop` | Teleskop | Merek/pabrikan, perkiraan tahun, spesifikasi lensa |
| `r3-model-plta` | Model Peraga PLTA Kuno | Model ini merepresentasikan PLTA yang mana? Dibuat kapan & untuk keperluan apa? |
| `r3-senjata-api-kolonial` | Koleksi Senjata Api Kolonial | Perkiraan tahun tiap pucuk, asal, konteks penggunaan |
| `r3-simponion` | Symphonion | Pabrikan, perkiraan tahun, jumlah piringan yang tersimpan |

---

## C. Model 3D yang belum bertekstur

Dua file `.glb` di `public/models/` adalah ekspor geometri polos: **nol gambar, satu material,
`baseColorFactor` masih di nilai bawaan glTF 0.8 abu-abu**. Tidak ada kode yang memutihkannya —
memang begitu asetnya. Bandingkan dengan `ganesha.glb` (3,6 MB, 3 tekstur KTX2) atau
`simponion.glb` (2,9 MB, 3 tekstur) yang bertekstur penuh.

| File | Ukuran | Gambar | Artefak |
|---|---|---|---|
| `r3-sepeda-tinggi.glb` | 30 KB | 0 | Sepeda Tinggi |
| `r3-sepeda-daimler.glb` | 40 KB | 0 | Sepeda Motor Uap |

Petunjuk tambahan: nama material di `r3-sepeda-tinggi.glb` adalah `sepeda-daimler-mat.001` —
kedua model tampaknya diekspor dari file Blender yang sama dengan material duplikat.

**Yang dilakukan sementara:** field `material_override` di `artifacts.json` memberi keduanya
warna dasar kayu/logam gelap supaya tidak lagi tampil sebagai maket putih. Ini **keputusan
tampilan sementara, bukan warna asli benda** — nilainya ditebak dari jenis bendanya.

**Yang dibutuhkan:** ekspor ulang kedua model dengan tekstur (atau minimal material yang
diwarnai dengan benar di sumbernya). Begitu aset bertekstur masuk, **hapus field
`material_override`** dari artefak yang bersangkutan — kalau dibiarkan, ia akan menimpa tekstur
yang baru.

---

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
- deskripsi kosong, lebih pendek dari 40 karakter, atau identik antar dua artefak.

Catatan hasil dari dokumen ini **tidak boleh** dipindahkan ke `artifacts.json`. Kalau sebuah
data belum tersedia, biarkan deskripsinya berhenti di kalimat terakhir yang valid — jangan
menambahkan kalimat penutup semacam "data sedang dilengkapi".
