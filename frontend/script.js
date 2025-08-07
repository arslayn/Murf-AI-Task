/**
 * 30 Days of Voice Agents - Complete Frontend JavaScript
 * Implements all 6 days of features:
 * - Day 1: Basic setup and API communication
 * - Day 2-3: Text-to-Speech with Murf API
 * - Day 4: Echo Bot with MediaRecorder
 * - Day 5: Audio file upload
 * - Day 6: Audio transcription with AssemblyAI
 */

class VoiceAgentsApp {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recordingStartTime = null;
        this.recordingTimer = null;
        this.currentRecording = null;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkApiStatus();
        this.setupFileUpload();
    }

    bindEvents() {
        // Text-to-Speech Events
        document.getElementById('generate-btn').addEventListener('click', () => this.generateSpeech());
        document.getElementById('tts-text').addEventListener('input', (e) => this.updateCharCount(e.target));

        // Echo Bot Events
        document.getElementById('start-record-btn').addEventListener('click', () => this.startRecording());
        document.getElementById('stop-record-btn').addEventListener('click', () => this.stopRecording());
        document.getElementById('upload-btn').addEventListener('click', () => this.uploadRecording());

        // File Upload Events
        const fileInput = document.getElementById('file-input');
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files));

        // Transcription Events
        document.getElementById('copy-transcription').addEventListener('click', () => this.copyTranscription());
        document.getElementById('download-transcription').addEventListener('click', () => this.downloadTranscription());

        // Modal Events
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        // Click outside modal to close
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    // Utility Methods
    showError(message) {
        document.getElementById('error-message').textContent = message;
        document.getElementById('error-modal').style.display = 'block';
    }

    showSuccess(message) {
        document.getElementById('success-message').textContent = message;
        document.getElementById('success-modal').style.display = 'block';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Day 1: API Status Check
    async checkApiStatus() {
        try {
            const response = await fetch('/health');
            const data = await response.json();
            
            document.getElementById('backend-status').textContent = 'Online';
            document.getElementById('backend-status').className = 'status-value online';
            
            document.getElementById('murf-status').textContent = data.murf_api_configured ? 'Configured' : 'Not Configured';
            document.getElementById('murf-status').className = `status-value ${data.murf_api_configured ? 'online' : 'offline'}`;
            
            document.getElementById('assemblyai-status').textContent = data.assemblyai_configured ? 'Configured' : 'Not Configured';
            document.getElementById('assemblyai-status').className = `status-value ${data.assemblyai_configured ? 'online' : 'offline'}`;
            
        } catch (error) {
            document.getElementById('backend-status').textContent = 'Offline';
            document.getElementById('backend-status').className = 'status-value offline';
            document.getElementById('murf-status').textContent = 'Unknown';
            document.getElementById('murf-status').className = 'status-value offline';
            document.getElementById('assemblyai-status').textContent = 'Unknown';
            document.getElementById('assemblyai-status').className = 'status-value offline';
        }
    }

    // Day 2-3: Text-to-Speech Implementation
    updateCharCount(textarea) {
        const count = textarea.value.length;
        document.getElementById('char-count').textContent = count;
        
        if (count > 900) {
            document.getElementById('char-count').style.color = 'var(--error-color)';
        } else if (count > 700) {
            document.getElementById('char-count').style.color = 'var(--warning-color)';
        } else {
            document.getElementById('char-count').style.color = 'var(--text-light)';
        }
    }

    async generateSpeech() {
        const text = document.getElementById('tts-text').value.trim();
        const voiceId = document.getElementById('voice-select').value;
        
        if (!text) {
            this.showError('Please enter some text to convert to speech.');
            return;
        }

        const generateBtn = document.getElementById('generate-btn');
        const loadingDiv = document.getElementById('tts-loading');
        const resultDiv = document.getElementById('tts-result');
        
        // Show loading state
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        loadingDiv.style.display = 'block';
        resultDiv.style.display = 'none';

        try {
            const response = await fetch('/generate-audio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text,
                    voice_id: voiceId
                })
            });

            const data = await response.json();

            if (data.success && data.audio_url) {
                // Display audio player and URL
                const audioElement = document.getElementById('tts-audio');
                const urlElement = document.getElementById('audio-url');
                
                audioElement.src = data.audio_url;
                urlElement.href = data.audio_url;
                urlElement.textContent = data.audio_url;
                
                resultDiv.style.display = 'block';
                this.showSuccess('Audio generated successfully! Click play to listen.');
            } else {
                throw new Error(data.message || 'Failed to generate audio');
            }

        } catch (error) {
            console.error('TTS Error:', error);
            this.showError(`Failed to generate speech: ${error.message}`);
        } finally {
            // Reset button state
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-magic"></i> Generate Speech';
            loadingDiv.style.display = 'none';
        }
    }

    // Day 4: Echo Bot Implementation
    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                } 
            });
            
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            this.audioChunks = [];
            this.recordingStartTime = Date.now();
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.processRecording();
                stream.getTracks().forEach(track => track.stop());
            };
            
            this.mediaRecorder.start(100); // Collect data every 100ms
            this.updateRecordingUI(true);
            this.startRecordingTimer();
            
        } catch (error) {
            console.error('Recording Error:', error);
            this.showError('Failed to access microphone. Please check permissions.');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            this.updateRecordingUI(false);
            this.stopRecordingTimer();
        }
    }

    updateRecordingUI(isRecording) {
        const startBtn = document.getElementById('start-record-btn');
        const stopBtn = document.getElementById('stop-record-btn');
        const statusDiv = document.getElementById('recording-status');
        const resultDiv = document.getElementById('echo-result');
        
        startBtn.disabled = isRecording;
        stopBtn.disabled = !isRecording;
        statusDiv.style.display = isRecording ? 'block' : 'none';
        
        if (!isRecording) {
            resultDiv.style.display = 'none';
        }
    }

    startRecordingTimer() {
        this.recordingTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
            document.getElementById('recording-time').textContent = this.formatDuration(elapsed);
        }, 1000);
    }

    stopRecordingTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }

    processRecording() {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const duration = (Date.now() - this.recordingStartTime) / 1000;
        
        // Store current recording
        this.currentRecording = audioBlob;
        
        // Update UI
        const audioElement = document.getElementById('echo-audio');
        const resultDiv = document.getElementById('echo-result');
        
        audioElement.src = audioUrl;
        document.getElementById('recording-duration').textContent = this.formatDuration(duration);
        document.getElementById('recording-size').textContent = this.formatFileSize(audioBlob.size);
        
        resultDiv.style.display = 'block';
    }

    // Day 5: Audio Upload Implementation
    async uploadRecording() {
        if (!this.currentRecording) {
            this.showError('No recording available to upload.');
            return;
        }

        const uploadBtn = document.getElementById('upload-btn');
        const statusDiv = document.getElementById('upload-status');
        
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        
        try {
            const formData = new FormData();
            formData.append('audio_file', this.currentRecording, 'recording.webm');
            
            const response = await fetch('/upload-audio', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                statusDiv.innerHTML = `
                    <div class="status-message success">
                        <strong>Upload Successful!</strong><br>
                        File: ${data.filename}<br>
                        Size: ${this.formatFileSize(data.size)}<br>
                        Type: ${data.content_type}
                    </div>
                `;
                statusDiv.style.display = 'block';
                this.showSuccess('Recording uploaded successfully to server!');
            } else {
                throw new Error(data.message || 'Upload failed');
            }
            
        } catch (error) {
            console.error('Upload Error:', error);
            statusDiv.innerHTML = `
                <div class="status-message error">
                    <strong>Upload Failed:</strong> ${error.message}
                </div>
            `;
            statusDiv.style.display = 'block';
            this.showError(`Upload failed: ${error.message}`);
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Upload to Server';
        }
    }

    // Day 5-6: File Upload Setup
    setupFileUpload() {
        const uploadArea = document.getElementById('file-upload-area');
        const fileInput = document.getElementById('file-input');
        
        // Drag and drop events
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            this.handleFileSelect(files);
        });
        
        // Click to upload
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });
    }

    handleFileSelect(files) {
        if (files.length === 0) return;
        
        const fileListDiv = document.getElementById('file-list');
        fileListDiv.innerHTML = '';
        fileListDiv.style.display = 'block';
        
        Array.from(files).forEach((file, index) => {
            if (file.type.startsWith('audio/')) {
                this.displayFileItem(file, index);
                this.transcribeFile(file);
            } else {
                this.showError(`File "${file.name}" is not an audio file.`);
            }
        });
    }

    displayFileItem(file, index) {
        const fileListDiv = document.getElementById('file-list');
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <div class="file-info-item">
                <i class="fas fa-file-audio"></i>
                <div>
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${this.formatFileSize(file.size)}</div>
                </div>
            </div>
            <div class="file-status" id="file-status-${index}">
                <i class="fas fa-clock"></i> Pending
            </div>
        `;
        fileListDiv.appendChild(fileItem);
    }

    // Day 6: Audio Transcription Implementation
    async transcribeFile(file) {
        const loadingDiv = document.getElementById('transcription-loading');
        const resultsDiv = document.getElementById('transcription-results');
        
        loadingDiv.style.display = 'block';
        resultsDiv.style.display = 'none';
        
        try {
            const formData = new FormData();
            formData.append('audio_file', file);
            
            const response = await fetch('/transcribe-file', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success && data.transcription) {
                this.displayTranscription(data.transcription);
                this.showSuccess('Audio transcription completed successfully!');
            } else {
                throw new Error(data.message || 'Transcription failed');
            }
            
        } catch (error) {
            console.error('Transcription Error:', error);
            this.showError(`Transcription failed: ${error.message}`);
        } finally {
            loadingDiv.style.display = 'none';
        }
    }

    displayTranscription(transcriptionText) {
        const resultsDiv = document.getElementById('transcription-results');
        const textDiv = document.getElementById('transcription-text');
        
        textDiv.textContent = transcriptionText;
        resultsDiv.style.display = 'block';
        
        // Store transcription for copy/download
        this.currentTranscription = transcriptionText;
    }

    copyTranscription() {
        if (!this.currentTranscription) {
            this.showError('No transcription available to copy.');
            return;
        }
        
        navigator.clipboard.writeText(this.currentTranscription).then(() => {
            this.showSuccess('Transcription copied to clipboard!');
        }).catch(() => {
            this.showError('Failed to copy transcription to clipboard.');
        });
    }

    downloadTranscription() {
        if (!this.currentTranscription) {
            this.showError('No transcription available to download.');
            return;
        }
        
        const blob = new Blob([this.currentTranscription], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transcription_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showSuccess('Transcription downloaded successfully!');
    }
}

// Global functions for HTML onclick handlers
function checkApiStatus() {
    if (window.voiceApp) {
        window.voiceApp.checkApiStatus();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.voiceApp = new VoiceAgentsApp();
    console.log('Voice Agents Application Initialized');
    
    // Add some visual feedback for development
    console.log('%c🎤 Voice Agents App Ready!', 'color: #667eea; font-size: 16px; font-weight: bold;');
    console.log('Features available:');
    console.log('✅ Text-to-Speech (Murf API)');
    console.log('✅ Echo Bot (MediaRecorder)');
    console.log('✅ Audio Upload');
    console.log('✅ Speech-to-Text (AssemblyAI)');
});
