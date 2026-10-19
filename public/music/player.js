(function(){
  // Simple music player that reads public/music/playlist.json
  const playlistPath = '/music/playlist.json';
  let playlist = [];
  let current = 0;
  let audio;
  let isPlaying = false;

  function qs(id){return document.getElementById(id)}

  function setTitle(t){const el = qs('musicTitle'); if(el) el.textContent = t}

  function loadTrack(index){
    if(!playlist.length) return;
    current = (index + playlist.length) % playlist.length;
    const tr = playlist[current];
    if(!tr) return;
    if(!audio) audio = new Audio();
    audio.src = '/music/' + tr.file;
    audio.loop = false;
    audio.preload = 'auto';
    setTitle(tr.title || tr.file);
  }

  function play(){
    if(!audio) return;
    audio.play().then(()=>{
      isPlaying = true; updatePlayIcons();
    }).catch(()=>{
      // Autoplay blocked — show play overlay
      showPlayOverlay();
    });
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
    // minimal overlay: ask user to click the play button
    const overlay = document.createElement('div');
    overlay.className = 'play-overlay';
    overlay.innerHTML = '<div>Audio dimatikan oleh browser. Klik tombol Play untuk mendengarkan.</div>';
    document.body.appendChild(overlay);
    setTimeout(()=>{ overlay.addEventListener('click', ()=>{ overlay.remove(); tryEnableAudio(); }); },50);
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
    if(playPause) playPause.addEventListener('click', ()=>{ if(isPlaying) { pause(); } else { play(); } });
    if(prevBtn) prevBtn.addEventListener('click', ()=>{ prev(); });
    if(nextBtn) nextBtn.addEventListener('click', ()=>{ next(); });
    if(toggle) toggle.addEventListener('click', ()=>{ if(isPlaying) { pause(); } else { play(); } });
    // When audio ends, play next
    if(audio) audio.addEventListener('ended', ()=>{ next(); });
  }

  // init
  fetch(playlistPath).then(r=>r.json()).then(data=>{
    if(!data || !Array.isArray(data.tracks)) return;
    playlist = data.tracks.slice(0,5);
    if(!playlist.length) return;
    loadTrack(0);
    bindControls();
    // attempt autoplay on user entry
    try {
      audio.play().then(()=>{ isPlaying=true; updatePlayIcons(); }).catch(()=>{ /* blocked */ updatePlayIcons(); });
    } catch(e){ /* ignore */ }
  }).catch(()=>{
    // no playlist found — keep widget in disabled state
    setTitle('No music');
  });

  // expose for debugging
  window.musicPlayer = {
    play, pause, next, prev, loadTrack
  };
})();
