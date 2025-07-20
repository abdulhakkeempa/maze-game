# 🎮 Audio Maze Game

An immersive audio-first maze navigation game built with Next.js and advanced Web Audio APIs. Players navigate through a maze using spatial audio cues, creating an accessible gaming experience that relies primarily on sound rather than visuals.

## 🌟 Features

### 🎧 Advanced Spatial Audio System
- **3D Positional Audio**: Real-time stereo panning with enhanced left/right separation
- **Custom Audio Integration**: Support for .mp3 files with fallback to synthesized sounds
- **Environmental Audio**: Bell sound guidance system directing players to the exit
- **Dynamic Audio Processing**: Distance-based volume, filtering, and reverb effects

### 🎮 Gameplay Features
- **Intuitive Controls**: Arrow key navigation with R key restart functionality
- **Wolf Detection System**: Spatial wolf growls indicate nearby dangers
- **Progressive Difficulty**: Audio cues become more pronounced as threats approach
- **Real-time Feedback**: Visual and audio status updates

### ♿ Accessibility First Design
- **High Contrast UI**: Black, white, and yellow color scheme for visual clarity
- **Screen Reader Compatible**: Semantic HTML structure
- **Web Speech API Integration**: Spoken instructions on demand
- **Keyboard-only Navigation**: Full game playable without mouse

## 🏗️ Architectural Design

### Core Components

#### 🎵 Audio Engine (`useAudioEngine` Hook)
- **Tone.js Integration**: Professional-grade Web Audio API wrapper
- **Dual Audio Sources**: Custom .mp3 players with synthesized fallbacks
- **Spatial Processing Chain**: Panner → Filter → Reverb → Destination
- **Resource Management**: Automatic cleanup and error handling

#### 🎮 Game State Management
- **React Hooks**: useState and useEffect for reactive state updates
- **Position Tracking**: Real-time player and entity coordinate system
- **Collision Detection**: Grid-based maze boundary enforcement
- **Win/Lose Conditions**: Dynamic game state transitions


### Audio Architecture Deep Dive

#### 🎯 Multi-Source Audio System
1. **Bell Guidance System**
   - Custom .mp3 file loading with Tone.Player
   - High-pass filtering (800Hz+) for clarity
   - Distance-based volume attenuation
   - Directional panning toward exit

2. **Wolf Threat Detection**
   - Individual audio sources per wolf entity
   - Low-frequency emphasis (100-300Hz) for growls
   - Proximity-triggered activation (6-tile range)
   - Spatial positioning with reverb depth


## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm, yarn, pnpm, or bun
- Headphones (recommended for optimal spatial audio experience)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd audio-maze-game-next
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. **Add custom audio files** (optional)
```bash
# Place your custom audio files in the public directory
public/
├── wolf-growl.mp3    # Custom wolf sound
└── bell.mp3          # Custom exit guidance sound
```

4. **Run the development server**
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

5. **Open your browser**
Navigate to [http://localhost:3000](http://localhost:3000)

## 🎯 Game Instructions

### Controls
- **Arrow Keys**: Move through the maze
- **R Key**: Restart the game at any time
- **Space Bar**: Hear spoken instructions (on start page)

### Objective
- Navigate to the exit using audio cues
- Avoid wolves that growl when nearby
- Follow the bell sound to find the correct path

### Audio Cues
- **🔔 Bell Sound**: Directional guidance to the exit
- **🐺 Wolf Growls**: Danger indicators (left/right ear positioning)
- **Movement Sounds**: Confirmation of valid moves
- **Wall Collision**: Audio feedback for blocked paths

## 🛠️ Technical Stack

- **Frontend Framework**: Next.js 14+ (React 18+)
- **Audio Engine**: Tone.js (Web Audio API)
- **Styling**: Tailwind CSS
- **Speech Synthesis**: Web Speech API
- **Build Tool**: Next.js built-in bundler
- **Deployment**: Vercel-ready


