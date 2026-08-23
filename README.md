# YouMusic

PWA streaming musik YouTube dengan lirik. Frontend vanilla JS + serverless API proxy (Node.js/CommonJS) untuk Vercel.

## Struktur

```
youmusic/
├── api/                # Serverless functions (proxy ke nanzz-musify.netlify.app)
│   ├── _base.js
│   ├── search.js       # GET  /api/search?query=...&type=all
│   ├── suggest.js      # GET  /api/suggest?q=...
│   ├── lyrics.js       # GET  /api/lyrics?id=...&title=...&artist=...
│   ├── artist.js       # GET  /api/artist?id=...
│   └── ytplay.js       # POST /api/ytplay  { query: <video url> }
├── index.html           # Shell 6 screen: Home, Search, Library, Offline, Liked, Profile
├── style.css
├── app.js
├── manifest.json
├── sw.js                # Service worker (app-shell + audio offline cache)
├── icon.svg
├── package.json
└── vercel.json
```

## Kenapa ada proxy `/api/*`?

Supaya request ke API sumber (`nanzz-musify.netlify.app`) tidak kena masalah CORS dari browser,
dan supaya base URL API tidak keras-di-hardcode di banyak tempat di client. Audio hasil `/api/ytplay`
tetap di-stream **langsung** dari URL aslinya (bukan lewat proxy) — supaya nggak kena limit durasi/size
function Vercel.

## Deploy ke Vercel

1. Push folder ini ke repo GitHub (atau upload langsung).
2. Buka [vercel.com/new](https://vercel.com/new) → Import repo.
3. Framework preset: **Other** (Vercel otomatis mendeteksi folder `api/` sebagai serverless functions
   dan file di root sebagai static site — tidak perlu build command).
4. Deploy. Selesai — domain default `youmusic-xxxx.vercel.app`, bisa diganti nama project jadi
   `youmusic` supaya URL-nya `youmusic.vercel.app` (kalau belum dipakai orang lain).

Atau lewat CLI (kalau punya akses terminal + akun Vercel):

```bash
npm i -g vercel
cd youmusic
vercel --prod
```

## Catatan fitur

- **Offline mode**: tombol download di player nyimpen file audio ke Cache Storage browser + daftar
  lagu ke localStorage. Ini best-effort — tergantung dukungan browser terhadap caching response
  cross-origin (opaque response), jadi tidak 100% berhasil di semua browser/koneksi.
- **Liked & Playlist**: disimpan di localStorage, per-device (belum ada akun/sync ke server).
- **Playlist tab di Search**: API sumber belum punya endpoint pencarian playlist, jadi tab ini
  menampilkan pesan placeholder.
- **Icon**: pakai SVG monogram sederhana (`icon.svg`). Ganti dengan PNG 512×512 kalau mau ikon custom.

## v1.2.5 — akar masalah sebenarnya: Service Worker nyimpen file lama

Semua perbaikan CSS/JS di versi-versi sebelumnya (horizontal scroll, dll)
kemungkinan **tidak pernah benar-benar sampai ke browser** kamu. Penyebabnya:

- `sw.js` men-cache `index.html`, `style.css`, `app.js` dengan strategi
  **cache-first** (`SHELL_CACHE = 'youmusic-shell-v1'`), dan isi `sw.js`
  itu sendiri tidak pernah berubah antar deploy — jadi browser tidak
  pernah mendeteksi ada Service Worker versi baru, dan terus menyajikan
  file shell yang tersimpan dari kunjungan PERTAMA kali, selamanya.
- Diperbaiki dengan mengganti strategi shell file jadi **network-first**
  (selalu coba ambil versi terbaru dari server dulu, baru fallback ke
  cache kalau memang tidak ada internet). File audio yang sudah
  didownload untuk offline tetap cache-first seperti biasa (memang harus
  begitu supaya bisa diputar tanpa internet).
- Nama cache juga dinaikkan ke `v2` supaya perubahan ini sendiri pasti
  terdeteksi sebagai Service Worker baru oleh browser.

**PENTING setelah deploy ulang**: karena Service Worker lama masih
mengontrol tab yang sedang terbuka, lakukan salah satu dari ini sekali saja
supaya Service Worker baru benar-benar mengambil alih:
- Tutup tab, buka lagi (paling gampang), **atau**
- Buka DevTools → Application → Service Workers → klik "Unregister", lalu
  refresh halaman.

Setelah itu, setiap update berikutnya akan otomatis muncul tanpa perlu
langkah manual lagi.

## v1.2.4 — download offline diperbaiki (CORS + URL kadaluarsa)

- **Bug utama**: `downloadCurrentSong()` memakai `cache.add(url)`, yang di
  balik layar melakukan fetch mode `cors`. URL audio berasal dari CDN
  YouTube (`googlevideo.com`) yang cross-origin dan tidak mengirim header
  CORS — jadi fetch-nya selalu diblokir browser dan `cache.add()` selalu
  gagal (toast "Gagal menyimpan lagu offline"). Diperbaiki dengan fetch
  mode `no-cors` (opaque response) lalu disimpan manual lewat `cache.put()`
  — pola standar untuk cache resource cross-origin di PWA.
- **Bug kedua**: URL audio dari YouTube itu punya signature & masa berlaku
  yang berubah tiap kali diminta. Sebelumnya, memutar ulang lagu offline
  tetap selalu minta URL baru ke `/api/ytplay` dulu — kalau lagi tanpa
  internet, permintaan itu gagal duluan sebelum sempat cek cache, jadi
  lagu yang "sudah didownload" tetap tidak bisa diputar offline.
  Sekarang kalau permintaan URL live gagal (mis. tanpa internet) dan lagu
  itu ada di daftar offline, pemutar otomatis jatuh balik ke URL persis
  yang tersimpan di cache saat download — dan Service Worker akan
  menyajikannya dari cache.

## v1.2.3 — halaman bisa digeser ke samping (horizontal scroll) diperbaiki

- Akar masalah: item di dalam grid "Quick Picks" (`.song-card`) memakai judul
  dengan `white-space:nowrap` + ellipsis, tapi elemen grid secara default
  punya `min-width:auto` — artinya dia menolak menyusut lebih kecil dari
  panjang teks aslinya. Judul lagu yang panjang (mis. "Masa ini, Nanti, dan
  Masa Indah Lainnya") memaksa card & seluruh grid melebar melebihi lebar
  layar, dan karena tidak ada yang menahannya, seluruh halaman jadi bisa
  discroll ke samping.
- Diperbaiki dengan menambahkan `min-width:0` pada `.grid-2`, `.song-card`,
  dan wrapper judul/artis di panel Now Playing (`.np-meta > div`), supaya
  ellipsis benar-benar memotong teks alih-alih mendorong layout melebar.
- Ditambah juga `overflow-x:hidden` pada `<html>` sebagai pengaman tambahan,
  supaya bug serupa di elemen lain di masa depan tidak lagi bisa membuat
  seluruh halaman bisa digeser ke samping.

## v1.2.2 — mobile-friendly fixes + emoji ke Lucide icon

- Input pencarian dinaikkan ke `font-size:16px` — di bawah itu Safari iOS
  otomatis melakukan zoom saat input di-tap, yang terasa mengganggu di HP.
- Semua tombol ikon (`.icon-btn`, `.icon-btn-circle`, kontrol Now Playing)
  dinaikkan ke area sentuh minimal 44×44px sesuai rekomendasi Apple HIG /
  WCAG untuk target sentuh di layar kecil.
- Karakter simbol yang dipakai sebagai "ikon" (♪ ♫ ◐ ⇩ di empty-state dan
  placeholder cover album) diganti semua dengan SVG Lucide asli, konsisten
  dengan ikon lain yang sudah dipakai di seluruh app.

## v1.2.1 — perbaikan stuck loader + selesaikan panel Now Playing

- **Bug utama diperbaiki**: `app.js` sempat mereferensikan elemen modal lama
  (`#btnDownload`, `#modalTitle`, `#modalArtist`, `#lyricsModal`, `#btnCloseModal`,
  `#modalBackdrop`) yang sudah dihapus saat redesain ke panel "Now Playing".
  `querySelector` mengembalikan `null` lalu `.addEventListener` di atasnya
  melempar error, sehingga seluruh script berhenti sebelum sempat
  menyembunyikan splash loader — app terlihat "stuck" selamanya di layar loading.
- Panel Now Playing (tab Player / Lirik / Antrean) sekarang punya CSS lengkap
  (sebelumnya markup-nya ada tapi tanpa gaya sama sekali) dan benar-benar
  berfungsi: cover besar, seek bar, play/pause, next/prev, shuffle, repeat
  (off/all/one), like, dan download — semua tersambung ke audio player yang
  sesungguhnya, plus antrean lagu otomatis dibangun dari list yang lagi
  ditampilkan (Home, hasil pencarian, Liked, Offline, lagu top artis).
- Detail artis dipindah ke modal baru (`#artistModal`) yang menggunakan gaya
  `.modal` yang sebelumnya sudah ada di CSS tapi tak terpakai.
- Semua event binding di level atas kini pakai helper `on()` yang null-safe,
  supaya satu elemen yang hilang di masa depan tidak lagi menghentikan
  seluruh aplikasi. Inisialisasi juga dibungkus `try/finally` agar splash
  loader dijamin selalu hilang.

## v1.1.0 — polish pass

- Animasi via [AOS](https://michalsnik.github.io/aos/) (scroll reveal) + micro-interaction custom
  (screen transition, staggered list/grid entrance, nav pill & tab indicator yang geser mulus,
  player bar slide-in, progress bar lagu berjalan, heart pop saat like, splash loader).
- Toast & dialog konfirmasi custom (gantiin `alert()`/`confirm()` bawaan browser) untuk UX yang
  lebih konsisten dengan tema app.
- Layout dirapihin: touch target ≥44px, safe-area untuk notch/gesture bar, breakpoint tambahan
  untuk layar kecil (<360px) dan tablet (≥560px), `prefers-reduced-motion` dihormati.
- Semua source (`api/*.js`, `app.js`, `sw.js`) ditulis tanpa komentar `//`.
