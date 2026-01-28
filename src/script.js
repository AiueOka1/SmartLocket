// NFCchain Swiper Gallery JavaScript

// =============================
// Cloudflare R2 Image Settings
// =============================
// Public R2 bucket URL (no trailing slash)
// This will be updated dynamically from backend if needed
let R2_PUBLIC_URL = "https://pub-cfb74f6c6f03ae746b61558cfd98e44d.r2.dev/nfcchain";

// Helper to build full image URL from filename
function getImageUrl(filename) {
    if (!filename) return "";
    // If already a full URL, return as-is (backend returns full URLs)
    if (filename.startsWith("http://") || filename.startsWith("https://")) {
        // Fix: Ensure URL includes /nfcchain/ if it's missing
        // Backend might return: https://pub-xxx.r2.dev/JADLNY/file.png
        // Should be: https://pub-xxx.r2.dev/nfcchain/JADLNY/file.png
        if (filename.includes('.r2.dev/')) {
            const urlPattern = /^(https?:\/\/pub-[a-f0-9]+\.r2\.dev)\/(.+)$/;
            const match = filename.match(urlPattern);
            if (match) {
                const domain = match[1];
                const path = match[2];
                // Check if /nfcchain/ is missing
                if (!path.startsWith('nfcchain/')) {
                    // Reconstruct URL with /nfcchain/
                    const fixedUrl = `${domain}/nfcchain/${path}`;
                    console.log(`🔧 Fixed R2 URL: ${filename} → ${fixedUrl}`);
                    return fixedUrl;
                }
            }
        }
        return filename;
    }
    // If relative path, prepend R2 public URL
    return `${R2_PUBLIC_URL}/${filename}`;
}

// ========================================
// MEMORY ID & BACKEND INTEGRATION
// ========================================

// API Base URL
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://us-central1-nfcchain.cloudfunctions.net/api'; // Update this when deploying

// Get Memory ID from URL
function getMemoryIdFromURL() {
    // Check URL patterns: /m/MEMORYID or ?id=MEMORYID
    const pathParts = window.location.pathname.split('/');
    const memoryIdFromPath = pathParts[pathParts.length - 1];
    const urlParams = new URLSearchParams(window.location.search);
    const memoryIdFromQuery = urlParams.get('id');
    return memoryIdFromPath && memoryIdFromPath !== 'gallery.html' && memoryIdFromPath !== '' 
        ? memoryIdFromPath 
        : memoryIdFromQuery;
}

// Global Memory ID
const MEMORY_ID = getMemoryIdFromURL();

// Load gallery data from backend
async function loadGalleryData() {
    if (!MEMORY_ID) {
        console.warn('No Memory ID found in URL. Using demo mode.');
        return null;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/api/memory/${MEMORY_ID}`);
        if (!response.ok) {
            if (response.status === 404) {
                // NFCchain not found - redirect to activation
                console.log('NFCchain not found, redirecting to activation...');
                window.location.href = 'activate.html?id=' + MEMORY_ID;
                return null;
            }
            throw new Error('Failed to load gallery data');
        }
        const data = await response.json();
        // Store passcode hash for edit mode verification
        if (data.passcodeHash) {
            STORED_PASSCODE_HASH = data.passcodeHash;
            console.log('🔒 Passcode protection enabled');
        }
        // Check if activated - redirect if not
        if (data.status === 'unused' || data.status === 'written' || data.status === 'shipped') {
            console.log(`NFCchain status: ${data.status}, redirecting to activation...`);
            // Redirect to activation without showing alert
            window.location.href = 'activate.html?id=' + MEMORY_ID;
            return null;
        }
        if (data.status !== 'activated') {
            // Any other non-activated status
            console.log(`NFCchain not activated (status: ${data.status}), redirecting...`);
            window.location.href = 'activate.html?id=' + MEMORY_ID;
            return null;
        }
        // NFCchain is activated - load images into memories array
        if (data.images && Array.isArray(data.images) && data.images.length > 0) {
            console.log(`📸 Loading ${data.images.length} images from backend`);
            // Clear existing memories and load from backend
            memories.length = 0;
            data.images.forEach(img => {
                memories.push({
                    id: img.id || Date.now() + Math.random(),
                    title: img.title || 'Memory',
                    description: img.description || '',
                    fullImage: img.fullImage,
                    thumbnail: img.thumbnail || img.fullImage,
                    fileName: img.fileName || '', // For Firebase Storage deletion
                    date: img.date || new Date().toISOString().split('T')[0],
                    location: img.location || '',
                    tags: img.tags || '',
                    isFavorite: img.isFavorite || false // Premium feature
                });
            });
            // Rebuild gallery with loaded images
            rebuildGalleryFromMemories();
        }
        // Check if premium and update MAX_IMAGES
        if (data.premium) {
            IS_PREMIUM = true;
            MAX_IMAGES = MAX_IMAGES_PREMIUM;
            console.log('⭐ Premium account detected - 100 image limit enabled');
        } else {
            IS_PREMIUM = false;
            MAX_IMAGES = MAX_IMAGES_FREE;
        }
        // Update image counter display with correct max
        updateImageCounter();
        // Load Spotify track if available
        if (data.spotifyTrack) {
            currentSpotifyTrack = data.spotifyTrack;
            currentSpotifyUrl = data.spotifyTrack.embedUrl;
            console.log('🎵 Spotify track loaded from backend');
        } else if (data.spotifyUrl) {
            // Legacy support
            currentSpotifyUrl = data.spotifyUrl;
        }
        // Return full gallery data
        return data;
    } catch (error) {
        console.error('Error loading gallery:', error);
        // Only show error if it's not a redirect scenario
        if (!error.message.includes('Failed to load gallery data')) {
            alert('Failed to load gallery. Please make sure the backend is running.');
        }
        return null;
    }
}

// Save gallery data to backend
async function saveGalleryData(galleryData) {
    if (!MEMORY_ID) {
        console.warn('No Memory ID. Cannot save to backend.');
        // Fall back to localStorage for demo mode
        localStorage.setItem('memorychain-gallery-data', JSON.stringify(galleryData));
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/api/memory/${MEMORY_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(galleryData)
        });
        if (!response.ok) {
            throw new Error('Failed to save gallery data');
        }
        console.log('Gallery data saved successfully');
    } catch (error) {
        console.error('Error saving gallery:', error);
        alert('Failed to save changes. Please try again.');
    }
}

// ========================================
// ENVELOPE & LETTER ZOOM ANIMATION
// ========================================

// Initialize envelope and letter functionality
document.addEventListener('DOMContentLoaded', async function() {
    // Show loading state while checking Memory ID
    if (MEMORY_ID) {
        document.body.style.opacity = '0.5';
        console.log('Loading NFCchain:', MEMORY_ID);
    }
    // Load gallery data first (will redirect if not activated)
    const galleryData = await loadGalleryData();
    // If we got here, the NFCchain is activated
    if (galleryData) {
        // Remove loading state
        document.body.style.opacity = '1';
        // Apply loaded data to the page
        if (galleryData.galleryTitle) {
            document.getElementById('galleryTitle').textContent = galleryData.galleryTitle;
        }
        // Load letter content
        if (galleryData.letterContent) {
            const letter = galleryData.letterContent;
            const letterTitle = document.querySelector('.zoom-letter h2');
            if (letterTitle) {
                letterTitle.textContent = letter.title || 'Welcome to SmartLocket';
            }
            const paragraphs = document.querySelectorAll('.zoom-letter p');
            if (letter.paragraphs && letter.paragraphs.length > 0) {
                letter.paragraphs.forEach((text, index) => {
                    if (paragraphs[index]) {
                        paragraphs[index].textContent = text;
                    }
                });
            }
        }
        // Store globally for use by other functions (including theme settings)
        window.currentGalleryData = galleryData;
        // Apply theme settings after a short delay to ensure all functions are loaded
        setTimeout(() => {
            applyLoadedThemeSettings(galleryData.themeSettings);
        }, 100);
    } else {
        // No gallery data and no redirect happened - probably demo mode
        document.body.style.opacity = '1';
    }
    const envelope = document.querySelector('.envelope-wrapper');
    const envelopeContainer = document.getElementById('envelopeContainer');
    const letterZoom = document.getElementById('letterZoom');
    const zoomLetter = document.getElementById('zoomLetter');
    const body = document.body;
    
    let isEnvelopeOpen = false;
    let letterZoomStart = 0;

    // CRITICAL: Force scroll to top on page load to prevent cached scroll position
    // This ensures the letter doesn't skip when refreshing the page
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    // Check if welcome letter should be shown
    const showWelcomeLetter = localStorage.getItem('memorychain-show-welcome-letter');
    
    if (showWelcomeLetter === 'false') {
        // Skip envelope and letter, go straight to gallery
        envelopeContainer.style.display = 'none';
        letterZoom.style.display = 'none';
        body.style.overflow = 'auto';
        body.classList.add('gallery-active');
        
        // Initialize Swiper immediately
        setTimeout(() => {
            initializeSwiper();
            swiperInitialized = true;
            if (mainSwiper) {
                setTimeout(() => {
                    mainSwiper.update();
                    mainSwiper.updateSlides();
                    mainSwiper.updateProgress();
                    mainSwiper.updateSlidesClasses();
                }, 100);
            }
        }, 100);
    } else {
        // Show envelope animation
        body.style.overflow = 'hidden';
    }

    // Load saved letter content
    loadLetterContent();

    // Open envelope on click
    if (envelope) {
        envelope.addEventListener('click', () => {
            if (!isEnvelopeOpen) {
                envelope.classList.add('flap');
                isEnvelopeOpen = true;

                // After animation, start letter zoom
                setTimeout(() => {
                    envelopeContainer.classList.add('fade-out');
                    setTimeout(() => {
                        envelopeContainer.style.display = 'none';
                        letterZoom.style.display = 'flex';
                        body.style.overflow = 'auto';
                        
                        // Force scroll to top before letter becomes active
                        window.scrollTo(0, 0);
                        
                        // Reset the hasUserScrolled flag
                        hasUserScrolled = false;
                        
                        // Wait two frames for proper rendering
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                letterZoom.classList.add('active');
                                
                                // Ensure we're still at top after activation
                                window.scrollTo(0, 0);
                                
                                // Set the start position after render
                                setTimeout(() => {
                                    letterZoomStart = 0; // Letter section starts at top
                                }, 10);
                            });
                        });
                    }, 500);
                }, 2000);
            }
        });
    }

    // Track if user has actually scrolled (prevents immediate transition on refresh)
    let hasUserScrolled = false;
    let scrollTimeout;

    // Handle scroll for zoom effect
    window.addEventListener('scroll', () => {
        if (!letterZoom || !letterZoom.classList.contains('active')) return;

        // Mark that user has scrolled after a brief delay
        // This prevents cached scroll position from triggering transition
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            hasUserScrolled = true;
        }, 100);

        const scrollPos = window.scrollY;
        const letterZoomHeight = letterZoom.offsetHeight;
        const windowHeight = window.innerHeight;
        
        // Calculate progress through the letter section
        // Letter section is 200vh tall, so we need to scroll 2 viewport heights
        const scrollInSection = scrollPos;
        const totalScrollDistance = letterZoomHeight - windowHeight;
        const progress = Math.max(0, Math.min(scrollInSection / totalScrollDistance, 1));
        
        console.log('Scroll Progress:', {
            scrollPos,
            letterZoomHeight,
            windowHeight,
            totalScrollDistance,
            progress: (progress * 100).toFixed(2) + '%'
        });
        
        // Zoom from 1 to 1.8 (slower, gentler zoom for better mobile readability)
        const zoomScale = 1 + (progress * 0.8);
        
        // Start fully visible, then fade out as it zooms (from 10% to 98%)
        let opacity = 1;
        if (progress > 0.10) {
            // Fade out from 10% to 98% - gradual fade as it zooms
            opacity = Math.max(0, 1 - ((progress - 0.10) / 0.88));
        }
        
        if (zoomLetter) {
            zoomLetter.style.transform = `scale(${zoomScale})`;
            zoomLetter.style.opacity = opacity;
        }

        // When scrolled past 98%, start transitioning to main content
        // IMPORTANT: Only transition if user has actually scrolled (not just cached position)
        if (progress >= 0.98 && !body.classList.contains('gallery-active') && hasUserScrolled) {
            // Fade out the letter section
            letterZoom.classList.add('fading-out');
            
            // Show main content with smooth transition
            setTimeout(() => {
                body.classList.add('gallery-active');
                
                // Remove letter section from DOM after transition
                setTimeout(() => {
                    letterZoom.style.display = 'none';
                    letterZoom.classList.remove('active');
                    window.scrollTo(0, 0);
                    
                    // Initialize Swiper after content becomes visible
                    if (!swiperInitialized) {
                        setTimeout(() => {
                            initializeSwiper();
                            swiperInitialized = true;
                            
                            // Force Swiper to update and render all slides
                            if (mainSwiper) {
                                mainSwiper.update();
                                mainSwiper.updateSlides();
                                mainSwiper.updateProgress();
                                mainSwiper.updateSlidesClasses();
                            }
                        }, 100);
                    }
                }, 100);
            }, 200);
        }
    });
});

// ========================================
// END ENVELOPE & LETTER ANIMATION
// ========================================

// Test if JavaScript is loading
console.log('🚀 JavaScript file loaded successfully!');
window.addEventListener('load', function() {
    console.log('🎯 Window loaded, all scripts ready!');
});

// Memory data structure for Firebase integration
let memories = [
    {
        id: 0,
        title: "Beautiful Memory #1",
        description: "This is a placeholder for your first memory. Upload your special moments here and create lasting memories.",
        fullImage: "https://via.placeholder.com/800x500/6366f1/ffffff?text=Memory+1",
        thumbnail: "https://via.placeholder.com/120x80/6366f1/ffffff?text=M1",
        date: "2024-01-15",
        location: "Paris, France",
        tags: "vacation, memories, beautiful"
    },
    {
        id: 1,
        title: "Beautiful Memory #2", 
        description: "Another precious moment waiting to be captured and shared. Every memory tells a unique story.",
        fullImage: "https://via.placeholder.com/800x500/8b5cf6/ffffff?text=Memory+2",
        thumbnail: "https://via.placeholder.com/120x80/8b5cf6/ffffff?text=M2",
        date: "2024-02-20",
        location: "Tokyo, Japan",
        tags: "family, travel, fun"
    },
    {
        id: 2,
        title: "Beautiful Memory #3",
        description: "Every picture tells a story. What's yours? Capture the moments that matter most to you.",
        fullImage: "https://via.placeholder.com/800x500/06b6d4/ffffff?text=Memory+3",
        thumbnail: "https://via.placeholder.com/120x80/06b6d4/ffffff?text=M3",
        date: "2024-03-10",
        location: "New York, USA",
        tags: "adventure, city, lights"
    },
    {
        id: 3,
        title: "Beautiful Memory #4",
        description: "Memories fade but pictures last forever. Preserve your most cherished moments in this gallery.",
        fullImage: "https://via.placeholder.com/800x500/10b981/ffffff?text=Memory+4",
        thumbnail: "https://via.placeholder.com/120x80/10b981/ffffff?text=M4",
        date: "2024-04-05",
        location: "Bali, Indonesia",
        tags: "beach, sunset, relaxation"
    },
    {
        id: 4,
        title: "Beautiful Memory #5",
        description: "The final piece of your memory collection. Add your own photos to make this gallery truly personal.",
        fullImage: "https://via.placeholder.com/800x500/f59e0b/ffffff?text=Memory+5",
        thumbnail: "https://via.placeholder.com/120x80/f59e0b/ffffff?text=M5",
        date: "2024-05-12",
        location: "London, England",
        tags: "culture, history, exploration"
    }
];

// Configuration constants
let MAX_IMAGES = 5; // Will be updated to 100 for premium users
const MAX_IMAGES_FREE = 5;
const MAX_IMAGES_PREMIUM = 100;
const MAX_FAVORITES = 5; // Only 5 favorites show in slideshow for premium
const MIN_IMAGES = 3;

// Global variables
let mainSwiper;
let isEditMode = false;
let currentActiveSlide = 0;
let currentTheme = 'light';
let currentBackgroundStyle = 'solid';
let currentEditingImageIndex = null;
let swiperInitialized = false;
let currentSpotifyUrl = null; // Stores the current Spotify embed URL
let currentSpotifyTrack = null; // Stores the current Spotify track object
let STORED_PASSCODE_HASH = null; // Stores the passcode hash from backend
let IS_PREMIUM = false; // Will be set from backend data

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Don't initialize Swiper immediately - wait for letter animation
    // initializeSwiper();
});

function initializeSwiper() {
    const swiperWrapper = document.getElementById('swiperWrapper');
    if (!swiperWrapper) {
        console.error('Swiper wrapper not found!');
        return;
    }
    
    // Destroy existing swiper instance to prevent conflicts
    if (mainSwiper && typeof mainSwiper.destroy === 'function') {
        console.log('🔄 Destroying existing Swiper instance');
        mainSwiper.destroy(true, true);
        mainSwiper = null;
    }
    
    swiperWrapper.innerHTML = ''; // Clear everything
    
    // Debug: Show current state
    console.log(`📊 Gallery Status:`, {
        isPremium: IS_PREMIUM,
        totalMemories: memories.length,
        favorites: memories.filter(m => m.isFavorite).length,
        maxImages: MAX_IMAGES
    });
    
    // For premium users, only show favorite images in slideshow (max 5)
    // For free users, show all images (max 5)
    let slideshowMemories = memories;
    if (IS_PREMIUM) {
        const favoriteMemories = memories.filter(m => m.isFavorite);
        console.log(`⭐ Found ${favoriteMemories.length} favorites:`, favoriteMemories.map(m => m.title));
        
        if (favoriteMemories.length > 0) {
            slideshowMemories = favoriteMemories.slice(0, MAX_FAVORITES);
            console.log(`⭐ Premium: Showing ${slideshowMemories.length} favorite images in slideshow`);
        } else {
            // If no favorites selected, show all memories
            slideshowMemories = memories;
            console.log(`⭐ Premium: No favorites selected, showing all ${slideshowMemories.length} images`);
        }
    } else {
        console.log(`👤 Free account: Showing all ${slideshowMemories.length} images`);
    }
    
    // Store slideshow memories globally so we can reference them later
    window.currentSlideshowMemories = slideshowMemories;
    
    console.log('🎡 Creating Ferris Wheel with', slideshowMemories.length, 'images');
    
    // Create each memory slide
    slideshowMemories.forEach((memory, index) => {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        slide.setAttribute('data-memory-index', index);
        
        const imageUrl = getImageUrl(memory.fullImage);
        slide.innerHTML = `
            <div class="slide-content">
                <img src="${imageUrl}" 
                     alt="${memory.title}"
                     loading="lazy"
                     onerror="console.error('❌ Failed to load image:', '${imageUrl}'); this.style.display='none';">
                <div class="slide-info">
                    <h3>${memory.title}</h3>
                    <p>${memory.description}</p>
                </div>
            </div>
        `;
        
        swiperWrapper.appendChild(slide);
        console.log(`✅ Created slide ${index + 1}: ${memory.title}`);
    });
    
    console.log(`🎡 Total slides created: ${swiperWrapper.children.length}`);
    
    // Initialize Swiper
    mainSwiper = new Swiper('.mainSwiper', {
        effect: 'coverflow',
        grabCursor: true,
        centeredSlides: true,
        slidesPerView: 3,
        slidesPerGroup: 1,
        spaceBetween: 30,
        initialSlide: 0, // Start at first slide (Swiper handles loop)
        coverflowEffect: {
            rotate: 30,
            stretch: 0,
            depth: 100,
            modifier: 1,
            slideShadows: true,
        },
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
            dynamicBullets: true,
        },
        scrollbar: {
            el: '.swiper-scrollbar',
            draggable: true,
            dragSize: 50,
        },
        autoplay: {
            delay: 4000,
            disableOnInteraction: true,
            pauseOnMouseEnter: true,
        },
        speed: 800,
        loop: true, // Enable Swiper's loop mode
        loopedSlides: 2,
        slidesPerGroupSkip: 1,
        watchSlidesProgress: true,
        preloadImages: false,
        lazy: false,
        observer: true,
        observeParents: true,
        keyboard: {
            enabled: true,
            onlyInViewport: true,
        },
        mousewheel: {
            enabled: true,
            sensitivity: 1,
        },
        breakpoints: {
            320: {
                slidesPerView: 1.2,
                spaceBetween: 20,
                coverflowEffect: {
                    rotate: 20,
                    depth: 80,
                    modifier: 1,
                    slideShadows: true,
                },
            },
            480: {
                slidesPerView: 1.5,
                spaceBetween: 25,
                coverflowEffect: {
                    rotate: 25,
                    depth: 90,
                    modifier: 1,
                    slideShadows: true,
                },
            },
            768: {
                slidesPerView: 2.5,
                spaceBetween: 30,
                coverflowEffect: {
                    rotate: 30,
                    depth: 100,
                    modifier: 1,
                    slideShadows: true,
                },
            },
            1080: {
                slidesPerView: 3, // Keep 3 slides visible on desktop
                spaceBetween: 30,
                coverflowEffect: {
                    rotate: 35,
                    depth: 120,
                    modifier: 1,
                    slideShadows: true,
                },
            }
        },
        on: {
            slideChange: function() {
                // Get the real index (accounting for loop mode)
                const realIndex = this.realIndex;
                currentActiveSlide = realIndex;
                updateSlideInfo(realIndex);
                updateSlideshowCounter();
            },
            init: function() {
                console.log('🎡 Ferris Wheel initialized with', this.slides.length, 'total slides');
                updateSlideshowCounter();
            }
        }
    });

    // Add hover effects to pause/resume autoplay
    const swiperContainer = document.querySelector('.mainSwiper');
    if (swiperContainer) {
        swiperContainer.addEventListener('mouseenter', () => {
            if (mainSwiper && mainSwiper.autoplay) {
                mainSwiper.autoplay.stop();
            }
        });
        
        swiperContainer.addEventListener('mouseleave', () => {
            if (mainSwiper && mainSwiper.autoplay) {
                mainSwiper.autoplay.start();
            }
        });
    }
}

function updateSlideInfo(index) {
    const slideshowMemories = window.currentSlideshowMemories || memories;
    const memory = slideshowMemories[index];
    if (memory) {
        console.log(`🎡 Viewing: ${memory.title} (${index + 1}/${slideshowMemories.length})`);
    }
}

function updateSlideshowCounter() {
    const slideshowMemories = window.currentSlideshowMemories || memories;
    const counterElement = document.querySelector('.image-counter');
    if (counterElement && mainSwiper) {
        const current = mainSwiper.realIndex + 1;
        const total = slideshowMemories.length;
        counterElement.textContent = `${current} / ${total}`;
    }
}

// Placeholder function for upload modal (for future Firebase integration)
function openUploadModal() {
    alert(`🚀 Firebase Upload Integration Ready!

Features to implement:
✨ Drag & Drop image uploads
📱 Mobile-friendly file selection
🔄 Real-time upload progress
🖼️ Automatic thumbnail generation
💾 Firestore metadata storage
🔗 Direct Swiper integration
📊 Upload analytics
🎨 Image filters and editing

Current Swiper features:
• Smooth transitions with progress bar
• Touch/swipe navigation
• Keyboard controls (arrow keys)
• Auto-play with pause on hover
• Responsive thumbnail navigation
• Loop mode for continuous browsing

Ready for Firebase integration!`);
}

// Firebase integration helper functions

// Function to add new memory to Swiper
function addNewMemoryToSwiper(imageUrl, thumbnailUrl, title, description) {
    const newMemory = {
        id: memories.length,
        title: title,
        description: description,
        fullImage: imageUrl,
        thumbnail: thumbnailUrl
    };
    
    memories.push(newMemory);
    
    // Add new slide to main swiper
    const newSlide = `
        <div class="swiper-slide">
            <div class="slide-content">
                <img src="${getImageUrl(imageUrl)}" alt="${title}">
                <div class="slide-info">
                    <h3>${title}</h3>
                    <p>${description}</p>
                </div>
            </div>
        </div>
    `;
    
    // Append slide
    mainSwiper.appendSlide(newSlide);
    
    // Go to the new slide
    mainSwiper.slideTo(memories.length - 1);
}

// Function to update existing memory
function updateSwiperSlide(index, updates) {
    if (index >= 0 && index < memories.length) {
        Object.assign(memories[index], updates);
        
        // CRITICAL FIX: In loop mode, find slides by data-swiper-slide-index attribute
        // This ensures we update the original slide AND all loop duplicates
        const allSlides = document.querySelectorAll('.mainSwiper .swiper-slide');
        
        allSlides.forEach((slide) => {
            // Get the real index from data attribute (set by Swiper in loop mode)
            const slideDataIndex = slide.getAttribute('data-swiper-slide-index');
            const slideRealIndex = slideDataIndex !== null ? parseInt(slideDataIndex) : null;
            
            // Update if this slide matches our index
            if (slideRealIndex === index) {
                console.log(`Updating slide with data-index ${slideDataIndex} for memory ${index}`);
                
                if (updates.fullImage) {
                    const img = slide.querySelector('.slide-content img');
                    if (img) img.src = getImageUrl(updates.fullImage);
                }
                
                if (updates.title) {
                    const title = slide.querySelector('.slide-info h3');
                    if (title) title.textContent = updates.title;
                }
                
                if (updates.description) {
                    const desc = slide.querySelector('.slide-info p');
                    if (desc) desc.textContent = updates.description;
                }
            }
        });
        
        // Force swiper to update after changes
        if (mainSwiper) {
            mainSwiper.update();
            console.log(`✅ Updated memory ${index}:`, updates.title);
        }
    }
}

// Function to remove slide
function removeSwiperSlide(index) {
    if (index >= 0 && index < memories.length) {
        memories.splice(index, 1);
        
        // Update IDs for remaining memories
        memories.forEach((memory, i) => {
            memory.id = i;
        });
        
        // Regenerate all slides with updated memories
        regenerateSlides();
    }
}

// Function to regenerate all slides (useful after adding/removing memories)
function regenerateSlides() {
    if (!mainSwiper) return;
    
    // Destroy current swiper
    mainSwiper.destroy(true, true);
    
    // Re-initialize with new slides
    initializeSwiper();
    
    console.log('🔄 Slides regenerated with', memories.length, 'memories');
}

// Function to rebuild gallery from loaded memories (from backend)
function rebuildGalleryFromMemories() {
    console.log('🔨 Rebuilding gallery from', memories.length, 'memories');
    
    // Update all memory image URLs to use R2 public URL if needed
    memories.forEach((memory, index) => {
        const originalFullImage = memory.fullImage;
        const originalThumbnail = memory.thumbnail;
        
        // Process URLs - getImageUrl handles both full URLs and relative paths
        memory.fullImage = getImageUrl(memory.fullImage);
        memory.thumbnail = getImageUrl(memory.thumbnail || memory.fullImage);
        
        // Debug logging for first few images
        if (index < 3) {
            console.log(`🖼️ Image ${index} URL processing:`, {
                original: originalFullImage,
                processed: memory.fullImage,
                thumbnail: memory.thumbnail
            });
        }
        
        // Test if image URL is accessible (optional debug)
        if (index === 0) {
            const testImg = new Image();
            testImg.onload = () => console.log(`✅ First image URL is accessible: ${memory.fullImage}`);
            testImg.onerror = () => console.error(`❌ First image URL failed to load: ${memory.fullImage} - Check CORS and public access!`);
            testImg.src = memory.fullImage;
        }
    });
    
    // Simply reinitialize the swiper with current memories
    // initializeSwiper will handle the favorite filtering for premium users
    initializeSwiper();
    
    console.log(`✅ Gallery rebuilt successfully`);
}

// Control functions for external use
function goToSlide(index) {
    if (mainSwiper) {
        mainSwiper.slideTo(index);
    }
}

function nextSlide() {
    if (mainSwiper) {
        mainSwiper.slideNext();
    }
}

function prevSlide() {
    if (mainSwiper) {
        mainSwiper.slidePrev();
    }
}

function pauseAutoplay() {
    if (mainSwiper) {
        mainSwiper.autoplay.stop();
    }
}

function resumeAutoplay() {
    if (mainSwiper) {
        mainSwiper.autoplay.start();
    }
}

// Fullscreen functionality
function enterFullscreen() {
    const swiperContainer = document.querySelector('.mainSwiper');
    if (swiperContainer) {
        if (swiperContainer.requestFullscreen) {
            swiperContainer.requestFullscreen();
        } else if (swiperContainer.mozRequestFullScreen) {
            swiperContainer.mozRequestFullScreen();
        } else if (swiperContainer.webkitRequestFullscreen) {
            swiperContainer.webkitRequestFullscreen();
        } else if (swiperContainer.msRequestFullscreen) {
            swiperContainer.msRequestFullscreen();
        }
    }
}

// Additional Swiper configuration for advanced features
function enhanceSwiper() {
    if (mainSwiper) {
        // Add custom event listeners
        mainSwiper.on('slideChangeTransitionStart', function() {
            // Add custom animations or effects here
            const activeSlide = this.slides[this.activeIndex];
            if (activeSlide) {
                activeSlide.style.transform = 'scale(1.02)';
                setTimeout(() => {
                    activeSlide.style.transform = 'scale(1)';
                }, 300);
            }
        });
        
        // Add keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            if (e.key === 'f' || e.key === 'F') {
                enterFullscreen();
            } else if (e.key === ' ') {
                e.preventDefault();
                if (mainSwiper.autoplay.running) {
                    pauseAutoplay();
                } else {
                    resumeAutoplay();
                }
            }
        });
    }
}

// Edit Mode Functions
function exitEditMode() {
    isEditMode = false;
    const editOverlay = document.getElementById('editOverlay');
    const colorPalette = document.getElementById('colorPalettePanel');
    
    editOverlay.classList.remove('active');
    colorPalette.classList.remove('active');
    
    if (mainSwiper.autoplay) {
        mainSwiper.autoplay.start();
    }
}

function toggleEditMode() {
    console.log(`🔄 Toggle edit mode called, current state: ${isEditMode}`);
    
    // If already in edit mode, exit it
    if (isEditMode) {
        console.log('❌ Exiting edit mode');
        exitEditMode();
        return;
    }
    
    // Check if passcode protection is enabled
    if (STORED_PASSCODE_HASH) {
        console.log('🔒 Passcode required, opening passcode modal');
        openPasscodeModal();
    } else {
        // No passcode protection - enter edit mode directly
        console.log('⚠️ No passcode protection, entering edit mode directly');
        enterEditMode();
    }
}

// New function to actually enter edit mode (called after passcode verification)
function enterEditMode() {
    console.log('✅ Entering edit mode');
    isEditMode = true;
    const editOverlay = document.getElementById('editOverlay');
    
    editOverlay.classList.add('active');
    document.body.classList.add('edit-mode');
    enableHeaderEditing();
    
    if (mainSwiper && mainSwiper.autoplay) {
        mainSwiper.autoplay.stop();
    }
    
    // Setup functions - call only once
    updateEditControls();
    populateImageGrid();
    populateGalleryTitleInput();
    setupImageUpload(); // This now properly prevents duplicate listeners
}

// Gallery Title Functions
function populateGalleryTitleInput() {
    const titleElement = document.getElementById('galleryTitle');
    const titleInput = document.getElementById('galleryTitleInput');
    if (titleElement && titleInput) {
        titleInput.value = titleElement.textContent;
    }
}

function saveGalleryTitle() {
    const titleInput = document.getElementById('galleryTitleInput');
    const titleElement = document.getElementById('galleryTitle');
    
    if (titleInput && titleElement) {
        const newTitle = titleInput.value.trim();
        if (newTitle) {
            titleElement.textContent = newTitle;
            localStorage.setItem('memorychain-gallery-title', newTitle);
            showNotification('✨ Gallery title updated!', 'success');
        } else {
            showNotification('❌ Please enter a valid title', 'error');
        }
    }
}

function exitEditMode() {
    isEditMode = false;
    const editOverlay = document.getElementById('editOverlay');
    const colorPalette = document.getElementById('colorPalettePanel');
    
    editOverlay.classList.remove('active');
    colorPalette.classList.remove('active');
    document.body.classList.remove('edit-mode');
    disableHeaderEditing();
    
    // Save all changes to backend when exiting edit mode
    saveAllChangesToBackend();
    
    if (mainSwiper.autoplay) {
        mainSwiper.autoplay.start();
    }
}

// Save all gallery changes to backend
async function saveAllChangesToBackend() {
    if (!MEMORY_ID) {
        console.warn('No Memory ID. Saving to localStorage only.');
        saveToLocalStorage();
        return;
    }

    try {
        // Show saving notification
        showNotification('💾 Saving changes...', 'info');
        
        console.log('� Preparing to save gallery data...');
        
        // No need to compress - images are URLs from Firebase Storage
        const preparedMemories = memories.map(memory => ({
            id: memory.id || 0,
            title: memory.title || '',
            description: memory.description || '',
            fullImage: memory.fullImage || '', // URL from Storage
            thumbnail: memory.thumbnail || memory.fullImage || '', // URL from Storage
            fileName: memory.fileName || '', // For Storage deletion
            date: memory.date || '',
            location: memory.location || '',
            tags: memory.tags || '',
            isFavorite: memory.isFavorite || false // Premium feature
        }));
        
        // Prepare gallery data
        const galleryData = {
            galleryTitle: document.getElementById('galleryTitle')?.textContent || 'SmartLocket Gallery',
            images: preparedMemories,
            letterContent: getLetterContent(),
            spotifyUrl: currentSpotifyUrl || null,
            spotifyTrack: currentSpotifyTrack || null, // Save Spotify track object
            // Save theme and appearance settings
            themeSettings: {
                theme: currentTheme || 'light',
                backgroundStyle: currentBackgroundStyle || 'solid',
                colorTheme: document.documentElement.getAttribute('data-color-theme') || 'blue',
                showWelcomeLetter: localStorage.getItem('memorychain-show-welcome-letter') !== 'false'
            }
        };
        
        // Remove null values to avoid Firebase errors
        if (!galleryData.spotifyUrl) delete galleryData.spotifyUrl;
        if (!galleryData.spotifyTrack) delete galleryData.spotifyTrack;

        const totalSize = JSON.stringify(galleryData).length;
        const totalSizeKB = (totalSize / 1024).toFixed(2);
        const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
        
        console.log('📤 Sending to backend:', {
            memoryId: MEMORY_ID,
            galleryTitle: galleryData.galleryTitle,
            imageCount: galleryData.images.length,
            totalSize: `${totalSizeKB}KB (${totalSizeMB}MB)`,
            hasLetter: !!galleryData.letterContent,
            hasSpotify: !!galleryData.spotifyUrl || !!galleryData.spotifyTrack,
            themeSettings: galleryData.themeSettings
        });

        // Send to backend
        const response = await fetch(`${API_BASE_URL}/api/memory/${MEMORY_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(galleryData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Backend error response:', errorText);
            throw new Error(`Failed to save gallery data: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Gallery saved successfully:', result);
        showNotification('✅ All changes saved!', 'success');
        
        // Save metadata only to localStorage (images are in backend)
        saveToLocalStorage();
        
    } catch (error) {
        console.error('❌ Error saving gallery:', error);
        showNotification('❌ Failed to save changes. ' + error.message, 'error');
        
        // Try to save metadata to localStorage (without images)
        saveToLocalStorage();
    }
}

// Helper function to get current letter content
function getLetterContent() {
    const letterTitle = document.querySelector('.zoom-letter h2')?.textContent || 'Welcome to SmartLocket';
    const paragraphs = Array.from(document.querySelectorAll('.zoom-letter p')).map(p => p.textContent);
    
    return {
        title: letterTitle,
        paragraphs: paragraphs
    };
}

// Helper function to save to localStorage (skip images to avoid quota errors)
function saveToLocalStorage() {
    try {
        const galleryData = {
            galleryTitle: document.getElementById('galleryTitle')?.textContent,
            // Don't save images to localStorage - they're too large and cause quota errors
            imageCount: memories.length,
            letterContent: getLetterContent(),
            spotifyUrl: currentSpotifyUrl,
            themeSettings: {
                theme: currentTheme,
                backgroundStyle: currentBackgroundStyle,
                colorTheme: document.documentElement.getAttribute('data-color-theme') || 'blue',
                showWelcomeLetter: localStorage.getItem('memorychain-show-welcome-letter') !== 'false'
            }
        };
        
        localStorage.setItem('memorychain-gallery-data', JSON.stringify(galleryData));
        console.log('💾 Saved metadata to localStorage (images saved to backend only)');
    } catch (error) {
        console.warn('⚠️ localStorage quota exceeded, skipping backup save:', error.message);
        // Don't throw error - backend save is what matters
    }
}

// Make essential functions globally available for HTML onclick attributes
window.toggleEditMode = toggleEditMode;
window.exitEditMode = exitEditMode;
window.saveGalleryTitle = saveGalleryTitle;

// ========================================
// PASSCODE VERIFICATION FUNCTIONS
// ========================================

// Simple bcrypt-compatible hash verification using Web Crypto API
async function hashPasscode(passcode) {
    const encoder = new TextEncoder();
    const data = encoder.encode(passcode);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

async function verifyPasscode(inputPasscode, storedHash) {
    // For bcrypt hashes (starting with $2a$ or $2b$), we need to send to backend
    if (storedHash && storedHash.startsWith('$2')) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/verify-passcode`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memoryId: MEMORY_ID,
                    passcode: inputPasscode
                })
            });
            
            if (!response.ok) {
                return false;
            }
            
            const result = await response.json();
            return result.valid === true;
        } catch (error) {
            console.error('Passcode verification error:', error);
            return false;
        }
    }
    
    // For simple SHA-256 hashes (fallback for demo mode)
    const inputHash = await hashPasscode(inputPasscode);
    return inputHash === storedHash;
}

function openPasscodeModal() {
    const modal = document.getElementById('passcodeModal');
    const input = document.getElementById('passcodeInput');
    const error = document.getElementById('passcodeError');
    
    if (modal) {
        // Clear previous input and errors
        if (input) input.value = '';
        if (error) error.style.display = 'none';
        
        // Show modal
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.add('active');
            if (input) input.focus();
        }, 10);
        
        // Add Enter key listener
        if (input) {
            input.addEventListener('keypress', handlePasscodeEnter);
        }
    }
}

function closePasscodeModal() {
    const modal = document.getElementById('passcodeModal');
    const input = document.getElementById('passcodeInput');
    
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
        
        // Remove Enter key listener
        if (input) {
            input.removeEventListener('keypress', handlePasscodeEnter);
        }
    }
}

function handlePasscodeEnter(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        verifyPasscodeAndEnterEditMode();
    }
}

async function verifyPasscodeAndEnterEditMode() {
    const input = document.getElementById('passcodeInput');
    const error = document.getElementById('passcodeError');
    const passcode = input?.value?.trim();
    
    // Validate input
    if (!passcode || passcode.length !== 6) {
        if (error) {
            error.textContent = '❌ Please enter a 6-digit passcode';
            error.style.display = 'block';
        }
        return;
    }
    
    // Show loading state
    const unlockBtn = document.querySelector('#passcodeModal .image-save-btn');
    const originalText = unlockBtn?.innerHTML;
    if (unlockBtn) {
        unlockBtn.disabled = true;
        unlockBtn.innerHTML = '<span style="animation: spin 1s linear infinite;">⏳</span> Verifying...';
    }
    
    try {
        // Verify passcode
        const isValid = await verifyPasscode(passcode, STORED_PASSCODE_HASH);
        
        if (isValid) {
            console.log('✅ Passcode verified successfully');
            
            // Close modal
            closePasscodeModal();
            
            // Check if there's a pending Spotify action
            if (window.pendingSpotifyAction) {
                const action = window.pendingSpotifyAction;
                window.pendingSpotifyAction = null; // Clear the pending action
                
                if (action === 'open') {
                    // Temporarily allow the action
                    isEditMode = true;
                    openSpotifyModal();
                    isEditMode = false;
                } else if (action === 'clear') {
                    // Temporarily allow the action
                    isEditMode = true;
                    clearSpotifyTrack();
                    isEditMode = false;
                }
                
                showNotification('🔓 Access granted!', 'success');
            } else {
                // Enter edit mode (original behavior)
                enterEditMode();
                showNotification('🔓 Edit mode unlocked!', 'success');
            }
        } else {
            console.log('❌ Incorrect passcode');
            
            // Show error
            if (error) {
                error.textContent = '❌ Incorrect passcode. Please try again.';
                error.style.display = 'block';
            }
            
            // Clear input and focus
            if (input) {
                input.value = '';
                input.focus();
            }
        }
    } catch (error) {
        console.error('Passcode verification error:', error);
        
        if (error) {
            error.textContent = '❌ Verification failed. Please try again.';
            error.style.display = 'block';
        }
    } finally {
        // Restore button
        if (unlockBtn) {
            unlockBtn.disabled = false;
            unlockBtn.innerHTML = originalText;
        }
    }
}

// Make passcode functions globally available
window.openPasscodeModal = openPasscodeModal;
window.closePasscodeModal = closePasscodeModal;
window.verifyPasscodeAndEnterEditMode = verifyPasscodeAndEnterEditMode;

// ========================================
// FORGOT PASSCODE MODAL FUNCTIONS
// ========================================

// Store reset token temporarily
let resetToken = null;

function openForgotPasscodeModal() {
    closePasscodeModal(); // Close the main passcode modal
    
    const modal = document.getElementById('forgotPasscodeModal');
    if (modal) {
        // Reset to step 1
        document.getElementById('forgotStep1').style.display = 'block';
        document.getElementById('forgotStep2').style.display = 'none';
        document.getElementById('forgotStep3').style.display = 'none';
        document.getElementById('forgotFooter1').style.display = 'flex';
        document.getElementById('forgotFooter2').style.display = 'none';
        document.getElementById('forgotFooter3').style.display = 'none';
        
        // Clear inputs
        document.getElementById('resetMemoryId').value = MEMORY_ID || '';
        document.getElementById('resetEmail').value = '';
        document.getElementById('verificationCode').value = '';
        document.getElementById('newPasscode').value = '';
        document.getElementById('confirmNewPasscode').value = '';
        
        // Clear errors
        document.getElementById('forgotStep1Error').style.display = 'none';
        document.getElementById('forgotStep2Error').style.display = 'none';
        
        // Show modal
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    }
}

function closeForgotPasscodeModal() {
    const modal = document.getElementById('forgotPasscodeModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
            resetToken = null;
        }, 300);
    }
}

function backToStep1() {
    document.getElementById('forgotStep1').style.display = 'block';
    document.getElementById('forgotStep2').style.display = 'none';
    document.getElementById('forgotFooter1').style.display = 'flex';
    document.getElementById('forgotFooter2').style.display = 'none';
    document.getElementById('forgotStep2Error').style.display = 'none';
}

async function sendResetCode() {
    const memoryId = document.getElementById('resetMemoryId').value.trim().toUpperCase();
    const email = document.getElementById('resetEmail').value.trim();
    const errorDiv = document.getElementById('forgotStep1Error');
    
    // Validation
    if (!memoryId) {
        errorDiv.textContent = '❌ Please enter your Memory ID';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (!email) {
        errorDiv.textContent = '❌ Please enter your email address';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (!email.includes('@')) {
        errorDiv.textContent = '❌ Please enter a valid email address';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        errorDiv.style.display = 'none';
        
        // Show loading
        showNotification('📧 Sending verification code...', 'info');
        
        // Send request to backend
        const response = await fetch(`${API_BASE_URL}/api/memory/request-reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memoryId, email })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            // Store token for later verification
            resetToken = result.token;
            
            showNotification('✅ Verification code sent to your email!', 'success');
            
            // Move to step 2
            document.getElementById('forgotStep1').style.display = 'none';
            document.getElementById('forgotStep2').style.display = 'block';
            document.getElementById('forgotFooter1').style.display = 'none';
            document.getElementById('forgotFooter2').style.display = 'flex';
            
            // Focus on verification code input
            setTimeout(() => document.getElementById('verificationCode').focus(), 100);
        } else {
            errorDiv.textContent = `❌ ${result.message || 'Failed to send verification code'}`;
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Error sending reset code:', error);
        errorDiv.textContent = '❌ Network error. Please check if the server is running.';
        errorDiv.style.display = 'block';
    }
}

async function resetPasscode() {
    const code = document.getElementById('verificationCode').value.trim();
    const newPasscode = document.getElementById('newPasscode').value.trim();
    const confirmPasscode = document.getElementById('confirmNewPasscode').value.trim();
    const memoryId = document.getElementById('resetMemoryId').value.trim().toUpperCase();
    const errorDiv = document.getElementById('forgotStep2Error');
    
    // Validation
    if (!code) {
        errorDiv.textContent = '❌ Please enter the verification code';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
        errorDiv.textContent = '❌ Verification code must be 6 digits';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (!newPasscode) {
        errorDiv.textContent = '❌ Please enter a new passcode';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (newPasscode.length !== 6 || !/^\d{6}$/.test(newPasscode)) {
        errorDiv.textContent = '❌ Passcode must be 6 digits';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (newPasscode !== confirmPasscode) {
        errorDiv.textContent = '❌ Passcodes do not match';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        errorDiv.style.display = 'none';
        
        // Show loading
        showNotification('🔄 Resetting passcode...', 'info');
        
        // Send request to backend
        const response = await fetch(`${API_BASE_URL}/api/memory/reset-passcode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                memoryId,
                code,
                newPasscode,
                token: resetToken
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showNotification('✅ Passcode reset successfully!', 'success');
            
            // Update stored passcode hash
            STORED_PASSCODE_HASH = result.passcodeHash;
            
            // Move to success step
            document.getElementById('forgotStep2').style.display = 'none';
            document.getElementById('forgotStep3').style.display = 'block';
            document.getElementById('forgotFooter2').style.display = 'none';
            document.getElementById('forgotFooter3').style.display = 'flex';
        } else {
            errorDiv.textContent = `❌ ${result.message || 'Failed to reset passcode'}`;
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Error resetting passcode:', error);
        errorDiv.textContent = '❌ Network error. Please check if the server is running.';
        errorDiv.style.display = 'block';
    }
}

// Make forgot passcode functions globally available
window.openForgotPasscodeModal = openForgotPasscodeModal;
window.closeForgotPasscodeModal = closeForgotPasscodeModal;
window.backToStep1 = backToStep1;
window.sendResetCode = sendResetCode;
window.resetPasscode = resetPasscode;

// ========================================
// LETTER EDIT MODAL FUNCTIONS
// ========================================

// Load letter content from localStorage
function loadLetterContent() {
    const savedTitle = localStorage.getItem('memorychain-letter-title');
    const savedPara1 = localStorage.getItem('memorychain-letter-para1');
    const savedPara2 = localStorage.getItem('memorychain-letter-para2');
    const savedPara3 = localStorage.getItem('memorychain-letter-para3');
    
    const letterTitle = document.querySelector('.zoom-letter h2');
    const paragraphs = document.querySelectorAll('.zoom-letter p');
    
    if (savedTitle && letterTitle) {
        letterTitle.textContent = savedTitle;
    }
    if (savedPara1 && paragraphs[0]) {
        paragraphs[0].textContent = savedPara1;
    }
    if (savedPara2 && paragraphs[1]) {
        paragraphs[1].textContent = savedPara2;
    }
    if (savedPara3 && paragraphs[2]) {
        paragraphs[2].textContent = savedPara3;
    }
}

// Open letter edit modal
function openLetterEditModal() {
    const modal = document.getElementById('letterEditModal');
    const letterTitle = document.querySelector('.zoom-letter h2');
    const paragraphs = document.querySelectorAll('.zoom-letter p');
    
    // Populate modal with current content
    document.getElementById('letterTitle').value = letterTitle ? letterTitle.textContent : 'Welcome to SmartLocket';
    document.getElementById('letterPara1').value = paragraphs[0] ? paragraphs[0].textContent.trim() : '';
    document.getElementById('letterPara2').value = paragraphs[1] ? paragraphs[1].textContent.trim() : '';
    document.getElementById('letterPara3').value = paragraphs[2] ? paragraphs[2].textContent.trim() : '';
    
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// Close letter edit modal
function closeLetterEditModal() {
    const modal = document.getElementById('letterEditModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Save letter content
function saveLetterContent() {
    const title = document.getElementById('letterTitle').value;
    const para1 = document.getElementById('letterPara1').value;
    const para2 = document.getElementById('letterPara2').value;
    const para3 = document.getElementById('letterPara3').value;
    
    // Save to localStorage
    localStorage.setItem('memorychain-letter-title', title);
    localStorage.setItem('memorychain-letter-para1', para1);
    localStorage.setItem('memorychain-letter-para2', para2);
    localStorage.setItem('memorychain-letter-para3', para3);
    
    // Update the actual letter content
    const letterTitle = document.querySelector('.zoom-letter h2');
    const paragraphs = document.querySelectorAll('.zoom-letter p');
    
    if (letterTitle) {
        letterTitle.textContent = title;
    }
    if (paragraphs[0]) {
        paragraphs[0].textContent = para1;
    }
    if (paragraphs[1]) {
        paragraphs[1].textContent = para2;
    }
    if (paragraphs[2]) {
        paragraphs[2].textContent = para3;
    }
    
    // Show success message
    alert('✓ Letter content saved successfully!');
    
    // Close modal
    closeLetterEditModal();
}

// Initialize welcome letter checkbox
document.addEventListener('DOMContentLoaded', function() {
    const checkbox = document.getElementById('showWelcomeLetterCheckbox');
    
    // Load saved preference
    const showWelcomeLetter = localStorage.getItem('memorychain-show-welcome-letter');
    if (checkbox) {
        checkbox.checked = showWelcomeLetter !== 'false';
        
        // Save preference when changed
        checkbox.addEventListener('change', function() {
            localStorage.setItem('memorychain-show-welcome-letter', this.checked.toString());
            
            // Show message to user
            if (this.checked) {
                alert('✓ Welcome letter animation will be shown on next page load');
            } else {
                alert('✓ Welcome letter animation will be skipped on next page load');
            }
        });
    }
});

// Make functions globally available
window.openLetterEditModal = openLetterEditModal;
window.closeLetterEditModal = closeLetterEditModal;
window.saveLetterContent = saveLetterContent;

function updateEditControls() {
    updateImageCounter();
    updateUploadZone();
}

function updateImageCounter() {
    const counter = document.getElementById('imageCount');
    const maxCounter = document.getElementById('maxImageCount');
    
    if (counter) {
        counter.textContent = memories.length;
    }
    
    // Update the max count display based on premium status
    if (maxCounter) {
        const maxCount = IS_PREMIUM ? MAX_IMAGES_PREMIUM : MAX_IMAGES_FREE;
        maxCounter.textContent = maxCount;
    }
    
    // Log for debugging
    if (counter || maxCounter) {
        console.log(`📊 Counter updated: ${memories.length}/${IS_PREMIUM ? MAX_IMAGES_PREMIUM : MAX_IMAGES_FREE} images (Premium: ${IS_PREMIUM})`);
    }
}

function updateUploadZone() {
    const uploadZone = document.querySelector('.upload-zone');
    const h4 = uploadZone.querySelector('h4');
    const input = document.getElementById('imageUploadInput');
    
    if (memories.length >= MAX_IMAGES) {
        uploadZone.style.opacity = '0.5';
        uploadZone.style.cursor = 'not-allowed';
        h4.textContent = `Maximum ${MAX_IMAGES} images reached`;
        input.disabled = true;
    } else {
        uploadZone.style.opacity = '1';
        uploadZone.style.cursor = 'pointer';
        h4.textContent = 'Drop images here or click to upload';
        input.disabled = false;
    }
}

// Add a flag to prevent multiple file dialog opens
let isFileDialogOpen = false;

function setupImageUpload() {
    const uploadZone = document.querySelector('.upload-zone');
    const fileInput = document.getElementById('imageUploadInput');
    
    if (!uploadZone || !fileInput) {
        console.error('❌ Upload zone or file input not found');
        return;
    }
    
    console.log('🔧 Setting up image upload...');
    
    // Remove existing event listeners to prevent duplicates
    const newUploadZone = uploadZone.cloneNode(true);
    uploadZone.parentNode.replaceChild(newUploadZone, uploadZone);
    
    const newFileInput = fileInput.cloneNode(true);
    fileInput.parentNode.replaceChild(newFileInput, fileInput);
    
    // Add event listeners to the new elements
    newUploadZone.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log(`🎯 Upload zone clicked, dialog open: ${isFileDialogOpen}, memories: ${memories.length}/${MAX_IMAGES}`);
        
        if (isFileDialogOpen) {
            console.log('⚠️ File dialog already open, ignoring click');
            return;
        }
        
        if (memories.length >= MAX_IMAGES) {
            showNotification('❌ Maximum images reached!', 'error');
            return;
        }
        
        isFileDialogOpen = true;
        console.log('📂 Opening file dialog...');
        newFileInput.click();
        
        // Reset flag after a short delay
        setTimeout(() => {
            isFileDialogOpen = false;
            console.log('🔓 File dialog flag reset');
        }, 500);
    });
    
    // File input change - only trigger once
    newFileInput.addEventListener('change', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('📁 File input changed, files:', e.target.files?.length || 0);
        
        if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files);
            // Clear the input to allow selecting the same file again if needed
            e.target.value = '';
        }
        
        // Reset the dialog flag
        isFileDialogOpen = false;
    });
    
    // Also reset flag if user cancels file dialog
    newFileInput.addEventListener('cancel', () => {
        console.log('❌ File dialog cancelled');
        isFileDialogOpen = false;
    });
    
    // Handle focus events (when file dialog closes)
    window.addEventListener('focus', () => {
        setTimeout(() => {
            isFileDialogOpen = false;
        }, 100);
    });
    
    // Drag and drop
    newUploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (memories.length < MAX_IMAGES) {
            newUploadZone.classList.add('dragover');
        }
    });
    
    newUploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        newUploadZone.classList.remove('dragover');
    });
    
    newUploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        newUploadZone.classList.remove('dragover');
        
        console.log('📁 Files dropped:', e.dataTransfer.files?.length || 0);
        
        if (memories.length < MAX_IMAGES) {
            handleFileUpload(e.dataTransfer.files);
        } else {
            showNotification('❌ Maximum images reached!', 'error');
        }
    });
    
    console.log('✅ Image upload setup complete');
}

// Compress image to reduce size for Firebase
function compressImage(base64Data, maxSizeKB = 70) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Calculate new dimensions (max 800px on longest side for maximum compression)
            const maxDimension = 800;
            if (width > height && width > maxDimension) {
                height = (height * maxDimension) / width;
                width = maxDimension;
            } else if (height > maxDimension) {
                width = (width * maxDimension) / height;
                height = maxDimension;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Start with lower quality for maximum compression
            let quality = 0.6;
            let compressedData = canvas.toDataURL('image/jpeg', quality);
            
            // Reduce quality until size is acceptable
            while (compressedData.length > maxSizeKB * 1024 && quality > 0.1) {
                quality -= 0.05;
                compressedData = canvas.toDataURL('image/jpeg', quality);
            }
            
            const originalSizeKB = (base64Data.length / 1024).toFixed(2);
            const compressedSizeKB = (compressedData.length / 1024).toFixed(2);
            console.log(`📦 Compressed: ${originalSizeKB}KB → ${compressedSizeKB}KB (${quality.toFixed(2)} quality)`);
            
            resolve(compressedData);
        };
        img.src = base64Data;
    });
}

function handleFileUpload(files) {
    if (!files || files.length === 0) return;
    
    const remainingSlots = MAX_IMAGES - memories.length;
    const filesToProcess = Math.min(files.length, remainingSlots);
    
    if (filesToProcess === 0) {
        showNotification('❌ Maximum images reached!', 'error');
        return;
    }
    
    console.log(`📸 Processing ${filesToProcess} files...`);
    showNotification(`📤 Uploading ${filesToProcess} image${filesToProcess > 1 ? 's' : ''}...`, 'info');
    
    let processedCount = 0;
    
    // Process each file - upload to Firebase Storage
    for (let i = 0; i < filesToProcess; i++) {
        const file = files[i];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            
            reader.onload = async function(e) {
                const imageData = e.target.result;
                
                try {
                    // Upload image to Firebase Storage
                    console.log(`� Uploading ${file.name} to Firebase Storage...`);
                    
                    const response = await fetch(`${API_BASE_URL}/api/upload-image`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            memoryId: MEMORY_ID || 'demo',
                            imageData: imageData,
                            fileName: file.name
                        })
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Failed to upload image');
                    }
                    
                    const result = await response.json();
                    const imageUrl = result.url;
                    
                    console.log(`✅ Image uploaded to Storage: ${imageUrl}`);
                    
                    // Create new memory object with URL instead of base64
                    const newMemory = {
                        id: memories.length,
                        title: `Memory #${memories.length + 1}`,
                        description: 'Add a description for this memory...',
                        fullImage: imageUrl,  // Store URL, not base64
                        thumbnail: imageUrl,  // Store URL, not base64
                        fileName: result.fileName, // Store for deletion
                        date: new Date().toISOString().split('T')[0],
                        location: '',
                        tags: '',
                        isFavorite: false
                    };
                    
                    memories.push(newMemory);
                    processedCount++;
                    
                    console.log(`✅ Processed ${processedCount}/${filesToProcess}: ${file.name}`);
                    
                    // When all files are processed
                    if (processedCount === filesToProcess) {
                        // Rebuild gallery
                        if (mainSwiper) {
                            mainSwiper.destroy(true, true);
                        }
                        initializeSwiper();
                        
                        // Update UI
                        updateEditControls();
                        populateImageGrid();
                        
                        showNotification(`✅ ${filesToProcess} image${filesToProcess > 1 ? 's' : ''} uploaded successfully!`, 'success');
                    }
                } catch (error) {
                    console.error('❌ Error uploading to Firebase Storage:', error);
                    showNotification(`❌ Failed to upload ${file.name}: ${error.message}`, 'error');
                    processedCount++;
                }
            };
            
            reader.onerror = function() {
                console.error('❌ Error reading file:', file.name);
                showNotification('❌ Error reading image file', 'error');
                processedCount++;
            };
            
            reader.readAsDataURL(file);
        } else {
            console.log(`⚠️ Skipping non-image file:`, file?.name);
        }
    }
    
    if (filesToProcess < files.length) {
        showNotification(`⚠️ Only ${filesToProcess} images were added. Maximum ${MAX_IMAGES} images allowed.`, 'warning');
    }
}

function populateImageGrid() {
    const imageGrid = document.getElementById('imageGrid');
    if (!imageGrid) {
        console.error('❌ Image grid not found');
        return;
    }
    
    console.log(`🖼️ Populating image grid with ${memories.length} images`);
    
    // Clear existing grid completely
    imageGrid.innerHTML = '';
    
    // Create fresh elements for each memory
    memories.forEach((memory, index) => {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        imageItem.dataset.index = index; // Add data attribute for reference
        
        if (index === currentActiveSlide) {
            imageItem.classList.add('current');
        }
        
        // Add favorite class if it's a favorite
        if (memory.isFavorite) {
            imageItem.classList.add('favorite');
        }
        
        // Create inner HTML with favorite button for premium users
        const favoriteButton = IS_PREMIUM 
            ? `<button class="favorite-btn" type="button" title="${memory.isFavorite ? 'Remove from favorites' : 'Add to favorites'}">${memory.isFavorite ? '⭐' : '☆'}</button>`
            : '';
        
        imageItem.innerHTML = `
            <img src="${getImageUrl(memory.thumbnail || memory.fullImage)}" alt="${memory.title}" draggable="false">
            ${favoriteButton}
            <button class="edit-icon" type="button" title="Edit details">✎</button>
            <button class="delete-btn" type="button" title="Delete image">×</button>
        `;
        
        // Get elements for event listeners
        const favoriteBtn = imageItem.querySelector('.favorite-btn');
        const editBtn = imageItem.querySelector('.edit-icon');
        const deleteBtn = imageItem.querySelector('.delete-btn');
        const img = imageItem.querySelector('img');
        
        // Add favorite button handler for premium users
        if (favoriteBtn && IS_PREMIUM) {
            favoriteBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log(`⭐ Favorite button clicked for index ${index}`);
                toggleFavorite(index);
            }, { once: false });
        }
        
        // Add single event listeners with proper event handling
        if (editBtn) {
            editBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log(`✏️ Edit button clicked for index ${index}`);
                openImageEditModal(index);
            }, { once: false }); // Allow multiple clicks but prevent bubbling
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log(`🗑️ Delete button clicked for index ${index}`);
                deleteImage(index);
            }, { once: false });
        }
        
        if (img) {
            img.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log(`🖼️ Image clicked for index ${index}`);
                if (mainSwiper) {
                    // Find the slide with matching data-swiper-slide-index
                    const allSlides = document.querySelectorAll('.mainSwiper .swiper-slide');
                    allSlides.forEach((slide, slideIndex) => {
                        const dataIndex = parseInt(slide.getAttribute('data-swiper-slide-index'));
                        if (dataIndex === index) {
                            mainSwiper.slideTo(slideIndex);
                        }
                    });
                }
            }, { once: false });
        }
        
        imageGrid.appendChild(imageItem);
    });
    
    console.log(`✅ Image grid populated successfully`);
}

// Toggle favorite status for premium users
function toggleFavorite(index) {
    if (!IS_PREMIUM) {
        showNotification('⭐ Favorites are a premium feature', 'info');
        return;
    }
    
    const memory = memories[index];
    const wasFavorite = memory.isFavorite;
    
    // Check if we're adding a favorite and already have 5
    if (!wasFavorite) {
        const favoriteCount = memories.filter(m => m.isFavorite).length;
        if (favoriteCount >= MAX_FAVORITES) {
            showNotification(`⭐ Maximum ${MAX_FAVORITES} favorites allowed`, 'warning');
            return;
        }
    }
    
    // Toggle favorite status
    memory.isFavorite = !wasFavorite;
    
    console.log(`⭐ Image ${index} favorite status: ${memory.isFavorite}`);
    
    // Update UI
    populateImageGrid();
    
    // Rebuild slideshow with new favorites
    if (mainSwiper) {
        mainSwiper.destroy(true, true);
    }
    initializeSwiper();
    
    // Show notification
    if (memory.isFavorite) {
        const favoriteCount = memories.filter(m => m.isFavorite).length;
        showNotification(`⭐ Added to favorites (${favoriteCount}/${MAX_FAVORITES})`, 'success');
    } else {
        showNotification('☆ Removed from favorites', 'info');
    }
}

async function deleteImage(index) {
    if (memories.length <= MIN_IMAGES) {
        showNotification(`❌ Minimum ${MIN_IMAGES} images required!`, 'error');
        return;
    }
    
    if (confirm('Are you sure you want to remove this image?')) {
        const memory = memories[index];
        
        // Delete from Firebase Storage if it has a fileName
        if (memory.fileName) {
            try {
                console.log(`🗑️ Deleting from Firebase Storage: ${memory.fileName}`);
                
                const response = await fetch(`${API_BASE_URL}/api/delete-image`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        fileName: memory.fileName
                    })
                });
                
                if (response.ok) {
                    console.log(`✅ Image deleted from Storage`);
                } else {
                    console.warn(`⚠️ Failed to delete from Storage (image may not exist)`);
                }
            } catch (error) {
                console.error('❌ Error deleting from Storage:', error);
                // Continue with deletion even if Storage delete fails
            }
        }
        
        // Remove from memories array
        memories.splice(index, 1);
        
        // Remove from swiper
        if (mainSwiper) {
            mainSwiper.removeSlide(index);
            mainSwiper.update();
        }
        
        // Update IDs to maintain consistency
        memories.forEach((memory, newIndex) => {
            memory.id = newIndex;
        });
        
        // Update UI once
        updateEditControls();
        populateImageGrid();
        
        showNotification('🗑️ Image removed successfully!', 'success');
    }
}

function triggerImageUpload() {
    console.log('🎯 triggerImageUpload called - this should not be used anymore');
    
    if (isFileDialogOpen) {
        console.log('⚠️ File dialog already open via triggerImageUpload, ignoring');
        return;
    }
    
    const input = document.getElementById('imageUploadInput');
    if (input && memories.length < MAX_IMAGES) {
        isFileDialogOpen = true;
        input.click();
        setTimeout(() => {
            isFileDialogOpen = false;
        }, 500);
    } else if (memories.length >= MAX_IMAGES) {
        showNotification('❌ Maximum images reached!', 'error');
    }
}

function addSlideToSwiper(memory) {
    if (!mainSwiper) return;
    
    const imageUrl = getImageUrl(memory.fullImage);
    const slideHTML = `
        <div class="swiper-slide">
            <div class="slide-content">
                <img src="${imageUrl}" 
                     alt="${memory.title}"
                     loading="lazy"
                     onerror="console.error('❌ Failed to load image:', '${imageUrl}'); this.style.display='none';">
                <div class="slide-info">
                    <h3>${memory.title}</h3>
                    <p>${memory.description}</p>
                </div>
            </div>
        </div>
    `;
    
    // Add slide only once
    mainSwiper.appendSlide(slideHTML);
    
    // Update swiper
    mainSwiper.update();
}

// Color Palette Functions
function openColorPalette() {
    console.log('🎨 Opening color palette function called!');
    const colorPalette = document.getElementById('colorPalettePanel');
    if (colorPalette) {
        console.log('✅ Color palette found, adding active class');
        colorPalette.classList.add('active');
        updateThemeButtons();
        updateColorOptions();
        
        // Add event listeners when palette opens (in case they weren't attached earlier)
        attachColorPaletteListeners();
        
        console.log('🎉 Color palette opened successfully, active class:', colorPalette.classList.contains('active'));
    } else {
        console.error('❌ Color palette panel not found');
    }
}

// Function to attach event listeners to color palette elements
function attachColorPaletteListeners() {
    console.log('🔗 Attaching color palette event listeners...');
    
    // Add click event listeners to theme buttons
    const themeButtons = document.querySelectorAll('.theme-btn');
    console.log('📱 Found theme buttons:', themeButtons.length);
    themeButtons.forEach(btn => {
        // Remove existing listener to avoid duplicates
        btn.removeEventListener('click', handleThemeClick);
        btn.addEventListener('click', handleThemeClick);
    });
    
    // Add click event listeners to color presets
    const colorPresets = document.querySelectorAll('.color-preset');
    console.log('🎨 Found color presets:', colorPresets.length);
    colorPresets.forEach(preset => {
        preset.removeEventListener('click', handleColorPresetClick);
        preset.addEventListener('click', handleColorPresetClick);
    });
    
    // Add click event listeners to background options
    const bgOptions = document.querySelectorAll('.bg-option');
    console.log('🖼️ Found background options:', bgOptions.length);
    bgOptions.forEach(option => {
        option.removeEventListener('click', handleBackgroundClick);
        option.addEventListener('click', handleBackgroundClick);
    });
}

// Event handler functions
function handleThemeClick(event) {
    console.log('🌟 Theme button clicked:', this.dataset.theme);
    switchTheme(this.dataset.theme);
}

function handleColorPresetClick(event) {
    console.log('🎨 Color preset clicked:', this.dataset.colors);
    const colors = JSON.parse(this.dataset.colors);
    applyColorPalette(colors);
    setSelectedColorPreset(colors);
}

function handleBackgroundClick(event) {
    console.log('🖼️ Background option clicked:', this.dataset.bg);
    const bgType = this.dataset.bg;
    applyBackgroundStyle(bgType);
    setSelectedBackgroundOption(bgType);
}

// Notification System
function showNotification(message, type = 'info') {
    // Remove any existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${getNotificationColor(type)};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 9999999;
        font-size: 14px;
        font-weight: 500;
        max-width: 300px;
        word-wrap: break-word;
        animation: slideInRight 0.3s ease-out;
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease-in forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, 3000);
}

function getNotificationColor(type) {
    switch (type) {
        case 'success': return '#10b981';
        case 'error': return '#ef4444';
        case 'warning': return '#f59e0b';
        default: return '#6366f1';
    }
}

// Make function globally available
window.openColorPalette = openColorPalette;
window.attachColorPaletteListeners = attachColorPaletteListeners;

function closeColorPalette() {
    console.log('🔴 Closing color palette');
    const colorPalette = document.getElementById('colorPalettePanel');
    if (colorPalette) {
        colorPalette.classList.remove('active');
        console.log('✅ Color palette closed successfully');
    }
}

// Make functions globally available
window.closeColorPalette = closeColorPalette;

function updateThemeButtons() {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.theme === currentTheme) {
            btn.classList.add('active');
        }
    });
}

function updateColorOptions() {
    const lightColors = document.querySelectorAll('.color-preset[data-theme="light"]');
    const darkColors = document.querySelectorAll('.color-preset.dark-mode-color');
    
    if (currentTheme === 'dark') {
        lightColors.forEach(preset => preset.style.display = 'none');
        darkColors.forEach(preset => preset.style.display = 'block');
    } else {
        lightColors.forEach(preset => preset.style.display = 'block');
        darkColors.forEach(preset => preset.style.display = 'none');
    }
}

function switchTheme(theme) {
    currentTheme = theme;
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    
    updateThemeButtons();
    updateColorOptions();
    
    // Save theme preference
    localStorage.setItem('memorychain-theme', theme);
}

function applyColorPalette(colors, silent = false) {
    const root = document.documentElement;
    
    // Determine color theme name from the colors array
    const colorThemeMap = {
        '["#2563eb","#1e40af","#3b82f6"]': 'blue',
        '["#3b82f6","#2563eb","#1d4ed8"]': 'blue',
        '["#7c3aed","#5b21b6","#8b5cf6"]': 'purple', 
        '["#8b5cf6","#7c3aed","#6d28d9"]': 'purple',
        '["#059669","#047857","#10b981"]': 'green',
        '["#10b981","#059669","#047857"]': 'green',
        '["#dc2626","#b91c1c","#ef4444"]': 'red',
        '["#ef4444","#dc2626","#b91c1c"]': 'red',
        '["#d97706","#b45309","#f59e0b"]': 'orange',
        '["#f59e0b","#d97706","#b45309"]': 'orange',
        '["#0891b2","#0e7490","#06b6d4"]': 'cyan',
        '["#06b6d4","#0891b2","#0e7490"]': 'cyan',
        '["#ec4899","#be185d","#f472b6"]': 'pink',
        '["#f472b6","#ec4899","#be185d"]': 'pink',
        '["#6366f1","#4f46e5","#818cf8"]': 'indigo',
        '["#818cf8","#6366f1","#4f46e5"]': 'indigo',
        '["#374151","#111827","#6b7280"]': 'white',
        '["#d1d5db","#f3f4f6","#9ca3af"]': 'white',
        '["#000000","#1f2937","#374151"]': 'black',
        '["#ffffff","#f1f5f9","#e2e8f0"]': 'black'
    };
    
    const colorKey = JSON.stringify(colors);
    const themeName = colorThemeMap[colorKey] || 'blue';
    
    // Apply the color theme to the root element
    root.setAttribute('data-color-theme', themeName);
    
    // Save to localStorage for persistence
    localStorage.setItem('memorychain-colors', JSON.stringify(colors));
    localStorage.setItem('memorychain-color-theme', themeName);
    
    // Only show notification if not silent
    if (!silent) {
        showNotification(`${themeName.charAt(0).toUpperCase() + themeName.slice(1)} theme applied!`);
    }
}

// Set selected color preset based on colors
function setSelectedColorPreset(colors) {
    document.querySelectorAll('.color-preset').forEach(preset => {
        const presetColors = JSON.parse(preset.dataset.colors);
        if (JSON.stringify(presetColors) === JSON.stringify(colors)) {
            preset.classList.add('selected');
        } else {
            preset.classList.remove('selected');
        }
    });
}

// Background Style Functions
function applyBackgroundStyle(bgType, silent = false) {
    const body = document.body;
    
    // Remove all existing background classes
    body.classList.remove('bg-solid', 'bg-gradient', 'bg-pattern-dots', 'bg-pattern-hearts', 'bg-pattern-stars', 'bg-pattern-diamonds', 'bg-animated');
    
    // Apply new background class
    body.classList.add(`bg-${bgType}`);
    
    // Update global variable
    currentBackgroundStyle = bgType;
    
    // Store preference
    localStorage.setItem('memorychain-background', bgType);
    
    // Update floating shapes based on selection
    updateFloatingShapes(bgType);
    
    console.log(`Applied background: ${bgType}`);
    
    // Only show notification if not silent
    if (!silent) {
        showNotification(`${bgType.charAt(0).toUpperCase() + bgType.slice(1)} background applied!`);
    }
}

function setSelectedBackgroundOption(bgType) {
    document.querySelectorAll('.bg-option').forEach(option => {
        if (option.dataset.bg === bgType) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
}

// Apply theme settings loaded from backend
function applyLoadedThemeSettings(settings) {
    if (!settings) {
        console.log('⚠️ No theme settings to apply');
        return;
    }
    
    console.log('🎨 Applying loaded theme settings:', settings);
    
    try {
        // Apply theme (light/dark) - don't show notification
        if (settings.theme) {
            currentTheme = settings.theme;
            const root = document.documentElement;
            root.setAttribute('data-theme', settings.theme);
            updateThemeButtons();
            updateColorOptions();
            localStorage.setItem('memorychain-theme', settings.theme);
            console.log(`✅ Applied theme: ${settings.theme}`);
        }
        
        // Apply background style - don't show notification
        if (settings.backgroundStyle) {
            currentBackgroundStyle = settings.backgroundStyle;
            const body = document.body;
            body.classList.remove('bg-solid', 'bg-gradient', 'bg-pattern-dots', 'bg-pattern-hearts', 'bg-pattern-stars', 'bg-pattern-diamonds', 'bg-animated');
            body.classList.add(`bg-${settings.backgroundStyle}`);
            localStorage.setItem('memorychain-background', settings.backgroundStyle);
            updateFloatingShapes(settings.backgroundStyle);
            setSelectedBackgroundOption(settings.backgroundStyle);
            console.log(`✅ Applied background: ${settings.backgroundStyle}`);
        }
        
        // Apply color theme
        if (settings.colorTheme) {
            document.documentElement.setAttribute('data-color-theme', settings.colorTheme);
            localStorage.setItem('memorychain-color-theme', settings.colorTheme);
            console.log(`✅ Applied color theme: ${settings.colorTheme}`);
        }
        
        // Apply welcome letter setting
        if (settings.showWelcomeLetter !== undefined) {
            localStorage.setItem('memorychain-show-welcome-letter', 
                settings.showWelcomeLetter ? 'true' : 'false');
            console.log(`✅ Applied welcome letter setting: ${settings.showWelcomeLetter}`);
        }
        
        console.log('✨ All theme settings applied successfully!');
    } catch (error) {
        console.error('❌ Error applying theme settings:', error);
    }
}

function updateFloatingShapes(bgType) {
    // Clear existing floating shapes
    const existingContainer = document.querySelector('.floating-shapes-container');
    if (existingContainer) {
        existingContainer.remove();
    }
    
    // Create new floating shapes based on pattern type
    if (bgType.startsWith('pattern-') || bgType === 'animated') {
        createFloatingShapes(bgType);
    }
}

// Create floating shapes for different patterns
function createFloatingShapes(bgType) {
    console.log('🎨 Creating floating shapes for:', bgType);
    
    // Remove any existing floating shapes container
    const existingContainer = document.querySelector('.floating-shapes-container');
    if (existingContainer) {
        existingContainer.remove();
    }
    
    // Create container for floating shapes
    const container = document.createElement('div');
    container.className = 'floating-shapes-container';
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: -1;
        overflow: hidden;
    `;
    
    // Determine shape type and count
    let shapeType = 'dot';
    let shapeCount = 80;
    
    if (bgType === 'pattern-hearts') {
        shapeType = 'heart';
        shapeCount = 60;
    } else if (bgType === 'pattern-stars') {
        shapeType = 'star';
        shapeCount = 70;
    } else if (bgType === 'pattern-diamonds') {
        shapeType = 'diamond';
        shapeCount = 65;
    } else if (bgType === 'pattern-dots') {
        shapeType = 'dot';
        shapeCount = 90;
    } else if (bgType === 'animated') {
        shapeType = 'mixed';
        shapeCount = 100;
    }
    
    // Create shapes
    for (let i = 0; i < shapeCount; i++) {
        const shape = createShape(shapeType === 'mixed' ? getRandomShapeType() : shapeType, i);
        container.appendChild(shape);
    }
    
    // Add container to body
    document.body.appendChild(container);
    
    console.log(`✨ Created ${shapeCount} ${shapeType} shapes`);
}

// Create individual shape element
function createShape(type, index) {
    const shape = document.createElement('div');
    shape.className = `floating-shape floating-${type}`;
    
    // Random positioning from different starting points
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const size = Math.random() * 20 + 15; // 15-35px (slightly larger)
    const duration = Math.random() * 15 + 10; // 10-25s
    const delay = Math.random() * 5; // 0-5s
    
    // Choose random animation direction
    const animations = [
        'floatFromTop',
        'floatFromBottom', 
        'floatFromLeft',
        'floatFromRight',
        'floatDiagonal1',
        'floatDiagonal2',
        'floatCircular',
        'continuousFloat'
    ];
    const randomAnimation = animations[Math.floor(Math.random() * animations.length)];
    
    shape.style.cssText = `
        position: absolute;
        left: ${x}%;
        top: ${y}%;
        width: ${size}px;
        height: ${size}px;
        opacity: ${Math.random() * 0.4 + 0.2};
        animation: ${randomAnimation} ${duration}s ${delay}s infinite linear;
        pointer-events: none;
        z-index: -1;
    `;
    
    // Set shape appearance based on type
    switch (type) {
        case 'heart':
            shape.innerHTML = '❤️';
            shape.style.fontSize = `${size * 0.8}px`;
            shape.style.filter = 'hue-rotate(0deg)';
            break;
        case 'star':
            shape.innerHTML = '⭐';
            shape.style.fontSize = `${size * 0.8}px`;
            shape.style.filter = 'hue-rotate(45deg)';
            break;
        case 'diamond':
            shape.innerHTML = '💎';
            shape.style.fontSize = `${size * 0.8}px`;
            shape.style.filter = 'hue-rotate(180deg)';
            break;
        case 'dot':
        default:
            shape.style.background = `hsl(${Math.random() * 360}, 70%, 60%)`;
            shape.style.borderRadius = '50%';
            shape.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
            break;
    }
    
    return shape;
}

// Get random shape type for mixed animation
function getRandomShapeType() {
    const types = ['heart', 'star', 'diamond', 'dot'];
    return types[Math.floor(Math.random() * types.length)];
}

// Initialize color palette event listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing...');
    
    // Load saved theme and colors
    const savedTheme = localStorage.getItem('memorychain-theme') || 'light';
    const savedColors = localStorage.getItem('memorychain-colors');
    
    switchTheme(savedTheme);
    
    if (savedColors) {
        const colors = JSON.parse(savedColors);
        applyColorPalette(colors, true); // Silent mode - no notification on load
        setSelectedColorPreset(colors);
    }
    
    // Load saved background style
    const savedBackground = localStorage.getItem('memorychain-background') || 'gradient';
    applyBackgroundStyle(savedBackground, true); // Silent mode - no notification on load
    setSelectedBackgroundOption(savedBackground);
    
    // Try to attach listeners immediately, and also when palette opens
    setTimeout(() => {
        console.log('⏰ Delayed listener attachment...');
        attachColorPaletteListeners();
    }, 1000);
    
    console.log('✅ Initialization complete');
    
    // Initialize Spotify player
    loadSavedSpotifyTrack();
    setupSpotifyUrlValidation();
    
    // Add click handler for Spotify button
    const spotifyPlayBtn = document.getElementById('spotifyPlayBtn');
    if (spotifyPlayBtn) {
        spotifyPlayBtn.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent island toggle
            openSpotifyModal();
        });
    }
    
    // Close edit overlay when clicking outside
    document.getElementById('editOverlay').addEventListener('click', function(e) {
        if (e.target === this) {
            exitEditMode();
        }
    });
    
    // Close color palette when clicking outside
    document.addEventListener('click', function(e) {
        const colorPalette = document.getElementById('colorPalettePanel');
        const editBtn = document.querySelector('.edit-btn');
        const colorBtn = document.querySelector('[onclick="openColorPalette()"]');
        
        if (colorPalette.classList.contains('active') &&
            !colorPalette.contains(e.target) && 
            !editBtn.contains(e.target) && 
            colorBtn && !colorBtn.contains(e.target)) {
            closeColorPalette();
        }
    });
    
    updateImageCounter();
    
    // Load saved gallery title
    const savedTitle = localStorage.getItem('memorychain-gallery-title');
    if (savedTitle) {
        document.getElementById('galleryTitle').textContent = savedTitle;
    }
});

// Editable Header Functions for Edit Mode
function enableHeaderEditing() {
    const title = document.getElementById('galleryTitle');
    title.style.cursor = 'pointer';
    title.setAttribute('title', 'Click to edit gallery title');
    title.addEventListener('click', makeHeaderEditable);
}

function disableHeaderEditing() {
    const title = document.getElementById('galleryTitle');
    title.style.cursor = 'default';
    title.removeAttribute('title');
    title.removeEventListener('click', makeHeaderEditable);
    // If currently editing, finish editing
    if (title.contentEditable === 'true') {
        saveHeaderTitle();
    }
}

function makeHeaderEditable() {
    const title = document.getElementById('galleryTitle');
    const currentText = title.textContent;
    
    title.contentEditable = true;
    title.focus();
    
    // Select all text
    const range = document.createRange();
    range.selectNodeContents(title);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    
    // Handle Enter key to save
    const handleKeydown = function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveHeaderTitle();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            title.textContent = currentText;
            title.contentEditable = false;
            title.blur();
            title.removeEventListener('keydown', handleKeydown);
            title.removeEventListener('blur', handleBlur);
        }
    };
    
    // Handle blur to save
    const handleBlur = function() {
        saveHeaderTitle();
        title.removeEventListener('keydown', handleKeydown);
        title.removeEventListener('blur', handleBlur);
    };
    
    title.addEventListener('keydown', handleKeydown);
    title.addEventListener('blur', handleBlur);
}

function saveHeaderTitle() {
    const title = document.getElementById('galleryTitle');
    let newTitle = title.textContent.trim();
    
    // Prevent empty title
    if (!newTitle) {
        newTitle = 'SmartLocket Gallery';
    }
    
    // Limit title length
    if (newTitle.length > 50) {
        newTitle = newTitle.substring(0, 50);
    }
    
    title.textContent = newTitle;
    title.contentEditable = false;
    
    // Save to localStorage
    localStorage.setItem('memorychain-gallery-title', newTitle);
    
    // Show notification
    showNotification('Gallery title updated!', 'success');
}

// Image Edit Modal Functions
function openImageEditModal(index) {
    console.log(`🔍 openImageEditModal called with index: ${index}, memories.length: ${memories.length}`);
    
    if (index < 0 || index >= memories.length) {
        console.error(`❌ Invalid index: ${index}, memories.length: ${memories.length}`);
        return;
    }
    
    currentEditingImageIndex = index;
    const memory = memories[index];
    const modal = document.getElementById('imageEditModal');
    
    console.log('📝 Memory to edit:', memory);
    console.log('🎨 Modal element:', modal);
    
    if (!modal) {
        console.error('❌ Image edit modal not found in DOM');
        return;
    }
    
    // Populate modal with current memory data
    const titleInput = document.getElementById('imageTitle');
    const descInput = document.getElementById('imageDescription');
    const dateInput = document.getElementById('imageDate');
    const locationInput = document.getElementById('imageLocation');
    const tagsInput = document.getElementById('imageTags');
    const previewImage = document.getElementById('modalPreviewImage');
    
    console.log('📋 Modal inputs:', { titleInput, descInput, dateInput, locationInput, tagsInput, previewImage });
    
    if (titleInput) titleInput.value = memory.title || '';
    if (descInput) descInput.value = memory.description || '';
    if (dateInput) dateInput.value = memory.date || '';
    if (locationInput) locationInput.value = memory.location || '';
    if (tagsInput) tagsInput.value = memory.tags || '';
    if (previewImage) previewImage.src = memory.fullImage || '';
    
    // Show modal
    modal.style.display = 'block';
    modal.classList.add('active');
    
    console.log('✅ Modal should now be visible with display:', modal.style.display, 'and class:', modal.className);
}

function closeImageEditModal() {
    const modal = document.getElementById('imageEditModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    currentEditingImageIndex = null;
}

function saveImageDetails() {
    if (currentEditingImageIndex === null || currentEditingImageIndex < 0 || currentEditingImageIndex >= memories.length) {
        showNotification('❌ No image selected for editing', 'error');
        return;
    }
    
    const memory = memories[currentEditingImageIndex];
    
    // Get form values
    const titleInput = document.getElementById('imageTitle');
    const descInput = document.getElementById('imageDescription');
    const dateInput = document.getElementById('imageDate');
    const locationInput = document.getElementById('imageLocation');
    const tagsInput = document.getElementById('imageTags');
    
    // Update memory object
    if (titleInput) memory.title = titleInput.value.trim() || memory.title;
    if (descInput) memory.description = descInput.value.trim() || memory.description;
    if (dateInput) memory.date = dateInput.value || memory.date;
    if (locationInput) memory.location = locationInput.value.trim() || memory.location;
    if (tagsInput) memory.tags = tagsInput.value.trim() || memory.tags;
    
    // Update the swiper slide
    updateSwiperSlide(currentEditingImageIndex, {
        title: memory.title,
        description: memory.description,
        date: memory.date,
        location: memory.location,
        tags: memory.tags
    });
    
    // Update the image grid
    populateImageGrid();
    
    // Close modal
    closeImageEditModal();
    
    showNotification('✅ Memory details updated successfully!', 'success');
}

// ========================================
// SPOTIFY PLAYER FUNCTIONS
// ========================================

function convertSpotifyUrl(url) {
    // Remove query parameters and hash
    url = url.split('?')[0].split('#')[0];
    
    // Track URL patterns
    const trackPattern = /spotify\.com\/track\/([a-zA-Z0-9]+)/;
    const playlistPattern = /spotify\.com\/playlist\/([a-zA-Z0-9]+)/;
    const albumPattern = /spotify\.com\/album\/([a-zA-Z0-9]+)/;
    const artistPattern = /spotify\.com\/artist\/([a-zA-Z0-9]+)/;
    
    let match, type, id;
    
    if (match = url.match(trackPattern)) {
        type = 'track';
        id = match[1];
    } else if (match = url.match(playlistPattern)) {
        type = 'playlist';
        id = match[1];
    } else if (match = url.match(albumPattern)) {
        type = 'album';
        id = match[1];
    } else if (match = url.match(artistPattern)) {
        type = 'artist';
        id = match[1];
    } else {
        return null;
    }
    
    return {
        type: type,
        id: id,
        embedUrl: `https://open.spotify.com/embed/${type}/${id}`
    };
}

function openSpotifyModal() {
    // Check if passcode protection is enabled
    if (STORED_PASSCODE_HASH && !isEditMode) {
        console.log('🔒 Passcode required for Spotify changes');
        
        // Store the action to perform after passcode verification
        window.pendingSpotifyAction = 'open';
        openPasscodeModal();
        return;
    }
    
    const modal = document.getElementById('spotifyModal');
    const urlInput = document.getElementById('spotifyUrl');
    
    // Clear any previous input
    urlInput.value = '';
    hideSpotifyPreview();
    
    // Show modal
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('show');
        urlInput.focus();
    }, 10);
    
    // Add escape key listener
    document.addEventListener('keydown', handleSpotifyModalEscape);
}

function closeSpotifyModal(event) {
    // Don't close if clicking inside modal content
    if (event && event.target.closest('.spotify-modal-content')) {
        return;
    }
    
    const modal = document.getElementById('spotifyModal');
    modal.classList.remove('show');
    
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
    
    // Remove escape key listener
    document.removeEventListener('keydown', handleSpotifyModalEscape);
}

function handleSpotifyModalEscape(event) {
    if (event.key === 'Escape') {
        closeSpotifyModal();
    }
}

function showSpotifyPreview(embedUrl, type) {
    const previewSection = document.getElementById('previewSection');
    const previewContainer = document.getElementById('spotifyPreview');
    
    const previewHeight = type === 'track' ? '152' : '200';
    previewContainer.innerHTML = `
        <iframe 
            src="${embedUrl}" 
            width="100%" 
            height="${previewHeight}" 
            frameborder="0" 
            allowtransparency="true" 
            allow="encrypted-media"
            style="border-radius: 8px;">
        </iframe>
    `;
    
    previewSection.style.display = 'block';
}

function hideSpotifyPreview() {
    const previewSection = document.getElementById('previewSection');
    const previewContainer = document.getElementById('spotifyPreview');
    
    previewSection.style.display = 'none';
    previewContainer.innerHTML = '';
}

function loadSpotifyTrack() {
    const urlInput = document.getElementById('spotifyUrl');
    const url = urlInput.value.trim();
    
    if (!url) {
        showNotification('Please enter a Spotify URL', 'error');
        return;
    }
    
    const spotifyData = convertSpotifyUrl(url);
    
    if (!spotifyData) {
        showNotification('Invalid Spotify URL. Please check the format.', 'error');
        return;
    }
    
    // Show preview first
    showSpotifyPreview(spotifyData.embedUrl, spotifyData.type);
    
    // Save to localStorage
    localStorage.setItem('spotifyPlayer', JSON.stringify(spotifyData));
    
    // Update global variables
    currentSpotifyTrack = spotifyData;
    currentSpotifyUrl = spotifyData.embedUrl;
    
    // Update the player card
    updateSpotifyPlayerCard(spotifyData);
    
    // Save to backend immediately
    saveSpotifyToBackend(spotifyData);
    
    // Show clear button
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) clearBtn.style.display = 'inline-block';
    
    // Close modal
    closeSpotifyModal();
    
    showNotification('Spotify track loaded successfully!', 'success');
}

// Save Spotify track to backend
async function saveSpotifyToBackend(spotifyData) {
    if (!MEMORY_ID) {
        console.warn('No Memory ID. Cannot save Spotify to backend.');
        return;
    }

    try {
        console.log('🎵 Saving Spotify track to backend:', spotifyData);
        
        const response = await fetch(`${API_BASE_URL}/api/memory/${MEMORY_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                spotifyTrack: spotifyData,
                spotifyUrl: spotifyData.embedUrl // Legacy support
            })
        });

        if (!response.ok) {
            throw new Error('Failed to save Spotify track');
        }

        console.log('✅ Spotify track saved to backend');
    } catch (error) {
        console.error('❌ Error saving Spotify to backend:', error);
    }
}

// Clear Spotify track from backend
async function clearSpotifyFromBackend() {
    if (!MEMORY_ID) {
        console.warn('No Memory ID. Cannot clear Spotify from backend.');
        return;
    }

    try {
        console.log('🗑️ Clearing Spotify track from backend');
        
        const response = await fetch(`${API_BASE_URL}/api/memory/${MEMORY_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                spotifyTrack: null,
                spotifyUrl: null
            })
        });

        if (!response.ok) {
            throw new Error('Failed to clear Spotify track');
        }

        // Clear global variables
        currentSpotifyTrack = null;
        currentSpotifyUrl = null;
        
        console.log('✅ Spotify track cleared from backend');
    } catch (error) {
        console.error('❌ Error clearing Spotify from backend:', error);
    }
}

function updateSpotifyPlayerCard(data) {
    const playerCard = document.getElementById('spotifyPlayerCard');
    const spotifyInfo = document.getElementById('spotifyInfo');
    const playBtn = document.getElementById('spotifyPlayBtn');
    
    if (!playerCard || !spotifyInfo || !playBtn) return;
    
    // Update button text
    playBtn.innerHTML = '🎵 Change';
    
    // Show track info
    spotifyInfo.style.display = 'block';
    
    // Add embedded player to the card with smaller height
    const embedHeight = data.type === 'track' ? '152' : '200';
    spotifyInfo.innerHTML = `
        <iframe 
            src="${data.embedUrl}" 
            width="100%" 
            height="${embedHeight}" 
            frameborder="0" 
            allowtransparency="true" 
            allow="encrypted-media"
            loading="lazy"
            style="border-radius: 8px;">
        </iframe>
    `;
    
    // Add visual indicator
    playerCard.classList.add('has-track');
}

function clearSpotifyTrack() {
    // Check if passcode protection is enabled
    if (STORED_PASSCODE_HASH && !isEditMode) {
        console.log('🔒 Passcode required to clear Spotify track');
        
        // Store the action to perform after passcode verification
        window.pendingSpotifyAction = 'clear';
        openPasscodeModal();
        return;
    }
    
    // Remove from localStorage
    localStorage.removeItem('spotifyPlayer');
    
    // Reset player card
    const playerCard = document.getElementById('spotifyPlayerCard');
    const spotifyInfo = document.getElementById('spotifyInfo');
    const playBtn = document.getElementById('spotifyPlayBtn');
    
    if (playBtn) playBtn.innerHTML = '🎵 Add Song';
    if (spotifyInfo) {
        spotifyInfo.style.display = 'none';
        spotifyInfo.innerHTML = `
            <div class="spotify-track-info">
                <div class="track-title">No track loaded</div>
                <div class="track-artist">Tap to add music</div>
            </div>
        `;
    }
    
    if (playerCard) {
        playerCard.classList.remove('has-track');
        playerCard.classList.remove('expanded');
    }
    
    // Hide clear button
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) clearBtn.style.display = 'none';
    
    // Hide preview
    hideSpotifyPreview();
    
    // Clear from backend
    clearSpotifyFromBackend();
    
    showNotification('Spotify track cleared', 'info');
}

function loadSavedSpotifyTrack() {
    // Try loading from backend first
    if (MEMORY_ID) {
        loadGalleryData().then(data => {
            if (data && data.spotifyTrack) {
                console.log('🎵 Loading Spotify track from backend');
                updateSpotifyPlayerCard(data.spotifyTrack);
                localStorage.setItem('spotifyPlayer', JSON.stringify(data.spotifyTrack));
                return;
            }
        }).catch(error => {
            console.error('Error loading Spotify from backend:', error);
        });
    }
    
    // Fallback to localStorage
    const saved = localStorage.getItem('spotifyPlayer');
    if (saved) {
        try {
            const spotifyData = JSON.parse(saved);
            updateSpotifyPlayerCard(spotifyData);
        } catch (error) {
            console.error('Error loading saved Spotify track:', error);
            localStorage.removeItem('spotifyPlayer');
        }
    }
}

// Real-time URL validation for Spotify modal
function setupSpotifyUrlValidation() {
    const urlInput = document.getElementById('spotifyUrl');
    if (urlInput) {
        urlInput.addEventListener('input', function() {
            const url = this.value.trim();
            if (url) {
                const spotifyData = convertSpotifyUrl(url);
                if (spotifyData) {
                    showSpotifyPreview(spotifyData.embedUrl, spotifyData.type);
                } else {
                    hideSpotifyPreview();
                }
            } else {
                hideSpotifyPreview();
            }
        });
    }
}

// Make Spotify functions globally available
window.openSpotifyModal = openSpotifyModal;
window.closeSpotifyModal = closeSpotifyModal;
window.loadSpotifyTrack = loadSpotifyTrack;
window.clearSpotifyTrack = clearSpotifyTrack;

// Dynamic Island Toggle Function
function toggleSpotifyIsland() {
    const playerCard = document.getElementById('spotifyPlayerCard');
    const isExpanded = playerCard.classList.contains('expanded');
    
    if (isExpanded) {
        playerCard.classList.remove('expanded');
    } else {
        playerCard.classList.add('expanded');
    }
}

// Close Dynamic Island when clicking outside
document.addEventListener('click', function(e) {
    const playerCard = document.getElementById('spotifyPlayerCard');
    if (playerCard && !playerCard.contains(e.target)) {
        playerCard.classList.remove('expanded');
    }
});

// Prevent clicks inside the island from closing it
window.addEventListener('DOMContentLoaded', function() {
    const playerCard = document.getElementById('spotifyPlayerCard');
    if (playerCard) {
        playerCard.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
});
