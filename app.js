// SyncWatch - Collaborative Video Streaming Application with YouTube Support
class SyncWatch {
    constructor() {
        this.currentUser = null;
        this.currentRoom = null;
        this.peers = new Map();
        this.localStream = null;
        this.screenStream = null;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.syncTimeout = null;
        this.lastSyncTime = 0;
        this.isVideoMaster = false;
        this.typingTimeout = null;
        this.initialized = false;
        
        // Video player state
        this.currentPlayerType = 'html5'; // 'html5', 'youtube', 'vimeo'
        this.youtubePlayer = null;
        this.youtubeReady = false;
        this.youtubeAPIReady = false;
        this.pendingYouTubeVideoId = null;
        this.currentVideoUrl = '';
        
        // Configuration
        this.config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ],
            maxParticipants: 4,
            syncInterval: 5000,
            messageLimit: 100,
            youtube: {
                apiUrl: 'https://www.youtube.com/iframe_api',
                playerVars: {
                    autoplay: 0,
                    controls: 0,
                    disablekb: 1,
                    enablejsapi: 1,
                    fs: 1,
                    playsinline: 1,
                    rel: 0,
                    showinfo: 0,
                    modestbranding: 1
                }
            }
        };
        
        // URL patterns for different video sources
        this.urlPatterns = {
            youtube: [
                /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
                /youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)/
            ],
            vimeo: [
                /vimeo\.com\/(\d+)/,
                /player\.vimeo\.com\/video\/(\d+)/
            ],
            direct: [
                /\.(mp4|webm|ogg|mov|avi|mkv)(\?|$)/i,
                /googleapis\.com.*\.(mp4|webm)/i,
                /sample-videos\.com/i
            ]
        };
        
        // Error messages
        this.errorMessages = {
            youtube_load_failed: "Failed to load YouTube video. Please check the URL or try a different video.",
            video_not_found: "Video not found or unavailable. Please check the URL.",
            format_not_supported: "Video format not supported. Try YouTube, Vimeo, or direct video files (.mp4, .webm, etc.)",
            network_error: "Network error occurred. Please check your connection and try again.",
            sync_failed: "Synchronization failed. Attempting to reconnect...",
            youtube_api_failed: "Failed to load YouTube player. Please refresh and try again."
        };
    }
    
    init() {
        console.log('Initializing SyncWatch...');
        
        // Wait for DOM to be fully ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.bindEvents());
        } else {
            this.bindEvents();
        }
        
        this.showRoomModal();
        this.loadSampleVideo();
        this.loadYouTubeAPI();
        this.initialized = true;
        
        console.log('SyncWatch initialized successfully');
    }
    
    loadYouTubeAPI() {
        // Check if YouTube API is already loaded
        if (window.YT && window.YT.Player) {
            console.log('YouTube API already loaded');
            this.youtubeAPIReady = true;
            return;
        }
        
        // Avoid loading multiple times
        if (window.onYouTubeIframeAPIReady) {
            console.log('YouTube API already loading');
            return;
        }
        
        console.log('Loading YouTube IFrame API...');
        
        // Set global callback first
        window.onYouTubeIframeAPIReady = () => {
            console.log('YouTube IFrame API ready');
            this.youtubeAPIReady = true;
            
            // If we have a pending video ID, load it now
            if (this.pendingYouTubeVideoId) {
                this.createYouTubePlayer(this.pendingYouTubeVideoId);
                this.pendingYouTubeVideoId = null;
            }
        };
        
        // Create script tag to load YouTube API
        const script = document.createElement('script');
        script.src = this.config.youtube.apiUrl;
        script.async = true;
        script.onerror = () => {
            console.error('Failed to load YouTube API');
            this.showNotification('Failed to load YouTube API. Some features may not work.', 'warning');
        };
        
        document.head.appendChild(script);
    }
    
    detectVideoType(url) {
        console.log('Detecting video type for URL:', url);
        
        // Test YouTube patterns
        for (const pattern of this.urlPatterns.youtube) {
            const match = url.match(pattern);
            if (match) {
                console.log('Detected YouTube video:', match[1]);
                return { type: 'youtube', id: match[1] };
            }
        }
        
        // Test Vimeo patterns
        for (const pattern of this.urlPatterns.vimeo) {
            const match = url.match(pattern);
            if (match) {
                console.log('Detected Vimeo video:', match[1]);
                return { type: 'vimeo', id: match[1] };
            }
        }
        
        // Test direct video patterns
        for (const pattern of this.urlPatterns.direct) {
            if (pattern.test(url)) {
                console.log('Detected direct video');
                return { type: 'direct', url: url };
            }
        }
        
        // Default to direct if it looks like a valid URL
        try {
            const urlObj = new URL(url);
            if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
                console.log('Defaulting to direct video');
                return { type: 'direct', url: url };
            }
        } catch (e) {
            console.error('Invalid URL:', e);
        }
        
        return null;
    }
    
    createYouTubePlayer(videoId) {
        console.log('Creating YouTube player for video:', videoId);
        
        if (!this.youtubeAPIReady) {
            console.log('YouTube API not ready, queuing video:', videoId);
            this.pendingYouTubeVideoId = videoId;
            return;
        }
        
        const container = document.getElementById('youtubePlayer');
        if (!container) {
            console.error('YouTube player container not found');
            return;
        }
        
        // Clear any existing player
        container.innerHTML = '';
        
        try {
            this.youtubePlayer = new YT.Player(container, {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: this.config.youtube.playerVars,
                events: {
                    'onReady': (event) => this.onYouTubePlayerReady(event),
                    'onStateChange': (event) => this.onYouTubePlayerStateChange(event),
                    'onError': (event) => this.onYouTubePlayerError(event)
                }
            });
            
            console.log('YouTube player created successfully');
        } catch (error) {
            console.error('Error creating YouTube player:', error);
            this.showError(this.errorMessages.youtube_api_failed);
        }
    }
    
    onYouTubePlayerReady(event) {
        console.log('YouTube player ready');
        this.youtubeReady = true;
        this.hideLoadingIndicator();
        this.updateVideoSourceIndicator('YouTube');
        
        // Set initial volume
        const volumeBar = document.getElementById('volumeBar');
        if (volumeBar && this.youtubePlayer) {
            this.youtubePlayer.setVolume(volumeBar.value);
        }
        
        this.showNotification('YouTube video loaded successfully!', 'success');
        this.hideError();
    }
    
    onYouTubePlayerStateChange(event) {
        const state = event.data;
        console.log('YouTube player state changed:', state);
        
        switch (state) {
            case YT.PlayerState.PLAYING:
                this.onVideoPlay();
                if (this.isVideoMaster) {
                    this.broadcastVideoUpdate('play', { 
                        currentTime: this.youtubePlayer.getCurrentTime() 
                    });
                }
                break;
            case YT.PlayerState.PAUSED:
                this.onVideoPause();
                if (this.isVideoMaster) {
                    this.broadcastVideoUpdate('pause', { 
                        currentTime: this.youtubePlayer.getCurrentTime()
                    });
                }
                break;
            case YT.PlayerState.ENDED:
                this.onVideoEnd();
                if (this.isVideoMaster) {
                    this.broadcastVideoUpdate('end', { currentTime: 0 });
                }
                break;
            case YT.PlayerState.BUFFERING:
                this.showSyncIndicator('Buffering...');
                break;
        }
        
        // Update progress bar
        this.updateProgress();
    }
    
    onYouTubePlayerError(event) {
        console.error('YouTube player error:', event.data);
        let errorMessage = this.errorMessages.youtube_load_failed;
        
        switch (event.data) {
            case 2:
                errorMessage = 'Invalid YouTube video ID. Please check the URL.';
                break;
            case 5:
                errorMessage = 'YouTube video cannot be played in HTML5 player.';
                break;
            case 100:
                errorMessage = 'YouTube video not found or private.';
                break;
            case 101:
            case 150:
                errorMessage = 'YouTube video embedding disabled by owner.';
                break;
        }
        
        this.showError(errorMessage);
    }
    
    switchToPlayer(playerType) {
        console.log('Switching to player type:', playerType);
        
        // Hide all players
        const htmlVideo = document.getElementById('mainVideo');
        const youtubeContainer = document.getElementById('youtubePlayer');
        const vimeoPlayer = document.getElementById('vimeoPlayer');
        
        if (htmlVideo) htmlVideo.classList.add('hidden');
        if (youtubeContainer) youtubeContainer.classList.add('hidden');
        if (vimeoPlayer) vimeoPlayer.classList.add('hidden');
        
        // Show the selected player
        switch (playerType) {
            case 'html5':
                if (htmlVideo) htmlVideo.classList.remove('hidden');
                break;
            case 'youtube':
                if (youtubeContainer) youtubeContainer.classList.remove('hidden');
                break;
            case 'vimeo':
                if (vimeoPlayer) vimeoPlayer.classList.remove('hidden');
                break;
        }
        
        this.currentPlayerType = playerType;
        this.updateVideoControls();
    }
    
    getCurrentTime() {
        switch (this.currentPlayerType) {
            case 'html5':
                const video = document.getElementById('mainVideo');
                return video ? video.currentTime || 0 : 0;
            case 'youtube':
                return this.youtubePlayer && this.youtubeReady ? 
                       (this.youtubePlayer.getCurrentTime() || 0) : 0;
            case 'vimeo':
                return 0;
            default:
                return 0;
        }
    }
    
    getDuration() {
        switch (this.currentPlayerType) {
            case 'html5':
                const video = document.getElementById('mainVideo');
                return video ? video.duration || 0 : 0;
            case 'youtube':
                return this.youtubePlayer && this.youtubeReady ? 
                       (this.youtubePlayer.getDuration() || 0) : 0;
            case 'vimeo':
                return 0;
            default:
                return 0;
        }
    }
    
    isPlaying() {
        switch (this.currentPlayerType) {
            case 'html5':
                const video = document.getElementById('mainVideo');
                return video ? !video.paused : false;
            case 'youtube':
                return this.youtubePlayer && this.youtubeReady ? 
                       this.youtubePlayer.getPlayerState() === YT.PlayerState.PLAYING : false;
            case 'vimeo':
                return false;
            default:
                return false;
        }
    }
    
    play() {
        console.log('Playing video with player type:', this.currentPlayerType);
        switch (this.currentPlayerType) {
            case 'html5':
                const video = document.getElementById('mainVideo');
                if (video && video.src && !video.src.endsWith('/')) {
                    video.play().catch(err => {
                        console.error('Error playing HTML5 video:', err);
                        this.showNotification('Cannot play video', 'error');
                    });
                }
                break;
            case 'youtube':
                if (this.youtubePlayer && this.youtubeReady) {
                    this.youtubePlayer.playVideo();
                }
                break;
            case 'vimeo':
                break;
        }
    }
    
    pause() {
        console.log('Pausing video with player type:', this.currentPlayerType);
        switch (this.currentPlayerType) {
            case 'html5':
                const video = document.getElementById('mainVideo');
                if (video) video.pause();
                break;
            case 'youtube':
                if (this.youtubePlayer && this.youtubeReady) {
                    this.youtubePlayer.pauseVideo();
                }
                break;
            case 'vimeo':
                break;
        }
    }
    
    seekTo(time) {
        console.log('Seeking to time:', time, 'with player type:', this.currentPlayerType);
        switch (this.currentPlayerType) {
            case 'html5':
                const video = document.getElementById('mainVideo');
                if (video && video.duration) {
                    video.currentTime = Math.max(0, Math.min(time, video.duration));
                }
                break;
            case 'youtube':
                if (this.youtubePlayer && this.youtubeReady) {
                    this.youtubePlayer.seekTo(time, true);
                }
                break;
            case 'vimeo':
                break;
        }
    }
    
    setVolume(volume) {
        switch (this.currentPlayerType) {
            case 'html5':
                const video = document.getElementById('mainVideo');
                if (video) video.volume = Math.max(0, Math.min(volume / 100, 1));
                break;
            case 'youtube':
                if (this.youtubePlayer && this.youtubeReady) {
                    this.youtubePlayer.setVolume(Math.max(0, Math.min(volume, 100)));
                }
                break;
            case 'vimeo':
                break;
        }
    }
    
    showLoadingIndicator() {
        const indicator = document.getElementById('videoLoadingIndicator');
        if (indicator) {
            indicator.classList.remove('hidden');
        }
    }
    
    hideLoadingIndicator() {
        const indicator = document.getElementById('videoLoadingIndicator');
        if (indicator) {
            indicator.classList.add('hidden');
        }
    }
    
    updateVideoSourceIndicator(type) {
        const indicator = document.getElementById('videoSourceType');
        if (indicator) {
            indicator.textContent = type;
            indicator.className = 'status status--success';
        }
    }
    
    showError(message) {
        console.error('Showing error:', message);
        const errorEl = document.getElementById('videoError');
        const messageEl = document.getElementById('errorMessage');
        
        if (errorEl && messageEl) {
            messageEl.textContent = message;
            errorEl.classList.remove('hidden');
        }
        
        this.hideLoadingIndicator();
        this.showNotification(message, 'error');
    }
    
    hideError() {
        const errorEl = document.getElementById('videoError');
        if (errorEl) {
            errorEl.classList.add('hidden');
        }
    }
    
    bindEvents() {
        console.log('Binding events...');
        
        // Room setup events
        const joinBtn = document.getElementById('joinRoomBtn');
        const roomInput = document.getElementById('roomCodeInput');
        const usernameInput = document.getElementById('usernameInput');
        
        if (joinBtn) {
            joinBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleJoinRoom();
            });
        }
        
        if (roomInput) {
            roomInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleJoinRoom();
                }
            });
        }
        
        if (usernameInput) {
            usernameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleJoinRoom();
                }
            });
        }
        
        // Video control events
        const loadVideoBtn = document.getElementById('loadVideoBtn');
        if (loadVideoBtn) {
            loadVideoBtn.addEventListener('click', () => this.loadVideo());
        }
        
        const playPauseBtn = document.getElementById('playPauseBtn');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        }
        
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }
        
        const muteBtn = document.getElementById('muteBtn');
        if (muteBtn) {
            muteBtn.addEventListener('click', () => this.toggleMute());
        }
        
        const retryBtn = document.getElementById('retryVideoBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                this.hideError();
                this.loadVideo();
            });
        }
        
        // Progress and volume controls
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.addEventListener('input', (e) => this.seekVideo(e.target.value));
        }
        
        const volumeBar = document.getElementById('volumeBar');
        if (volumeBar) {
            volumeBar.addEventListener('input', (e) => this.setVolumeFromBar(e.target.value));
        }
        
        // Chat events
        const sendBtn = document.getElementById('sendMessageBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }
        
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.sendMessage();
                } else {
                    this.handleTyping();
                }
            });
        }
        
        const voiceBtn = document.getElementById('voiceMessageBtn');
        if (voiceBtn) {
            voiceBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.startVoiceRecording();
            });
            voiceBtn.addEventListener('mouseup', (e) => {
                e.preventDefault();
                this.stopVoiceRecording();
            });
            voiceBtn.addEventListener('mouseleave', () => this.stopVoiceRecording());
        }
        
        // Media control events
        const videoChatBtn = document.getElementById('toggleVideoChatBtn');
        if (videoChatBtn) {
            videoChatBtn.addEventListener('click', () => this.toggleVideoChat());
        }
        
        const audioBtn = document.getElementById('toggleAudioBtn');
        if (audioBtn) {
            audioBtn.addEventListener('click', () => this.toggleAudio());
        }
        
        const screenShareBtn = document.getElementById('screenShareBtn');
        if (screenShareBtn) {
            screenShareBtn.addEventListener('click', () => this.toggleScreenShare());
        }
        
        const copyBtn = document.getElementById('copyRoomBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyRoomLink());
        }
        
        // Video events for HTML5 player
        const video = document.getElementById('mainVideo');
        if (video) {
            video.addEventListener('loadedmetadata', () => {
                console.log('HTML5 video metadata loaded');
                this.updateVideoControls();
                this.hideLoadingIndicator();
                this.hideError();
            });
            video.addEventListener('timeupdate', () => this.updateProgress());
            video.addEventListener('play', () => this.onVideoPlay());
            video.addEventListener('pause', () => this.onVideoPause());
            video.addEventListener('ended', () => this.onVideoEnd());
            video.addEventListener('error', (e) => {
                console.error('HTML5 video error:', e);
                this.showError('Failed to load video. Please check the URL or try a different format.');
            });
            video.addEventListener('loadstart', () => {
                console.log('HTML5 video load started');
                this.showLoadingIndicator();
            });
            video.addEventListener('canplay', () => {
                console.log('HTML5 video can play');
                this.hideLoadingIndicator();
                this.hideError();
                this.showNotification('Video loaded successfully!', 'success');
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
        
        // Window events
        window.addEventListener('beforeunload', () => this.cleanup());
        window.addEventListener('storage', (e) => this.handleStorageChange(e));
        
        console.log('All event listeners bound successfully');
    }
    
    showRoomModal() {
        console.log('Showing room modal...');
        const modal = document.getElementById('roomModal');
        const app = document.getElementById('app');
        
        if (modal) {
            modal.classList.remove('hidden');
        }
        
        if (app) {
            app.classList.add('hidden');
        }
        
        // Focus on username input after a short delay
        setTimeout(() => {
            const usernameInput = document.getElementById('usernameInput');
            if (usernameInput) {
                usernameInput.focus();
            }
        }, 200);
    }
    
    handleJoinRoom() {
        console.log('Handling join room...');
        
        const usernameInput = document.getElementById('usernameInput');
        const roomInput = document.getElementById('roomCodeInput');
        
        if (!usernameInput || !roomInput) {
            console.error('Input elements not found');
            return;
        }
        
        const username = usernameInput.value.trim();
        const roomCode = roomInput.value.trim();
        
        if (!username) {
            this.showNotification('Please enter a username', 'error');
            usernameInput.focus();
            return;
        }
        
        if (username.length > 20) {
            this.showNotification('Username too long (max 20 characters)', 'error');
            return;
        }
        
        this.currentUser = {
            id: this.generateId(),
            username: username,
            joinedAt: Date.now()
        };
        
        if (roomCode) {
            this.joinRoom(roomCode);
        } else {
            this.createRoom();
        }
        
        // Show main app
        const modal = document.getElementById('roomModal');
        const app = document.getElementById('app');
        
        if (modal) {
            modal.classList.add('hidden');
        }
        
        if (app) {
            app.classList.remove('hidden');
        }
        
        setTimeout(() => {
            this.initializeApp();
        }, 200);
    }
    
    initializeApp() {
        console.log('Initializing main app...');
        
        this.updateUI();
        this.startSyncLoop();
        this.updateUsersDisplay();
        
        this.addSystemMessage(`Welcome to SyncWatch, ${this.currentUser.username}! You can now watch YouTube, Vimeo, and direct video files together.`);
        
        // Set initial volume
        const volumeBar = document.getElementById('volumeBar');
        if (volumeBar) {
            this.setVolumeFromBar(volumeBar.value);
        }
        
        console.log('Main app initialized successfully');
    }
    
    createRoom() {
        const roomCode = this.generateRoomCode();
        console.log('Creating room with code:', roomCode);
        
        this.currentRoom = {
            code: roomCode,
            createdAt: Date.now(),
            users: [this.currentUser],
            messages: [],
            videoState: {
                url: '',
                currentTime: 0,
                playing: false,
                lastUpdate: Date.now(),
                playerType: 'html5'
            }
        };
        
        // Set default video URL
        const video = document.getElementById('mainVideo');
        if (video && video.src && !video.src.endsWith('/')) {
            this.currentRoom.videoState.url = video.src;
        }
        
        this.saveRoomToStorage();
        this.showNotification('Room created successfully! Share the room code with friends.', 'success');
        this.updateConnectionStatus('Connected');
        
        console.log('Room created:', this.currentRoom);
    }
    
    joinRoom(roomCode) {
        console.log('Attempting to join room:', roomCode);
        
        const room = this.loadRoomFromStorage(roomCode);
        if (!room) {
            this.showNotification('Room not found. Please check the room code.', 'error');
            this.showRoomModal();
            return;
        }
        
        if (room.users.length >= this.config.maxParticipants) {
            this.showNotification('Room is full (max 4 users)', 'error');
            this.showRoomModal();
            return;
        }
        
        if (room.users.some(user => user.username === this.currentUser.username)) {
            this.showNotification('Username already taken in this room. Please choose a different name.', 'error');
            this.showRoomModal();
            return;
        }
        
        room.users.push(this.currentUser);
        this.currentRoom = room;
        this.saveRoomToStorage();
        
        this.showNotification('Joined room successfully!', 'success');
        this.updateConnectionStatus('Connected');
        
        setTimeout(() => {
            this.syncWithRoom();
            this.loadExistingMessages();
        }, 200);
    }
    
    loadExistingMessages() {
        if (!this.currentRoom || !this.currentRoom.messages) return;
        
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const systemMessages = Array.from(chatMessages.querySelectorAll('.system-message'));
        chatMessages.innerHTML = '';
        systemMessages.forEach(msg => chatMessages.appendChild(msg));
        
        this.currentRoom.messages.forEach(message => {
            this.addMessageToChat(message);
        });
    }
    
    loadVideo() {
        const urlInput = document.getElementById('videoUrlInput');
        if (!urlInput) return;
        
        const url = urlInput.value.trim();
        if (!url) {
            this.showNotification('Please enter a video URL', 'error');
            urlInput.focus();
            return;
        }
        
        console.log('Loading video URL:', url);
        
        this.hideError();
        this.showLoadingIndicator();
        this.currentVideoUrl = url;
        
        const videoInfo = this.detectVideoType(url);
        if (!videoInfo) {
            this.showError(this.errorMessages.format_not_supported);
            return;
        }
        
        console.log('Detected video info:', videoInfo);
        
        switch (videoInfo.type) {
            case 'youtube':
                this.loadYouTubeVideo(videoInfo.id, url);
                break;
            case 'vimeo':
                this.loadVimeoVideo(videoInfo.id, url);
                break;
            case 'direct':
                this.loadDirectVideo(videoInfo.url);
                break;
        }
    }
    
    loadYouTubeVideo(videoId, originalUrl) {
        console.log('Loading YouTube video:', videoId);
        
        this.switchToPlayer('youtube');
        this.updateVideoSourceIndicator('YouTube');
        
        if (!this.youtubeAPIReady) {
            console.log('YouTube API not ready, queuing video');
            this.pendingYouTubeVideoId = videoId;
            this.showSyncIndicator('Loading YouTube API...');
            return;
        }
        
        this.createYouTubePlayer(videoId);
        
        // Update room state
        if (this.currentRoom) {
            this.currentRoom.videoState.url = originalUrl;
            this.currentRoom.videoState.currentTime = 0;
            this.currentRoom.videoState.playing = false;
            this.currentRoom.videoState.playerType = 'youtube';
            this.currentRoom.videoState.lastUpdate = Date.now();
            this.saveRoomToStorage();
            
            this.broadcastVideoUpdate('load', { 
                url: originalUrl, 
                currentTime: 0, 
                playerType: 'youtube' 
            });
            this.addSystemMessage(`${this.currentUser.username} loaded a YouTube video`);
        }
    }
    
    loadVimeoVideo(videoId, originalUrl) {
        console.log('Loading Vimeo video:', videoId);
        
        this.switchToPlayer('vimeo');
        this.updateVideoSourceIndicator('Vimeo');
        
        const vimeoPlayer = document.getElementById('vimeoPlayer');
        if (vimeoPlayer) {
            vimeoPlayer.src = `https://player.vimeo.com/video/${videoId}?autoplay=0&controls=0`;
        }
        
        this.hideLoadingIndicator();
        this.showNotification('Vimeo video loaded! (Basic support)', 'success');
        
        // Update room state
        if (this.currentRoom) {
            this.currentRoom.videoState.url = originalUrl;
            this.currentRoom.videoState.currentTime = 0;
            this.currentRoom.videoState.playing = false;
            this.currentRoom.videoState.playerType = 'vimeo';
            this.currentRoom.videoState.lastUpdate = Date.now();
            this.saveRoomToStorage();
            
            this.broadcastVideoUpdate('load', { 
                url: originalUrl, 
                currentTime: 0, 
                playerType: 'vimeo' 
            });
            this.addSystemMessage(`${this.currentUser.username} loaded a Vimeo video`);
        }
    }
    
    loadDirectVideo(url) {
        console.log('Loading direct video:', url);
        
        this.switchToPlayer('html5');
        this.updateVideoSourceIndicator('Direct Video');
        
        const video = document.getElementById('mainVideo');
        if (!video) return;
        
        // Set up event handlers for this specific load
        const handleLoad = () => {
            console.log('Direct video loaded successfully');
            this.hideLoadingIndicator();
            this.showNotification('Video loaded successfully!', 'success');
            this.hideError();
            video.removeEventListener('canplay', handleLoad);
            video.removeEventListener('error', handleError);
        };
        
        const handleError = (e) => {
            console.error('Direct video load error:', e);
            this.showError('Failed to load video. Please check the URL or try a different format.');
            video.removeEventListener('canplay', handleLoad);
            video.removeEventListener('error', handleError);
        };
        
        video.addEventListener('canplay', handleLoad);
        video.addEventListener('error', handleError);
        
        video.src = url;
        video.load();
        
        // Update room state
        if (this.currentRoom) {
            this.currentRoom.videoState.url = url;
            this.currentRoom.videoState.currentTime = 0;
            this.currentRoom.videoState.playing = false;
            this.currentRoom.videoState.playerType = 'html5';
            this.currentRoom.videoState.lastUpdate = Date.now();
            this.saveRoomToStorage();
            
            this.broadcastVideoUpdate('load', { 
                url: url, 
                currentTime: 0, 
                playerType: 'html5' 
            });
            this.addSystemMessage(`${this.currentUser.username} loaded a new video`);
        }
    }
    
    loadSampleVideo() {
        const sampleUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
        const urlInput = document.getElementById('videoUrlInput');
        const video = document.getElementById('mainVideo');
        
        if (urlInput) {
            urlInput.value = sampleUrl;
        }
        
        if (video) {
            // Don't auto-load the sample, just set the placeholder
            // video.src = sampleUrl;
            // video.load();
        }
        
        this.updateVideoSourceIndicator('Direct Video');
        console.log('Sample video URL set');
    }
    
    togglePlayPause() {
        if (!this.hasValidVideo()) {
            this.showNotification('Please load a video first', 'error');
            return;
        }
        
        this.isVideoMaster = true;
        
        if (this.isPlaying()) {
            this.pause();
            this.broadcastVideoUpdate('pause', { 
                currentTime: this.getCurrentTime() 
            });
        } else {
            this.play();
            this.broadcastVideoUpdate('play', { 
                currentTime: this.getCurrentTime() 
            });
        }
    }
    
    hasValidVideo() {
        switch (this.currentPlayerType) {
            case 'html5':
                const video = document.getElementById('mainVideo');
                return video && video.src && !video.src.endsWith('/');
            case 'youtube':
                return this.youtubePlayer && this.youtubeReady;
            case 'vimeo':
                const vimeoPlayer = document.getElementById('vimeoPlayer');
                return vimeoPlayer && vimeoPlayer.src;
            default:
                return false;
        }
    }
    
    onVideoPlay() {
        const playPauseIcon = document.getElementById('playPauseIcon');
        if (playPauseIcon) {
            playPauseIcon.textContent = '⏸️';
        }
        
        if (this.currentRoom) {
            this.currentRoom.videoState.playing = true;
            this.currentRoom.videoState.currentTime = this.getCurrentTime();
            this.currentRoom.videoState.lastUpdate = Date.now();
            this.saveRoomToStorage();
        }
    }
    
    onVideoPause() {
        const playPauseIcon = document.getElementById('playPauseIcon');
        if (playPauseIcon) {
            playPauseIcon.textContent = '▶️';
        }
        
        if (this.currentRoom) {
            this.currentRoom.videoState.playing = false;
            this.currentRoom.videoState.currentTime = this.getCurrentTime();
            this.currentRoom.videoState.lastUpdate = Date.now();
            this.saveRoomToStorage();
        }
    }
    
    onVideoEnd() {
        this.broadcastVideoUpdate('end', { currentTime: 0 });
        if (this.currentRoom) {
            this.addSystemMessage('Video ended');
        }
    }
    
    seekVideo(value) {
        if (!this.hasValidVideo()) return;
        
        const duration = this.getDuration();
        if (!duration) return;
        
        const seekTime = (value / 100) * duration;
        this.seekTo(seekTime);
        this.broadcastVideoUpdate('seek', { currentTime: seekTime });
        this.isVideoMaster = true;
    }
    
    setVolumeFromBar(value) {
        this.setVolume(value);
        
        const muteBtn = document.getElementById('muteBtn');
        if (muteBtn) {
            muteBtn.textContent = value == 0 ? '🔇' : '🔊';
        }
    }
    
    toggleMute() {
        const volumeBar = document.getElementById('volumeBar');
        const muteBtn = document.getElementById('muteBtn');
        
        if (!volumeBar || !muteBtn) return;
        
        if (volumeBar.value == 0) {
            volumeBar.value = 50;
            this.setVolume(50);
            muteBtn.textContent = '🔊';
        } else {
            volumeBar.value = 0;
            this.setVolume(0);
            muteBtn.textContent = '🔇';
        }
    }
    
    toggleFullscreen() {
        const videoContainer = document.querySelector('.video-container');
        if (!videoContainer) return;
        
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => {
                console.error('Error exiting fullscreen:', err);
            });
        } else {
            videoContainer.requestFullscreen().catch(err => {
                console.error('Error entering fullscreen:', err);
                this.showNotification('Fullscreen not supported', 'error');
            });
        }
    }
    
    updateProgress() {
        const progressBar = document.getElementById('progressBar');
        const timeDisplay = document.getElementById('timeDisplay');
        
        if (!progressBar || !timeDisplay) return;
        
        const currentTime = this.getCurrentTime();
        const duration = this.getDuration();
        
        if (duration && duration > 0) {
            const progress = (currentTime / duration) * 100;
            progressBar.value = progress;
            
            const currentTimeStr = this.formatTime(currentTime);
            const durationStr = this.formatTime(duration);
            timeDisplay.textContent = `${currentTimeStr} / ${durationStr}`;
            
            // Update room state periodically
            if (this.currentRoom && Date.now() - this.lastSyncTime > 2000) {
                this.currentRoom.videoState.currentTime = currentTime;
                this.lastSyncTime = Date.now();
            }
        }
    }
    
    updateVideoControls() {
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.max = 100;
        }
        this.updateProgress();
    }
    
    // Continue with rest of the methods from the original implementation...
    sendMessage() {
        const input = document.getElementById('chatInput');
        if (!input || !this.currentUser) return;
        
        const message = input.value.trim();
        if (!message) return;
        
        if (message.length > 500) {
            this.showNotification('Message too long (max 500 characters)', 'error');
            return;
        }
        
        const messageObj = {
            id: this.generateId(),
            username: this.currentUser.username,
            content: message,
            timestamp: Date.now(),
            type: 'text'
        };
        
        this.addMessageToChat(messageObj);
        this.addMessageToRoom(messageObj);
        input.value = '';
        
        this.hideTypingIndicator();
    }
    
    handleTyping() {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        
        this.showTypingIndicator(this.currentUser?.username || 'Someone');
        
        this.typingTimeout = setTimeout(() => {
            this.hideTypingIndicator();
        }, 2000);
    }
    
    startVoiceRecording() {
        if (this.isRecording) return;
        
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                this.isRecording = true;
                const voiceBtn = document.getElementById('voiceMessageBtn');
                if (voiceBtn) {
                    voiceBtn.classList.add('recording');
                }
                
                this.mediaRecorder = new MediaRecorder(stream);
                const chunks = [];
                
                this.mediaRecorder.ondataavailable = (e) => {
                    chunks.push(e.data);
                };
                
                this.mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(chunks, { type: 'audio/webm' });
                    this.sendVoiceMessage(audioBlob);
                    stream.getTracks().forEach(track => track.stop());
                    if (voiceBtn) {
                        voiceBtn.classList.remove('recording');
                    }
                    this.isRecording = false;
                };
                
                this.mediaRecorder.start();
                this.showNotification('Recording voice message...', 'info');
            })
            .catch(err => {
                console.error('Error accessing microphone:', err);
                this.showNotification('Microphone access denied', 'error');
            });
    }
    
    stopVoiceRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.showNotification('Voice message sent!', 'success');
        }
    }
    
    sendVoiceMessage(audioBlob) {
        const reader = new FileReader();
        reader.onload = () => {
            const messageObj = {
                id: this.generateId(),
                username: this.currentUser.username,
                content: reader.result,
                timestamp: Date.now(),
                type: 'voice',
                duration: 0
            };
            
            this.addMessageToChat(messageObj);
            this.addMessageToRoom(messageObj);
        };
        reader.readAsDataURL(audioBlob);
    }
    
    async toggleVideoChat() {
        const overlay = document.getElementById('videoChatOverlay');
        const btn = document.getElementById('toggleVideoChatBtn');
        
        if (!overlay || !btn) return;
        
        if (overlay.classList.contains('hidden')) {
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({ 
                    video: true, 
                    audio: true 
                });
                
                const localVideo = overlay.querySelector('#localVideo video');
                if (localVideo) {
                    localVideo.srcObject = this.localStream;
                }
                
                overlay.classList.remove('hidden');
                btn.textContent = '📹 Stop Video';
                
                this.showNotification('Video chat enabled', 'success');
                if (this.currentUser) {
                    this.addSystemMessage(`${this.currentUser.username} enabled video chat`);
                }
            } catch (err) {
                console.error('Error accessing camera:', err);
                this.showNotification('Camera access denied', 'error');
            }
        } else {
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
                this.localStream = null;
            }
            
            overlay.classList.add('hidden');
            btn.textContent = '📹 Video Chat';
            
            this.showNotification('Video chat disabled', 'success');
            if (this.currentUser) {
                this.addSystemMessage(`${this.currentUser.username} disabled video chat`);
            }
        }
    }
    
    toggleAudio() {
        const btn = document.getElementById('toggleAudioBtn');
        const audioIcon = document.getElementById('audioIcon');
        
        if (!btn || !audioIcon) return;
        
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                audioIcon.textContent = audioTrack.enabled ? '🎤' : '🎤❌';
                btn.textContent = audioTrack.enabled ? '🎤 Audio' : '🎤❌ Muted';
                
                const status = audioTrack.enabled ? 'unmuted' : 'muted';
                this.showNotification(`Audio ${status}`, 'info');
            }
        } else {
            this.showNotification('Enable video chat first', 'warning');
        }
    }
    
    async toggleScreenShare() {
        const btn = document.getElementById('screenShareBtn');
        if (!btn) return;
        
        if (!this.screenStream) {
            try {
                this.screenStream = await navigator.mediaDevices.getDisplayMedia({ 
                    video: true, 
                    audio: true 
                });
                
                btn.textContent = '🖥️ Stop Share';
                this.showNotification('Screen sharing started', 'success');
                if (this.currentUser) {
                    this.addSystemMessage(`${this.currentUser.username} is sharing their screen`);
                }
                
                this.screenStream.getVideoTracks()[0].addEventListener('ended', () => {
                    this.stopScreenShare();
                });
            } catch (err) {
                console.error('Error sharing screen:', err);
                this.showNotification('Screen sharing failed', 'error');
            }
        } else {
            this.stopScreenShare();
        }
    }
    
    stopScreenShare() {
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
            this.screenStream = null;
            
            const btn = document.getElementById('screenShareBtn');
            if (btn) {
                btn.textContent = '🖥️ Share Screen';
            }
            this.showNotification('Screen sharing stopped', 'success');
            if (this.currentUser) {
                this.addSystemMessage(`${this.currentUser.username} stopped sharing their screen`);
            }
        }
    }
    
    addMessageToChat(messageObj) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const messageEl = this.createMessageElement(messageObj);
        chatMessages.appendChild(messageEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        while (chatMessages.children.length > this.config.messageLimit) {
            const firstChild = chatMessages.firstChild;
            if (firstChild && !firstChild.classList.contains('system-message')) {
                chatMessages.removeChild(firstChild);
            } else {
                break;
            }
        }
    }
    
    addSystemMessage(content) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const messageEl = document.createElement('div');
        messageEl.className = 'system-message';
        messageEl.textContent = content;
        
        chatMessages.appendChild(messageEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    createMessageElement(messageObj) {
        const messageEl = document.createElement('div');
        messageEl.className = 'message';
        
        const headerEl = document.createElement('div');
        headerEl.className = 'message-header';
        
        const usernameEl = document.createElement('span');
        usernameEl.className = 'message-username';
        usernameEl.textContent = messageObj.username;
        
        const timeEl = document.createElement('span');
        timeEl.className = 'message-time';
        timeEl.textContent = this.formatTime(new Date(messageObj.timestamp));
        
        headerEl.appendChild(usernameEl);
        headerEl.appendChild(timeEl);
        
        const contentEl = document.createElement('div');
        contentEl.className = 'message-content';
        
        if (messageObj.type === 'voice') {
            contentEl.className += ' voice-message';
            contentEl.innerHTML = `
                <button class="voice-play-btn" onclick="window.syncWatch.playVoiceMessage('${messageObj.content}')">▶️</button>
                <span class="voice-duration">Voice message</span>
            `;
        } else {
            contentEl.textContent = messageObj.content;
        }
        
        messageEl.appendChild(headerEl);
        messageEl.appendChild(contentEl);
        
        return messageEl;
    }
    
    playVoiceMessage(audioData) {
        const audio = document.getElementById('audioPlayer');
        if (audio) {
            audio.src = audioData;
            audio.play().catch(err => {
                console.error('Error playing voice message:', err);
                this.showNotification('Cannot play voice message', 'error');
            });
        }
    }
    
    showTypingIndicator(username) {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.textContent = `${username} is typing...`;
            indicator.classList.remove('hidden');
        }
    }
    
    hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.classList.add('hidden');
        }
    }
    
    broadcastVideoUpdate(action, data) {
        if (!this.currentRoom) return;
        
        const update = {
            type: 'video_update',
            action: action,
            data: data,
            timestamp: Date.now(),
            userId: this.currentUser.id
        };
        
        // Update room state
        this.currentRoom.videoState = { 
            ...this.currentRoom.videoState,
            ...data,
            lastUpdate: Date.now()
        };
        
        if (action === 'play') {
            this.currentRoom.videoState.playing = true;
        } else if (action === 'pause') {
            this.currentRoom.videoState.playing = false;
        }
        
        this.saveRoomToStorage();
        this.showSyncIndicator();
        
        console.log('Video update broadcasted:', update);
    }
    
    syncWithRoom() {
        if (!this.currentRoom) return;
        
        const videoState = this.currentRoom.videoState;
        
        // Switch player type if needed
        if (videoState.playerType && videoState.playerType !== this.currentPlayerType) {
            this.switchToPlayer(videoState.playerType);
        }
        
        // Sync video URL
        if (videoState.url && videoState.url !== this.currentVideoUrl) {
            const urlInput = document.getElementById('videoUrlInput');
            if (urlInput) {
                urlInput.value = videoState.url;
            }
            
            // Load the video if it's different from current
            this.currentVideoUrl = videoState.url;
            const videoInfo = this.detectVideoType(videoState.url);
            if (videoInfo) {
                switch (videoInfo.type) {
                    case 'youtube':
                        if (this.currentPlayerType === 'youtube') {
                            this.loadYouTubeVideo(videoInfo.id, videoState.url);
                        }
                        break;
                    case 'vimeo':
                        if (this.currentPlayerType === 'vimeo') {
                            this.loadVimeoVideo(videoInfo.id, videoState.url);
                        }
                        break;
                    case 'direct':
                        if (this.currentPlayerType === 'html5') {
                            const video = document.getElementById('mainVideo');
                            if (video && video.src !== videoState.url) {
                                video.src = videoState.url;
                                video.load();
                            }
                        }
                        break;
                }
            }
        }
        
        // Sync playback time (allow 2-second tolerance)
        const currentTime = this.getCurrentTime();
        if (Math.abs(currentTime - videoState.currentTime) > 2 && this.hasValidVideo()) {
            this.seekTo(videoState.currentTime);
            this.showSyncIndicator();
        }
        
        // Sync play/pause state
        if (videoState.playing && !this.isPlaying() && !this.isVideoMaster && this.hasValidVideo()) {
            this.play();
        } else if (!videoState.playing && this.isPlaying() && !this.isVideoMaster) {
            this.pause();
        }
        
        // Reset master status after sync
        setTimeout(() => { this.isVideoMaster = false; }, 1000);
    }
    
    showSyncIndicator(message = 'Syncing...') {
        const indicator = document.getElementById('syncIndicator');
        if (indicator) {
            indicator.textContent = `🔄 ${message}`;
            indicator.classList.remove('hidden');
            
            setTimeout(() => this.hideSyncIndicator(), 2000);
        }
    }
    
    hideSyncIndicator() {
        const indicator = document.getElementById('syncIndicator');
        if (indicator) {
            indicator.classList.add('hidden');
        }
    }
    
    startSyncLoop() {
        this.syncInterval = setInterval(() => {
            this.syncWithRoom();
            this.updateUsersDisplay();
        }, this.config.syncInterval);
        
        console.log('Sync loop started');
    }
    
    updateUI() {
        if (this.currentRoom) {
            const roomCodeEl = document.getElementById('currentRoomCode');
            const userCountEl = document.getElementById('userCount');
            
            if (roomCodeEl) {
                roomCodeEl.textContent = this.currentRoom.code;
            }
            
            if (userCountEl) {
                userCountEl.textContent = this.currentRoom.users.length;
            }
        }
    }
    
    updateUsersDisplay() {
        if (!this.currentRoom) return;
        
        const usersList = document.getElementById('usersList');
        if (!usersList) return;
        
        usersList.innerHTML = '';
        
        this.currentRoom.users.forEach(user => {
            const userEl = document.createElement('div');
            userEl.className = 'user-item';
            userEl.innerHTML = `
                <div class="user-status"></div>
                <span>${user.username}${user.id === this.currentUser.id ? ' (You)' : ''}</span>
            `;
            usersList.appendChild(userEl);
        });
    }
    
    updateConnectionStatus(status) {
        const statusEl = document.getElementById('connectionStatus');
        if (!statusEl) return;
        
        statusEl.textContent = status;
        
        switch (status) {
            case 'Connected':
                statusEl.className = 'status status--success';
                break;
            case 'Connecting':
                statusEl.className = 'status status--info';
                break;
            case 'Disconnected':
                statusEl.className = 'status status--error';
                break;
        }
    }
    
    copyRoomLink() {
        if (!this.currentRoom) return;
        
        const url = `${window.location.origin}${window.location.pathname}?room=${this.currentRoom.code}`;
        
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(url).then(() => {
                this.showNotification('Room link copied to clipboard!', 'success');
            }).catch(() => {
                this.fallbackCopyText(url);
            });
        } else {
            this.fallbackCopyText(url);
        }
    }
    
    fallbackCopyText(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showNotification('Room link copied!', 'success');
        } catch (err) {
            this.showNotification('Copy failed. Room code: ' + this.currentRoom.code, 'error');
        }
        
        document.body.removeChild(textArea);
    }
    
    handleKeyboardShortcuts(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        switch (e.code) {
            case 'Space':
                e.preventDefault();
                this.togglePlayPause();
                break;
            case 'KeyM':
                e.preventDefault();
                this.toggleMute();
                break;
            case 'KeyF':
                e.preventDefault();
                this.toggleFullscreen();
                break;
            case 'KeyC':
                e.preventDefault();
                const chatInput = document.getElementById('chatInput');
                if (chatInput) {
                    chatInput.focus();
                }
                break;
            case 'KeyV':
                e.preventDefault();
                this.toggleVideoChat();
                break;
        }
    }
    
    handleStorageChange(e) {
        if (e.key && e.key.startsWith('syncwatch_room_')) {
            const roomCode = e.key.replace('syncwatch_room_', '');
            if (this.currentRoom && this.currentRoom.code === roomCode && e.newValue) {
                const newRoomData = JSON.parse(e.newValue);
                const oldMessageCount = this.currentRoom.messages ? this.currentRoom.messages.length : 0;
                
                this.currentRoom = newRoomData;
                this.syncWithRoom();
                this.updateUI();
                this.updateUsersDisplay();
                
                if (newRoomData.messages && newRoomData.messages.length > oldMessageCount) {
                    this.loadNewMessages();
                }
            }
        }
    }
    
    loadNewMessages() {
        if (!this.currentRoom || !this.currentRoom.messages) return;
        
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const currentMessageCount = chatMessages.querySelectorAll('.message').length;
        const roomMessageCount = this.currentRoom.messages.length;
        
        if (roomMessageCount > currentMessageCount) {
            const newMessages = this.currentRoom.messages.slice(currentMessageCount);
            newMessages.forEach(message => {
                if (message.username !== this.currentUser.username) {
                    this.addMessageToChat(message);
                }
            });
        }
    }
    
    addMessageToRoom(messageObj) {
        if (!this.currentRoom) return;
        
        if (!this.currentRoom.messages) {
            this.currentRoom.messages = [];
        }
        
        this.currentRoom.messages.push(messageObj);
        
        if (this.currentRoom.messages.length > this.config.messageLimit) {
            this.currentRoom.messages = this.currentRoom.messages.slice(-this.config.messageLimit);
        }
        
        this.saveRoomToStorage();
    }
    
    saveRoomToStorage() {
        if (!this.currentRoom) return;
        
        try {
            localStorage.setItem(`syncwatch_room_${this.currentRoom.code}`, JSON.stringify(this.currentRoom));
        } catch (err) {
            console.error('Error saving room to storage:', err);
        }
    }
    
    loadRoomFromStorage(roomCode) {
        try {
            const data = localStorage.getItem(`syncwatch_room_${roomCode}`);
            return data ? JSON.parse(data) : null;
        } catch (err) {
            console.error('Error loading room from storage:', err);
            return null;
        }
    }
    
    showNotification(message, type = 'info') {
        const notifications = document.getElementById('notifications');
        if (!notifications) return;
        
        // Remove any existing notifications of the same type
        const existingNotifications = notifications.querySelectorAll(`.notification.${type}`);
        existingNotifications.forEach(notification => {
            if (notification.parentNode) {
                notification.remove();
            }
        });
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        notifications.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
        
        console.log('Notification:', type, message);
    }
    
    cleanup() {
        console.log('Cleaning up...');
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
        }
        
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        
        if (this.currentRoom && this.currentUser) {
            this.currentRoom.users = this.currentRoom.users.filter(
                user => user.id !== this.currentUser.id
            );
            this.saveRoomToStorage();
        }
    }
    
    // Utility functions
    generateId() {
        return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }
    
    generateRoomCode() {
        return Math.random().toString(36).substr(2, 6).toUpperCase();
    }
    
    formatTime(seconds) {
        if (seconds instanceof Date) {
            return seconds.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Initialize the application
let syncWatch = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing SyncWatch...');
    syncWatch = new SyncWatch();
    syncWatch.init();
    
    // Check for room code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('room');
    if (roomCode) {
        const roomInput = document.getElementById('roomCodeInput');
        if (roomInput) {
            roomInput.value = roomCode;
        }
    }
});

if (document.readyState !== 'loading') {
    console.log('DOM already loaded, initializing SyncWatch immediately...');
    syncWatch = new SyncWatch();
    syncWatch.init();
}

// Expose to global scope
window.syncWatch = syncWatch;