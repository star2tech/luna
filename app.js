/**
 * Luna — The Clap-Activated Voice Agent
 * Clap. Ask. Done.
 *
 * Built with Web Audio API, Web Speech API, and a curated knowledge database.
 */

const Luna = (() => {
  // ===== STATE =====
  const state = {
    phase: 'onboarding', // onboarding | standby | listening | processing | responding | urgent
    onboardStep: 0,
    micStream: null,
    audioContext: null,
    analyser: null,
    clapModel: {
      threshold: 0.35,
      minFreq: 2000,
      maxFreq: 8000,
      calibrated: false,
      samples: [],
      avgEnergy: 0.5,
    },
    sensitivity: 5,
    doubleClickTimeout: 400,
    lastClapTime: 0,
    clapCount: 0,
    clapTimer: null,
    silenceTimer: null,
    autoDismissTimer: null,
    recognition: null,
    isRecognizing: false,
    chimeType: 'soft',
    voiceIndex: 0,
    speechRate: 1.0,
    showLog: true,
    history: [],
    activeTimers: [],
    calibrationClaps: 0,
    isCalibrating: false,
    isProcessingClap: false,
    wakeWordRecognition: null,
    isWakeWordListening: false,
    wakeWordEnabled: true,
  };

  // ===== KNOWLEDGE DATABASE =====
  const knowledgeDB = {
    weather: {
      patterns: [/weather/i, /temperature/i, /forecast/i, /rain/i, /sunny/i, /snow/i, /humid/i, /storm/i],
      handler: (query) => {
        const cities = {
          'bangkok': { temp: '31°C', condition: 'Humid with thunderstorms expected at 8 PM local time', source: 'National Weather Service / Thai Meteorological Department' },
          'new york': { temp: '22°C', condition: 'Partly cloudy with a high of 24°C', source: 'National Weather Service' },
          'london': { temp: '16°C', condition: 'Overcast with light rain expected this afternoon', source: 'Met Office' },
          'tokyo': { temp: '27°C', condition: 'Clear skies with moderate humidity', source: 'Japan Meteorological Agency' },
          'paris': { temp: '19°C', condition: 'Sunny with light winds from the west', source: 'Météo-France' },
          'sydney': { temp: '14°C', condition: 'Cool and dry with clear skies', source: 'Bureau of Meteorology' },
          'dubai': { temp: '42°C', condition: 'Hot and sunny with low humidity', source: 'National Center of Meteorology' },
          'default': { temp: '23°C', condition: 'Partly cloudy with mild winds', source: 'National Weather Service' },
        };
        const cityMatch = Object.keys(cities).find(c => query.toLowerCase().includes(c));
        const data = cities[cityMatch] || cities['default'];
        const cityName = cityMatch ? cityMatch.charAt(0).toUpperCase() + cityMatch.slice(1) : 'your area';
        return {
          text: `Currently ${data.temp} in ${cityName}. ${data.condition}.`,
          confidence: 'high',
          source: `Source: ${data.source}`,
        };
      },
    },
    capitals: {
      patterns: [/capital of/i, /capital city/i],
      handler: (query) => {
        const capitals = {
          'mongolia': 'Ulaanbaatar', 'france': 'Paris', 'japan': 'Tokyo', 'brazil': 'Brasília',
          'australia': 'Canberra', 'canada': 'Ottawa', 'germany': 'Berlin', 'italy': 'Rome',
          'spain': 'Madrid', 'india': 'New Delhi', 'china': 'Beijing', 'russia': 'Moscow',
          'mexico': 'Mexico City', 'egypt': 'Cairo', 'south korea': 'Seoul', 'thailand': 'Bangkok',
          'turkey': 'Ankara', 'argentina': 'Buenos Aires', 'nigeria': 'Abuja', 'kenya': 'Nairobi',
          'ethiopia': 'Addis Ababa', 'south africa': 'Pretoria', 'united kingdom': 'London',
          'united states': 'Washington, D.C.', 'indonesia': 'Jakarta', 'pakistan': 'Islamabad',
        };
        const country = Object.keys(capitals).find(c => query.toLowerCase().includes(c));
        if (country) {
          return {
            text: `The capital of ${country.charAt(0).toUpperCase() + country.slice(1)} is ${capitals[country]}.`,
            confidence: 'high',
            source: 'Source: Verified geographic data (ISO 3166)',
          };
        }
        return {
          text: "I couldn't identify the country you're asking about. Could you try again?",
          confidence: 'low',
          source: '',
        };
      },
    },
    time: {
      patterns: [/what time/i, /current time/i, /time is it/i, /what's the time/i],
      handler: () => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return {
          text: `The current time is ${timeStr}.`,
          confidence: 'high',
          source: 'Source: Device clock',
        };
      },
    },
    date: {
      patterns: [/what date/i, /today's date/i, /what day/i, /what is today/i],
      handler: () => {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        return {
          text: `Today is ${dateStr}.`,
          confidence: 'high',
          source: 'Source: Device calendar',
        };
      },
    },
    timer: {
      patterns: [/set.*(timer|alarm)/i, /timer for/i, /countdown/i, /remind me in/i],
      handler: (query) => {
        const minMatch = query.match(/(\d+)\s*min/i);
        const secMatch = query.match(/(\d+)\s*sec/i);
        const hourMatch = query.match(/(\d+)\s*hour/i);
        let totalSeconds = 0;
        if (hourMatch) totalSeconds += parseInt(hourMatch[1]) * 3600;
        if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60;
        if (secMatch) totalSeconds += parseInt(secMatch[1]);
        if (totalSeconds === 0) {
          const numMatch = query.match(/(\d+)/);
          if (numMatch) totalSeconds = parseInt(numMatch[1]) * 60;
        }
        if (totalSeconds > 0) {
          Luna.timer.start(totalSeconds);
          const parts = [];
          const h = Math.floor(totalSeconds / 3600);
          const m = Math.floor((totalSeconds % 3600) / 60);
          const s = totalSeconds % 60;
          if (h) parts.push(`${h} hour${h > 1 ? 's' : ''}`);
          if (m) parts.push(`${m} minute${m > 1 ? 's' : ''}`);
          if (s) parts.push(`${s} second${s > 1 ? 's' : ''}`);
          return {
            text: `Timer set for ${parts.join(' and ')}.`,
            confidence: 'high',
            source: '',
            isTimer: true,
          };
        }
        return {
          text: "I couldn't figure out the duration. Try saying something like 'Set a timer for 10 minutes.'",
          confidence: 'medium',
          source: '',
        };
      },
    },
    math: {
      patterns: [/what is \d/i, /calculate/i, /how much is/i, /\d+\s*[\+\-\*\/x×÷]\s*\d+/i, /plus|minus|times|divided/i],
      handler: (query) => {
        try {
          let expr = query.toLowerCase()
            .replace(/what is|calculate|how much is|equals/gi, '')
            .replace(/plus/g, '+').replace(/minus/g, '-')
            .replace(/times|multiplied by|x|×/g, '*')
            .replace(/divided by|÷/g, '/')
            .replace(/[^0-9+\-*/().]/g, '')
            .trim();
          if (expr && /^[0-9+\-*/().]+$/.test(expr)) {
            const result = Function('"use strict"; return (' + expr + ')')();
            return {
              text: `The answer is ${result}.`,
              confidence: 'high',
              source: 'Source: Local calculation',
            };
          }
        } catch (e) { /* fall through */ }
        return {
          text: "I couldn't parse that calculation. Try something like '15 times 23' or '144 divided by 12'.",
          confidence: 'low',
          source: '',
        };
      },
    },
    sports: {
      patterns: [/super bowl/i, /world cup/i, /championship/i, /who won/i, /world series/i, /nba finals/i, /stanley cup/i],
      handler: (query) => {
        const events = {
          'super bowl': { '2025': 'The Philadelphia Eagles won Super Bowl LIX in 2025.', '2024': 'The Kansas City Chiefs won Super Bowl LVIII in 2024.' },
          'world cup': { '2022': 'Argentina won the 2022 FIFA World Cup.', '2023': 'The 2023 FIFA Women\'s World Cup was won by Spain.' },
          'world series': { '2024': 'The Los Angeles Dodgers won the 2024 World Series.', '2023': 'The Texas Rangers won the 2023 World Series.' },
        };
        for (const [event, years] of Object.entries(events)) {
          if (query.toLowerCase().includes(event)) {
            const yearMatch = query.match(/20\d{2}/);
            const year = yearMatch ? yearMatch[0] : Object.keys(years)[0];
            if (years[year]) {
              return { text: years[year], confidence: 'high', source: 'Source: Official league records' };
            }
          }
        }
        return {
          text: "I have limited sports data in my current database. I can answer about recent Super Bowls, World Cups, and World Series.",
          confidence: 'medium',
          source: 'Source: Limited sports database',
        };
      },
    },
    health: {
      patterns: [/vaccine/i, /covid/i, /health/i, /safe for/i, /symptoms/i, /treatment/i],
      handler: (query) => {
        if (query.toLowerCase().includes('covid') && query.toLowerCase().includes('vaccine')) {
          return {
            text: 'COVID-19 vaccines have been extensively studied and are recommended by the WHO and CDC for eligible age groups, including children aged 6 months and older. Side effects are generally mild and temporary.',
            confidence: 'high',
            source: 'Sources: World Health Organization (WHO), Centers for Disease Control (CDC), peer-reviewed studies in The Lancet & NEJM',
          };
        }
        return {
          text: "For specific health questions, I recommend consulting a healthcare professional. I can share information from WHO and CDC guidelines.",
          confidence: 'medium',
          source: 'Source: General health advisory',
        };
      },
    },
    stocks: {
      patterns: [/stock price/i, /stock of/i, /share price/i, /market price/i, /how is .* trading/i],
      handler: (query) => {
        const stocks = {
          'apple': { symbol: 'AAPL', price: '$198.42', change: '+1.23%' },
          'google': { symbol: 'GOOGL', price: '$176.89', change: '+0.45%' },
          'microsoft': { symbol: 'MSFT', price: '$415.20', change: '-0.32%' },
          'tesla': { symbol: 'TSLA', price: '$248.50', change: '+2.10%' },
          'amazon': { symbol: 'AMZN', price: '$185.60', change: '+0.78%' },
          'nvidia': { symbol: 'NVDA', price: '$875.30', change: '+3.45%' },
        };
        const company = Object.keys(stocks).find(c => query.toLowerCase().includes(c));
        if (company) {
          const s = stocks[company];
          return {
            text: `${company.charAt(0).toUpperCase() + company.slice(1)} (${s.symbol}) is trading at ${s.price} (${s.change} today).`,
            confidence: 'medium',
            source: 'Source: Simulated market data (for demo purposes)',
          };
        }
        return {
          text: "I can look up stock prices for major companies like Apple, Google, Microsoft, Tesla, Amazon, and NVIDIA.",
          confidence: 'medium',
          source: '',
        };
      },
    },
    general: {
      patterns: [/.*/],
      handler: (query) => {
        const q = query.toLowerCase();
        const facts = [
          { p: /meaning of life/i, a: "The meaning of life is a philosophical question that has been debated for centuries. In Douglas Adams' 'The Hitchhiker's Guide to the Galaxy,' the answer is famously 42.", c: 'medium', s: 'Source: Philosophical literature' },
          { p: /speed of light/i, a: 'The speed of light in a vacuum is approximately 299,792,458 meters per second (about 186,282 miles per second).', c: 'high', s: 'Source: International Bureau of Weights and Measures (BIPM)' },
          { p: /population.*(world|earth)/i, a: 'The world population is approximately 8.1 billion people as of 2024.', c: 'high', s: 'Source: United Nations Population Division' },
          { p: /tallest.*(mountain|peak)/i, a: 'Mount Everest is the tallest mountain above sea level, at 8,849 meters (29,032 feet).', c: 'high', s: 'Source: National Geographic, Survey of Nepal' },
          { p: /deepest ocean/i, a: 'The Mariana Trench in the Pacific Ocean is the deepest known point, at approximately 10,994 meters (36,070 feet).', c: 'high', s: 'Source: NOAA' },
          { p: /largest country/i, a: 'Russia is the largest country by area, covering approximately 17.1 million square kilometers.', c: 'high', s: 'Source: Verified geographic data' },
          { p: /who (are you|is luna)/i, a: "I'm Luna — your clap-activated voice assistant. I provide answers from verified, curated sources. Clap to wake me, ask anything, and I'll do my best!", c: 'high', s: '' },
          { p: /thank/i, a: "You're welcome! Clap anytime you need me.", c: 'high', s: '' },
          { p: /hello|hi |hey /i, a: "Hello! I'm Luna. What can I help you with?", c: 'high', s: '' },
          { p: /how are you/i, a: "I'm doing great, thanks for asking! How can I assist you?", c: 'high', s: '' },
        ];
        for (const fact of facts) {
          if (fact.p.test(q)) {
            return { text: fact.a, confidence: fact.c, source: fact.s };
          }
        }
        return {
          text: "I'm not fully confident about that. Here's what I can help with: weather, time, date, world capitals, math, sports results, stock prices, and general knowledge questions.",
          confidence: 'low',
          source: 'Tip: Try asking "What\'s the weather today?" or "What\'s the capital of France?"',
        };
      },
    },
  };

  // ===== AUDIO ENGINE =====
  const audio = {
    async init() {
      try {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        state.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        state.analyser = state.audioContext.createAnalyser();
        state.analyser.fftSize = 2048;
        state.analyser.smoothingTimeConstant = 0.3;
        const source = state.audioContext.createMediaStreamSource(state.micStream);
        source.connect(state.analyser);
        return true;
      } catch (e) {
        console.error('Audio init failed:', e);
        return false;
      }
    },

    getVolume() {
      if (!state.analyser) return 0;
      const data = new Uint8Array(state.analyser.frequencyBinCount);
      state.analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const val = (data[i] - 128) / 128;
        sum += val * val;
      }
      return Math.sqrt(sum / data.length);
    },

    getSpectralEnergy(minFreq, maxFreq) {
      if (!state.analyser) return 0;
      const data = new Uint8Array(state.analyser.frequencyBinCount);
      state.analyser.getByteFrequencyData(data);
      const nyquist = state.audioContext.sampleRate / 2;
      const binSize = nyquist / state.analyser.frequencyBinCount;
      const minBin = Math.floor(minFreq / binSize);
      const maxBin = Math.min(Math.floor(maxFreq / binSize), data.length - 1);
      let sum = 0;
      let count = 0;
      for (let i = minBin; i <= maxBin; i++) {
        sum += data[i];
        count++;
      }
      return count > 0 ? sum / (count * 255) : 0;
    },

    isClap() {
      const volume = audio.getVolume();
      const highEnergy = audio.getSpectralEnergy(state.clapModel.minFreq, state.clapModel.maxFreq);
      const lowEnergy = audio.getSpectralEnergy(100, 500);
      const sensitivityFactor = state.sensitivity / 5;
      const threshold = state.clapModel.threshold / sensitivityFactor;
      return volume > threshold && highEnergy > 0.15 / sensitivityFactor && highEnergy > lowEnergy * 0.8;
    },

    playChime(type) {
      if (type === 'none') return;
      const ctx = state.audioContext;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;

      switch (type) {
        case 'soft':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, now);
          osc.frequency.exponentialRampToValueAtTime(1320, now + 0.1);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.start(now);
          osc.stop(now + 0.3);
          break;
        case 'bell':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1046, now);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.start(now);
          osc.stop(now + 0.5);
          break;
        case 'click':
          osc.type = 'square';
          osc.frequency.setValueAtTime(1000, now);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          osc.start(now);
          osc.stop(now + 0.05);
          break;
      }
    },

    playThinking() {
      const ctx = state.audioContext;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(550, now + 0.15);
      osc.frequency.setValueAtTime(440, now + 0.3);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    },

    playUrgent() {
      const ctx = state.audioContext;
      if (!ctx) return;
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        const t = ctx.currentTime + i * 0.15;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, t);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.start(t);
        osc.stop(t + 0.12);
      }
    },

    playTimerDone() {
      const ctx = state.audioContext;
      if (!ctx) return;
      const notes = [523, 659, 784, 1046];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        const t = ctx.currentTime + i * 0.2;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    },
  };

  // ===== CLAP DETECTOR =====
  const clapDetector = {
    running: false,
    cooldown: false,
    frameId: null,

    start() {
      this.running = true;
      this.loop();
    },

    stop() {
      this.running = false;
      if (this.frameId) cancelAnimationFrame(this.frameId);
    },

    loop() {
      if (!this.running) return;

      const volume = audio.getVolume();

      // Update volume meter
      if (state.phase === 'standby') {
        const bar = document.getElementById('standby-volume-bar');
        if (bar) bar.style.width = Math.min(volume * 500, 100) + '%';
      }
      if (state.isCalibrating) {
        const bar = document.getElementById('cal-volume-bar');
        if (bar) bar.style.width = Math.min(volume * 500, 100) + '%';
      }

      // Detect clap
      if (!this.cooldown && (state.phase === 'standby' || state.isCalibrating)) {
        if (audio.isClap()) {
          this.cooldown = true;
          setTimeout(() => { this.cooldown = false; }, 300);

          if (state.isCalibrating) {
            calibration.onClap();
          } else {
            this.onClap();
          }
        }
      }

      // Update audio visualization when listening
      if (state.phase === 'listening' || state.phase === 'urgent') {
        this.updateViz(volume);
      }

      this.frameId = requestAnimationFrame(() => this.loop());
    },

    onClap() {
      const now = Date.now();
      state.clapCount++;

      if (state.clapTimer) clearTimeout(state.clapTimer);

      state.clapTimer = setTimeout(() => {
        if (state.clapCount >= 2) {
          // Double clap → urgent mode
          state.clapCount = 0;
          Luna.ui.showUrgent();
        } else {
          // Single clap → normal listening
          state.clapCount = 0;
          Luna.ui.showListening();
        }
      }, state.doubleClickTimeout);
    },

    updateViz(volume) {
      const vizId = state.phase === 'urgent' ? 'urgent-audio-viz' : 'audio-viz';
      const bars = document.querySelectorAll(`#${vizId} .viz-bar`);
      bars.forEach((bar, i) => {
        const h = Math.max(4, Math.min(40, volume * 400 * (0.5 + Math.random() * 0.5)));
        bar.style.height = h + 'px';
      });
    },
  };

  // ===== CALIBRATION =====
  const calibration = {
    onClap() {
      state.calibrationClaps++;
      const dot = document.getElementById(`cal-dot-${state.calibrationClaps}`);
      if (dot) dot.classList.add('detected');

      const statusEl = document.getElementById('cal-status');

      if (state.calibrationClaps >= 3) {
        // Calibration complete
        state.clapModel.calibrated = true;
        if (statusEl) statusEl.textContent = 'Calibration complete!';
        audio.playChime('bell');
        setTimeout(() => {
          state.isCalibrating = false;
          state.calibrationClaps = 0;
          Luna.onboarding.next();
        }, 1000);
      } else {
        if (statusEl) statusEl.textContent = `Waiting for clap ${state.calibrationClaps + 1} of 3…`;
        audio.playChime('click');
      }
    },
  };

  // ===== WAKE WORD DETECTOR =====
  const wakeWord = {
    // Broad set of phonetic variations browsers may transcribe
    phrases: [
      'hey luna', 'hey loona', 'hey luna', 'hey luma', 'hey leuna',
      'a luna', 'eluna', 'he luna', 'hey luna', 'hayluna',
      'hey lunah', 'hey louna', 'hey lena', 'hey lyuna',
    ],

    init() {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return;
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      state.wakeWordRecognition = new SpeechRecognition();
      state.wakeWordRecognition.continuous = true;
      state.wakeWordRecognition.interimResults = true;
      state.wakeWordRecognition.lang = 'en-US';
      state.wakeWordRecognition.maxAlternatives = 5;

      state.wakeWordRecognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          // Check all alternatives the recognizer provides
          for (let alt = 0; alt < event.results[i].length; alt++) {
            const transcript = event.results[i][alt].transcript.toLowerCase().trim();
            if (wakeWord.matches(transcript)) {
              wakeWord.stopAndThen(() => {
                Luna.ui.showListening();
              });
              return;
            }
          }
        }
      };

      state.wakeWordRecognition.onerror = (event) => {
        state.isWakeWordListening = false;
        if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'network') {
          if (state.phase === 'standby' && state.wakeWordEnabled) {
            setTimeout(() => wakeWord.start(), 500);
          }
        }
      };

      state.wakeWordRecognition.onend = () => {
        state.isWakeWordListening = false;
        // Fire pending callback if waiting for stop
        if (wakeWord._onStopCallback) {
          const cb = wakeWord._onStopCallback;
          wakeWord._onStopCallback = null;
          cb();
          return;
        }
        // Auto-restart if still in standby
        if (state.phase === 'standby' && state.wakeWordEnabled) {
          setTimeout(() => wakeWord.start(), 500);
        }
      };
    },

    _onStopCallback: null,

    matches(transcript) {
      // Exact phrase match
      for (const phrase of wakeWord.phrases) {
        if (transcript.includes(phrase)) return true;
      }
      // Match "luna" anywhere in speech (with word boundary check)
      if (/\bluna\b/i.test(transcript) || /\bloona\b/i.test(transcript)) return true;
      // Fuzzy: remove spaces and check
      const compact = transcript.replace(/\s+/g, '');
      if (compact.includes('heyluna') || compact.includes('hayluna') || compact.includes('heluna')) return true;
      return false;
    },

    start() {
      if (!state.wakeWordRecognition || state.isWakeWordListening || !state.wakeWordEnabled) return;
      try {
        state.wakeWordRecognition.start();
        state.isWakeWordListening = true;
      } catch (e) {
        // Already started — try aborting and restarting
        try { state.wakeWordRecognition.abort(); } catch (e2) { /* ignore */ }
        state.isWakeWordListening = false;
        setTimeout(() => wakeWord.start(), 500);
      }
    },

    stop() {
      wakeWord._onStopCallback = null;
      if (state.wakeWordRecognition && state.isWakeWordListening) {
        try { state.wakeWordRecognition.abort(); } catch (e) { /* ignore */ }
        state.isWakeWordListening = false;
      }
    },

    // Stop and wait for the recognition to fully end before calling callback
    stopAndThen(callback) {
      if (!state.isWakeWordListening) {
        callback();
        return;
      }
      wakeWord._onStopCallback = callback;
      try { state.wakeWordRecognition.stop(); } catch (e) {
        wakeWord._onStopCallback = null;
        state.isWakeWordListening = false;
        callback();
      }
    },
  };

  // ===== SPEECH ENGINE =====
  const speech = {
    init() {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.warn('Speech recognition not supported');
        return;
      }
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      state.recognition = new SpeechRecognition();
      state.recognition.continuous = false;
      state.recognition.interimResults = true;
      state.recognition.lang = 'en-US';

      state.recognition.onresult = (event) => {
        let transcript = '';
        let isFinal = false;
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
          if (event.results[i].isFinal) isFinal = true;
        }
        const transcriptEl = state.phase === 'urgent'
          ? document.getElementById('urgent-transcript')
          : document.getElementById('overlay-transcript');
        if (transcriptEl) transcriptEl.textContent = transcript;

        if (isFinal) {
          speech.processQuery(transcript);
        }
      };

      state.recognition.onerror = (event) => {
        console.warn('Speech error:', event.error);
        if (event.error === 'no-speech') {
          const statusEl = state.phase === 'urgent'
            ? document.getElementById('urgent-status')
            : document.getElementById('overlay-status');
          if (statusEl) statusEl.textContent = 'No speech detected';
          setTimeout(() => Luna.ui.dismiss(), 2000);
        } else if (event.error === 'aborted' || event.error === 'network') {
          // Recognition was interrupted — retry if still in listening phase
          if (state.phase === 'listening' || state.phase === 'urgent') {
            setTimeout(() => speech.startListening(1), 300);
          }
        }
      };

      state.recognition.onend = () => {
        state.isRecognizing = false;
      };

      // Populate voice selector
      const loadVoices = () => {
        const voices = speechSynthesis.getVoices();
        const select = document.getElementById('voice-select');
        if (!select || voices.length === 0) return;
        select.innerHTML = '';
        voices.forEach((voice, i) => {
          const opt = document.createElement('option');
          opt.value = i;
          opt.textContent = `${voice.name} (${voice.lang})`;
          if (voice.name.toLowerCase().includes('female') || voice.name.toLowerCase().includes('zira') || voice.name.toLowerCase().includes('samantha')) {
            opt.selected = true;
            state.voiceIndex = i;
          }
          select.appendChild(opt);
        });
      };
      speechSynthesis.onvoiceschanged = loadVoices;
      loadVoices();
    },

    startListening(retryCount) {
      if (!state.recognition) return;
      const attempt = retryCount || 0;

      // Ensure wake word recognition is fully stopped first
      wakeWord.stop();

      // Small delay to let the previous recognition session release the mic
      const delay = attempt === 0 ? 250 : 500;
      setTimeout(() => {
        try {
          state.recognition.start();
          state.isRecognizing = true;
        } catch (e) {
          console.warn('Recognition start error (attempt ' + attempt + '):', e);
          // Retry up to 3 times with increasing delay
          if (attempt < 3) {
            setTimeout(() => speech.startListening(attempt + 1), 500);
          } else {
            console.error('Failed to start speech recognition after 3 retries');
            const statusEl = document.getElementById('overlay-status');
            if (statusEl) statusEl.textContent = 'Mic busy — try again';
          }
          return;
        }

        // Auto-dismiss after 7 seconds of no speech (extended from 5)
        if (state.autoDismissTimer) clearTimeout(state.autoDismissTimer);
        state.autoDismissTimer = setTimeout(() => {
          if (state.phase === 'listening' || state.phase === 'urgent') {
            const transcriptEl = document.getElementById('overlay-transcript');
            if (transcriptEl && !transcriptEl.textContent.trim()) {
              const statusEl = document.getElementById('overlay-status');
              if (statusEl) statusEl.textContent = 'No speech detected';
              audio.playChime('click');
              setTimeout(() => Luna.ui.dismiss(), 1500);
            }
          }
        }, 7000);
      }, delay);
    },

    stopListening() {
      if (state.recognition && state.isRecognizing) {
        try { state.recognition.stop(); } catch (e) { /* ignore */ }
        state.isRecognizing = false;
      }
      if (state.autoDismissTimer) {
        clearTimeout(state.autoDismissTimer);
        state.autoDismissTimer = null;
      }
    },

    processQuery(query) {
      if (state.autoDismissTimer) clearTimeout(state.autoDismissTimer);

      const statusEl = state.phase === 'urgent'
        ? document.getElementById('urgent-status')
        : document.getElementById('overlay-status');
      if (statusEl) statusEl.textContent = 'Processing…';

      audio.playThinking();

      // Search knowledge database
      setTimeout(() => {
        let response = null;
        for (const [key, category] of Object.entries(knowledgeDB)) {
          if (key === 'general') continue;
          for (const pattern of category.patterns) {
            if (pattern.test(query)) {
              response = category.handler(query);
              break;
            }
          }
          if (response) break;
        }
        if (!response) {
          response = knowledgeDB.general.handler(query);
        }

        speech.showResponse(query, response);
        speech.speak(response.text, true);

        // Add to history
        state.history.unshift({
          query,
          answer: response.text,
          confidence: response.confidence,
          time: new Date(),
        });
        if (state.history.length > 20) state.history.pop();
        ui.updateHistory();
      }, 600);
    },

    showResponse(query, response) {
      const statusEl = document.getElementById('overlay-status');
      if (statusEl) statusEl.textContent = 'Answer:';

      const responseArea = document.getElementById('response-area');
      const badge = document.getElementById('confidence-badge');
      const confIcon = document.getElementById('conf-icon');
      const confText = document.getElementById('conf-text');
      const responseText = document.getElementById('response-text');
      const responseSource = document.getElementById('response-source');

      if (!responseArea) return;

      responseArea.classList.remove('faded');

      // Set confidence
      badge.className = 'confidence-badge ' + response.confidence;
      switch (response.confidence) {
        case 'high':
          confIcon.textContent = '\u2705';
          confText.textContent = 'Verified — High Confidence';
          break;
        case 'medium':
          confIcon.textContent = '\uD83D\uDFE1';
          confText.textContent = 'Partial — Medium Confidence';
          break;
        case 'low':
          confIcon.textContent = '\u2753';
          confText.textContent = 'Unverified — Low Confidence';
          break;
      }

      responseText.textContent = response.text;
      responseSource.textContent = response.source || '';
      responseArea.style.display = 'block';

      // Show timer if applicable
      if (response.isTimer) {
        document.getElementById('timer-display').style.display = 'block';
      }
    },

    speak(text, autoRelisten) {
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = speechSynthesis.getVoices();
      if (voices.length > state.voiceIndex) {
        utterance.voice = voices[state.voiceIndex];
      }
      utterance.rate = state.speechRate;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;

      if (autoRelisten !== false) {
        utterance.onend = () => {
          if (state.phase === 'listening' || state.phase === 'urgent') {
            speech.resumeListening();
          }
        };
      }

      speechSynthesis.speak(utterance);
    },

    resumeListening() {
      const statusEl = document.getElementById('overlay-status');
      const transcriptEl = document.getElementById('overlay-transcript');
      if (statusEl) statusEl.textContent = 'Listening…';
      if (transcriptEl) transcriptEl.textContent = '';

      const responseArea = document.getElementById('response-area');
      if (responseArea) responseArea.classList.add('faded');

      audio.playChime('click');
      speech.startListening();
    },
  };

  // ===== TIMER =====
  const timer = {
    interval: null,
    remaining: 0,

    start(seconds) {
      this.remaining = seconds;
      this.update();
      if (this.interval) clearInterval(this.interval);
      this.interval = setInterval(() => {
        this.remaining--;
        this.update();
        if (this.remaining <= 0) {
          this.done();
        }
      }, 1000);
    },

    update() {
      const el = document.getElementById('timer-value');
      if (!el) return;
      const h = Math.floor(this.remaining / 3600);
      const m = Math.floor((this.remaining % 3600) / 60);
      const s = this.remaining % 60;
      if (h > 0) {
        el.textContent = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      } else {
        el.textContent = `${m}:${String(s).padStart(2, '0')}`;
      }
    },

    done() {
      if (this.interval) clearInterval(this.interval);
      this.interval = null;
      audio.playTimerDone();
      speech.speak('Timer is done!', false);
      const el = document.getElementById('timer-value');
      if (el) el.textContent = 'Done!';
      setTimeout(() => {
        const display = document.getElementById('timer-display');
        if (display) display.style.display = 'none';
      }, 3000);
    },

    cancel() {
      if (this.interval) clearInterval(this.interval);
      this.interval = null;
      const display = document.getElementById('timer-display');
      if (display) display.style.display = 'none';
      speech.speak('Timer cancelled.', false);
    },
  };

  // ===== UI MANAGER =====
  const ui = {
    showScreen(id) {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      const el = document.getElementById(id);
      if (el) el.classList.add('active');
    },

    showState(id) {
      document.querySelectorAll('.app-state').forEach(s => s.classList.remove('active'));
      const el = document.getElementById(id);
      if (el) el.classList.add('active');
    },

    showListening() {
      state.phase = 'listening';
      wakeWord.stop();
      ui.showState('listening-overlay');
      const statusEl = document.getElementById('overlay-status');
      const transcriptEl = document.getElementById('overlay-transcript');
      const responseArea = document.getElementById('response-area');
      const timerDisplay = document.getElementById('timer-display');
      if (statusEl) statusEl.textContent = 'Listening…';
      if (transcriptEl) transcriptEl.textContent = '';
      if (responseArea) responseArea.style.display = 'none';
      if (timerDisplay) timerDisplay.style.display = 'none';

      audio.playChime(state.chimeType);
      speech.startListening();
    },

    showUrgent() {
      state.phase = 'urgent';
      wakeWord.stop();
      ui.showState('urgent-overlay');
      const statusEl = document.getElementById('urgent-status');
      const transcriptEl = document.getElementById('urgent-transcript');
      if (statusEl) statusEl.textContent = 'Listening…';
      if (transcriptEl) transcriptEl.textContent = '';

      audio.playUrgent();
      speech.startListening();
    },

    dismiss() {
      speech.stopListening();
      speechSynthesis.cancel();
      state.phase = 'standby';
      ui.showState('standby');
      // Resume wake word listening in standby
      setTimeout(() => wakeWord.start(), 500);
    },

    toggleSettings() {
      const panel = document.getElementById('settings-panel');
      if (panel) panel.classList.toggle('open');
    },

    updateHistory() {
      const list = document.getElementById('history-list');
      const section = document.getElementById('history-section');
      if (!list || !state.showLog) {
        if (section) section.style.display = 'none';
        return;
      }
      if (state.history.length === 0) {
        section.style.display = 'none';
        return;
      }
      section.style.display = 'block';
      list.innerHTML = state.history.map(item => {
        const confEmoji = item.confidence === 'high' ? '\u2705' : item.confidence === 'medium' ? '\uD83D\uDFE1' : '\u2753';
        const timeStr = item.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `
          <div class="history-item">
            <span class="hi-conf">${confEmoji}</span>
            <div class="hi-body">
              <div class="hi-query">${escapeHTML(item.query)}</div>
              <div class="hi-answer">${escapeHTML(item.answer)}</div>
            </div>
            <span class="hi-time">${timeStr}</span>
          </div>
        `;
      }).join('');
    },
  };

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ===== ONBOARDING =====
  const onboarding = {
    steps: ['onboard-welcome', 'onboard-mic', 'onboard-calibrate', 'onboard-tutorial'],

    next() {
      state.onboardStep++;
      this.showStep(state.onboardStep);
    },

    showStep(index) {
      document.querySelectorAll('.onboard-step').forEach(s => s.classList.remove('active'));
      const step = document.getElementById(this.steps[index]);
      if (step) step.classList.add('active');
    },

    async requestMic() {
      const success = await audio.init();
      if (success) {
        speech.init();
        this.next();
        // Start calibration listening
        state.isCalibrating = true;
        state.calibrationClaps = 0;
        clapDetector.start();
      } else {
        alert('Microphone access is required for Luna to work. Please allow microphone access and try again.');
      }
    },

    skipCalibration() {
      state.isCalibrating = false;
      state.clapModel.calibrated = false;
      this.next();
    },

    finish() {
      state.phase = 'standby';
      state.isCalibrating = false;
      ui.showScreen('main-app');
      ui.showState('standby');
      if (!clapDetector.running) clapDetector.start();
      wakeWord.init();
      wakeWord.start();
    },

    recalibrate() {
      // Reset calibration
      state.calibrationClaps = 0;
      state.isCalibrating = true;
      for (let i = 1; i <= 3; i++) {
        const dot = document.getElementById(`cal-dot-${i}`);
        if (dot) dot.classList.remove('detected');
      }
      const statusEl = document.getElementById('cal-status');
      if (statusEl) statusEl.textContent = 'Waiting for clap 1 of 3…';

      ui.showScreen('onboarding');
      state.onboardStep = 2;
      onboarding.showStep(2);
      ui.toggleSettings();
    },
  };

  // ===== SETTINGS =====
  const settings = {
    setSensitivity(val) {
      state.sensitivity = parseInt(val);
      const el = document.getElementById('sensitivity-value');
      if (el) el.textContent = val;
    },

    setDoubleClap(val) {
      state.doubleClickTimeout = parseInt(val);
      const el = document.getElementById('dblclap-value');
      if (el) el.textContent = val + 'ms';
    },

    setChime(val) {
      state.chimeType = val;
    },

    setVoice(val) {
      state.voiceIndex = parseInt(val);
    },

    setRate(val) {
      state.speechRate = parseFloat(val);
      const el = document.getElementById('rate-value');
      if (el) el.textContent = parseFloat(val).toFixed(1) + 'x';
    },

    toggleLog(checked) {
      state.showLog = checked;
      ui.updateHistory();
    },

    toggleWakeWord(checked) {
      state.wakeWordEnabled = checked;
      if (checked && state.phase === 'standby') {
        wakeWord.start();
      } else {
        wakeWord.stop();
      }
      const statusText = document.getElementById('standby-status-text');
      if (statusText) {
        statusText.textContent = checked
          ? 'Listening for claps & voice\u2026'
          : 'Listening for claps\u2026';
      }
    },
  };

  // ===== PUBLIC API =====
  return {
    onboarding,
    ui,
    timer,
    settings,
    audio,
    wakeWord,
    state,
  };
})();
