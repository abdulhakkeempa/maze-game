# Custom Wolf Sound Setup

## How to add your custom wolf .mp3 file:

### Step 1: Place your audio file
1. Copy your wolf growl .mp3 file to the `public` folder in your project
2. Rename it to `wolf-growl.mp3` (or update the filename in the code)

```
audio-maze-game-next/
├── public/
│   ├── wolf-growl.mp3  ← Place your file here
│   ├── file.svg
│   ├── globe.svg
│   └── ...
└── src/
    └── ...
```

### Step 2: File requirements
- **Format**: .mp3, .wav, .ogg (mp3 recommended for compatibility)
- **Duration**: 2-5 seconds is ideal (it will loop automatically)
- **Quality**: Good quality but not too large (under 1MB recommended)
- **Content**: Wolf growl or similar animal sound

### Step 3: Customize the filename (optional)
If you want to use a different filename, update this line in the code:
```javascript
const wolfAudioUrl = '/your-custom-filename.mp3';
```

### Step 4: Test the audio
1. Start the development server: `npm run dev`
2. Open the game and move around to trigger wolf sounds
3. The custom audio should play with spatial positioning

## Technical Details:
- The audio file is loaded using Tone.js Player
- Each wolf uses the same audio file but with individual spatial effects
- Audio loops continuously while wolves are in range
- Spatial effects (panning, filtering, reverb) are applied in real-time

## Troubleshooting:
- If audio doesn't play, check the browser console for loading errors
- Make sure the file is in the `public` folder (not `src` or other folders)
- Try refreshing the page if the audio doesn't load initially
- Some browsers require user interaction before playing audio
