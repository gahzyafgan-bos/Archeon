# Archeon — Museum Mpu Tantular Virtual (IDRL Experience)

Simulasi penjelajahan Museum Mpu Tantular Sidoarjo secara 3D berbasis web,
dibangun dengan pendekatan *Immersive Dual Reality Learning (IDRL)*: React,
Three.js (React Three Fiber), TypeScript, dan Zustand. Berisi Lobi + 3
ruangan galeri (Prasejarah, Hindu-Buddha, Transisi IPTEK) yang bisa
dijelajahi bebas dengan joystick virtual / WASD, sistem interaksi
zoom-artefak, panel info melayang, audio guide, musik ambience, dan sebuah
**Mode VR Cardboard/Sinecone** opsional untuk headset + gamepad Bluetooth.

Semua model 3D artefak masih berupa **placeholder primitif** (kubus, bola,
kerucut, dst) — sistem interaksi dan alurnya sudah berjalan penuh, tinggal
tukar dengan model `.glb` asli kapan pun siap (lihat bagian *Menambah
Artefak* di bawah).

## Menjalankan proyek

```bash
npm install
npm run dev
```

Buka `http://localhost:5173`. Di desktop, kontrol memakai **WASD** (gerak),
**drag mouse** (lihat sekeliling), dan **E** (interaksi). Di perangkat
sentuh, dua joystick virtual otomatis muncul di kiri-bawah (gerak) dan
kanan-bawah (lihat sekeliling), plus tombol "X" untuk berinteraksi. Untuk
Mode VR Cardboard + gamepad, lihat bagian tersendiri di bawah.

## Struktur folder

```
src/
  components/
    rooms/        # RoomShell (shell arsitektur bersama), Lobby, GalleryRoom
    artifacts/     # ArtifactMesh — render placeholder/model 3D artefak
    ui/             # LoadingScreen, HUD, InfoPanel, RoomTransition, MiniMap
    vr/             # CardboardStereoView, VREntryOverlay, VRHud — Mode VR
    PlayerRig.tsx   # Movement, kamera, collision, deteksi pintu & proximity
    MuseumExperience.tsx  # Canvas R3F + lazy-load per ruangan
  data/
    artifacts.json        # Data seluruh artefak (lihat skema di bawah)
    artifactRepository.ts # Lapisan akses data — gampang diganti fetch() API
    roomConfig.ts          # Layout, batas ruangan, titik spawn, pintu
  hooks/            # Joystick (nipplejs), keyboard, mouse-look, gyro, gamepad, audio, dsb
  store/
    useMuseumStore.ts # Zustand — satu sumber kebenaran untuk semua state
  types/artifact.ts   # Tipe TypeScript untuk data artefak
```

## Menambah artefak baru

1. Buka `src/data/artifacts.json`, tambahkan objek baru mengikuti skema:

```json
{
  "id": "room1-nama-unik",
  "nama": "Nama Artefak",
  "deskripsi": "Deskripsi singkat...",
  "url_model_3d": "",
  "placeholder_shape": "box",
  "url_audio": "",
  "koordinat_ruangan": { "x": 0, "y": 1, "z": 0 },
  "rotasi_y": 0,
  "url_thumbnail": "",
  "ruangan": "room1",
  "is_ikonik": false
}
```

2. `placeholder_shape` bisa `box | sphere | cylinder | cone | torus` — dipakai
   selama `url_model_3d` masih kosong.
3. Untuk model 3D asli: taruh file `.glb` di `public/models/`, lalu isi
   `url_model_3d` (mis. `"/models/kapak-perimbas.glb"`), dan ganti
   `<PlaceholderGeometry>` di `ArtifactMesh.tsx` dengan `useGLTF()` dari
   `@react-three/drei` — komponen lain (highlight, klik, spotlight) tidak
   perlu diubah.
4. Untuk audio guide: taruh file `.mp3` di `public/audio/`, isi `url_audio`.

## Menambah ruangan baru

1. Tambahkan konfigurasi baru di `src/data/roomConfig.ts` (bounds, titik
   spawn, dan minimal satu `door` yang menghubungkan ke ruangan lain).
2. Tambahkan artefak untuk ruangan tersebut di `artifacts.json` dengan
   field `"ruangan"` yang sesuai.
3. Render ruangan lewat `<GalleryRoom room={ROOM_CONFIGS.roomBaru} .../>`
   di `MuseumExperience.tsx` (atau buat komponen kustom seperti `Lobby.tsx`
   jika perlu dekorasi khusus).
4. Update tipe `RoomId` di `useMuseumStore.ts` dan `roomConfig.ts` bila
   nama ruangan baru belum terdaftar.

## Mengganti sumber data JSON lokal → REST API

`src/data/artifactRepository.ts` adalah satu-satunya tempat yang menyentuh
`artifacts.json`. Untuk pindah ke backend sungguhan, cukup ganti isi
`fetchArtifactsByRoom()` / `fetchAllArtifacts()` dengan `fetch()` ke
endpoint `GET /api/artifacts?ruangan=...` — komponen lain tidak perlu
diubah karena semuanya bergantung pada tipe `Artifact`, bukan sumber
datanya.

## Mode VR Cardboard/Sinecone + Gamepad Bluetooth

Mode VR adalah lapisan alternatif di atas scene dan state yang sama persis
(Zustand, data artefak) — bukan scene terpisah. Diaktifkan lewat tombol
"Masuk Mode VR" di HUD (`HUD.tsx`), yang hanya muncul di perangkat yang
mendukung `DeviceOrientationEvent`.

**Alur masuk:** tombol HUD → izin sensor gyroscope (wajib di-*trigger* dari
klik, khusus iOS 13+) → `requestFullscreen()` → coba
`screen.orientation.lock('landscape')` (best-effort, ada fallback kalau
browser tidak mendukung) → layar instruksi 4 detik ("Lanjutkan") supaya
sempat memasang HP ke headset → render stereo aktif
(`CardboardStereoView.tsx`).

**Saat aktif:**
- Render jadi dua viewport (kiri/kanan) via `THREE.StereoCamera`, bukan dua
  `<Canvas>` terpisah — lihat `src/components/vr/CardboardStereoView.tsx`.
  Jarak antar-mata (eye separation) di-set 0.032 unit dunia sebagai titik
  awal; dunia scene ini ≈ 1 unit = 1 meter (lihat `EYE_HEIGHT` di
  `PlayerRig.tsx`), jadi kalau kedalaman stereo terasa terlalu tipis di
  headset asli, naikkan `EYE_SEPARATION` menuju ~0.06.
- Resolusi render otomatis diturunkan (`dpr={[1,1]}` alih-alih `[1,1.8]`)
  dan post-processing bloom dimatikan (`PostProcessing`), karena stereo
  merender scene dua kali per frame.
- Arah pandang mengikuti giroskop HP (`useDeviceOrientationLook.ts`),
  bukan joystick kanan/mouse — logic look lama tetap ada dan tetap dipakai
  di luar Mode VR.
- Gerak jalan & interaksi datang dari gamepad Bluetooth
  (`useGamepadControls.ts`, lewat `navigator.getGamepads()`), bukan
  joystick kiri/tombol sentuh — HUD sentuh biasa disembunyikan total dan
  digantikan overlay minimal (`VRHud.tsx`): crosshair kecil + indikator
  proximity/nama artefak, dicerminkan di kedua viewport.
- Panel info artefak (`InfoPanel.tsx`) yang biasa (drag-to-rotate 360°)
  disembunyikan di Mode VR karena butuh sentuhan — sebagai gantinya, audio
  guide **otomatis mulai** begitu artefak difokuskan (lihat
  `useAudioGuide(artifact, autoPlay)` di `VRHud.tsx`).

**Pemetaan tombol gamepad** (diasumsikan layout "standard" ala Xbox — pad
lain mungkin berbeda index, sesuaikan konstanta di
`useGamepadControls.ts` kalau perlu):

| Tombol           | Index | Aksi                                             |
| ----------------- | ----- | ------------------------------------------------- |
| Analog stick kiri | axes 0/1 | Gerak jalan (`moveInput`)                       |
| A / X             | 0     | Interaksi artefak (sama seperti E/X sentuh)        |
| B                 | 1     | Kembali/keluar dari fokus artefak                  |
| Back / Select     | 8     | Kalibrasi ulang arah depan (gyro drift correction) |
| Start             | 9     | Keluar dari Mode VR                                |

Deadzone stick gamepad memakai nilai `settings.deadzone` yang sama dengan
joystick sentuh — diterapkan satu kali secara terpusat di `PlayerRig.tsx`
(bukan diduplikasi di `useGamepadControls.ts`), karena `moveInput` sudah
melewati logic deadzone itu apa pun sumbernya.

**Batasan penting:**
- **HTTPS wajib untuk produksi.** `DeviceOrientationEvent` dan sensor
  browser lain hanya aktif di *secure context* (HTTPS atau `localhost`).
  Tanpa HTTPS, tombol "Masuk Mode VR" tetap muncul tapi giroskop tidak
  akan pernah mengirim data.
- **Tidak ada positional tracking** — murni rotational (nengok kepala) +
  gamepad untuk gerak, sesuai keterbatasan tier Cardboard.
- Gamepad harus sudah dipasangkan (paired) via Bluetooth OS *sebelum*
  masuk Mode VR, dan banyak browser butuh minimal satu tekanan tombol dari
  gamepad dulu sebelum `navigator.getGamepads()` mengembalikan datanya.
- Diuji dengan satu gamepad Bluetooth ber-layout "standard"/Xbox-style di
  desktop Chrome untuk memverifikasi input axes/tombol — **belum** diuji
  di HP fisik + Cardboard sungguhan dengan gamepad ter-pairing (lihat
  catatan di bawah).

**Menguji Mode VR secara lokal (butuh HTTPS lokal juga):**

Vite 5 tidak lagi punya flag `--https` bawaan. Dua opsi termudah:

```bash
# Opsi 1: plugin self-signed cert bawaan Vite ecosystem
npm install -D @vitejs/plugin-basic-ssl
# lalu tambahkan plugin basicSsl() di vite.config.ts, plugins: [react(), basicSsl()]

# Opsi 2: tunnel HTTPS ke dev server yang sudah jalan di :5173
npx ngrok http 5173
```

Buka URL HTTPS-nya di HP (harus di jaringan yang sama untuk opsi 1, atau
lewat internet untuk opsi 2 via ngrok), baru tombol "Masuk Mode VR" akan
benar-benar bisa membaca sensor.

## Catatan performa

- Setiap ruangan hanya di-*mount* satu per satu (`MuseumExperience.tsx`) —
  ruangan yang tidak aktif tidak memuat model/artefaknya sama sekali.
- Ganti model placeholder dengan `.glb` yang sudah dikompresi (disarankan
  lewat [gltf-transform](https://gltf-transform.dev/) atau Draco) agar
  tetap ringan di perangkat mobile.
- Musik ambience per ruangan menggunakan file terpisah
  (`public/audio/ambience-<ruangan>.mp3`); jika file belum ada, sistem akan
  diam-diam gagal tanpa mematikan aplikasi (lihat `onloaderror` di
  `useAmbience.ts`).
- Mode VR merender scene dua kali per frame (stereo) — dpr diturunkan

  otomatis saat aktif; kalau frame rate masih jatuh di HP kelas menengah,
  turunkan lagi lewat `dpr` di `MuseumExperience.tsx` atau kecilkan
  `EYE_SEPARATION`'s viewport resolution lebih lanjut.

## Fitur yang sudah diimplementasikan

- [x] Loading screen dengan progress bar
- [x] Free-roam movement 3D dengan collision sederhana (batas ruangan)
- [x] Kontrol kamera 360° independen dari arah gerak
- [x] Highlight otomatis saat mendekati artefak + prompt interaksi
- [x] Klik/tombol artefak → smooth zoom + blur background
- [x] Panel info melayang (nama, deskripsi, audio guide, model 3D 360°)
- [x] Audio guide per artefak (play/pause) via Howler.js
- [x] Background music ambient per ruangan (mute/unmute)
- [x] Navigasi antar 3 ruangan + lobi lewat pintu/lorong
- [x] Data artefak terpisah di JSON, siap diganti API
- [x] Joystick otomatis di touch device, WASD+mouse di desktop
- [x] Lazy load per ruangan (hanya ruangan aktif yang di-mount)
- [x] Mini-map sederhana (fitur opsional)
- [x] Mode VR Cardboard/Sinecone: render stereoscopic + gyro look + gamepad
      Bluetooth untuk gerak/interaksi (lihat bagian di atas)

## Belum diimplementasikan (opsional, lanjutan)

- Checklist eksplorasi per-artefak yang tervisualisasi di UI (state-nya
  sudah ada di `viewedArtifactIds` pada store, tinggal dibuatkan tampilan)
- Koreksi distorsi lensa (barrel distortion) untuk Mode VR — versi
  sekarang pakai stereo split-screen polos tanpa koreksi optik lensa
- Mode AR via `<model-viewer>`
- Subtitle otomatis untuk audio guide
- Backend REST sungguhan (saat ini JSON lokal, lihat bagian di atas)
- **Konfirmasi akhir Mode VR di perangkat fisik** — kode ini belum diuji
  di HP sungguhan dengan Cardboard fisik + gamepad Bluetooth yang benar-
  benar dipasangkan (giroskop & Gamepad API berperilaku berbeda dari
  simulasi DevTools desktop); lakukan pengujian ini sebelum menganggap
  Mode VR selesai.
