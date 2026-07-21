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
