(function(){
  // Robust music player: crossOrigin, encode filenames, first-gesture enable, error handling
  const playlistPath = '/music/playlist.json';
  let playlist = [];
  let current = 0;
  let audio = null;
  let isPlaying = false;
  let audioReady = false;

  function qs(id){ return document.getElementById(id); }
  function setTitle(t){ const el = qs('musicTitle'); if(el) el.textContent = t; }

  function createAudioIfNeeded() {
    if (audio) return;
    audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.volume = 1.0;

    audio.addEventListener('ended', () => {
      isPlaying = false;
      updatePlayIcons();
      next();
    });
    audio.addEventListener('error', (e) => console.warn('Audio error', e));
    audio.addEventListener('stalled', () => console.warn('Audio stalled'));
    audio.addEventListener('play', () => { isPlaying = true; updatePlayIcons(); });
    audio.addEventListener('pause', () => { isPlaying = false; updatePlayIcons(); });
  }

  function loadTrack(index) {
    if(!playlist.length) return;
    current = (index + playlist.length) % playlist.length;
    const tr = playlist[current];
    if(!tr) return;
    createAudioIfNeeded();
    // encode filename for URLs with spaces or special chars
    audio.src = '/music/' + encodeURIComponent(tr.file);
    try { audio.load(); } catch(e){}
    audioReady = true;
    setTitle(tr.title || tr.file);
  }

  async function play(){
    if(!audio) return;
    try {
      await audio.play();
      isPlaying = true; updatePlayIcons();
    } catch(err){
      // autoplay blocked
      showPlayOverlay();
    }
  }
  function pause(){ if(audio){ audio.pause(); isPlaying=false; updatePlayIcons(); } }

  function next(){ loadTrack(current+1); if(isPlaying) play(); }
  function prev(){ loadTrack(current-1); if(isPlaying) play(); }

  function updatePlayIcons(){
    const ico = qs('playPause');
    const main = qs('playToggle');
    if(!ico || !main) return;
    if(isPlaying){ ico.innerHTML = '<i class="fas fa-pause"></i>'; main.innerHTML = '<i class="fas fa-pause"></i>'; }
    else { ico.innerHTML = '<i class="fas fa-play"></i>'; main.innerHTML = '<i class="fas fa-play"></i>'; }
  }

  function showPlayOverlay(){
    if(qs('playOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'playOverlay';
    overlay.className = 'play-overlay';
    overlay.innerHTML = '<div>Audio diblokir oleh browser. Ketuk sekali di halaman atau tekan Play untuk mendengarkan.</div>';
    overlay.addEventListener('click', ()=>{ overlay.remove(); tryEnableAudio(); });
    document.body.appendChild(overlay);
  }

  function tryEnableAudio(){
    if(!audio) return;
    audio.play().then(()=>{ isPlaying = true; updatePlayIcons(); }).catch(()=>{});
  }

  function bindControls(){
    const playPause = qs('playPause');
    const prevBtn = qs('prevTrack');
    const nextBtn = qs('nextTrack');
    const toggle = qs('playToggle');

    if(playPause) playPause.addEventListener('click', ()=>{ if(isPlaying) pause(); else play(); });
    if(prevBtn) prevBtn.addEventListener('click', ()=>{ prev(); });
    if(nextBtn) nextBtn.addEventListener('click', ()=>{ next(); });
    if(toggle) toggle.addEventListener('click', ()=>{ if(isPlaying) pause(); else play(); });
  }

  function enableOnFirstGesture(){
    const tryEnable = async () => {
      if(!audio) return;
      try {
        await audio.play();
        isPlaying = true; updatePlayIcons();
      } catch(e){ /* still blocked */ }
      document.removeEventListener('click', tryEnable, true);
    };
    document.addEventListener('click', tryEnable, true);
  }

  // init
  fetch(playlistPath).then(r=>r.json()).then(data=>{
    if(!data || !Array.isArray(data.tracks)) return;
    playlist = data.tracks.slice(0,5);
    if(!playlist.length) return;
    loadTrack(0);
    bindControls();
    enableOnFirstGesture();
    // attempt autoplay (may be blocked)
    try { audio && audio.play().then(()=>{ isPlaying=true; updatePlayIcons(); }).catch(()=>{ updatePlayIcons(); }); } catch(e){}
  }).catch(()=>{ setTitle('No music'); });

  // expose
  window.musicPlayer = { play, pause, next, prev, loadTrack };
})();
