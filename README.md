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
