let currentSlides = [];
let currentSlideIndex = 0;
let currentUsername = 'tiktok_user'; 

async function fetchData() {
    const url = document.getElementById('urlInput').value;
    const btn = document.getElementById('downloadBtn');
    const loader = document.getElementById('loader');
    const resultArea = document.getElementById('resultArea');
    const videoContainer = document.getElementById('videoContainer');
    const photoContainer = document.getElementById('photoContainer');

    const btnVideo = document.getElementById('btnVideoNowm');
    const btnAudio = document.getElementById('btnAudio');
    const videoPlayer = document.getElementById('videoPlayer');

    if (!url) return alert('Please paste a TikTok link first!');

    // UI Loading State
    btn.classList.add('hidden');
    loader.classList.remove('hidden');
    resultArea.classList.add('hidden');

    try {
        const response = await fetch(`/api/download?url=${encodeURIComponent(url)}`);
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        // Populate Data UI
        currentUsername = data.username || 'tiktok_user';
        document.getElementById('resUsername').textContent = `@${data.username}`;
        document.getElementById('resViews').textContent = data.views;
        document.getElementById('resLikes').textContent = data.likes;

        resultArea.classList.remove('hidden');

        // Reset Displays and controls
        videoContainer.classList.add('hidden');
        photoContainer.classList.add('hidden');

        // Reset video & audio controls to avoid leftover handlers
        if (videoPlayer) {
            videoPlayer.removeAttribute('src');
            if (videoPlayer.load) videoPlayer.load();
        }
        if (btnVideo) {
            btnVideo.removeAttribute('href');
            btnVideo.onclick = null;
            btnVideo.style.display = 'inline-block';
        }
        if (btnAudio) {
            btnAudio.removeAttribute('href');
            btnAudio.onclick = null;
            btnAudio.style.display = 'none';
        }

        if (data.type === 'video') {
            videoContainer.classList.remove('hidden');
            const videoUrl = (data.downloads && (data.downloads.nowm && data.downloads.nowm[0])) || (data.downloads && data.downloads.wm && data.downloads.wm[0]);
            const audioUrl = (data.mp3 && data.mp3[0]) || null;
            
            // Set Preview Video
            if (videoPlayer && videoUrl) {
                videoPlayer.src = videoUrl;
            }
            
            // --- LOGIKA TOMBOL VIDEO (Auto Download) ---
            if (btnVideo && videoUrl) {
                // Hapus href default agar tidak membuka tab
                btnVideo.removeAttribute('href');
                // Override klik dengan fungsi download paksa
                btnVideo.onclick = (e) => {
                    e.preventDefault();
                    forceDownload(videoUrl, `${currentUsername}_video.mp4`, btnVideo);
                };
            }
            
            // --- LOGIKA TOMBOL AUDIO (Auto Download & Fix Access Denied) ---
            if (btnAudio) {
                if(audioUrl) {
                    btnAudio.style.display = 'inline-block';
                    btnAudio.removeAttribute('href');
                    btnAudio.onclick = (e) => {
                        e.preventDefault();
                        forceDownload(audioUrl, `${currentUsername}_audio.mp3`, btnAudio);
                    };
                } else {
                    btnAudio.style.display = 'none';
                    btnAudio.onclick = null;
                }
            }

        } else if (data.type === 'photo') {
            // Photo (slideshow) handling
            photoContainer.classList.remove('hidden');

            // If API provides an mp3 for slideshow, allow audio download too
            const photoAudioUrl = (data.mp3 && data.mp3[0]) || null;

            if (photoAudioUrl && btnAudio) {
                btnAudio.style.display = 'inline-block';
                btnAudio.removeAttribute('href');
                btnAudio.onclick = (e) => {
                    e.preventDefault();
                    forceDownload(photoAudioUrl, `${currentUsername}_audio.mp3`, btnAudio);
                };
            } else if (btnAudio) {
                // no audio available for this slideshow
                btnAudio.style.display = 'none';
                btnAudio.onclick = null;
            }

            // Hide video download button for slides
            if (btnVideo) { btnVideo.style.display = 'none'; btnVideo.onclick = null; }

            // Setup slider with proper sizing and horizontal layout
            setupSlider(data.slides || []);

            // Pause music if playing to avoid audio conflict
            if (window.musicPlayer && typeof window.musicPlayer.pause === 'function') {
                try { window.musicPlayer.pause(); } catch(e){}
            }
        }

    } catch (error) {
        alert('Error: ' + error.message);
        console.error(error);
    } finally {
        btn.classList.remove('hidden');
        loader.classList.add('hidden');
    }
}

/**
 * FUNGSI INTI: Force Download & Bypass Access Denied
 * Menggunakan server proxy /api/download?download=1 untuk menghindari CORS dan blokir browser
 */
async function forceDownload(url, filename, btnElement = null) {
    let originalText = '';
    
    // Efek visual pada tombol saat proses download berjalan
    if(btnElement) {
        originalText = btnElement.innerText;
        btnElement.innerText = "Downloading... (Please Wait)";
        btnElement.style.opacity = "0.7";
        btnElement.style.pointerEvents = "none";
    }

    try {
        // Panggil server proxy untuk menghindari CORS / browser block
        const proxyUrl = `/api/download?download=1&url=${encodeURIComponent(url)}`;
        const resp = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
                'X-Download-Filename': filename || 'download.bin'
            }
        });

        if (!resp.ok) throw new Error('Download proxy failed: ' + resp.status + ' ' + resp.statusText);

        const blob = await resp.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;
        // Jika server mengirim Content-Disposition, browser akan menuruti; tetap set fallback filename
        link.download = filename || 'download.bin';
        document.body.appendChild(link);

        // Klik berasal dari handler klik -> biasanya tidak diblok
        link.click();

        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);

    } catch (error) {
        console.error('Download failed:', error);
        alert("Gagal download otomatis. Mengalihkan ke tab baru...");
        // Fallback terakhir: buka tab baru jika fetch benar-benar diblokir browser
        window.open(url, '_blank');
    } finally {
        // Kembalikan tombol ke kondisi semula
        if(btnElement) {
            btnElement.innerText = originalText;
            btnElement.style.opacity = "1";
            btnElement.style.pointerEvents = "auto";
        }
    }
}

// --- Logic Slider Foto ---
function setupSlider(slides) {
    currentSlides = Array.isArray(slides) ? slides : [];
    currentSlideIndex = 0;
    const wrapper = document.querySelector('.slider-wrapper');
    const track = document.getElementById('sliderTrack');

    // Ensure wrapper and track exist and are correctly styled via CSS
    if (!track || !wrapper) return;

    track.innerHTML = ''; 

    // Build slides as flex children with full-width
    currentSlides.forEach(slide => {
        const item = document.createElement('div');
        item.className = 'slide-item';
        const img = document.createElement('img');
        img.className = 'slide-img';
        img.src = slide.url;
        img.alt = slide.alt || '';
        // Prevent huge layout shifts by setting loading=lazy
        img.loading = 'lazy';

        // Detect aspect ratio on load and mark landscape for cover display
        img.addEventListener('load', () => {
            if (img.naturalWidth && img.naturalHeight) {
                if (img.naturalWidth > img.naturalHeight) {
                    img.classList.add('landscape');
                } else {
                    img.classList.remove('landscape');
                }
            }
            // ensure widths are set and UI updated after image loads
            setSlideWidths();
            updateSlideUI();
        });

        item.appendChild(img);
        track.appendChild(item);
    });

    // If there are no slides, hide photoContainer
    if (currentSlides.length === 0) {
        document.getElementById('photoContainer').classList.add('hidden');
        return;
    }

    // Set initial widths then update UI
    setSlideWidths();
    updateSlideUI();

    const downloadAllBtn = document.getElementById('downloadAllBtn');
    if (downloadAllBtn) {
        downloadAllBtn.onclick = async () => {
            const originalText = downloadAllBtn.innerText;
            downloadAllBtn.innerText = "Downloading all photos...";
            for (let i = 0; i < currentSlides.length; i++) {
                await new Promise(r => setTimeout(r, 700));
                await forceDownload(currentSlides[i].url, `${currentUsername}_slide_${i+1}.jpg`);
            }
            downloadAllBtn.innerText = originalText;
        };
    }
}

function setSlideWidths() {
    const wrapper = document.querySelector('.slider-wrapper');
    const track = document.getElementById('sliderTrack');
    if (!track || !wrapper) return;
    const items = track.querySelectorAll('.slide-item');
    const width = wrapper.clientWidth;
    items.forEach(it => {
        it.style.width = width + 'px';
    });
    // ensure track's total width equals items width sum (browser handles flex layout)
}

function moveSlide(direction) {
    const total = currentSlides.length;
    if (total === 0) return;

    currentSlideIndex += direction;

    if (currentSlideIndex < 0) currentSlideIndex = total - 1;
    if (currentSlideIndex >= total) currentSlideIndex = 0;

    updateSlideUI();
}

function updateSlideUI() {
    const track = document.getElementById('sliderTrack');
    const counter = document.getElementById('slideCounter');
    const wrapper = document.querySelector('.slider-wrapper');
    if (!track || !wrapper) return;

    const slideWidth = wrapper.clientWidth;
    track.style.transform = `translateX(-${currentSlideIndex * slideWidth}px)`;
    counter.textContent = `${currentSlideIndex + 1} / ${currentSlides.length}`;

    // Update tombol download untuk foto yang sedang aktif
    const currentUrl = currentSlides[currentSlideIndex] && currentSlides[currentSlideIndex].url;
    const btn = document.getElementById('btnDownloadCurrentSlide');
    if (btn) {
        btn.onclick = null;
        if (currentUrl) {
            btn.onclick = () => {
                forceDownload(currentUrl, `${currentUsername}_slide_${currentSlideIndex + 1}.jpg`, btn);
            };
            btn.style.display = 'inline-block';
        } else {
            btn.style.display = 'none';
        }
    }
}

// Recalculate slide transform and widths on resize so layout keeps correct
let resizeTimeout = null;
window.addEventListener('resize', ()=>{
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(()=>{
        try { setSlideWidths(); updateSlideUI(); } catch(e){}
    }, 120);
});
