# Checklist Master — Urutan Prompt

Daftar prompt besar yang sudah dijalankan di proyek ini, dalam urutan pengerjaan.
Setiap entri dicatat setelah prompt selesai dilaksanakan (semua fase commit).

---

## 1. Fix Pucat/Overexposed — Tone Mapping, Shadow, Color Grading + Pengaturan Grafis

**File sumber:** `prompt-fix-pucet-grading-shadow-graphic-settings.md` (didapat dari luar repo, isinya diringkas di bawah)

**Masalah:** Setelah refactor 4 walled rooms -> 2 open halls, scene jadi overexposed/washed-out —
dinding & lantai kecuci nyaris putih, warna kurang saturasi, tidak ada bayangan sehingga objek
"melayang".

**Yang dikerjakan (6 fase, masing-masing 1 commit):**

- [x] **Fase 1 — Fondasi lighting**: `toneMappingExposure` diturunkan 1.25 → 0.95 (ACES tetap,
      itu default R3F), `ambientLight`/`hemisphereLight` diturunkan drastis (1.7/1.4 → ~0.4),
      satu `directionalLight` baru ditambah sebagai key light berarah.
- [x] **Fase 2 — Shadow**: `Canvas shadows` + directional key light `castShadow` sekarang
      preset-gated (mati di Rendah), shadow-camera frustum menyesuaikan ukuran hall, dinding
      dapat `receiveShadow`, ditambah `<ContactShadows>` (drei) murah untuk "menempelkan" objek
      ke lantai di semua preset.
- [x] **Fase 3 — Grading**: `Bloom` diperbaiki (threshold naik, intensity turun jadi aksen saja),
      tambah `HueSaturation` + `BrightnessContrast` + `Vignette`, tambah `<Environment>` (drei)
      intensitas rendah untuk respons material.
- [x] **Fase 4 — AO preset Tinggi**: `N8AO` ditambah, hanya nyala saat `graphicsQuality === "tinggi"`
      dan otomatis mati di Mode VR.
- [x] **Fase 5 — Pengaturan Grafis**: field `graphicsQuality` (persist localStorage) +
      `graphicsPresets.ts` (peta Rendah/Sedang/Tinggi → dpr/shadow/AO/env/accent light count) +
      `useGraphicsPreset()` hook (clamp otomatis ke maksimal Sedang saat Mode VR aktif) +
      auto-default dari `useDeviceDetection` (desktop → Tinggi, mobile → Sedang/Rendah) + kontrol
      UI baru di `SettingsPanel` tab Visual.
- [x] **Fase 6 — Verifikasi**: `tsc -b` bersih, `vite build` sukses, dev server dijalankan &
      di-drive lewat Playwright headless — konfirmasi scene tidak lagi washed-out (ada gradasi
      terang-gelap + bayangan di lantai), ganti Rendah/Sedang/Tinggi di panel langsung berubah
      tanpa reload/flash dan tanpa console error.

**File yang berubah:** `src/components/MuseumExperience.tsx`, `src/components/rooms/RoomShell.tsx`,
`src/components/PostProcessing.tsx`, `src/components/artifacts/ArtifactMesh.tsx`,
`src/hooks/useDeviceDetection.ts`, `src/hooks/useGraphicsPreset.ts` (baru),
`src/utils/graphicsPresets.ts` (baru), `src/store/useMuseumStore.ts`,
`src/components/ui/SettingsPanel.tsx`.

---

## 2. Fix Item/Hiasan Numpuk & Tembus-tembusan — Aturan Jarak & Penempatan Objek

**File sumber:** `prompt-fix-item-numpuk-spacing-penempatan.md` (didapat dari luar repo)

**Masalah:** Di Galeri Hindu-Buddha (hall-1), sepasang arca Dwarapala dekoratif
(gapura zona) ditempatkan hampir persis di baris depan grid artefak — menembus
pedestal Arca Durga Mahisasuramardhini dan vitrine kaca Garudeya Emas. Bangku
zona (HallBenches) juga duduk tepat di centerline zona, menembus artefak
"Info Prasasti Sangguran" yang memang diletakkan dekat dinding belakang.

**Yang dikerjakan:**

- [x] **Fase 1 — Audit**: script audit sementara (bukan bagian repo) yang
      meniru semua formula penempatan artefak + hiasan prosedural di kedua
      hall, mengecek tiap pasangan objek (`dist >= footprintA + footprintB +
      margin`). Ketemu 2 overlap parah (Dwarapala vs Durga/Garudeya, bangku
      vs Info Prasasti Sangguran) dan beberapa overlap kecil (<0.3m, pilar/batu)
      yang masih dalam toleransi.
- [x] **Fase 2 — Artefak & plinth**: diaudit — tidak ada overlap antar-artefak
      atau hiasan di atas plinth artefak, jadi tidak ada perubahan kode.
- [x] **Fase 3 — Hiasan**: pasangan Dwarapala digeser ke tepi zona (offset
      x 2.2→2.6, z-multiplier 0.6→0.85 dari radius zona) supaya jelas di luar
      grid artefak depan. `HallBenches` digeser menyamping dari centerline
      zona (`x + radius*0.45`) supaya tidak lagi searah dengan artefak yang
      duduk dekat dinding belakang.
- [x] **Fase 4 — Pencegahan**: `src/utils/placementValidator.ts` (baru) —
      util dev-only yang mengecek semua pasangan objek (artefak + hiasan
      prosedural) per hall sekali saat `RoomShell` mount (bukan tiap frame),
      `console.warn` kalau footprint-nya overlap. Footprint & margin
      didokumentasikan di file yang sama.
- [x] **Fase 5 — Verifikasi**: `tsc -b` bersih; audit ulang setelah fix
      mengonfirmasi kedua overlap parah hilang. Verifikasi visual in-game
      (screenshot before/after) tidak selesai — automasi browser sesi ini
      terkendala throttling render-loop pada tab background & mismatch
      koordinat viewport antar-tab; disarankan verifikasi manual sekali di
      browser sebelum dianggap final secara visual.

**File yang berubah:** `src/components/rooms/RoomShell.tsx`,
`src/components/architecture/HallEdgeDecor.tsx`,
`src/utils/placementValidator.ts` (baru).

---

## 3. Fix Bayangan Belang dari Struktur/Hiasan Langit-langit

**File sumber:** `prompt-fix-bayangan-atap-hiasan-langit.md` (didapat dari luar repo)

**Masalah:** Garis-garis bayangan diagonal belang di lantai, di-cast oleh
rangka balok atap joglo (ceiling beam grid di `RoomShell`) dari directional
key light.

**Yang dikerjakan (1 commit, low-risk — cuma flag `castShadow`):**

- [x] Matikan `castShadow` pada grid balok atap (`beam-x`/`beam-z` di ceiling
      group `RoomShell.tsx`) — sumber utama garis diagonal belang.
- [x] Matikan `castShadow` pada canopy `HangingLamp` (fixture langit-langit,
      posisinya nempel di grid balok yang sama).
- [x] Matikan `castShadow` pada dedaunan `PottedPlant` (props kecil berulang
      — sesuai prinsip performa yang sama dipakai di tempat lain; badan pot
      tetap cast).
- [x] Tidak diubah: bayangan artefak, tiang/kolonade, plinth, arca Dwarapala,
      bangku, papan zona — semua sudah `castShadow` dari sebelumnya dan tetap
      dipertahankan. Sistem shadow & tone/exposure tidak disentuh.
- Verifikasi visual in-game belum sempat dilakukan (kendala automasi browser
  di sesi sebelumnya) — `tsc -b` bersih, disarankan cek manual sekali di
  browser (preset Sedang/Tinggi) untuk konfirmasi garis belang sudah hilang.

**File yang berubah:** `src/components/rooms/RoomShell.tsx`,
`src/components/architecture/HangingLamp.tsx`,
`src/components/architecture/PottedPlant.tsx`.

---

## 4. Rombak Tata Letak & Elemen Ruang ala Desainer Pameran Museum Profesional

**File sumber:** `prompt-desain-museum-hero-hierarki-tata-letak.md` (didapat dari luar repo)

**Masalah:** Tiang berdiri sendiri terlihat seperti noise di tengah ruang, dan
penempatan artefak flat/membosankan — semua di alas hitam identik (cylinder
`#2a2826`/`#3a3025`, ukuran sama, tinggi seragam `y+0.55`), disebar rata
seperti grid 3x2/4x3 tanpa hero, tanpa fokus, tanpa cerita.

### Fase 1 — Audit & rencana desain

**Audit kolom:** satu-satunya pemakaian `<Pillar>` di kode saat ini adalah
pasangan kolom "candi" di tiap ambang antar-zona (`RoomShell.tsx`, flanking
jalur, offset tegak lurus 2.2m) plus kolonade instanced di sepanjang kedua
dinding panjang (`HallEdgeDecor.tsx`, spacing 4.5m, inset 1.4m dari dinding).
Tidak ditemukan tiang berdiri sendiri tanpa logika di tengah ruang terbuka —
keduanya sudah kolonade tepi/gerbang zona yang sah. Fase 2 karena itu berfokus
pada **reposisi kolom ambang** supaya sejalan dengan sumbu pandang hero baru
(bukan pembongkaran, karena tidak ada yang perlu dibongkar), plus audit ulang
setelah Fase 4 kalau-kalau reposisi artefak memunculkan kolom yang jadi
menghalangi.

**Hero per zona & signature piece:**
- **Prasejarah** (aksen `#C56A3A`, center -12,-4): hero = **Fosil Tengkorak
  Pithecanthropus Erectus** — dipindah ke pojok belakang-barat (dekat
  dinding barat, jauh dari pintu masuk zona) sebagai *terminating vista* saat
  pengunjung berjalan dari Selamat Datang, dengan backdrop panel dinding +
  step pedestal + spotlight. Fosil Homo Erectus jadi pasangan "evolusi
  manusia" di dekatnya (lebih kecil/rendah). Kapak perimbas + kapak genggam
  jadi vignette "alat batu" tersendiri (pedestal rendah, mengelompok, bukan
  segaris). Nekara Perunggu jadi *featured* (pedestal sedang, lampu sendiri).
  Koleksi Batuan jadi vitrine kaca sederhana dekat pintu masuk zona.
- **Hindu-Buddha** (aksen `#2E4A7D`, center 12,-4): hero/signature =
  **Garudeya Emas** (sudah brankas kaca — dipertahankan, dipindah ke sudut
  klimaks dekat dinding timur dengan backdrop + rope stanchion + kedua arca
  Dwarapala asli (`r2-dwarapala-1/2`, bukan patung prosedural gerbang)
  direposisi jadi penjaga yang mengapit langsung vitrine-nya). Arca Durga &
  Ganesha jadi *featured* (tetap `is_ikonik`, staging sedikit di bawah hero).
  Trimurti (Brahma/Wisnu/Siwa) + Nandi jadi klaster tematik (Nandi didekatkan
  ke Siwa, sesuai deskripsi aslinya). Relief Bentang Alam & Prasasti Loceret
  jadi panel/niche dinding (memang relief & prasasti, cocok untuk niche).
- **Transisi-IPTEK** (hall-2, aksen `#1F7A6E`, center 0,-2): hero = **Sepeda
  Motor Uap** — dipindah ke pusat-belakang (dekat dinding selatan yang solid,
  tanpa pintu) sebagai terminating vista, dengan backdrop. Sepeda
  Tinggi/Kayu jadi *featured* di sampingnya. Teleskop diletakkan di sumbu
  pandang dekat pintu masuk zona (mengarahkan mata ke hero, seperti "melihat
  lewat teropong menuju hero"). Sisanya (telepon antik, jam matahari, model
  PLTA, senjata api kolonial) mengelompok asimetris di sekitarnya.

**Ragam pedestal (Fase 3):** field presentasional baru & opsional di
`Artifact` (`display_tier: "signature"|"hero"|"featured"|"regular"`,
`pedestal_height`, `display_mode: "pedestal"|"vitrine"|"niche"`) — tidak
mengganti/merusak `is_ikonik` (tetap dipakai InfoPanel utk badge "Koleksi
Ikonik") atau kontrak data lain. Tinggi pedestal bervariasi 0.3/0.6/0.8/1.1m
+ versi step untuk hero, warna dari palet Batik Modern (kayu/batu/brass),
bukan hitam pekat.

**Rencana eksekusi:** Fase 2 (kolom) → Fase 3 (sistem pedestal/niche/vitrine)
→ Fase 4 (re-layout koordinat artefak + hiasan prosedural terkait, divalidasi
`placementValidator`) → Fase 5 (matikan spotlight per-artefak reguler biar
kontras hero nyata + hemat performa, spotlight hero/signature diperkuat) →
Fase 6 (verifikasi). Tidak ada perubahan yang menyentuh sistem anchor
interaksi terpisah — `PlayerRig`/`InfoPanel` membaca `koordinat_ruangan`
langsung dari data, jadi pemindahan posisi otomatis konsisten dengan titik
interaksi tanpa perlu sinkronisasi manual.

- [x] **Fase 2 — Kolom**: tidak ada tiang berdiri-sendiri yang perlu dibongkar
      (kolonade tepi & kolom ambang zona sudah sah); ditambah pasangan kolom
      "candi" tipis (`ZoneConfig.heroFocus` baru) yang membingkai hero tiap
      zona, dihitung generik dari sumbu center→hero.
- [x] **Fase 3 — Sistem pedestal & display bervariasi**: pedestal cylinder
      hitam identik (`ArtifactMesh.tsx`) diganti sistem bertingkat (reguler
      batu abu hangat, featured batu+brass, hero/signature plinth 2-step+kayu)
      + mode `vitrine` (etalase kaca) dan `niche` (ledge+panel dinding). Field
      baru di `Artifact` (`display_tier`, `pedestal_height`, `display_mode`)
      opsional, tidak mengubah `is_ikonik`/InfoPanel. `koordinat_ruangan.y`
      sekarang tinggi dunia literal (bukan offset +0.55 dari pedestal tetap).
- [x] **Fase 4 — Re-layout artefak per zona**: seluruh 26 artefak dipindah
      dari grid flat ke clustering naratif asimetris dengan hero/signature di
      terminating vista (Pithecanthropus di prasejarah, Garudeya Emas di
      Hindu-Buddha, Sepeda Motor Uap di Transisi-IPTEK) + backdrop dinding
      baru per hero (`nearestWallFor`, generik). Semua koordinat divalidasi
      lewat re-implementasi rumus `placementValidator` (footprint
      hero/featured/signature/niche baru) di luar repo sebelum ditulis ke
      JSON — tidak ada overlap.
- [x] **Fase 5 — Focal lighting & wayfinding**: spotlight hero dipertajam
      (intensity 42 vs featured 25-35 vs reguler 7) untuk kontras
      terang-gelap yang nyata; jalur wayfinding (`FloorPath`) sekarang
      mengalir ke `heroFocus` tiap zona, bukan center kosong.
- [x] **Fase 6 — Verifikasi**: `tsc -b` bersih, `vite build` sukses (lint
      tidak bisa dijalankan — repo belum punya `eslint.config.js`, masalah
      pre-existing di luar scope prompt ini). Verifikasi visual in-browser
      **tidak** sempat dilakukan — ekstensi Chrome tidak tersambung di sesi
      ini (`tabs_context_mcp` gagal). Disarankan cek manual sekali di browser
      (`npm run dev`) untuk konfirmasi staging hero, backdrop, niche, dan
      pencahayaan terlihat sesuai rencana sebelum dianggap final secara
      visual — logika penempatan sudah tervalidasi lewat script, tapi belum
      pernah dirender & dilihat langsung.

**File yang berubah:** `src/types/artifact.ts`, `src/data/roomConfig.ts`,
`src/data/artifacts.json`, `src/components/artifacts/ArtifactMesh.tsx`,
`src/components/rooms/RoomShell.tsx`,
`src/components/architecture/FloorPath.tsx`, `src/utils/placementValidator.ts`.

---

## 5. Fix Performa Berat — Preset Rendah Benar-benar Ringan, Reaktif, Transisi Mulus, Auto-Adaptif

**File sumber:** `prompt-fix-performa-berat-preset-rendah-transisi-grafik.md` (didapat dari luar repo)

**Masalah:** App berat/nge-lag di deploy server, bahkan preset grafis **Rendah**
masih patah-patah. Ganti preset terasa "tidak berfungsi" (beban render tidak
benar-benar berubah), dan transisi ganti preset tidak mulus. Tampilan
(palet, kehangatan, hero staging dari prompt #4) harus dipertahankan.

**Riset awal:** sebagian besar infrastruktur (dpr/shadow reaktif di Canvas,
ContactShadows `frames={1}`, Environment/accent-light gated per preset,
instancing di `HallEdgeDecor`) ternyata **sudah benar** dari prompt #1.
Akar masalah nyata: `PostProcessing.tsx` (EffectComposer: Bloom+HueSaturation+
BrightnessContrast+Vignette) jalan di **semua** preset termasuk Rendah — full-
screen postprocessing ini biang lag terbesar di GPU lemah/server.

**Yang dikerjakan (6 fase, masing-masing 1 commit):**

- [x] **Fase 1 — Rendah benar-benar ringan**: `postProcessingEnabled` &
      `antialias` baru di `graphicsPresets.ts`, off di Rendah (composer
      EffectComposer tidak di-mount sama sekali, bukan cuma effect-nya
      dikosongkan). Kompensasi look murah: `toneMappingExposure` Rendah
      dinaikkan sedikit (0.95→1.05), ambient/hemisphere intensity & warna
      fog di `RoomShell.tsx` dihangatkan tipis saat composer mati — supaya
      tetap terlihat hangat tanpa grading pass.
- [x] **Fase 2 — Verifikasi apply reaktif**: drei `<Stats/>` ditambah di
      `MuseumExperience.tsx`, gated `import.meta.env.DEV` (tree-shaken dari
      build produksi) untuk membuktikan FPS beda nyata antar preset saat
      `npm run dev`. DPR/shadow sudah reaktif by design (props R3F biasa).
- [x] **Fase 3 — Transisi mulus**: Canvas sudah tidak pernah remount ganti
      preset (dikonfirmasi, tidak diubah); toggle EffectComposer mount/unmount
      Rendah↔Sedang/Tinggi — turun ke Rendah instan (unmount murah), naik
      boleh sedikit hitch shader-compile pertama kali (diperbolehkan sesuai
      spec). Tidak ada perubahan kode.
- [x] **Fase 4 — Default Rendah + VR paksa Rendah**: default
      `graphicsQuality` di store & auto-detect (`useDeviceDetection`)
      diubah dari device-based (desktop→Tinggi) jadi selalu `"rendah"` di
      kunjungan pertama; `VR_MAX_QUALITY` di `useGraphicsPreset` diubah dari
      `"sedang"` jadi `"rendah"`. Persistensi manual (localStorage,
      `graphicsQualityCustomized`) sudah ada, tidak diubah.
- [x] **Fase 5 — Auto-adaptif**: drei `<PerformanceMonitor>` +
      `<AdaptiveDpr>`/`<AdaptiveEvents>` (non-VR) ditambah di
      `MuseumExperience.tsx` — pixel ratio otomatis turun/naik dalam batas
      `dpr` preset aktif mengikuti FPS terukur, jaring pengaman di atas
      preset manual.
- [x] **Fase 6 — Nol alokasi per-frame**: `DustParticles.tsx` — 
      `p.vel.clone().multiplyScalar(delta)` (alokasi `Vector3` baru per
      partikel per frame, x80 partikel x tiap artefak hero/featured) diganti
      update in-place tanpa alokasi.
- [ ] **Fase 7 — Verifikasi visual in-browser**: `tsc -b` bersih & `vite
      build` sukses di tiap fase (dijalankan sebelum tiap commit). Verifikasi
      visual langsung di browser **tidak** sempat dilakukan — ekstensi
      Chrome tidak tersambung di sesi ini (sama seperti kendala prompt #2 dan
      #4 sebelumnya). Disarankan cek manual: `npm run dev`, bandingkan FPS
      (Stats overlay pojok) antar 3 preset, konfirmasi tidak ada
      freeze/flash saat ganti preset, preset Rendah tetap hangat, dan Mode
      VR ter-clamp ke Rendah.

**File yang berubah:** `src/utils/graphicsPresets.ts`,
`src/components/MuseumExperience.tsx`, `src/components/rooms/RoomShell.tsx`,
`src/store/useMuseumStore.ts`, `src/hooks/useDeviceDetection.ts`,
`src/hooks/useGraphicsPreset.ts`, `src/components/artifacts/DustParticles.tsx`.

---

## 6. Bongkar Kolom Tengah & Rombak Tata Artefak (v2, tegas & terukur)

**File sumber:** `prompt-rombak-tegas-kolom-tengah-tata-artefak.md` (didapat dari luar repo)

**Masalah:** Klaim bahwa prompt #4 (redesain tata letak) tidak menghasilkan
perubahan terlihat — kolom masih ada di tengah, artefak masih monoton.
Diminta eksekusi literal & terukur, bukan prinsip abstrak lagi.

**Audit geometris** (dihitung dari koordinat aktual di `roomConfig.ts`/
`artifacts.json`, bukan dari komentar kode) mengonfirmasi klaim ini secara
faktual: 6 dari 30 instance pilar berjarak >5m dari dinding terdekat (2
pasang "threshold pillar" Hall-1 yang tidak mengapit hero sama sekali, dan
1 pasang "hero-framing pillar" Hall-2 yang justru lebih jauh dari dinding
dibanding hero yang dibingkainya). Terpisah dari itu, 69% artefak (18/26,
semua tier `regular`) memakai warna pedestal & material artefak yang
identik persis di semua zona — akar "monoton" yang lebih dalam dari
sekadar tata letak. Trimurti (Brahma/Wisnu/Siwa) di zona Hindu-Buddha juga
ternyata terpecah — Siwa terisolasi ~10m dari Brahma/Wisnu.

**Yang dikerjakan (5 fase kode + 1 fase verifikasi, masing-masing 1 commit):**

- [x] **Fase 1 — Bongkar 6 kolom mid-floor**: blok "threshold pillar"
      Hall-1 dihapus total (4 pilar); pengecekan jarak-ke-dinding baru
      (`distanceToNearestWall` + `HERO_FRAME_MAX_WALL_DIST=5`, data-driven
      bukan hardcode per-zona) men-skip pasangan hero-framing Hall-2 (2
      pilar) yang gagal berfungsi sebagai framing. 4 pilar hero-framing
      Hall-1 (3.5-4.4m dari dinding, benar-benar mengapit hero pojok) & 20
      pilar kolonade tepi dipertahankan. **Hasil: 30 → 24 pilar**,
      diverifikasi ulang lewat perhitungan independen pasca-perubahan.
      `placementValidator.ts` di-mirror sesuai.
- [x] **Fase 2 — Pengganti elemen**: `HangingBanner` (sudah ada di repo,
      belum dipakai) dipasang menggantung dari langit-langit di titik-titik
      yang barusan kehilangan pilarnya (threshold Hall-1 + hero-approach
      Hall-2 yang di-skip) — ritme vertikal pengganti tiang, tanpa
      menghalangi lantai/sightline.
- [x] **Fase 3 — Variasi tier `regular`**: warna pedestal & material
      artefak `regular` di-tint dengan `accentColor` zona (~15% mix, dulu
      satu abu-abu universal di seluruh museum); tier `regular` bergantian
      antara profil drum vs kotak rendah (hash deterministik dari
      `artifact.id`). Eye-level rule: 4 artefak kecil bernilai
      (kapak-perimbas, kapak-genggam, teleskop, jam-matahari) diangkat ke
      ~1.45m, kapak pakai varian "kolom ramping" baru.
- [x] **Fase 4 — Re-layout klaster Hindu-Buddha**: Siwa & Nandi (dulu
      terisolasi di 16.8,-1/16.8,1.5) dipindah ke dekat Brahma/Wisnu
      (13.0,-0.8/13.5,1.5) — klaster Trimurti+Nandi yang benar-benar
      berdekatan, divalidasi lewat re-implementasi rumus
      `placementValidator` di luar repo sebelum ditulis ke JSON. Zona
      Prasejarah & Transisi-IPTEK tidak diubah — sudah cukup terklaster.
- [x] **Fase 5 — Framing & spotlight**: tidak ada perubahan kode — sistem
      spotlight fokus (hero 42, featured 25-35, regular 7) dari prompt #4
      sudah kontras sesuai spec, cukup untuk menggantikan peran reveal
      pilar yang dihapus di Fase 1.
- [ ] **Fase 6 — Verifikasi**: `tsc -b` bersih & `vite build` sukses di
      tiap fase. Angka pilar 30→24 diverifikasi ulang lewat perhitungan
      independen (bukan cuma dipercaya dari kode). Koordinat Siwa/Nandi
      divalidasi lewat script jarak/footprint sebelum commit — tidak ada
      overlap. Verifikasi visual in-browser **tidak** sempat dilakukan —
      ekstensi Chrome tidak tersambung di sesi ini (kendala berulang, sama
      seperti prompt #2, #4, #5). Disarankan cek manual: `npm run dev`,
      titik pandang pintu masuk tiap zona (konfirmasi sumbu lapang + hero
      langsung terlihat), dan tier `regular` tidak lagi seragam warnanya.

**File yang berubah:** `src/components/rooms/RoomShell.tsx`,
`src/utils/placementValidator.ts`, `src/components/artifacts/ArtifactMesh.tsx`,
`src/data/artifacts.json`.

---

## 7. Right-size Hall 1 + Isi Titik Tengah Kosong + Optimasi Berat di HP & Render Awal Lambat

**File sumber:** `prompt-rightsize-hall1-isi-tengah-optimasi-mobile.md` (didapat dari luar repo)

**Masalah (3 sekaligus, saling terkait):** Hall 1 (40x24m, 3 zona tersebar
ke tepi) terasa berat di HP, render awal lambat (semua aset dimuat
sekaligus + kompilasi shader menumpuk di frame pertama), dan titik tengah
kosong (sumbu pandang dari spawn berakhir di lantai/tembok kosong karena
kedua hero zona berada di pojok, bukan di sumbu tengah).

**Yang dikerjakan (2 commit gabungan fase, karena koordinatnya saling
bergantung):**

- [x] **Fase 1 — Right-size Hall 1**: `bounds` 40x24 -> **30x18** (skala
      0.75 seragam), `ceilingHeight` baru (field opsional di `RoomConfig`,
      hall-1 = 6.5m) supaya langit-langit tetap tinggi walau lantai
      mengecil (rapat di lantai, tinggi di atas). Spawn & kedua pintu
      archway (posisi + `targetSpawn` timbal-balik ke hall-2) dihitung
      ulang presisi, bukan sekadar diskalakan, supaya tetap tepat di
      batas jangkauan pemain dan aman dari trigger pintu satunya.
      MiniMap & collision (`PlayerRig`) otomatis ikut karena keduanya
      sudah generik dari `room.bounds` — tidak ada perubahan kode di sana.
- [x] **Seluruh 19 artefak hall-1 + dekor prosedural direposisi**: bukan
      skala linear buta (footprint & margin objek tidak ikut mengecil,
      jadi jarak antar-objek yang tadinya pas-pasan bisa tembus) —
      dihitung lewat **repulsion-relaxation** di luar repo (mirror rumus
      `placementValidator.ts`/`RoomShell.tsx`/`HallEdgeDecor.tsx`) sampai
      0 overlap, lalu ditulis ke `artifacts.json`/`roomConfig.ts`. Kolonade
      & bangku dapat exclusion/arah generik baru (skip pilar dekat
      hero-focus/niche/pot; bangku menjauh dari sisi hero suatu zona,
      bukan selalu +x) — bug laten yang baru kelihatan setelah hall
      mengecil, dibuat robust lewat kode bukan ditambal per-titik.
      Setelah commit pertama, harness `esbuild` di luar repo menjalankan
      **`placementValidator.ts` versi asli** (bukan mirror) terhadap data
      final — ketemu 10 pasang tepat-di-batas ("short by 0.00m", lolos
      dari toleransi pembulatan validasi manual) dan diperbaiki di commit
      susulan lewat relaxation dengan safety-buffer 0.06m + gerbang
      Dwarapala prosedural (z-multiplier 0.85->0.90). Hasil akhir: **0
      warning** di kedua hall lewat harness yang sama.
- [x] **Fase 2 — Identitas zona**: cahaya aksen per-zona sekarang bertinta
      `zone.accent` masing-masing (dulu satu oranye generik untuk seluruh
      hall) — lantai motif per zona, threshold banner, dan signage sudah
      ada dari prompt sebelumnya, dipertahankan. Beda ketinggian lantai
      (opsional di spec) **tidak dikerjakan** — `PlayerRig` tidak punya
      logika elevasi vertikal (kamera selalu di `EYE_HEIGHT` tetap), jadi
      butuh perubahan gerak pemain yang lebih besar; identitas zona sudah
      dipenuhi lewat 4 cue lain (motif lantai, gerbang, cahaya, signage).
- [x] **Fase 3 — Isi titik tengah**: `CenterInstallation.tsx` baru (medalion
      lantai + crest dinding + sepasang pilar + spotlight) di
      `room.centerFocus` (field baru di `RoomConfig`, hall-1 saja) — tidak
      menyentuh `artifacts.json`, murni set dressing arsitektural supaya
      sumbu pandang dari spawn selalu berakhir di sesuatu, bukan tembok
      kosong. `FloorPath` dialurkan lewat titik ini.
- [x] **Fase 4 — Render awal**: `<Preload all />` (drei, precompile shader
      setelah scene mount), progress bar loading screen diganti dari timer
      acak ke `useProgress` (drei, tracking `THREE.DefaultLoadingManager`
      nyata) digabung status fetch artefak, `camera.far` preset-driven
      (200 tetap -> 40 Rendah/80 Sedang) karena kedua hall < 35m sehingga
      far pendek mempersempit volume frustum-culling di HP. Lazy-load
      Hall 2 & audio-lazy **sudah terpenuhi dari sebelumnya** (tiap hall
      fetch/mount artefaknya sendiri saat aktif; `Howl` ambience/guide
      dibangun di effect terpisah, tidak memblokir render) — tidak ada
      perubahan.
- [x] **Fase 5 — Berat di HP**: temuan utama — **setiap artefak regular**
      (15-19 per hall) membawa `spotLight` isian sendiri yang selalu nyala
      apa pun preset grafis; forward-rendering three.js menghitung tiap
      fragment terhadap semua light aktif, jadi ini beban real-light
      terbesar yang belum tersentuh prompt performa manapun sebelumnya.
      `perArtifactFillLights` (preset baru) mematikannya di Rendah —
      piece regular tetap dapat cue lewat tint emissive `isNearby` yang
      sudah ada (nyaris gratis). `dustParticlesEnabled` mematikan
      `DustParticles` (overdraw additive-blend) di Rendah. Ceiling beam
      grid (`RoomShell`) diinstance (2 draw call, dulu satu mesh per
      balok). Tekstur/KTX2/atlas **tidak relevan** — semua "tekstur" di
      app ini `CanvasTexture` prosedural kecil (128px), bukan file aset;
      model `.glb` sudah kecil (12-40KB). Render-scale 0.7-0.8 terpisah
      dari DPR **tidak dikerjakan** — R3F tidak punya jalur bawaan untuk
      itu tanpa restrukturisasi Canvas yang lebih invasif; DPR sudah
      di-cap 1.0 di Rendah (lever utama). Build produksi/gzip-brotli:
      `npm run build` sudah mode produksi by default, kompresi hosting di
      luar kendali kode repo.
- [x] **Fase 6 — Auto-adaptif**: **sudah ada dari prompt performa
      sebelumnya** (`PerformanceMonitor` + `AdaptiveDpr` + `AdaptiveEvents`
      di `MuseumExperience.tsx`) — tidak ada perubahan.
- [ ] **Fase 7 — Verifikasi**: `tsc -b` & `vite build` bersih di tiap
      commit. Placement divalidasi via harness `esbuild` di luar repo yang
      menjalankan `placementValidator.ts` **asli** (bukan mirror) terhadap
      `roomConfig.ts`/`artifacts.json` sungguhan — 0 warning di kedua hall
      (lihat detail di atas). Verifikasi visual in-browser **tidak**
      sempat dilakukan — ekstensi Chrome tidak tersambung di sesi ini
      (kendala berulang, sama seperti prompt #2, #4, #5, #6). FPS
      before/after dan screenshot titik-masuk yang diminta spec bagian 8
      juga tidak bisa diambil karena kendala yang sama. Disarankan cek
      manual: `npm run dev`, titik masuk Hall 1 (buktikan tengah tidak
      kosong + hero terlihat + zona tetap beda), bandingkan FPS HP asli
      preset Rendah sebelum/sesudah, dan transisi ke Hall 2 tetap mulus.

**File yang berubah:** `src/data/roomConfig.ts`, `src/data/artifacts.json`,
`src/components/rooms/RoomShell.tsx`,
`src/components/architecture/CenterInstallation.tsx` (baru),
`src/components/architecture/HallEdgeDecor.tsx`,
`src/components/architecture/FloorPath.tsx`,
`src/components/MuseumExperience.tsx`,
`src/components/artifacts/ArtifactMesh.tsx`, `src/utils/graphicsPresets.ts`,
`src/utils/placementValidator.ts`.

---

## 8. Fix Gerbang Antar-Hall Tertutup Hiasan + Right-size Hall 2

**File sumber:** `prompt-fix-gerbang-tertutup-hiasan-rightsize-hall2.md` (didapat dari luar repo)

**Masalah:** (1) area arch Hall 1 -> Hall 2 terbaca sebagai tembok buntu,
bukan jalan tembus. (2) Hall 2 (`Transisi ke IPTEK`, 32x24m, 1 zona)
terasa kosong & berat.

**Audit (Fase 1):** `CenterInstallation` yang ditambahkan prompt #7 untuk
mengisi titik tengah Hall 1 ternyata menempatkan wall-crest 3.6m lebar
persis di dinding & sumbu-x yang sama dengan arch Hall 1->Hall 2
(keduanya `x=0`, dinding `minZ`) — panel itu menutup penuh bukaan yang
seharusnya jadi jalan tembus, persis gejala di screenshot ("panel batik +
2 kolom membentang pas di bukaan arch"). Regresi dari sesi sebelumnya,
bukan bug lama. Tidak ada arch lain yang tertutup — backdrop hero
prasejarah/hindu-buddha Hall 1 ada di dinding berbeda; Hall 2 belum punya
dekor dekat archnya sendiri.

**Yang dikerjakan (3 commit, masing-masing 1+ fase):**

- [x] **Fase 2 — Fix gerbang**: `CenterInstallation` wall-crest dihapus
      total (medalion lantai + 2 pilar + spotlight dipertahankan) — tugas
      "vista" di sumbu tengah sekarang dipegang arch itu sendiri, bukan
      bersaing dengan panel dinding yang butuh ruang yang sama. `ArchwayGlimpse`
      baru (generik per-`Door`, bukan hardcode Hall 1/2): peek floor sempit
      di baliknya ditinta warna+aksen hall tujuan (satu-satunya cara
      "mengintip" tanpa memuat kedua hall sekaligus, karena hall
      di-lazy-load per spec performa sebelumnya), spill light warna aksen
      tujuan, label kecil di atas ambang ("Menuju Transisi ke IPTEK").
      `FloorPath` dapat satu node tambahan menembus dinding ke zona peek,
      supaya garis wayfinding kelihatan menyeberang bukaan, bukan cuma
      berhenti di ambang.
- [x] **Fase 3 — Right-size Hall 2**: `bounds` 32x24 -> **22x16**
      (~0.69x/0.67x — target eksplisit di spec, bukan satu faktor skala
      bulat seperti Hall 1), `ceilingHeight` 7 -> 6. Hall 2 cuma 1 zona
      jadi boleh dipadatkan lebih agresif daripada Hall 1 (tidak perlu
      jaga identitas antar-zona). Spawn & kedua arah trigger pintu
      (posisi + `targetSpawn` timbal-balik) dihitung ulang presisi
      mengikuti dinding baru — termasuk `targetSpawn` pintu Hall 1 yang
      harus digeser (z 6 -> 3.5) supaya tetap di luar radius trigger
      pintu-balik Hall 2 yang sekarang lebih dekat (z 11.5 -> 7.5).
      MiniMap & collision otomatis ikut (generik dari `room.bounds`).
- [x] **Fase 4 — Re-layout Hall 2**: ketujuh artefak zona transisi-iptek
      (termasuk sepeda tinggi & sepeda motor uap dari prompt skala dunia
      nyata — ukurannya **tidak** diubah, cuma posisi) direposisi lewat
      repulsion-relaxation di luar repo (mirror rumus
      `placementValidator.ts`), divalidasi 0 overlap lewat harness esbuild
      yang menjalankan `placementValidator.ts` **asli** terhadap data
      final. Ditemukan & diperbaiki sekalian: panel dinding "signage" zona
      (`RoomShell`) pakai tinggi tetap 6.2m (asumsi ceiling 7m lama) —
      kepotong ceiling baru 6m; diganti relatif ke `wallHeight` + panjang
      di-cap ke `depth` hall supaya tidak overshoot di hall manapun ke
      depannya juga. Hero/terminating vista (Sepeda Motor Uap) tetap di
      ujung sumbu pandang; kolonade/bangku/pot mengikuti bounds baru
      otomatis (formula generik dari prompt sebelumnya, tidak ada
      geometry sisa dari posisi lama karena tidak ada koordinat hardcode
      di luar `artifacts.json`/`roomConfig.ts`).
- [ ] **Fase 5-6 — Verifikasi**: `tsc -b` & `vite build` bersih di tiap
      commit. Placement divalidasi via harness `esbuild` di luar repo yang
      menjalankan `placementValidator.ts` **asli** terhadap
      `roomConfig.ts`/`artifacts.json` sungguhan — 0 warning di kedua hall
      (termasuk 1 pelanggaran kecil, sepeda-tinggi vs pilar pembingkai
      hero, short 0.03m karena footprint asli artefak lebih lebar dari
      dugaan awal script relaksasi — ditemukan & diperbaiki lewat
      verifikasi ulang, bukan lolos begitu saja). Tidak ditemukan
      geometry sisa/duplikat (`grep` untuk angka bounds lama). Verifikasi
      visual in-browser **tidak** sempat dilakukan — ekstensi Chrome
      tidak tersambung di sesi ini (kendala berulang, sama seperti prompt
      #2, #4, #5, #6, #7). FPS before/after dan screenshot arch dari
      berbagai sudut yang diminta spec bagian 5 juga tidak bisa diambil
      karena kendala yang sama. Disarankan cek manual: `npm run dev`,
      lihat arch dari titik hero staging Hall 1 (jauh) dan dari dekat,
      pastikan tembus pandang & ada sinyal peek/spill-light/signage;
      masuk Hall 2, pastikan terasa padat-tidak-lengang & hero langsung
      terlihat; bandingkan FPS Hall 2 sebelum/sesudah di HP asli.

**File yang berubah:** `src/data/roomConfig.ts`, `src/data/artifacts.json`,
`src/components/rooms/RoomShell.tsx`,
`src/components/architecture/CenterInstallation.tsx`,
`src/components/architecture/FloorPath.tsx`.

---

## 8. Fix UI Nabrak — Label Zona ("Transisi ke IPTEK") Tembus di Atas Panel Pengaturan

**File sumber:** `prompt-fix-ui-nabrak-panel-pengaturan_1.md` (didapat dari luar repo)

**Masalah:** Saat panel Pengaturan dibuka, label nama zona in-scene ("TRANSISI KE
IPTEK", dll) tetap tampil dan tembus di atas modal — menimpa tepat area dropdown
"Kualitas Grafis". Akar penyebab: label-label ini bukan DOM biasa, tapi drei
`<Html>` yang di-anchor ke posisi 3D (`ZoneSignboard`, greeting selamat datang di
`Hall.tsx`, label ambang pintu `ArchwayGlimpse` di `RoomShell.tsx`) — drei
memberi elemen ini default `zIndexRange` sangat tinggi (16.777.271) supaya
tampil di atas `<canvas>`, tapi itu juga bikin mereka lolos dari stacking
context modal manapun (termasuk `SettingsPanel` yang `z-50`) walau modalnya
render belakangan di DOM. Pola "sembunyikan HUD saat modal terbuka" yang sudah
benar di kontrol WASD/joystick (`HUD.tsx`, gated `!focusedArtifact` dkk) belum
diterapkan ke tiga label 3D ini karena mereka hidup di dalam `<Canvas>`, bukan
di layer DOM HUD yang sama.

**Yang dikerjakan (1 fase, 1 commit):**

- [x] **Fase 1 — Sembunyikan + jaring pengaman z-index**: hook baru
      `useIsOverlayActive` (`src/hooks/useIsOverlayActive.ts`) merangkum
      state yang sudah ada di store (`isSettingsOpen`, `isInfoPanelOpen`,
      `isLoading`, `!hasCompletedOnboarding`) — bukan flag baru, cuma
      selector turunan supaya tidak duplikat logika di 3 file. Dipakai di
      `ZoneSignboard.tsx`, `Hall.tsx` (greeting selamat datang), dan
      `RoomShell.tsx` (`ArchwayGlimpse`) untuk tidak me-render `<Html>`
      sama sekali selagi overlay aktif — otomatis muncul lagi tanpa
      flicker begitu state kembali `false` karena murni conditional
      render, tidak ada delay/timer. Sebagai jaring pengaman kedua (spec
      Fase 3, akar penyebab z-index), ketiga `<Html>` itu juga diberi
      `zIndexRange={[1, 0]}` eksplisit — dipatok jauh di bawah UI chrome
      app (`z-20` ke atas) supaya kalaupun ada label 3D baru ke depannya
      lupa di-hide, dia tidak bisa lagi menembus modal manapun.

**File yang berubah:** `src/hooks/useIsOverlayActive.ts` (baru),
`src/components/architecture/ZoneSignboard.tsx`, `src/components/rooms/Hall.tsx`,
`src/components/rooms/RoomShell.tsx`.
