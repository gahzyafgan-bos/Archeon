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
