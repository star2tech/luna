# Luna — Clap. Ask. Done.

Luna is a clap-activated voice agent that lives in a low-power listening state, waiting for a handclap trigger. No wake words, no buttons — just clap and ask.

![Luna Screenshot](https://img.shields.io/badge/Luna-Clap.%20Ask.%20Done.-7BA7D4?style=for-the-badge)

## Features

- **Clap Detection** — Real-time acoustic detection using Web Audio API. Distinguishes claps from background noise using spectral analysis.
- **Single & Double Clap** — Single clap opens the listening interface. Double clap triggers urgent mode.
- **Voice Commands** — Speak naturally. Luna uses the Web Speech API for speech-to-text and text-to-speech.
- **Curated Knowledge** — Answers come from a verified knowledge database with confidence indicators (high/medium/low), not raw web search.
- **Timers & Alarms** — "Set a timer for 10 minutes" — works with voice and displays a countdown.
- **Dark Mode UI** — Elegant night-sky theme with the signature crescent moon animation.
- **Onboarding Flow** — Guided setup with microphone permission, clap calibration, and interactive tutorial.
- **Privacy First** — All clap detection and speech processing happens on-device. Only transcribed queries are processed.
- **Query History** — View every query with source citations and confidence scores.
- **Customizable** — Adjust clap sensitivity, entry chime, voice, speech rate, and more.

## Knowledge Categories

| Category | Example Query | Source |
|----------|--------------|--------|
| Weather | "What's the weather in Tokyo?" | National Weather Service, Met Office |
| Capitals | "What's the capital of Mongolia?" | Verified geographic data (ISO 3166) |
| Time & Date | "What time is it?" | Device clock |
| Math | "What is 144 divided by 12?" | Local calculation |
| Sports | "Who won the Super Bowl in 2025?" | Official league records |
| Stocks | "Stock price of Apple" | Market data |
| Health | "Is the COVID vaccine safe?" | WHO, CDC |
| General Knowledge | "Speed of light?" | BIPM, NOAA, etc. |

## Getting Started

1. Open `index.html` in a modern browser (Chrome recommended for full Web Speech API support).
2. Follow the onboarding flow:
   - Grant microphone permission
   - Calibrate your clap (clap 3 times)
   - Review the tutorial
3. Clap to activate Luna and speak your command!

## Technical Stack

- **HTML5 / CSS3 / Vanilla JavaScript** — No frameworks, no build step
- **Web Audio API** — Real-time clap detection with spectral analysis
- **Web Speech API** — Speech-to-text (SpeechRecognition) and text-to-speech (SpeechSynthesis)
- **CSS Animations** — Crescent moon glow, audio visualization, smooth transitions

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Clap Detection | Yes | Yes | Yes | Yes |
| Speech Recognition | Yes | No | Yes (partial) | Yes |
| Text-to-Speech | Yes | Yes | Yes | Yes |

> **Note:** Chrome is recommended for the best experience with full speech recognition support.

## Privacy

- Audio is processed in real-time and never stored
- Clap detection runs entirely on-device
- No data is sent to any server
- Query history is stored only in browser memory (cleared on page refresh)

## License

MIT
