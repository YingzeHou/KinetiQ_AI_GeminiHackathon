<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# KinetiQ AI – Your Personal AI Sports Coach

Advanced biomechanical motion analysis powered by **Gemini 3 Pro**. Real-time AI coaching with computer vision, automated video annotation, and live feedback.

View your app in AI Studio: https://ai.studio/apps/drive/1wcbdgRfs-P-oQwYElr2t-1taxdpL_-68

---

## Features

### 🎯 Multi-Sport Analysis
Supports **8+ sports**: Tennis, Badminton, Basketball, Football (Soccer), Golf, Swimming, Alpine Skiing, Snowboarding. Precise biomechanical feedback for specific actions (e.g., Tennis Forehand, Basketball Shooting Form).

### 🧠 AI-Powered Video Analysis
- **Gemini 3 Pro Vision**: Frame-by-frame biomechanical audit with structured JSON output
- **6-Part Body Scoring**: Head, Shoulders, Arms, Hips, Legs, Footwork with individual scores (0-100)
- **Technical Feedback Protocol**: `[PASS]` for elite technique, `[FIX]` for errors with corrective cues
- **Temporal Markers**: 4-6 key technical phases per video with timestamps and frame numbers

### 🔬 Automated Visual Annotation
- **AI Director + Canvas Artist Architecture**: Two-step pipeline for intelligent overlay generation
- **Coordinate Extraction**: Gemini 3 Pro identifies body parts and generates X/Y coordinates with boundary awareness
- **Color-Coded Overlays**: GREEN arrows for correct biomechanics, RED arrows for errors
- **Smart Positioning**: Auto-adjusted label placement to prevent off-screen text

### ⚡ Live Coach Mode
- **Real-Time Streaming**: Gemini 2.5 Flash Native Audio with bidirectional audio + video (3.3 FPS)
- **Instant Corrections**: Sub-second feedback after detecting movement completion
- **Voice AI**: Natural voice coaching with "Zephyr" voice preset
- **WebRTC Pipeline**: Direct camera/microphone access with PCM audio resampling (16kHz)

### 📊 Performance Insights
- **Radar Chart Visualization**: Interactive biomechanical profile using Recharts
- **Strengths/Weaknesses Analysis**: Actionable suggestions for improvement
- **Session History**: Track progress over time with detailed metrics

### 📱 Mobile-First Design
- **Responsive UI**: Optimized for mobile devices (max-width: 448px)
- **Camera Integration**: In-app video recording with CameraRecorder component
- **Smooth Animations**: Tailwind CSS animations for professional UX

---

## Run Locally

**Prerequisites:** Node.js (v16+)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set your Gemini API key:**
   - Create `.env.local` in the project root
   - Add: `API_KEY=your_gemini_api_key_here`

3. **Run the app:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   - Navigate to `http://localhost:5173`

---

## Technology Stack

- **React 19** + **TypeScript** – Type-safe component architecture
- **Vite** – Lightning-fast build tool
- **@google/genai** – Gemini AI SDK for video/audio analysis and live streaming
- **Recharts** – Data visualization for biomechanical scores
- **Lucide React** – Icon library
- **Tailwind CSS** – Utility-first styling (via inline classes)

---

## Project Structure

```
├── App.tsx                  # Main app orchestrator
├── components/
│   ├── CameraRecorder.tsx   # In-app video capture
│   ├── LiveCoach.tsx        # Real-time AI coaching interface
│   ├── NavBar.tsx           # Bottom navigation
│   ├── RadarChart.tsx       # Biomechanical score visualization
│   └── VisualOverlay.tsx    # Annotated frame display
├── pages/
│   ├── HomePage.tsx         # Dashboard with sport selection
│   ├── NewAnalysisPage.tsx  # Upload/record video + action selection
│   ├── AnalyzingPage.tsx    # Loading screen with progress stages
│   └── ResultPage.tsx       # Detailed analysis with video playback
├── services/
│   ├── geminiService.ts     # Gemini API integration (analysis + annotation)
│   └── motionGeometry.ts    # Utility functions for coordinate calculations
├── constants.ts             # Sport definitions, actions, navigation
└── types.ts                 # TypeScript interfaces for analysis data
```

---

## Key Workflows

### Video Analysis Pipeline
1. User uploads video or records in-app
2. Frontend converts video to Base64
3. **Gemini 3 Pro** analyzes biomechanics with structured schema
4. For each timestamp, extract frame → **Gemini 3 Pro** generates annotation coordinates → Canvas renders overlay
5. Display results with radar chart, timestamped feedback, and visual corrections

### Live Coach Pipeline
1. User enables camera/microphone permissions
2. Connect to **Gemini 2.5 Flash** via WebSocket (`ai.live.connect`)
3. Stream video frames (300ms intervals) + PCM audio (16kHz, gain-boosted)
4. AI watches silently → detects action completion → speaks instant correction (≤6 words)
5. Bidirectional audio playback with interrupt handling

---

## API Configuration

The app uses **Google Gemini AI** models:
- **Video Analysis:** `gemini-3-pro-preview` (structured JSON output, temperature=0)
- **Live Coaching:** `gemini-2.5-flash-native-audio-preview-12-2025` (realtime audio mode)

Ensure your API key has access to these models.

---

## License

MIT License – See LICENSE file for details.

---

**Built with ❤️ using Google AI Studio and Gemini API**
