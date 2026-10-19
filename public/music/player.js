(function(){
  // Enhanced music player: autoplay attempt on enter, continuous play, and beat animation per track
  const playlistPath = '/music/playlist.json';
  let playlist = [];
  let current = 0;
  let audio = null;
  let isPlaying = false;
  let audioReady = false;

  function qs(id){ return document.getElementById(id); }
  function setTitle(t){ const el = qs('musicTitle'); if(el) el.textContent = t; }

  function addPlayingClass(){ const w = document.getElementById('musicWidget'); if(w) w.classList.add('playing'); }
  function removePlayingClass(){ const w = document.getElementById('musicWidget'); if(w) w.classList.remove('playing'); }

  function createAudioIfNeeded() {
    if (audio) return;
    audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.volume = 1.0;

    audio.addEventListener('ended', () => {
      isPlaying = false;
      updatePlayIcons();
      // small delay before loading next to allow UI animation
      setTimeout(()=> next(), 120);
    });
    audio.addEventListener('error', (e) => console.warn('Audio error', e));
    audio.addEventListener('stalled', () => console.warn('Audio stalled'));

    audio.addEventListener('playing', () => {
      isPlaying = true;
      updatePlayIcons();
      addPlayingClass();
    });
    audio.addEventListener('pause', () => {
      isPlaying = false;
      updatePlayIcons();
      removePlayingClass();
    });
  }

  function loadTrack(index, autoplay = false) {
    if(!playlist.length) return;
    current = (index + playlist.length) % playlist.length;
    const tr = playlist[current];
    if(!tr) return;
    createAudioIfNeeded();
    // encode filename for URLs with spaces or special chars
    // but preserve slashes if any; here files are in /music/
    audio.src = '/music/' + encodeURIComponent(tr.file);
    try { audio.load(); } catch(e){}
    audioReady = true;
    setTitle(tr.title || tr.file);
    // trigger a small visual beat when track is loaded
    pulseBeatOnce();
    if (autoplay) {
      play();
    }
  }

  async function play(){
    if(!audio) return;
    try {
      await audio.play();
      isPlaying = true; updatePlayIcons();
      addPlayingClass();
    } catch(err){
      // autoplay blocked
      showPlayOverlay();
    }
  }
  function pause(){ if(audio){ audio.pause(); isPlaying=false; updatePlayIcons(); removePlayingClass(); } }

  async function next(){ loadTrack(current+1, /*autoplay*/ true); }
  function prev(){ loadTrack(current-1, /*autoplay*/ true); }

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
    audio.play().then(()=>{ isPlaying = true; updatePlayIcons(); addPlayingClass(); }).catch(()=>{});
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
        isPlaying = true; updatePlayIcons(); addPlayingClass();
      } catch(e){ /* still blocked */ }
      document.removeEventListener('click', tryEnable, true);
    };
    document.addEventListener('click', tryEnable, true);
  }

  // small one-time pulse animation when track starts/loads
  function pulseBeatOnce(){
    const w = document.getElementById('musicWidget');
    if(!w) return;
    w.classList.remove('pulse-once');
    // force reflow
    void w.offsetWidth;
    w.classList.add('pulse-once');
    // remove after animation ends
    setTimeout(()=> w.classList.remove('pulse-once'), 700);
  }

  // Attempt autoplay when page visible (some browsers allow autoplay if muted or user gesture existed previously)
  function tryAutoplayOnEnter(){
    // Try once when window loads
    window.addEventListener('load', ()=>{
      setTimeout(()=>{
        try { if(audio) audio.play().then(()=>{ isPlaying=true; updatePlayIcons(); addPlayingClass(); }).catch(()=>{ }); } catch(e){}
      }, 200);
    });

    // Also try when tab becomes visible again
    document.addEventListener('visibilitychange', ()=>{
      if(document.visibilityState === 'visible' && audio && !isPlaying){
        try { audio.play().then(()=>{ isPlaying=true; updatePlayIcons(); addPlayingClass(); }).catch(()=>{}); } catch(e){}
      }
    });
  }

  // init
  fetch(playlistPath).then(r=>r.json()).then(data=>{
    if(!data || !Array.isArray(data.tracks)) return;
    playlist = data.tracks.slice(0,50);
    if(!playlist.length) return;
    loadTrack(0);
    bindControls();
    enableOnFirstGesture();
    tryAutoplayOnEnter();
    // initial attempt (may be blocked)
    try { audio && audio.play().then(()=>{ isPlaying=true; updatePlayIcons(); addPlayingClass(); }).catch(()=>{ updatePlayIcons(); }); } catch(e){}
  }).catch(()=>{ setTitle('No music'); });

  // expose
  window.musicPlayer = { play, pause, next, prev, loadTrack };
})();
