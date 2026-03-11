# 🎤 Voice Presentation

An AI-powered web application that transforms live voice input into presentation slides in real-time. Speak naturally and watch as your ideas are automatically organized into clean, professional presentation slides.

## ✨ Features

- **🎙️ Live Speech Recognition**: Capture audio directly from your browser using the Web Speech API
- **🤖 AI-Powered Slide Generation**: Automatically organize spoken content into structured presentation slides using AI
- **📊 Real-time Streaming**: See slides generated in real-time as you speak
- **🌍 Multi-language Support**: Works with both English and Italian (easily extensible to more languages)
- **🎨 Beautiful UI**: Modern, responsive interface with smooth animations and gradient accents
- **📋 Export to Markdown**: Copy all slides to markdown format with one click
- **🔌 Chrome Extension**: Capture audio from browser tabs (e.g., video calls, podcasts) for transcription
- **⚙️ Configurable AI Models**: Choose between different AI models via OpenRouter

## 🏗️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org) (App Router, React 19)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom animations
- **UI Components**: Radix UI (tooltips, popovers, buttons)
- **Icons**: Lucide React
- **AI Integration**: OpenRouter API (supports multiple LLM providers)
- **Speech Recognition**: Browser Web Speech API
- **Extension**: Chrome Extension Manifest V3

## 🚀 Getting Started

### Prerequisites

- Node.js 20 or higher
- An [OpenRouter API key](https://openrouter.ai/)

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd voice-presentation
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file in the root directory:

```bash
OPENROUTER_API_KEY=your_api_key_here
```

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Using the Chrome Extension

The Chrome extension allows you to capture audio from any browser tab:

1. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension/` folder from this project

2. Navigate to [http://localhost:3000/extension](http://localhost:3000/extension) in your browser

3. Click the extension icon and start capturing audio from the current tab

## 📖 How It Works

1. **Voice Input**: The app uses the browser's Web Speech API to transcribe your voice in real-time
2. **Transcript Processing**: As you speak, transcripts are collected and monitored for natural sentence breaks
3. **AI Generation**: When you pause speaking, the transcript is sent to an AI model via OpenRouter
4. **Slide Creation**: The AI organizes your content into slides with titles and bullet points
5. **Streaming Display**: Slides are streamed back and displayed in real-time
6. **Navigation**: Navigate through generated slides using arrow buttons or keyboard shortcuts

## 🎯 Use Cases

- **Live Presentations**: Speak your presentation and generate slides on the fly
- **Meeting Notes**: Convert meeting discussions into structured presentation format
- **Content Creation**: Brainstorm ideas verbally and see them organized automatically
- **Lecture Transcription**: Capture audio from educational content and convert to slides
- **Video Summarization**: Use the extension to capture and summarize video content

## 📁 Project Structure

```
voice-presentation/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── generate/     # Slide generation endpoint
│   │   └── whisper/      # Whisper transcription endpoint
│   ├── extension/        # Extension integration page
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/            # React components
│   ├── LiveTranscript.tsx   # Real-time transcript display
│   ├── MicButton.tsx        # Microphone control button
│   ├── Navbar.tsx           # Navigation bar with settings
│   ├── Presentation.tsx     # Slide viewer component
│   └── SettingsPanel.tsx    # Configuration panel
├── extension/             # Chrome extension source
│   ├── background.js     # Service worker
│   ├── content.js        # Content script
│   ├── popup.js          # Extension popup
│   └── manifest.json     # Extension manifest
├── hooks/                 # Custom React hooks
│   ├── usePresentationGen.ts  # Slide generation logic
│   └── useSpeechRecognition.ts # Speech recognition hook
├── lib/                   # Utility functions
└── types/                 # TypeScript type definitions
```

## ⚙️ Configuration

### Supported AI Models

The app supports various AI models through OpenRouter. Configure the model in the settings panel (default: `openai/gpt-4o-mini`).

### Language Settings

Change the speech recognition language in the settings panel:

- English (US)
- Italian
- Additional languages can be added in `types/index.ts`

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### Environment Variables

- `OPENROUTER_API_KEY` - Your OpenRouter API key (required)

## 📝 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org)
- UI components from [Radix UI](https://www.radix-ui.com/)
- AI models via [OpenRouter](https://openrouter.ai/)
- Icons from [Lucide](https://lucide.dev/)
