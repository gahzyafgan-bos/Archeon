# Museum Mpu Tantular Virtual — IDRL Experience

Starting point untuk simulasi penjelajahan museum 3D berbasis web, sesuai
brief *Immersive Dual Reality Learning (IDRL)*. Berisi Lobi + 3 ruangan
galeri (Prasejarah, Hindu-Buddha, Transisi IPTEK) yang bisa dijelajahi
bebas dengan joystick virtual / WASD, sistem interaksi zoom-artefak, panel
info melayang, audio guide, dan musik ambience.

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
kanan-bawah (lihat sekeliling), plus tombol "X" untuk berinteraksi.

## Struktur folder

```
src/
  components/
    rooms/        # RoomShell (shell arsitektur bersama), Lobby, GalleryRoom
    artifacts/     # ArtifactMesh — render placeholder/model 3D artefak
    ui/             # LoadingScreen, HUD, InfoPanel, RoomTransition, MiniMap
    PlayerRig.tsx   # Movement, kamera, collision, deteksi pintu & proximity
    MuseumExperience.tsx  # Canvas R3F + lazy-load per ruangan
  data/
    artifacts.json        # Data seluruh artefak (lihat skema di bawah)
    artifactRepository.ts # Lapisan akses data — gampang diganti fetch() API
    roomConfig.ts          # Layout, batas ruangan, titik spawn, pintu
  hooks/            # Joystick (nipplejs), keyboard, mouse-look, audio, dsb
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

## Belum diimplementasikan (opsional, lanjutan)

- Checklist eksplorasi per-artefak yang tervisualisasi di UI (state-nya
  sudah ada di `viewedArtifactIds` pada store, tinggal dibuatkan tampilan)
- Mode AR via `<model-viewer>`
- Subtitle otomatis untuk audio guide
- Backend REST sungguhan (saat ini JSON lokal, lihat bagian di atas)
