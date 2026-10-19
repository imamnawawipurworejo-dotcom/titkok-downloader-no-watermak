(function(){
  // Enhanced music player with WebAudio analyser to animate beats
  const playlistPath = '/music/playlist.json';
  let playlist = [];
  let current = 0;
  let audio = null;
  let isPlaying = false;

  // WebAudio analyser state
  let audioContext = null;
  let analyser = null;
  let dataArray = null;
  let sourceNode = null;
  let rafId = null;

  function qs(id){ return document.getElementById(id); }
  function setTitle(t){ const el = qs('musicTitle'); if(el) el.textContent = t; }

  function addPlayingClass(){ const w = qs('musicWidget'); if(w) w.classList.add('playing'); }
  function removePlayingClass(){ const w = qs('musicWidget'); if(w) w.classList.remove('playing'); }

  function createAudioIfNeeded() {
    if (audio) return;
    audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.volume = 1.0;

    audio.addEventListener('ended', () => {
      isPlaying = false;
      updatePlayIcons();
      stopVisualiser();
      setTimeout(()=> next(), 120);
    });
    audio.addEventListener('error', (e) => console.warn('Audio error', e));
    audio.addEventListener('stalled', () => console.warn('Audio stalled'));

    audio.addEventListener('playing', () => {
      isPlaying = true;
      updatePlayIcons();
      addPlayingClass();
      trySetupAnalyser();
    });
    audio.addEventListener('pause', () => {
      isPlaying = false;
      updatePlayIcons();
      removePlayingClass();
      stopVisualiser();
    });
  }

  function loadTrack(index, autoplay = false) {
    if(!playlist.length) return;
    current = (index + playlist.length) % playlist.length;
    const tr = playlist[current];
    if(!tr) return;
    createAudioIfNeeded();
    audio.src = '/music/' + encodeURIComponent(tr.file);
    try { audio.load(); } catch(e){}
    setTitle(tr.title || tr.file);
    pulseBeatOnce();
    if (autoplay) play();
  }

  async function play(){
    if(!audio) return;
    try {
      await audio.play();
      isPlaying = true; updatePlayIcons(); addPlayingClass(); trySetupAnalyser();
    } catch(err){
      showPlayOverlay();
    }
  }
  function pause(){ if(audio){ audio.pause(); isPlaying=false; updatePlayIcons(); removePlayingClass(); stopVisualiser(); } }

  function next(){ loadTrack(current+1, true); }
  function prev(){ loadTrack(current-1, true); }

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
    audio.play().then(()=>{ isPlaying = true; updatePlayIcons(); addPlayingClass(); trySetupAnalyser(); }).catch(()=>{});
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
        isPlaying = true; updatePlayIcons(); addPlayingClass(); trySetupAnalyser();
      } catch(e){ }
      document.removeEventListener('click', tryEnable, true);
    };
    document.addEventListener('click', tryEnable, true);
  }

  function pulseBeatOnce(){
    const w = qs('musicWidget');
    if(!w) return;
    w.classList.remove('pulse-once');
    void w.offsetWidth;
    w.classList.add('pulse-once');
    setTimeout(()=> w.classList.remove('pulse-once'), 700);
  }

  // WebAudio analyser functions
  function trySetupAnalyser(){
    try {
      if(!audio) return;
      if(!audioContext) setupAnalyser();
      if(audioContext && audioContext.state === 'suspended') audioContext.resume().catch(()=>{});
    } catch(e){ console.warn('analyser setup failed', e); }
  }

  function setupAnalyser(){
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      sourceNode = audioContext.createMediaElementSource(audio);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      sourceNode.connect(analyser);
      analyser.connect(audioContext.destination);
      startVisualiser();
    } catch(e){ console.warn('setupAnalyser error', e); }
  }

  function startVisualiser(){
    if(!analyser) return;
    stopVisualiser();
    const widget = qs('musicWidget');
    function frame(){
      analyser.getByteFrequencyData(dataArray);
      let lowerSum = 0;
      const lowerCount = Math.max(1, Math.floor(dataArray.length * 0.25));
      for(let i=0;i<lowerCount;i++) lowerSum += dataArray[i];
      const avg = lowerSum / lowerCount / 255;
      const intensity = Math.min(1, Math.pow(avg, 0.9) * 1.6);
      const scale = (1 + intensity * 0.12).toFixed(3);
      if(widget) widget.style.setProperty('--music-scale', scale);
      rafId = requestAnimationFrame(frame);
    }
    frame();
  }

  function stopVisualiser(){
    if(rafId) { cancelAnimationFrame(rafId); rafId = null; }
    const widget = qs('musicWidget');
    if(widget) widget.style.setProperty('--music-scale', '1');
  }

  function tryAutoplayOnEnter(){
    window.addEventListener('load', ()=>{
      setTimeout(()=>{ try { if(audio) audio.play().then(()=>{ isPlaying=true; updatePlayIcons(); addPlayingClass(); trySetupAnalyser(); }).catch(()=>{}); } catch(e){} }, 200);
    });
    document.addEventListener('visibilitychange', ()=>{
      if(document.visibilityState === 'visible' && audio && !isPlaying){
        try { audio.play().then(()=>{ isPlaying=true; updatePlayIcons(); addPlayingClass(); trySetupAnalyser(); }).catch(()=>{}); } catch(e){}
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
    try { audio && audio.play().then(()=>{ isPlaying=true; updatePlayIcons(); addPlayingClass(); trySetupAnalyser(); }).catch(()=>{ updatePlayIcons(); }); } catch(e){}
  }).catch(()=>{ setTitle('No music'); });

  window.musicPlayer = { play, pause, next, prev, loadTrack };
})();
