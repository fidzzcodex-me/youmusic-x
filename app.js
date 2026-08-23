(() => {
  'use strict';

  const state = {
    screen: 'home',
    searchTab: 'musik',
    lastSearch: { query: '', data: null },
    liked: JSON.parse(localStorage.getItem('ym_liked') || '[]'),
    playlists: JSON.parse(localStorage.getItem('ym_playlists') || '[]'),
    currentSong: null,
    isPlaying: false,
    isLoadingSong: false,
  };

  const audio = document.getElementById('audioEl');
  const OFFLINE_CACHE = 'youmusic-audio-v1';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function saveLiked() { localStorage.setItem('ym_liked', JSON.stringify(state.liked)); }
  function savePlaylists() { localStorage.setItem('ym_playlists', JSON.stringify(state.playlists)); }
  function isLiked(videoId) { return state.liked.some((s) => s.videoId === videoId); }

  async function api(path, opts = {}) {
    const res = await fetch(path, opts);
    if (!res.ok) throw new Error(`Gagal memuat (${res.status})`);
    return res.json();
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function placeholderArt(seed) {
    const colors = ['#1F2937', '#111827', '#3B0F1F', '#0F2A24', '#1A1035'];
    const c = colors[Math.abs(hashCode(seed || 'x')) % colors.length];
    return `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="${c}"/><text x="60" y="68" font-size="40" text-anchor="middle" fill="white" opacity="0.5" font-family="sans-serif">♪</text></svg>`
    )}`;
  }
  function hashCode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i) | 0;
    return h;
  }

  function toast(message, duration = 2600) {
    const stack = $('#toastStack');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 240);
    }, duration);
  }

  function confirmDialog(message, confirmLabel = 'Ya, lanjut') {
    return new Promise((resolve) => {
      const overlay = $('#dialogOverlay');
      $('#dialogMessage').textContent = message;
      const actions = $('#dialogActions');
      actions.innerHTML = `
        <button class="dialog-btn-cancel" id="dlgCancel">Batal</button>
        <button class="dialog-btn-confirm" id="dlgConfirm">${escapeHtml(confirmLabel)}</button>
      `;
      overlay.classList.remove('hidden');
      const cleanup = (result) => {
        overlay.classList.add('hidden');
        resolve(result);
      };
      $('#dlgCancel').addEventListener('click', () => cleanup(false));
      $('#dlgConfirm').addEventListener('click', () => cleanup(true));
    });
  }

  function moveNavPill(target) {
    const pill = $('#navPill');
    const rect = target.getBoundingClientRect();
    const parentRect = target.parentElement.getBoundingClientRect();
    pill.style.left = `${rect.left - parentRect.left}px`;
    pill.style.width = `${rect.width}px`;
  }

  function moveTabIndicator(target) {
    const ind = $('#tabIndicator');
    if (!ind || !target) return;
    ind.style.left = `${target.offsetLeft}px`;
    ind.style.width = `${target.offsetWidth}px`;
  }

  function goTo(screen) {
    state.screen = screen;
    $$('.screen').forEach((s) => s.classList.toggle('hidden', s.dataset.screen !== screen));
    $$('.nav-item').forEach((b) => {
      const active = b.dataset.nav === screen;
      b.classList.toggle('active', active);
      if (active) moveNavPill(b);
    });
    if (screen === 'library') renderLibrary();
    if (screen === 'offline') renderOffline();
    if (screen === 'liked') renderLiked();
    if (screen === 'profile') renderProfile();
    if (screen === 'home' && !homeLoaded) loadHome();
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (window.AOS) setTimeout(() => AOS.refreshHard(), 60);
  }

  $$('[data-nav]').forEach((btn) => btn.addEventListener('click', () => goTo(btn.dataset.nav)));

  let homeLoaded = false;
  const homeFilterQuery = {
    semua: 'lagu pop indonesia terbaru',
    chill: 'lagu chill santai indonesia',
    focus: 'musik instrumental fokus belajar',
  };

  async function loadHome(filter = 'semua') {
    homeLoaded = true;
    const grid = $('#quickPicks');
    grid.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>';
    try {
      const data = await api(`/api/search?query=${encodeURIComponent(homeFilterQuery[filter])}&type=all`);
      const songs = (data.result && data.result.songs) || [];
      grid.innerHTML = songs.slice(0, 6).map((s, i) => songCardHtml(s, i)).join('') || emptyInline('Belum ada rekomendasi.');
      grid.querySelectorAll('.song-card').forEach((el) => {
        el.addEventListener('click', () => playSong(JSON.parse(el.dataset.song)));
      });
    } catch (e) {
      grid.innerHTML = emptyInline('Gagal memuat rekomendasi. Coba lagi nanti.');
    }
    renderPopularPlaylists();
  }

  function songCardHtml(s, i = 0) {
    const img = s.thumbnail || s.image || placeholderArt(s.title);
    const delay = Math.min(i, 8) * 45;
    return `<div class="song-card" style="animation-delay:${delay}ms" data-song='${escapeHtml(JSON.stringify(s)).replace(/'/g, '&#39;')}'>
      <img src="${img}" loading="lazy" alt="">
      <div class="t">${escapeHtml(s.title)}</div>
      <div class="a">${escapeHtml(s.artist || '')}</div>
    </div>`;
  }

  function emptyInline(text) {
    return `<div class="muted small" style="padding:20px 4px">${escapeHtml(text)}</div>`;
  }

  function renderPopularPlaylists() {
    const wrap = $('#popularPlaylists');
    const demo = state.playlists.length ? state.playlists : [];
    let html = `<div class="playlist-col"><div class="playlist-card" id="btnCreatePlaylistHome"><span class="plus">+</span></div><div class="playlist-meta"><b>Buat Baru</b></div></div>`;
    html += demo.map((p, i) => `<div class="playlist-col" style="animation-delay:${(i + 1) * 60}ms">
        <div class="playlist-card" style="background:${p.color}"></div>
        <div class="playlist-meta"><b>${escapeHtml(p.name)}</b><span class="muted">${p.songs.length} lagu</span></div>
      </div>`).join('');
    wrap.innerHTML = html;
    $('#btnCreatePlaylistHome').addEventListener('click', createPlaylist);
  }

  $('#homeFilters').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    $$('.chip', $('#homeFilters')).forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    loadHome(chip.dataset.filter);
  });

  const searchForm = $('#searchForm');
  const searchInput = $('#searchInput');
  const suggestBox = $('#suggestBox');
  const clearBtn = $('#btnClearSearch');
  let suggestTimer = null;

  searchInput.addEventListener('input', () => {
    clearBtn.classList.toggle('hidden', !searchInput.value.trim());
    clearTimeout(suggestTimer);
    const q = searchInput.value.trim();
    if (!q) { suggestBox.classList.add('hidden'); return; }
    suggestTimer = setTimeout(async () => {
      try {
        const list = await api(`/api/suggest?q=${encodeURIComponent(q)}`);
        if (!Array.isArray(list) || !list.length) { suggestBox.classList.add('hidden'); return; }
        suggestBox.innerHTML = list.slice(0, 6).map((s) => `<div class="suggest-item">${escapeHtml(s)}</div>`).join('');
        suggestBox.classList.remove('hidden');
        $$('.suggest-item', suggestBox).forEach((el) => {
          el.addEventListener('click', () => {
            searchInput.value = el.textContent;
            suggestBox.classList.add('hidden');
            runSearch(el.textContent);
          });
        });
      } catch (_) { suggestBox.classList.add('hidden'); }
    }, 300);
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.classList.add('hidden');
    suggestBox.classList.add('hidden');
    searchInput.focus();
  });

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    suggestBox.classList.add('hidden');
    runSearch(searchInput.value.trim());
  });

  $('#searchTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    $$('.tab', $('#searchTabs')).forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    state.searchTab = tab.dataset.tab;
    moveTabIndicator(tab);
    renderSearchResults();
  });

  async function runSearch(query) {
    if (!query) return;
    const box = $('#searchResults');
    box.innerHTML = emptyInline('Mencari...');
    try {
      const data = await api(`/api/search?query=${encodeURIComponent(query)}&type=all`);
      state.lastSearch = { query, data };
      renderSearchResults();
    } catch (e) {
      box.innerHTML = emptyInline('Gagal mencari. Periksa koneksi kamu.');
    }
  }

  function renderSearchResults() {
    const box = $('#searchResults');
    const data = state.lastSearch.data;
    if (!data) { box.innerHTML = ''; return; }

    if (state.searchTab === 'musik') {
      const songs = (data.result && data.result.songs) || [];
      if (!songs.length) { box.innerHTML = emptyInline('Lagu tidak ditemukan.'); return; }
      box.innerHTML = songs.map((s, i) => songRowHtml(s, i)).join('');
      bindSongRows(box);
    } else if (state.searchTab === 'artis') {
      const artists = (data.result && data.result.artists) || [];
      if (!artists.length) { box.innerHTML = emptyInline('Artis tidak ditemukan.'); return; }
      box.innerHTML = artists.map((a, i) => `<div class="song-row" style="animation-delay:${Math.min(i, 8) * 40}ms" data-artist='${escapeHtml(JSON.stringify(a)).replace(/'/g, '&#39;')}'>
          <img src="${a.thumbnail || placeholderArt(a.title)}" alt="">
          <div class="meta"><div class="t">${escapeHtml(a.title || a.name)}</div><div class="a">Artis</div></div>
        </div>`).join('');
      $$('.song-row', box).forEach((el) => el.addEventListener('click', () => openArtist(JSON.parse(el.dataset.artist))));
    } else {
      box.innerHTML = emptyInline('Pencarian playlist belum tersedia di API ini.');
    }
  }

  function songRowHtml(s, i = 0) {
    const playing = state.currentSong && state.currentSong.videoId === s.videoId && state.isPlaying;
    const delay = Math.min(i, 10) * 40;
    return `<div class="song-row ${playing ? 'playing' : ''}" style="animation-delay:${delay}ms" data-song='${escapeHtml(JSON.stringify(s)).replace(/'/g, '&#39;')}'>
      <img src="${s.thumbnail || s.image || placeholderArt(s.title)}" loading="lazy" alt="">
      <div class="meta">
        <div class="t">${escapeHtml(s.title)}</div>
        <div class="a">${escapeHtml(s.artist || '')}</div>
      </div>
      ${playing ? `<span class="badge-playing">DIPUTAR</span>` : ''}
      <button class="play-btn ${playing ? 'playing' : ''}" aria-label="Putar">
        ${playing ? `<div class="eq"><span></span><span></span><span></span></div>` : `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`}
      </button>
    </div>`;
  }

  function bindSongRows(container) {
    $$('.song-row', container).forEach((el) => {
      el.addEventListener('click', () => playSong(JSON.parse(el.dataset.song)));
    });
  }

  async function openArtist(a) {
    try {
      const data = await api(`/api/artist?id=${encodeURIComponent(a.id || a.artistId)}`);
      if (!data.status) return;
      const r = data.result;
      $('#modalTitle').textContent = r.name || a.title;
      $('#modalArtist').textContent = r.subscriberCount ? `${r.subscriberCount} subscriber` : 'Artis';
      const top = (r.topSongs || []).slice(0, 8);
      $('#lyricsContent').innerHTML = top.length
        ? top.map((s) => `<div class="song-row" data-song='${escapeHtml(JSON.stringify(s)).replace(/'/g, '&#39;')}' style="margin-bottom:8px">
            <img src="${s.thumbnail || placeholderArt(s.title)}" alt="">
            <div class="meta"><div class="t">${escapeHtml(s.title)}</div><div class="a">${escapeHtml(s.artist || r.name || '')}</div></div>
          </div>`).join('')
        : '<p class="muted">Tidak ada lagu top untuk artis ini.</p>';
      $$('.song-row', $('#lyricsContent')).forEach((el) => el.addEventListener('click', () => {
        closeModal();
        playSong(JSON.parse(el.dataset.song));
      }));
      openModal();
    } catch (e) { toast('Gagal memuat detail artis.'); }
  }

  let libTab = 'playlists';
  $('#btnNewPlaylist').addEventListener('click', createPlaylist);
  $$('[data-libtab]').forEach((b) => b.addEventListener('click', () => {
    libTab = b.dataset.libtab;
    $$('[data-libtab]').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    renderLibrary();
  }));

  function createPlaylist() {
    const name = prompt('Nama playlist baru:');
    if (!name || !name.trim()) return;
    const colors = ['#3B0F1F', '#0F2A24', '#1A1035', '#1F2937', '#302008'];
    state.playlists.push({ id: `pl_${Date.now()}`, name: name.trim(), songs: [], color: colors[state.playlists.length % colors.length] });
    savePlaylists();
    renderLibrary();
    renderPopularPlaylists();
    toast('Playlist dibuat.');
  }

  function renderLibrary() {
    const wrap = $('#libraryContent');
    if (libTab === 'playlists') {
      if (!state.playlists.length) {
        wrap.innerHTML = emptyState('♫', 'Belum Ada Playlist', 'Buat playlist pertamamu dan kumpulkan lagu-lagu favoritmu di satu tempat.');
        return;
      }
      wrap.innerHTML = `<div class="list">${state.playlists.map((p, i) => `
        <div class="song-row" style="animation-delay:${i * 40}ms" data-pl="${p.id}">
          <div style="width:56px;height:56px;border-radius:12px;background:${p.color}"></div>
          <div class="meta"><div class="t">${escapeHtml(p.name)}</div><div class="a">${p.songs.length} lagu</div></div>
        </div>`).join('')}</div>`;
    } else {
      const artistNames = [...new Set(state.liked.map((s) => s.artist).filter(Boolean))];
      if (!artistNames.length) {
        wrap.innerHTML = emptyState('◐', 'Belum Ada Artis', 'Artis dari lagu yang kamu suka akan muncul di sini.');
        return;
      }
      wrap.innerHTML = `<div class="list">${artistNames.map((n, i) => `
        <div class="song-row" style="animation-delay:${i * 40}ms"><div class="meta"><div class="t">${escapeHtml(n)}</div><div class="a">Artis</div></div></div>`).join('')}</div>`;
    }
  }

  function emptyState(icon, title, desc, btnLabel, btnId) {
    return `<div class="empty-card">
      <div class="icon-xl" style="font-size:44px">${icon}</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(desc)}</p>
      ${btnLabel ? `<button class="btn-outline" id="${btnId}">${escapeHtml(btnLabel)}</button>` : ''}
    </div>`;
  }

  function updateNetBadge() {
    const badge = $('#netBadge');
    if (!badge) return;
    const online = navigator.onLine;
    badge.textContent = online ? 'ONLINE' : 'OFFLINE';
    badge.classList.toggle('off', !online);
  }
  window.addEventListener('online', updateNetBadge);
  window.addEventListener('offline', updateNetBadge);

  async function getOfflineList() {
    return JSON.parse(localStorage.getItem('ym_offline') || '[]');
  }
  function saveOfflineList(list) { localStorage.setItem('ym_offline', JSON.stringify(list)); }

  async function renderOffline() {
    updateNetBadge();
    const wrap = $('#offlineContent');
    const list = await getOfflineList();
    if (!list.length) {
      wrap.innerHTML = emptyState('⇩', 'Belum Ada Lagu Offline', 'Simpan lagu favoritmu untuk diputar tanpa koneksi internet.', 'Klik ikon Download di pemutar lagu');
      return;
    }
    wrap.innerHTML = `<div class="list">${list.map((s, i) => `
      <div class="song-row" style="animation-delay:${i * 40}ms" data-song='${escapeHtml(JSON.stringify(s)).replace(/'/g, '&#39;')}'>
        <img src="${s.thumbnail || placeholderArt(s.title)}" alt="">
        <div class="meta"><div class="t">${escapeHtml(s.title)}</div><div class="a">${escapeHtml(s.artist || '')}</div></div>
        <button class="play-btn" aria-label="Putar"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>
      </div>`).join('')}</div>`;
    $$('.song-row', wrap).forEach((el) => el.addEventListener('click', () => playSong(JSON.parse(el.dataset.song), true)));
  }

  $('#btnClearOffline').addEventListener('click', async () => {
    const ok = await confirmDialog('Hapus semua lagu offline yang tersimpan?', 'Hapus semua');
    if (!ok) return;
    if ('caches' in window) await caches.delete(OFFLINE_CACHE);
    saveOfflineList([]);
    renderOffline();
    toast('Lagu offline dihapus.');
  });

  async function downloadCurrentSong() {
    const song = state.currentSong;
    if (!song || !song._audioUrl) return;
    const btn = $('#btnDownload');
    btn.disabled = true;
    try {
      if ('caches' in window) {
        const cache = await caches.open(OFFLINE_CACHE);
        await cache.add(song._audioUrl);
      }
      const list = await getOfflineList();
      if (!list.some((s) => s.videoId === song.videoId)) {
        list.push({ ...song });
        saveOfflineList(list);
      }
      toast('Lagu tersimpan untuk diputar offline.');
    } catch (e) {
      toast('Gagal menyimpan lagu offline.');
    } finally {
      btn.disabled = false;
    }
  }
  $('#btnDownload').addEventListener('click', downloadCurrentSong);

  function renderLiked() {
    $('#likedCount').textContent = `${state.liked.length} LAGU TERSIMPAN`;
    const wrap = $('#likedContent');
    if (!state.liked.length) {
      wrap.innerHTML = emptyInline('Belum ada lagu yang kamu suka.');
      return;
    }
    wrap.innerHTML = state.liked.map((s, i) => songRowHtml(s, i)).join('');
    bindSongRows(wrap);
  }
  $('#btnPlayAllLiked').addEventListener('click', () => {
    if (state.liked.length) playSong(state.liked[0]);
  });

  function toggleLike(song) {
    if (isLiked(song.videoId)) {
      state.liked = state.liked.filter((s) => s.videoId !== song.videoId);
      toast('Dihapus dari Liked Songs.');
    } else {
      state.liked.push({ ...song });
      toast('Ditambahkan ke Liked Songs.');
    }
    saveLiked();
    updateLikeUI();
    if (state.screen === 'liked') renderLiked();
    if (state.screen === 'profile') renderProfile();
  }

  function updateLikeUI() {
    const heart = $('#likeHeart');
    if (!state.currentSong) return;
    heart.classList.toggle('liked', isLiked(state.currentSong.videoId));
  }

  $('#btnLike').addEventListener('click', () => { if (state.currentSong) toggleLike(state.currentSong); });

  function renderProfile() {
    const preview = $('#profileLikedPreview');
    if (!state.liked.length) {
      preview.textContent = 'Belum ada lagu disukai.';
    } else {
      preview.innerHTML = state.liked.slice(0, 3).map((s) => `<div class="kv"><span>${escapeHtml(s.title)}</span><b>${escapeHtml(s.artist || '')}</b></div>`).join('');
    }
    $('#swStatus').textContent = ('serviceWorker' in navigator && navigator.serviceWorker.controller) ? 'Terdaftar' : 'Belum aktif';
  }

  $('#btnBersihkanCache').addEventListener('click', async (e) => {
    e.preventDefault();
    const ok = await confirmDialog('Bersihkan semua cache PWA? Lagu offline juga akan terhapus.', 'Bersihkan');
    if (!ok) return;
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    toast('Cache dibersihkan.');
  });

  const playerBar = $('#playerBar');

  async function playSong(song, preferOffline = false) {
    state.currentSong = song;
    state.isLoadingSong = true;
    $('#playerTitle').textContent = song.title;
    $('#playerArtist').textContent = song.artist || '';
    $('#playerCover').src = song.thumbnail || song.image || placeholderArt(song.title);
    playerBar.classList.remove('hidden');
    updateLikeUI();
    setPlayerIcon('loading');

    try {
      const data = await api('/api/ytplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: song.url || `https://www.youtube.com/watch?v=${song.videoId}` }),
      });
      if (!data.status || !data.result || !data.result.download || !data.result.download.audio) {
        throw new Error('Audio tidak tersedia');
      }
      const audioUrl = data.result.download.audio;
      song._audioUrl = audioUrl;
      audio.src = audioUrl;
      await audio.play();
      state.isPlaying = true;
      state.isLoadingSong = false;
      setPlayerIcon('pause');
      refreshSongRowsUI();
    } catch (e) {
      state.isLoadingSong = false;
      setPlayerIcon('play');
      toast('Gagal memutar lagu. Coba lagu lain.');
    }
  }

  function setPlayerIcon(mode) {
    $('#iconPlay').classList.toggle('hidden', mode !== 'play');
    $('#iconPause').classList.toggle('hidden', mode !== 'pause');
    $('#iconLoading').classList.toggle('hidden', mode !== 'loading');
  }

  $('#btnPlayPause').addEventListener('click', () => {
    if (!state.currentSong || state.isLoadingSong) return;
    if (audio.paused) {
      audio.play();
      state.isPlaying = true;
    } else {
      audio.pause();
      state.isPlaying = false;
    }
    setPlayerIcon(state.isPlaying ? 'pause' : 'play');
    refreshSongRowsUI();
  });

  audio.addEventListener('ended', () => { state.isPlaying = false; setPlayerIcon('play'); refreshSongRowsUI(); });
  audio.addEventListener('pause', () => { if (!state.isLoadingSong) { state.isPlaying = false; setPlayerIcon('play'); refreshSongRowsUI(); } });
  audio.addEventListener('play', () => { state.isPlaying = true; setPlayerIcon('pause'); refreshSongRowsUI(); });
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    $('#playerProgress').style.width = `${(audio.currentTime / audio.duration) * 100}%`;
  });

  function refreshSongRowsUI() {
    if (state.screen === 'search') renderSearchResults();
    if (state.screen === 'liked') renderLiked();
  }

  $('#playerInfoBtn').addEventListener('click', async () => {
    if (!state.currentSong) return;
    const song = state.currentSong;
    $('#modalTitle').textContent = song.title;
    $('#modalArtist').textContent = song.artist || '';
    $('#lyricsContent').textContent = 'Memuat lirik...';
    openModal();
    try {
      const data = await api(`/api/lyrics?id=${encodeURIComponent(song.videoId)}&title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist || '')}`);
      if (!data.status || !data.result || !data.result.lyrics) {
        $('#lyricsContent').textContent = 'Lirik tidak ditemukan untuk lagu ini.';
        return;
      }
      const l = data.result.lyrics;
      $('#lyricsContent').innerHTML = l.lines.map((line) => `<div>${escapeHtml(line.text)}</div>`).join('');
    } catch (e) {
      $('#lyricsContent').textContent = 'Gagal memuat lirik.';
    }
  });

  function openModal() { $('#lyricsModal').classList.remove('hidden'); }
  function closeModal() { $('#lyricsModal').classList.add('hidden'); }
  $('#btnCloseModal').addEventListener('click', closeModal);
  $('#modalBackdrop').addEventListener('click', closeModal);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }

  window.addEventListener('resize', () => {
    const active = $('.nav-item.active');
    if (active) moveNavPill(active);
    const activeTab = $('#searchTabs .tab.active');
    if (activeTab) moveTabIndicator(activeTab);
  });

  updateNetBadge();

  if (window.AOS) {
    AOS.init({ duration: 500, once: true, offset: 20, easing: 'ease-out-cubic' });
  }

  goTo('home');
  requestAnimationFrame(() => moveTabIndicator($('#searchTabs .tab.active')));

  setTimeout(() => $('#loader').classList.add('done'), 480);
})();
