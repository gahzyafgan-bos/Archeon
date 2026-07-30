# Sumber Fakta Menarik (`fakta_menarik`)

Dokumen ini **hanya untuk tim internal**. Isinya tidak pernah ditampilkan ke pengunjung.

Aturannya satu: **fakta yang tidak bisa ditelusuri sumbernya tidak boleh masuk ke
`artifacts.json`.** Setiap nilai `fakta_menarik` yang ada di data harus punya barisnya
sendiri di tabel bawah. Kalau sebuah fakta dihapus dari data, hapus juga barisnya di sini;
kalau ada fakta baru, tulis sumbernya dulu, baru datanya.

Dari 32 artefak, **7 punya `fakta_menarik`**. Sisanya sengaja dikosongkan — bukan karena
terlewat. Field ini opsional, dan UI tidak merender apa pun (label, kotak, maupun garis
pemisah) untuk artefak yang tidak punya. Museum dinilai dari akurasinya, bukan dari
keseragaman kolomnya.

---

## A. Fakta yang diangkat dari naskah kurator

Ini jalur teraman: tidak ada fakta baru sama sekali, hanya memindahkan detail yang sudah
ada di naskah pemilik repo ke tempat yang lebih menonjol.

| ID | Artefak | Fakta | Sumber |
|---|---|---|---|
| `r2-arca-durga-mahisasuramardhini` | Arca Durga Mahisasuramardhini | Delapan tangan bersenjata tapi wajahnya tetap tenang — ketegangan antara daya dan keanggunan | Naskah kurator, paragraf 2: *"...mampu menaklukkan kejahatan raksasa kerbau Mahisasura namun tetap menampilkan keanggunan seorang ibu."* |
| `r3-telepon-antik` | Pesawat Telepon Dinding | Panggilan disambungkan operator sentral lewat tuas engkol; tanpa tombol atau piringan angka | Naskah kurator, paragraf 2: *"...serta tuas engkol di bagian samping untuk menghubungkan panggilan melalui operator sentral tanpa tombol atau piringan angka."* |

---

## B. Fakta dari luar naskah — sudah diverifikasi

Keempat fakta di bawah termasuk kandidat "DUGAAN" yang wajib diverifikasi dulu. Semuanya
dicek dan **lolos**; sumbernya dicantumkan supaya bisa ditelusuri ulang.

| ID | Artefak | Fakta | Sumber verifikasi |
|---|---|---|---|
| `r3-sepeda-tinggi` | Sepeda Tinggi | Julukan *penny-farthing* berasal dari perbandingan koin penny (besar) dan farthing (kecil); julukan itu baru populer setelah sepedanya mulai ditinggalkan | [Britannica — Penny-farthing](https://www.britannica.com/technology/penny-farthing); [Wikipedia — Penny-farthing](https://en.wikipedia.org/wiki/Penny-farthing) (catatan cetak pertama 1891, *Bicycling News*) |
| `r3-sepeda-motor-uap` | Sepeda Daimler | Unit Reitwagen asli musnah dalam kebakaran pabrik Cannstatt 1903; semua yang ada sekarang adalah pembuatan ulang | [Wikipedia — Daimler Reitwagen](https://en.wikipedia.org/wiki/Daimler_Reitwagen) (replika tercatat di Mercedes-Benz Museum Stuttgart, Deutsches Museum Munich, Honda Collection Hall, AMA Motorcycle Hall of Fame) |
| `r3-simponion` | Symphonion | Piringan logamnya bisa ditukar sehingga satu alat memainkan banyak lagu; kotak musik cakram baru digeser gramofon pada awal abad ke-20 | [Museums Victoria — A Brief History of the Symphonion Company](https://collections.museumsvictoria.com.au/articles/2771); [Powerhouse Collection — Symphonium music box and discs, 1885–1912](https://collection.powerhouse.com.au/object/237133) |
| `r2-surya-stambha` | Surya Stambha | Istilah *Perundagian* dari kata Bali *undagi* = orang berketerampilan khusus (melebur logam, gerabah, sampan) | [Kompas — Mengenal Masa Perundagian](https://www.kompas.com/skola/read/2022/10/04/120000669/mengenal-masa-perundagian-akhir-masa-praaksara-di-indonesia) |

---

## C. Fakta yang butuh konfirmasi museum sebelum dianggap final

Satu fakta di bawah ini **sudah tayang** karena sumber luarnya kuat dan konsisten, tapi
belum dikonfirmasi oleh pihak museum sendiri. Kalau museum punya catatan berbeda, teks di
`artifacts.json` yang harus mengalah.

| ID | Artefak | Fakta yang tayang | Sumber | Yang perlu dikonfirmasi |
|---|---|---|---|---|
| `r2-garudeya-emas` | Garudeya Emas 22 Karat | Ditemukan tidak sengaja oleh **anak berusia 12 tahun** yang sedang membersihkan pematang sawah; ia kemudian mendapat beasiswa dari pemerintah hingga lulus sebagai insinyur | [INCAR Jatim — Hiasan Garudeya](https://incar.jatimprov.go.id/jenis-cb/benda/detail/c16a38e4-dcd2-45c9-b4b2-a58b9c9477ee); [Pewarta Nusantara — Garudeya: Harta Emas Airlangga dari Sawah Plaosan](https://www.pewartanusantara.com/news/garudeya-harta-emas-airlangga-dari-sawah-plaosan/) | Apakah museum ingin nama penemunya disebut? Saat ini **sengaja tidak dicantumkan** — cerita anak 12 tahun sudah kuat tanpa menyebut nama orang. |

---

## D. Kandidat yang sengaja TIDAK ditulis

Supaya tidak dikerjakan ulang oleh orang berikutnya, ini daftar fakta yang sempat
dipertimbangkan lalu dibuang.

| Artefak | Kandidat | Alasan dibuang |
|---|---|---|
| Manusia Purba | — | Tidak ada satu pun detail spesifik di naskah maupun di data. Entri paling tipis dari 11 naskah; lihat `artefak-butuh-verifikasi-kurator.md`. |
| Fosil Kepala Buaya | — | Semua yang diketahui (Sungai Porong, >800.000 tahun) sudah ada di deskripsi. Mengulangnya bukan fakta menarik, itu pengulangan. |
| Fosil Kepala Kerbau | — | Sama seperti di atas. Klaim "letusan purba" dari naskah tidak jelas rujukannya dan tidak ditulis di mana pun. |
| Arca Ganesha | Kisah gading patah yang dipakai menulis Mahabharata | Versi ceritanya berbeda-beda antar sumber dan tidak ada kaitan langsung dengan arca ini. Tidak dapat diverifikasi ke tingkat yang layak dicetak sebagai fakta museum. |
| Sepeda Daimler | Kecepatan 12 km/jam | Sudah ada di deskripsi. |
| Symphonion | "Satu-satunya di Indonesia" | **Justru berlawanan dengan sumber** — lihat `artefak-butuh-verifikasi-kurator.md`. |
