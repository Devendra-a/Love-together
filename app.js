// SyncWatch - Collaborative Video Streaming Application
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
        
        // Configuration
        this.config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ],
            maxParticipants: 4,
            syncInterval: 5000,
            messageLimit: 100
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
        this.initialized = true;
        
        console.log('SyncWatch initialized successfully');
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
                console.log('Join room button clicked');
                this.handleJoinRoom();
            });
        }
        
        if (roomInput) {
            roomInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    console.log('Enter pressed in room input');
                    this.handleJoinRoom();
                }
            });
        }
        
        if (usernameInput) {
            usernameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    console.log('Enter pressed in username input');
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
        
        // Progress and volume controls
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.addEventListener('input', (e) => this.seekVideo(e.target.value));
        }
        
        const volumeBar = document.getElementById('volumeBar');
        if (volumeBar) {
            volumeBar.addEventListener('input', (e) => this.setVolume(e.target.value));
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
        
        // Video events
        const video = document.getElementById('mainVideo');
        if (video) {
            video.addEventListener('loadedmetadata', () => this.updateVideoControls());
            video.addEventListener('timeupdate', () => this.updateProgress());
            video.addEventListener('play', () => this.onVideoPlay());
            video.addEventListener('pause', () => this.onVideoPause());
            video.addEventListener('ended', () => this.onVideoEnd());
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
        
        console.log('Username:', username, 'Room code:', roomCode);
        
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
        
        console.log('Current user created:', this.currentUser);
        
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
        
        // Initialize UI after showing app
        setTimeout(() => {
            this.initializeApp();
        }, 200);
    }
    
    initializeApp() {
        console.log('Initializing main app...');
        
        this.updateUI();
        this.startSyncLoop();
        this.updateUsersDisplay();
        
        // Add welcome message to chat
        this.addSystemMessage(`Welcome to the room, ${this.currentUser.username}!`);
        
        // Set initial volume
        const video = document.getElementById('mainVideo');
        const volumeBar = document.getElementById('volumeBar');
        if (video && volumeBar) {
            video.volume = volumeBar.value / 100;
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
                lastUpdate: Date.now()
            }
        };
        
        // Set default video URL
        const video = document.getElementById('mainVideo');
        if (video && video.src) {
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
        
        // Check if username is already taken
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
        
        console.log('Successfully joined room:', this.currentRoom);
        
        // Sync with room state
        setTimeout(() => {
            this.syncWithRoom();
            this.loadExistingMessages();
        }, 200);
    }
    
    loadExistingMessages() {
        if (!this.currentRoom || !this.currentRoom.messages) return;
        
        console.log('Loading existing messages:', this.currentRoom.messages.length);
        
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        // Clear existing messages except system messages
        const systemMessages = Array.from(chatMessages.querySelectorAll('.system-message'));
        chatMessages.innerHTML = '';
        systemMessages.forEach(msg => chatMessages.appendChild(msg));
        
        // Add room messages
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
        
        if (!this.isValidVideoUrl(url)) {
            this.showNotification('Please enter a valid video URL (MP4, WebM, or streaming service)', 'error');
            return;
        }
        
        const video = document.getElementById('mainVideo');
        if (!video) return;
        
        // Show loading state
        this.showSyncIndicator('Loading video...');
        
        const handleLoad = () => {
            this.showNotification('Video loaded successfully!', 'success');
            this.hideSyncIndicator();
            video.removeEventListener('loadeddata', handleLoad);
            video.removeEventListener('error', handleError);
        };
        
        const handleError = () => {
            this.showNotification('Failed to load video. Please check the URL.', 'error');
            this.hideSyncIndicator();
            video.removeEventListener('loadeddata', handleLoad);
            video.removeEventListener('error', handleError);
        };
        
        video.addEventListener('loadeddata', handleLoad);
        video.addEventListener('error', handleError);
        
        video.src = url;
        video.load();
        
        // Update room state
        if (this.currentRoom) {
            this.currentRoom.videoState.url = url;
            this.currentRoom.videoState.currentTime = 0;
            this.currentRoom.videoState.playing = false;
            this.currentRoom.videoState.lastUpdate = Date.now();
            this.saveRoomToStorage();
            
            // Broadcast to other users
            this.broadcastVideoUpdate('load', { url, currentTime: 0 });
            this.addSystemMessage(`${this.currentUser.username} loaded a new video`);
        }
        
        console.log('Loading video:', url);
    }
    
    loadSampleVideo() {
        const sampleUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
        const urlInput = document.getElementById('videoUrlInput');
        const video = document.getElementById('mainVideo');
        
        if (urlInput) {
            urlInput.value = sampleUrl;
        }
        
        if (video) {
            video.src = sampleUrl;
            video.load();
        }
        
        console.log('Sample video loaded');
    }
    
    togglePlayPause() {
        const video = document.getElementById('mainVideo');
        if (!video) return;
        
        if (!video.src) {
            this.showNotification('Please load a video first', 'error');
            return;
        }
        
        if (video.paused) {
            video.play().then(() => {
                this.broadcastVideoUpdate('play', { currentTime: video.currentTime });
            }).catch(err => {
                console.error('Error playing video:', err);
                this.showNotification('Cannot play video', 'error');
            });
        } else {
            video.pause();
            this.broadcastVideoUpdate('pause', { currentTime: video.currentTime });
        }
        this.isVideoMaster = true;
        
        console.log('Video play/pause toggled');
    }
    
    onVideoPlay() {
        const playPauseIcon = document.getElementById('playPauseIcon');
        if (playPauseIcon) {
            playPauseIcon.textContent = '⏸️';
        }
        
        if (this.currentRoom) {
            this.currentRoom.videoState.playing = true;
            const video = document.getElementById('mainVideo');
            if (video) {
                this.currentRoom.videoState.currentTime = video.currentTime;
            }
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
            const video = document.getElementById('mainVideo');
            if (video) {
                this.currentRoom.videoState.currentTime = video.currentTime;
            }
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
        const video = document.getElementById('mainVideo');
        if (!video || !video.duration) return;
        
        const seekTime = (value / 100) * video.duration;
        video.currentTime = seekTime;
        this.broadcastVideoUpdate('seek', { currentTime: seekTime });
        this.isVideoMaster = true;
    }
    
    setVolume(value) {
        const video = document.getElementById('mainVideo');
        const muteBtn = document.getElementById('muteBtn');
        
        if (video) {
            video.volume = value / 100;
        }
        
        if (muteBtn) {
            muteBtn.textContent = value == 0 ? '🔇' : '🔊';
        }
    }
    
    toggleMute() {
        const video = document.getElementById('mainVideo');
        const volumeBar = document.getElementById('volumeBar');
        const muteBtn = document.getElementById('muteBtn');
        
        if (!video || !volumeBar || !muteBtn) return;
        
        if (video.muted) {
            video.muted = false;
            muteBtn.textContent = '🔊';
            video.volume = volumeBar.value / 100;
        } else {
            video.muted = true;
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
        const video = document.getElementById('mainVideo');
        const progressBar = document.getElementById('progressBar');
        const timeDisplay = document.getElementById('timeDisplay');
        
        if (!video || !progressBar || !timeDisplay) return;
        
        if (video.duration) {
            const progress = (video.currentTime / video.duration) * 100;
            progressBar.value = progress;
            
            const currentTime = this.formatTime(video.currentTime);
            const duration = this.formatTime(video.duration);
            timeDisplay.textContent = `${currentTime} / ${duration}`;
            
            // Update room state periodically
            if (this.currentRoom && Date.now() - this.lastSyncTime > 2000) {
                this.currentRoom.videoState.currentTime = video.currentTime;
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
        
        // Clear typing indicator
        this.hideTypingIndicator();
        
        console.log('Message sent:', messageObj);
    }
    
    handleTyping() {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        
        // Show typing indicator to other users (simulated for demo)
        this.showTypingIndicator(this.currentUser?.username || 'Someone');
        
        // Clear typing indicator after 2 seconds of no typing
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
        
        // Limit message history
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
        
        const video = document.getElementById('mainVideo');
        if (!video) return;
        
        const videoState = this.currentRoom.videoState;
        
        // Sync video URL
        if (videoState.url && videoState.url !== video.src) {
            const urlInput = document.getElementById('videoUrlInput');
            if (urlInput) {
                urlInput.value = videoState.url;
            }
            video.src = videoState.url;
            video.load();
        }
        
        // Sync playback time (allow 2-second tolerance)
        if (video.duration && Math.abs(video.currentTime - videoState.currentTime) > 2) {
            video.currentTime = videoState.currentTime;
            this.showSyncIndicator();
        }
        
        // Sync play/pause state
        if (videoState.playing && video.paused && !this.isVideoMaster) {
            video.play().catch(err => console.error('Sync play error:', err));
        } else if (!videoState.playing && !video.paused && !this.isVideoMaster) {
            video.pause();
        }
        
        // Reset master status after sync
        setTimeout(() => { this.isVideoMaster = false; }, 1000);
    }
    
    showSyncIndicator(message = 'Syncing...') {
        const indicator = document.getElementById('syncIndicator');
        if (indicator) {
            indicator.textContent = message;
            indicator.classList.remove('hidden');
            
            // Auto-hide after 2 seconds
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
        // Fallback for non-secure contexts
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
        // Don't trigger shortcuts when typing in inputs
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
            // Room data updated by another user
            const roomCode = e.key.replace('syncwatch_room_', '');
            if (this.currentRoom && this.currentRoom.code === roomCode && e.newValue) {
                const newRoomData = JSON.parse(e.newValue);
                const oldMessageCount = this.currentRoom.messages ? this.currentRoom.messages.length : 0;
                
                this.currentRoom = newRoomData;
                this.syncWithRoom();
                this.updateUI();
                this.updateUsersDisplay();
                
                // Check for new messages
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
        
        // Limit message history
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
        
        // Remove user from room
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
        
        if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    isValidVideoUrl(url) {
        try {
            const urlObj = new URL(url);
            const validExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
            const hasValidExtension = validExtensions.some(ext => 
                urlObj.pathname.toLowerCase().includes(ext)
            );
            
            const validDomains = [
                'youtube.com', 'youtu.be', 'vimeo.com', 
                'googleapis.com', 'cloudflare.com', 'sample-videos.com'
            ];
            
            const hasValidDomain = validDomains.some(domain =>
                urlObj.hostname.includes(domain)
            );
            
            return hasValidExtension || hasValidDomain;
        } catch {
            return false;
        }
    }
}

// Initialize the application when DOM is loaded
let syncWatch = null;

// Immediate initialization
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

// Also try to initialize immediately if DOM is already loaded
if (document.readyState !== 'loading') {
    console.log('DOM already loaded, initializing SyncWatch immediately...');
    syncWatch = new SyncWatch();
    syncWatch.init();
}

// Expose to global scope for HTML onclick handlers and debugging
window.syncWatch = syncWatch;