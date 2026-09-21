/**
 * NovaGroq AI Application Controller
 * Handles Multimodal Chat, Groq Streaming, Whisper Voice, Vision QA,
 * Inbuilt Audio Assistant (TTS), 3D Avatar state sync, and AI Image Studio.
 */

document.addEventListener('DOMContentLoaded', () => {
  // App State
  const state = {
    apiKey: '',
    hasApiKey: false,
    selectedModel: 'qwen/qwen3.8-27b',
    currentMode: 'general',
    messages: [], // [{ role, content, image, metrics }]
    attachedImageBase64: null,
    attachedImageName: '',
    isGenerating: false,
    audioAssistantActive: false,
    selectedVoice: null,
    speechRate: 1.0,
    speechPitch: 1.0,
    autoSpeak: false,
    currentUtterance: null,
    sessions: [],
    activeSessionId: null
  };

  // DOM Elements
  const chatScrollContainer = document.getElementById('chatScrollContainer');
  const messagesContainer = document.getElementById('messagesContainer');
  const welcomeHero = document.getElementById('welcomeHero');
  const promptInput = document.getElementById('promptInput');
  const sendBtn = document.getElementById('sendBtn');
  const sendIcon = document.getElementById('sendIcon');
  const sendSpinner = document.getElementById('sendSpinner');
  const stopGenBtn = document.getElementById('stopGenBtn');
  let currentAbortController = null;
  const modelSelect = document.getElementById('modelSelect');
  const currentModelBadge = document.getElementById('currentModelBadge');
  const scrollBottomBtn = document.getElementById('scrollBottomBtn');

  // Lightbox Modal Elements
  const lightboxModal = document.getElementById('lightboxModal');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxTitle = document.getElementById('lightboxTitle');
  const lightboxDownloadBtn = document.getElementById('lightboxDownloadBtn');
  const closeLightboxBtn = document.getElementById('closeLightboxBtn');

  // Sidebar & Navigation
  const appSidebar = document.getElementById('appSidebar');
  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
  const newChatBtn = document.getElementById('newChatBtn');
  const historyList = document.getElementById('historyList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const exportChatBtn = document.getElementById('exportChatBtn');
  const hudSpeed = document.getElementById('hudSpeed');
  const hudLatency = document.getElementById('hudLatency');
  const hudKeyText = document.getElementById('hudKeyText');
  const apiKeyStatusHud = document.getElementById('apiKeyStatusHud');
  const serverStatusDot = document.getElementById('serverStatusDot');
  const groqStatusLabel = document.getElementById('groqStatusLabel');

  // Multimodal Attachments
  const attachImageBtn = document.getElementById('attachImageBtn');
  const imageFileInput = document.getElementById('imageFileInput');
  const attachmentPreviewBar = document.getElementById('attachmentPreviewBar');
  const previewImageThumb = document.getElementById('previewImageThumb');
  const previewFileName = document.getElementById('previewFileName');
  const removeAttachmentBtn = document.getElementById('removeAttachmentBtn');

  // Voice Recording
  const micBtn = document.getElementById('micBtn');
  const recordingIndicatorHud = document.getElementById('recordingIndicatorHud');
  const recordingTimer = document.getElementById('recordingTimer');
  const cancelRecordingBtn = document.getElementById('cancelRecordingBtn');
  const doneRecordingBtn = document.getElementById('doneRecordingBtn');
  let mediaRecorder = null;
  let audioChunks = [];
  let recordingInterval = null;
  let recordingSeconds = 0;

  // Inbuilt Audio Assistant
  const audioAssistantToggleBtn = document.getElementById('audioAssistantToggleBtn');
  const audioStatusPill = document.getElementById('audioStatusPill');
  const audioCompanionBar = document.getElementById('audioCompanionBar');
  const companionSubText = document.getElementById('companionSubText');
  const stopSpeechBtn = document.getElementById('stopSpeechBtn');
  const closeAudioBarBtn = document.getElementById('closeAudioBarBtn');
  const waveformCanvas = document.getElementById('waveformCanvas');
  let waveAnimationId = null;

  // 3D Virtual Pop-up Chatbot
  const companion3dPopup = document.getElementById('companion3dPopup');
  const popup3dWindow = document.getElementById('popup3dWindow');
  const floating3dLauncher = document.getElementById('floating3dLauncher');
  const headerAvatarBtn = document.getElementById('headerAvatarBtn');
  const open3dCompanionBtn = document.getElementById('open3dCompanionBtn');
  const minimize3dBtn = document.getElementById('minimize3dBtn');
  const close3dBtn = document.getElementById('close3dBtn');
  const companionBubble = document.getElementById('companionBubble');
  const companionVoiceToggle = document.getElementById('companionVoiceToggle');
  let avatar3D = null;

  // AI Image Studio Modal
  const imageStudioModal = document.getElementById('imageStudioModal');
  const openImageStudioBtn = document.getElementById('openImageStudioBtn');
  const quickArtBtn = document.getElementById('quickArtBtn');
  const heroImageGenCard = document.getElementById('heroImageGenCard');
  const closeImageStudioBtn = document.getElementById('closeImageStudioBtn');
  const imagePromptInput = document.getElementById('imagePromptInput');
  const generateArtBtn = document.getElementById('generateArtBtn');
  const generatedResultImg = document.getElementById('generatedResultImg');
  const emptyImagePreview = document.getElementById('emptyImagePreview');
  const imageGeneratingSpinner = document.getElementById('imageGeneratingSpinner');
  const imageStudioError = document.getElementById('imageStudioError');
  const imageStudioErrorText = document.getElementById('imageStudioErrorText');
  const studioSubjectMeta = document.getElementById('studioSubjectMeta');
  const studioSubjectText = document.getElementById('studioSubjectText');
  const imageActionsBar = document.getElementById('imageActionsBar');
  const studioViewFullBtn = document.getElementById('studioViewFullBtn');
  const studioDownloadBtn = document.getElementById('studioDownloadBtn');
  const studioRegenBtn = document.getElementById('studioRegenBtn');
  const insertArtToChatBtn = document.getElementById('insertArtToChatBtn');
  let selectedImageStyle = 'photorealistic';
  let selectedAspectRatio = '1:1';

  // Settings Modal
  const settingsModal = document.getElementById('settingsModal');
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const navSettingsBtn = document.getElementById('navSettingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const groqApiKeyInput = document.getElementById('groqApiKeyInput');
  const toggleApiKeyVisBtn = document.getElementById('toggleApiKeyVisBtn');
  const verifyKeyBtn = document.getElementById('verifyKeyBtn');
  const settingStatusDot = document.getElementById('settingStatusDot');
  const settingStatusText = document.getElementById('settingStatusText');
  const voiceSelect = document.getElementById('voiceSelect');
  const voiceRateSlider = document.getElementById('voiceRateSlider');
  const voicePitchSlider = document.getElementById('voicePitchSlider');
  const rateVal = document.getElementById('rateVal');
  const pitchVal = document.getElementById('pitchVal');
  const autoReadCheckbox = document.getElementById('autoReadCheckbox');

  /* ==========================================================================
     Initialize Application
     ========================================================================== */

  async function initApp() {
    // 1. Initialize 3D Avatar
    initAvatar3D();

    // 2. Check Server & Groq Status
    await checkServerStatus();

    // 3. Load Saved Voice Preferences
    initSpeechSynthesis();

    // 4. Load Chat Sessions from localStorage
    loadChatSessions();

    // 5. Setup Audio Waveform Canvas
    initWaveformCanvas();

    // 6. Bind Event Listeners
    setupEventListeners();
  }

  /* ==========================================================================
     3D Virtual Avatar Initialization
     ========================================================================== */

  function initAvatar3D() {
    try {
      avatar3D = new Avatar3DCompanion('canvas3dContainer');
      avatar3D.setState('IDLE');
    } catch (err) {
      console.warn('3D Avatar initialization warning:', err);
    }
  }

  function setAvatarState(stateName) {
    if (avatar3D && typeof avatar3D.setState === 'function') {
      avatar3D.setState(stateName);
    }
  }

  /* ==========================================================================
     Server & Groq API Key Verification
     ========================================================================== */

  async function checkServerStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      state.hasApiKey = data.has_api_key;

      if (data.has_api_key) {
        serverStatusDot.className = 'status-indicator-dot online';
        settingStatusDot.style.background = '#10b981';
        settingStatusText.textContent = `Groq API Key Configured (${data.api_key_preview})`;
        hudKeyText.textContent = 'Groq Connected';
        hudKeyText.style.color = 'var(--accent-cyan)';
        groqStatusLabel.textContent = 'Groq Engine Ready';
      } else {
        serverStatusDot.className = 'status-indicator-dot offline';
        settingStatusDot.style.background = '#fca311';
        settingStatusText.textContent = 'No Groq API Key configured';
        hudKeyText.textContent = 'Key Missing (Click)';
        hudKeyText.style.color = 'var(--accent-amber)';
        groqStatusLabel.textContent = 'Needs API Key';
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
      settingStatusText.textContent = 'Server offline or unreachable';
    }
  }

  /* ==========================================================================
     Inbuilt Audio Assistant (TTS) & Waveform
     ========================================================================== */

  function initSpeechSynthesis() {
    if (!('speechSynthesis' in window)) {
      console.warn('SpeechSynthesis is not supported in this browser.');
      return;
    }

    const populateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      voiceSelect.innerHTML = '';
      if (!voices.length) return;

      voices.forEach((voice, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${voice.name} (${voice.lang})${voice.default ? ' — Default' : ''}`;
        
        // Prefer natural English voices
        if (!state.selectedVoice && (voice.lang.includes('en-US') || voice.lang.includes('en-GB'))) {
          state.selectedVoice = voice;
          option.selected = true;
        }
        voiceSelect.appendChild(option);
      });
    };

    populateVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = populateVoices;
    }

    voiceSelect.addEventListener('change', (e) => {
      const voices = window.speechSynthesis.getVoices();
      state.selectedVoice = voices[e.target.value];
    });

    voiceRateSlider.addEventListener('input', (e) => {
      state.speechRate = parseFloat(e.target.value);
      rateVal.textContent = `${state.speechRate.toFixed(1)}x`;
    });

    voicePitchSlider.addEventListener('input', (e) => {
      state.speechPitch = parseFloat(e.target.value);
      pitchVal.textContent = `${state.speechPitch.toFixed(1)}`;
    });

    autoReadCheckbox.addEventListener('change', (e) => {
      state.autoSpeak = e.target.checked;
      toggleAudioAssistant(e.target.checked);
    });
  }

  function toggleAudioAssistant(forceState) {
    state.audioAssistantActive = forceState !== undefined ? forceState : !state.audioAssistantActive;

    if (state.audioAssistantActive) {
      audioAssistantToggleBtn.classList.add('active');
      audioStatusPill.className = 'status-pill on';
      audioStatusPill.textContent = 'ON';
      audioCompanionBar.classList.add('active');
      companionSubText.textContent = 'Ready to speak responses';
      startWaveformAnimation();
    } else {
      audioAssistantToggleBtn.classList.remove('active');
      audioStatusPill.className = 'status-pill off';
      audioStatusPill.textContent = 'OFF';
      audioCompanionBar.classList.remove('active');
      stopSpeaking();
    }
  }

  function speakText(text) {
    if (!('speechSynthesis' in window)) return;
    stopSpeaking();

    // Clean markdown formatting before speaking
    const cleanText = text
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[#*_~>]/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    if (state.selectedVoice) utterance.voice = state.selectedVoice;
    utterance.rate = state.speechRate;
    utterance.pitch = state.speechPitch;

    utterance.onstart = () => {
      setAvatarState('SPEAKING');
      audioCompanionBar.classList.add('active');
      companionSubText.textContent = 'Speaking response...';
      startWaveformAnimation(true);
      if (companionBubble) {
        companionBubble.textContent = `"${cleanText.slice(0, 110)}..."`;
      }
    };

    utterance.onend = () => {
      setAvatarState('IDLE');
      companionSubText.textContent = 'Listening / Idle';
      startWaveformAnimation(false);
    };

    utterance.onerror = () => {
      setAvatarState('IDLE');
      startWaveformAnimation(false);
    };

    state.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setAvatarState('IDLE');
    startWaveformAnimation(false);
    companionSubText.textContent = 'Speech paused';
  }

  function initWaveformCanvas() {
    if (!waveformCanvas) return;
    const ctx = waveformCanvas.getContext('2d');
    let step = 0;

    window.drawWave = (isLive) => {
      const w = waveformCanvas.width;
      const h = waveformCanvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.lineWidth = 2;
      ctx.strokeStyle = isLive ? '#00f2fe' : 'rgba(0, 242, 254, 0.25)';
      ctx.beginPath();

      const bars = 24;
      const barWidth = w / bars;

      for (let i = 0; i < bars; i++) {
        const height = isLive 
          ? Math.abs(Math.sin(step + i * 0.4) * (h * 0.75)) + 4 
          : 4;
        const x = i * barWidth + barWidth / 2;
        const y1 = (h - height) / 2;
        const y2 = y1 + height;

        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
      }
      ctx.stroke();
      step += 0.15;
    };

    window.drawWave(false);
  }

  function startWaveformAnimation(isLive = false) {
    if (waveAnimationId) cancelAnimationFrame(waveAnimationId);
    const loop = () => {
      if (window.drawWave) window.drawWave(isLive);
      waveAnimationId = requestAnimationFrame(loop);
    };
    loop();
  }

  /* ==========================================================================
     Voice Input via Groq Whisper API
     ========================================================================== */

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        if (audioChunks.length > 0) {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          await sendAudioForTranscription(audioBlob);
        }
      };

      mediaRecorder.start();
      setAvatarState('LISTENING');
      micBtn.classList.add('recording');
      recordingIndicatorHud.style.display = 'flex';

      recordingSeconds = 0;
      recordingTimer.textContent = '00:00';
      recordingInterval = setInterval(() => {
        recordingSeconds++;
        const mins = String(Math.floor(recordingSeconds / 60)).padStart(2, '0');
        const secs = String(recordingSeconds % 60).padStart(2, '0');
        recordingTimer.textContent = `${mins}:${secs}`;
      }, 1000);

    } catch (err) {
      console.warn('Microphone access issue:', err);
      // Fallback: try Web Speech API Recognition
      startWebSpeechFallback();
    }
  }

  function stopRecording(send = true) {
    if (recordingInterval) clearInterval(recordingInterval);
    recordingIndicatorHud.style.display = 'none';
    micBtn.classList.remove('recording');

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      if (!send) audioChunks = []; // discard
      mediaRecorder.stop();
    }
  }

  async function sendAudioForTranscription(audioBlob) {
    setAvatarState('THINKING');
    promptInput.placeholder = 'Transcribing with Groq Whisper...';

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (data.success && data.text) {
        promptInput.value = data.text;
        autoResizeTextarea();
        promptInput.focus();
        if (companionBubble) companionBubble.textContent = `Heard: "${data.text}"`;
      } else if (data.error) {
        alert(`Transcription error: ${data.error}`);
      }
    } catch (err) {
      console.error('Audio transcription request failed:', err);
    } finally {
      setAvatarState('IDLE');
      promptInput.placeholder = 'Ask anything, describe a problem, upload an image, or speak...';
    }
  }

  function startWebSpeechFallback() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Microphone recording is not permitted or supported in this browser. Please grant mic permissions.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    setAvatarState('LISTENING');
    micBtn.classList.add('recording');

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      promptInput.value = text;
      autoResizeTextarea();
    };

    recognition.onerror = () => {
      setAvatarState('IDLE');
      micBtn.classList.remove('recording');
    };

    recognition.onend = () => {
      setAvatarState('IDLE');
      micBtn.classList.remove('recording');
    };

    recognition.start();
  }

  /* ==========================================================================
     Multimodal Image Attachment (Vision QA)
     ========================================================================== */

  function handleImageUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      state.attachedImageBase64 = e.target.result;
      state.attachedImageName = file.name;

      previewImageThumb.src = e.target.result;
      previewFileName.textContent = file.name;
      attachmentPreviewBar.style.display = 'block';

      // Auto switch model to vision
      modelSelect.value = 'llama-3.2-11b-vision-preview';
      currentModelBadge.textContent = 'Llama 3.2 11B Vision';
    };
    reader.readAsDataURL(file);
  }

  function removeAttachedImage() {
    state.attachedImageBase64 = null;
    state.attachedImageName = '';
    attachmentPreviewBar.style.display = 'none';
    imageFileInput.value = '';
  }

  /* ==========================================================================
     Chat & Groq Streaming Message Flow
     ========================================================================== */

  /* ==========================================================================
     Global Image Helpers: Lightbox, Direct Download & Regenerate
     ========================================================================== */

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  window.openLightbox = function(url, subject) {
    if (!lightboxModal || !lightboxImg) return;
    lightboxImg.src = url;
    if (lightboxTitle) {
      lightboxTitle.innerHTML = `• <strong>Subject:</strong> ${escapeHtml(subject || 'Artwork')}`;
    }
    lightboxModal.classList.add('active');
    if (lightboxDownloadBtn) {
      lightboxDownloadBtn.onclick = () => window.downloadImageDirect(url, subject);
    }
  };

  window.downloadImageDirect = function(url, subject) {
    const safeSub = (subject || 'artwork').replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
    const filename = `nova_${safeSub}.jpg`;
    const proxyUrl = `/api/image-proxy?download=1&filename=${encodeURIComponent(filename)}&url=${encodeURIComponent(url)}`;
    const a = document.createElement('a');
    a.href = proxyUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  window.regenerateImagePrompt = function(subject) {
    if (!subject) return;
    promptInput.value = `create ${subject}`;
    autoResizeTextarea();
    sendMessage();
  };

  async function sendMessage() {
    const text = promptInput.value.trim();
    const hasImage = !!state.attachedImageBase64;

    if (!text && !hasImage) return;
    if (state.isGenerating) return;

    if (!state.hasApiKey) {
      settingsModal.classList.add('active');
      alert('Please enter your Groq API Key to proceed.');
      return;
    }

    // Hide welcome hero on first message
    welcomeHero.style.display = 'none';

    // 1. Append User Message
    const userMessage = {
      role: 'user',
      content: text,
      image: state.attachedImageBase64
    };
    state.messages.push(userMessage);
    renderMessage(userMessage);

    // Clear inputs
    removeAttachedImage();
    promptInput.value = '';
    autoResizeTextarea();

    // 2. Set Assistant Loading State
    state.isGenerating = true;
    setSendingUI(true);
    setAvatarState('THINKING');

    // 3. Create Assistant Message Element
    const assistantMsgObj = { role: 'assistant', content: '', metrics: null };
    const { bubbleEl, cursorEl, footerEl } = createAssistantMessageElement();

    // Multi-turn context window: last 12 messages
    const requestPayload = {
      messages: state.messages.slice(-12),
      model: modelSelect.value,
      mode: state.currentMode,
      stream: true
    };

    currentAbortController = new AbortController();

    try {
      const startTime = performance.now();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
        signal: currentAbortController.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // keep last incomplete chunk

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);
              if (data.replace_loading) {
                fullContent = data.chunk;
              } else if (data.chunk) {
                fullContent += data.chunk;
              }

              // Render raw HTML for image cards/notices, or parsed markdown for text
              if (fullContent.includes('generated-image-card') || fullContent.includes('image-generating-notice')) {
                bubbleEl.innerHTML = fullContent;
              } else {
                bubbleEl.innerHTML = marked.parse(fullContent) + '<span class="streaming-cursor"></span>';
                highlightCodeBlocks(bubbleEl);
              }
              scrollToBottom();

              if (data.done && data.metrics) {
                assistantMsgObj.metrics = data.metrics;
                updateHudMetrics(data.metrics);
              }
              if (data.error) {
                throw new Error(data.error);
              }
            } catch (jsonErr) {
              if (jsonErr.message && !jsonErr.message.includes('JSON')) {
                throw jsonErr;
              }
            }
          }
        }
      }

      // Finalize Assistant Message
      assistantMsgObj.content = fullContent;
      state.messages.push(assistantMsgObj);

      // Render final content
      if (fullContent.includes('generated-image-card')) {
        bubbleEl.innerHTML = fullContent;
      } else {
        bubbleEl.innerHTML = marked.parse(fullContent);
        highlightCodeBlocks(bubbleEl);
      }

      // Populate Footer Actions
      renderMessageFooter(footerEl, assistantMsgObj);

      // Save Session
      saveCurrentSession();

      // Trigger Audio Assistant if active (skip for image cards)
      if (!fullContent.includes('generated-image-card') && (state.audioAssistantActive || state.autoSpeak)) {
        speakText(fullContent);
      } else {
        setAvatarState('IDLE');
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        assistantMsgObj.content = fullContent;
        if (fullContent) {
          state.messages.push(assistantMsgObj);
          bubbleEl.innerHTML = marked.parse(fullContent) + ' <span class="stopped-tag"><em>[Generation stopped]</em></span>';
          renderMessageFooter(footerEl, assistantMsgObj);
        } else {
          bubbleEl.innerHTML = '<span class="stopped-tag"><em>[Generation stopped by user]</em></span>';
        }
      } else {
        console.error('Chat generation error:', err);
        bubbleEl.innerHTML = `<div style="color: var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${err.message}</div>`;
      }
      setAvatarState('IDLE');
    } finally {
      state.isGenerating = false;
      currentAbortController = null;
      setSendingUI(false);
      scrollToBottom();
    }
  }

  function setSendingUI(isSending) {
    if (isSending) {
      sendBtn.style.display = 'none';
      if (stopGenBtn) stopGenBtn.style.display = 'flex';
      sendSpinner.style.display = 'block';
    } else {
      if (stopGenBtn) stopGenBtn.style.display = 'none';
      sendBtn.style.display = 'flex';
      sendBtn.disabled = false;
      sendSpinner.style.display = 'none';
      sendIcon.style.display = 'block';
    }
  }

  function createAssistantMessageElement() {
    const row = document.createElement('div');
    row.className = 'message-row assistant';

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.innerHTML = '<i class="fa-solid fa-robot"></i>';

    const wrap = document.createElement('div');
    wrap.className = 'msg-content-wrap';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = '<span class="streaming-cursor"></span>';

    const footer = document.createElement('div');
    footer.className = 'msg-footer';

    wrap.appendChild(bubble);
    wrap.appendChild(footer);
    row.appendChild(avatar);
    row.appendChild(wrap);

    messagesContainer.appendChild(row);
    scrollToBottom();

    return { bubbleEl: bubble, footerEl: footer };
  }

  function renderMessage(msg) {
    const isUser = msg.role === 'user';
    const row = document.createElement('div');
    row.className = `message-row ${isUser ? 'user' : 'assistant'}`;

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.innerHTML = isUser ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';

    const wrap = document.createElement('div');
    wrap.className = 'msg-content-wrap';

    // If user attached an image
    if (isUser && msg.image) {
      const imgWrap = document.createElement('div');
      imgWrap.className = 'user-msg-image-wrap';
      const img = document.createElement('img');
      img.src = msg.image;
      img.alt = 'Uploaded context';
      imgWrap.appendChild(img);
      wrap.appendChild(imgWrap);
    }

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    if (isUser) {
      bubble.textContent = msg.content;
    } else {
      if (msg.content && msg.content.includes('generated-image-card')) {
        bubble.innerHTML = msg.content;
      } else {
        bubble.innerHTML = marked.parse(msg.content || '');
        highlightCodeBlocks(bubble);
      }
    }
    wrap.appendChild(bubble);

    if (!isUser) {
      const footer = document.createElement('div');
      footer.className = 'msg-footer';
      renderMessageFooter(footer, msg);
      wrap.appendChild(footer);
    }

    row.appendChild(avatar);
    row.appendChild(wrap);
    messagesContainer.appendChild(row);
  }

  function renderMessageFooter(footerEl, msg) {
    footerEl.innerHTML = '';
    // Skip extra buttons if message is already an interactive image card
    if (msg.content && msg.content.includes('generated-image-card')) {
      return;
    }

    const actions = document.createElement('div');
    actions.className = 'msg-actions';

    // Copy Button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'msg-action-btn';
    copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(msg.content);
      copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
      setTimeout(() => copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy', 2000);
    });

    // Speak / Listen TTS Button
    const listenBtn = document.createElement('button');
    listenBtn.className = 'msg-action-btn';
    listenBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Listen';
    listenBtn.addEventListener('click', () => {
      speakText(msg.content);
    });

    actions.appendChild(copyBtn);
    actions.appendChild(listenBtn);
    footerEl.appendChild(actions);

    if (msg.metrics) {
      const metricSpan = document.createElement('span');
      metricSpan.innerHTML = `<i class="fa-solid fa-bolt"></i> ${msg.metrics.tokens_per_sec} tok/s &bull; ${msg.metrics.elapsed_sec}s`;
      footerEl.appendChild(metricSpan);
    }
  }

  function highlightCodeBlocks(container) {
    container.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);

      // Avoid duplicating code header
      if (block.parentElement.parentElement.classList.contains('code-block-wrapper')) return;

      const pre = block.parentElement;
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';

      const lang = block.className.replace('hljs language-', '').replace('hljs', '').trim() || 'code';
      const header = document.createElement('div');
      header.className = 'code-header';
      header.innerHTML = `
        <span><i class="fa-solid fa-code"></i> ${lang}</span>
        <button class="copy-code-btn" type="button">
          <i class="fa-regular fa-copy"></i> Copy Code
        </button>
      `;

      header.querySelector('.copy-code-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(block.innerText);
        const btn = header.querySelector('.copy-code-btn');
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        setTimeout(() => btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy Code', 2000);
      });

      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);
    });
  }

  function updateHudMetrics(metrics) {
    if (metrics.tokens_per_sec) hudSpeed.textContent = `~${metrics.tokens_per_sec} tok/s`;
    if (metrics.elapsed_sec) hudLatency.textContent = `${metrics.elapsed_sec}s`;
  }

  function scrollToBottom() {
    chatScrollContainer.scrollTop = chatScrollContainer.scrollHeight;
  }

  function autoResizeTextarea() {
    promptInput.style.height = 'auto';
    promptInput.style.height = Math.min(promptInput.scrollHeight, 180) + 'px';
  }

  /* ==========================================================================
     Chat Session Persistence (localStorage)
     ========================================================================== */

  function loadChatSessions() {
    try {
      const stored = localStorage.getItem('nova_chat_sessions');
      state.sessions = stored ? JSON.parse(stored) : [];
      renderHistoryList();
    } catch (e) {
      state.sessions = [];
    }
  }

  function saveCurrentSession() {
    if (!state.messages.length) return;

    const firstMsg = state.messages.find(m => m.role === 'user');
    const title = firstMsg ? (firstMsg.content.slice(0, 32) || 'Vision Analysis') : 'Chat Session';

    if (!state.activeSessionId) {
      state.activeSessionId = 'sess_' + Date.now();
      state.sessions.unshift({
        id: state.activeSessionId,
        title: title,
        date: new Date().toLocaleDateString(),
        messages: state.messages
      });
    } else {
      const existing = state.sessions.find(s => s.id === state.activeSessionId);
      if (existing) {
        existing.messages = state.messages;
      }
    }

    localStorage.setItem('nova_chat_sessions', JSON.stringify(state.sessions));
    renderHistoryList();
  }

  function renderHistoryList() {
    historyList.innerHTML = '';
    state.sessions.forEach((sess) => {
      const item = document.createElement('div');
      item.className = `history-item ${sess.id === state.activeSessionId ? 'active' : ''}`;
      item.innerHTML = `
        <span><i class="fa-regular fa-message"></i> ${sess.title}</span>
        <button class="delete-chat-btn" title="Delete session"><i class="fa-solid fa-xmark"></i></button>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.delete-chat-btn')) return;
        loadSession(sess.id);
      });

      item.querySelector('.delete-chat-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSession(sess.id);
      });

      historyList.appendChild(item);
    });
  }

  function loadSession(id) {
    const session = state.sessions.find(s => s.id === id);
    if (!session) return;

    state.activeSessionId = session.id;
    state.messages = session.messages || [];
    messagesContainer.innerHTML = '';

    if (state.messages.length > 0) {
      welcomeHero.style.display = 'none';
      state.messages.forEach(msg => renderMessage(msg));
    } else {
      welcomeHero.style.display = 'flex';
    }

    renderHistoryList();
    scrollToBottom();
  }

  function deleteSession(id) {
    state.sessions = state.sessions.filter(s => s.id !== id);
    localStorage.setItem('nova_chat_sessions', JSON.stringify(state.sessions));

    if (state.activeSessionId === id) {
      startNewChat();
    } else {
      renderHistoryList();
    }
  }

  function startNewChat() {
    state.activeSessionId = null;
    state.messages = [];
    messagesContainer.innerHTML = '';
    welcomeHero.style.display = 'flex';
    removeAttachedImage();
    stopSpeaking();
    renderHistoryList();
  }

  /* ==========================================================================
     AI Image Studio Logic
     ========================================================================== */

  async function generateAIImage() {
    const prompt = imagePromptInput.value.trim();
    if (!prompt) {
      alert('Please enter a description for your image.');
      return;
    }

    // Immediate clean reset of previous render state
    generatedResultImg.src = '';
    generatedResultImg.style.display = 'none';
    emptyImagePreview.style.display = 'none';
    if (imageStudioError) imageStudioError.style.display = 'none';
    if (studioSubjectMeta) studioSubjectMeta.style.display = 'none';
    imageGeneratingSpinner.style.display = 'flex';
    imageActionsBar.style.display = 'none';
    generateArtBtn.disabled = true;

    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          style: selectedImageStyle,
          aspect_ratio: selectedAspectRatio
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to generate image.');

      // Load actual diffusion generated image
      const img = new Image();
      img.onload = () => {
        imageGeneratingSpinner.style.display = 'none';
        generatedResultImg.src = img.src;
        generatedResultImg.style.display = 'block';

        const subjectStr = data.subject || prompt;
        if (studioSubjectText) studioSubjectText.textContent = subjectStr;
        if (studioSubjectMeta) studioSubjectMeta.style.display = 'block';

        if (studioViewFullBtn) {
          studioViewFullBtn.onclick = () => window.openLightbox(img.src, subjectStr);
        }
        if (studioDownloadBtn) {
          studioDownloadBtn.onclick = () => window.downloadImageDirect(img.src, subjectStr);
        }
        if (studioRegenBtn) {
          studioRegenBtn.onclick = () => generateAIImage();
        }

        imageActionsBar.style.display = 'flex';
        generateArtBtn.disabled = false;
      };

      img.onerror = () => {
        imageGeneratingSpinner.style.display = 'none';
        if (imageStudioError) {
          if (imageStudioErrorText) {
            imageStudioErrorText.textContent = 'Could not load generated image from rendering engine. Please try again.';
          }
          imageStudioError.style.display = 'flex';
        }
        emptyImagePreview.style.display = 'block';
        generateArtBtn.disabled = false;
      };

      img.src = data.image_url;

    } catch (err) {
      imageGeneratingSpinner.style.display = 'none';
      if (imageStudioError) {
        if (imageStudioErrorText) {
          imageStudioErrorText.textContent = `Generation failed: ${err.message}`;
        }
        imageStudioError.style.display = 'flex';
      }
      emptyImagePreview.style.display = 'block';
      generateArtBtn.disabled = false;
    }
  }

  /* ==========================================================================
     Event Listeners Setup
     ========================================================================== */

  function setupEventListeners() {
    // Textarea Auto-expand & Enter Key
    promptInput.addEventListener('input', autoResizeTextarea);
    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    sendBtn.addEventListener('click', sendMessage);

    // Model Selector Change
    modelSelect.addEventListener('change', (e) => {
      state.selectedModel = e.target.value;
      const text = e.target.options[e.target.selectedIndex].text.split('(')[0].trim();
      currentModelBadge.textContent = text;
    });

    // Problem-Solving Mode Chips
    document.querySelectorAll('.mode-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.mode-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.currentMode = chip.dataset.mode;
      });
    });

    // Sidebar Mobile Toggle
    sidebarToggleBtn.addEventListener('click', () => appSidebar.classList.add('open'));
    sidebarCloseBtn.addEventListener('click', () => appSidebar.classList.remove('open'));
    newChatBtn.addEventListener('click', startNewChat);

    // Clear All History
    clearHistoryBtn.addEventListener('click', () => {
      if (confirm('Clear all conversation history?')) {
        state.sessions = [];
        localStorage.removeItem('nova_chat_sessions');
        startNewChat();
      }
    });

    // Export Chat
    exportChatBtn.addEventListener('click', () => {
      if (!state.messages.length) {
        alert('No conversation to export.');
        return;
      }
      let md = `# Nova AI Conversation Export\nDate: ${new Date().toLocaleString()}\n\n---\n\n`;
      state.messages.forEach((m) => {
        md += `### ${m.role === 'user' ? 'User' : 'Nova AI'}\n${m.content}\n\n`;
      });
      const blob = new Blob([md], { type: 'text/markdown' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `nova-chat-${Date.now()}.md`;
      a.click();
    });

    // Hero Prompt Cards Click
    document.querySelectorAll('.hero-card').forEach((card) => {
      card.addEventListener('click', () => {
        if (card.id === 'heroVisionCard') {
          imageFileInput.click();
        } else if (card.id === 'heroImageGenCard') {
          imageStudioModal.classList.add('active');
        } else if (card.dataset.prompt) {
          promptInput.value = card.dataset.prompt;
          autoResizeTextarea();
          sendMessage();
        }
      });
    });

    // Attach Image (File Picker & Paste)
    attachImageBtn.addEventListener('click', () => imageFileInput.click());
    imageFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleImageUpload(e.target.files[0]);
      }
    });
    removeAttachmentBtn.addEventListener('click', removeAttachedImage);

    // Clipboard Paste for Images
    window.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          handleImageUpload(blob);
          break;
        }
      }
    });

    // Voice Recording (Groq Whisper)
    micBtn.addEventListener('click', () => {
      if (micBtn.classList.contains('recording')) {
        stopRecording(true);
      } else {
        startRecording();
      }
    });

    cancelRecordingBtn.addEventListener('click', () => stopRecording(false));
    doneRecordingBtn.addEventListener('click', () => stopRecording(true));

    // Inbuilt Audio Assistant Toggle
    audioAssistantToggleBtn.addEventListener('click', () => toggleAudioAssistant());
    stopSpeechBtn.addEventListener('click', stopSpeaking);
    closeAudioBarBtn.addEventListener('click', () => toggleAudioAssistant(false));

    // 3D Virtual Pop-up Chatbot Controls
    const toggle3DWindow = () => {
      popup3dWindow.classList.toggle('active');
      if (popup3dWindow.classList.contains('active') && avatar3D) {
        setTimeout(() => avatar3D.onResize(), 100);
      }
    };

    floating3dLauncher.addEventListener('click', toggle3DWindow);
    headerAvatarBtn.addEventListener('click', toggle3DWindow);
    open3dCompanionBtn.addEventListener('click', toggle3DWindow);
    minimize3dBtn.addEventListener('click', () => popup3dWindow.classList.remove('active'));
    close3dBtn.addEventListener('click', () => popup3dWindow.classList.remove('active'));

    // 3D Companion Quick Action Chips
    document.querySelectorAll('.companion-quick-actions .chip-action').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.id === 'companionVoiceToggle') {
          micBtn.click();
        } else if (btn.dataset.ask) {
          promptInput.value = btn.dataset.ask;
          autoResizeTextarea();
          sendMessage();
        }
      });
    });

    // AI Image Studio Modal
    const openStudio = () => imageStudioModal.classList.add('active');
    openImageStudioBtn.addEventListener('click', openStudio);
    quickArtBtn.addEventListener('click', openStudio);
    closeImageStudioBtn.addEventListener('click', () => imageStudioModal.classList.remove('active'));

    // Style & Aspect Ratio Buttons
    document.querySelectorAll('.style-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedImageStyle = btn.dataset.style;
      });
    });

    document.querySelectorAll('.ratio-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedAspectRatio = btn.dataset.ratio;
      });
    });

    // Stop Generation Button
    if (stopGenBtn) {
      stopGenBtn.addEventListener('click', () => {
        if (currentAbortController) {
          currentAbortController.abort();
        }
      });
    }

    // Lightbox Modal Controls
    if (closeLightboxBtn) {
      closeLightboxBtn.addEventListener('click', () => {
        lightboxModal.classList.remove('active');
        lightboxImg.src = '';
      });
    }
    if (lightboxModal) {
      lightboxModal.addEventListener('click', (e) => {
        if (e.target === lightboxModal) {
          lightboxModal.classList.remove('active');
          lightboxImg.src = '';
        }
      });
    }
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightboxModal && lightboxModal.classList.contains('active')) {
        lightboxModal.classList.remove('active');
        lightboxImg.src = '';
      }
    });

    generateArtBtn.addEventListener('click', generateAIImage);

    insertArtToChatBtn.addEventListener('click', () => {
      const url = generatedResultImg.src;
      if (!url) return;
      imageStudioModal.classList.remove('active');
      welcomeHero.style.display = 'none';

      const subject = (studioSubjectText && studioSubjectText.textContent) ? studioSubjectText.textContent : (imagePromptInput.value || 'AI Artwork');
      const cardHtml = `
<div class="generated-image-card" data-subject="${escapeHtml(subject)}" data-image-url="${url}">
  <div class="image-wrapper">
    <img src="${url}" alt="${escapeHtml(subject)}" class="chat-generated-img" />
  </div>
  <div class="image-card-meta">
    <span class="image-subject-label">• <strong>Subject:</strong> ${escapeHtml(subject)}</span>
    <div class="image-card-actions">
      <button type="button" class="img-btn view-full-btn" onclick="window.openLightbox('${url}', '${escapeHtml(subject)}')">
        <i class="fa-solid fa-expand"></i> View Full Image
      </button>
      <button type="button" class="img-btn download-img-btn" onclick="window.downloadImageDirect('${url}', '${escapeHtml(subject)}')">
        <i class="fa-solid fa-download"></i> Download Image
      </button>
      <button type="button" class="img-btn regen-img-btn" onclick="window.regenerateImagePrompt('${escapeHtml(subject)}')">
        <i class="fa-solid fa-rotate"></i> Regenerate
      </button>
    </div>
  </div>
</div>`;
      const assistantMsg = {
        role: 'assistant',
        content: cardHtml,
        metrics: { tokens_per_sec: 250, elapsed_sec: 0.4 }
      };
      state.messages.push(assistantMsg);
      renderMessage(assistantMsg);
      saveCurrentSession();
      scrollToBottom();
    });

    // Settings Modal
    const openSettings = () => settingsModal.classList.add('active');
    openSettingsBtn.addEventListener('click', openSettings);
    navSettingsBtn.addEventListener('click', openSettings);
    apiKeyStatusHud.addEventListener('click', openSettings);
    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('active'));

    toggleApiKeyVisBtn.addEventListener('click', () => {
      const type = groqApiKeyInput.type === 'password' ? 'text' : 'password';
      groqApiKeyInput.type = type;
      toggleApiKeyVisBtn.innerHTML = type === 'password' ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
    });

    verifyKeyBtn.addEventListener('click', async () => {
      const key = groqApiKeyInput.value.trim();
      if (!key) {
        alert('Please enter a Groq API key.');
        return;
      }
      verifyKeyBtn.textContent = 'Verifying...';
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: key })
        });
        const data = await res.json();
        if (data.success) {
          alert('Groq API Key verified and saved successfully!');
          settingsModal.classList.remove('active');
          await checkServerStatus();
        } else {
          alert(`Validation failed: ${data.error}`);
        }
      } catch (err) {
        alert(`Request failed: ${err.message}`);
      } finally {
        verifyKeyBtn.textContent = 'Verify & Save Key';
      }
    });

    // Scroll Bottom Button
    chatScrollContainer.addEventListener('scroll', () => {
      const distFromBottom = chatScrollContainer.scrollHeight - chatScrollContainer.scrollTop - chatScrollContainer.clientHeight;
      if (distFromBottom > 150) {
        scrollBottomBtn.classList.add('visible');
      } else {
        scrollBottomBtn.classList.remove('visible');
      }
    });

    scrollBottomBtn.addEventListener('click', scrollToBottom);
  }

  // Launch app
  initApp();
});
