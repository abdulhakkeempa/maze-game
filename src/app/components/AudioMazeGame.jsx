'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as Tone from 'tone';

// --- Game Configuration ---
const MAZE_GRID = [
    ['R', ' ', 'X', ' ', ' ', ' ', 'X', ' ', ' ', ' ', 'X', ' ', ' ', ' ', 'X'],
    ['X', ' ', 'X', ' ', 'X', ' ', 'X', ' ', 'X', ' ', 'X', ' ', 'X', ' ', 'X'],
    ['X', ' ', ' ', ' ', 'X', ' ', ' ', ' ', 'X', ' ', ' ', ' ', 'X', ' ', ' '],
    ['X', ' ', 'X', 'X', 'X', ' ', 'X', 'X', 'X', ' ', 'X', 'X', 'X', ' ', 'X'],
    ['X', ' ', ' ', ' ', ' ', ' ', 'X', 'A', ' ', ' ', ' ', ' ', 'X', ' ', 'X'],
    ['X', 'X', 'X', ' ', 'X', ' ', 'X', 'X', 'X', ' ', 'X', ' ', 'X', ' ', 'X'],
    ['X', ' ', ' ', ' ', 'X', ' ', ' ', ' ', ' ', ' ', 'X', ' ', ' ', ' ', 'X'],
    ['X', ' ', 'X', 'X', 'X', 'X', 'X', ' ', 'X', 'X', 'X', 'X', 'X', ' ', 'X'],
    ['X', ' ', ' ', ' ', 'A', ' ', 'X', ' ', ' ', ' ', 'A', ' ', 'X', ' ', ' '],
    ['X', ' ', 'X', ' ', 'X', ' ', 'X', ' ', 'X', ' ', 'X', ' ', 'X', ' ', 'X'],
    ['X', ' ', 'X', ' ', ' ', ' ', 'X', ' ', 'X', ' ', ' ', ' ', 'X', ' ', 'X'],
    ['X', ' ', 'X', 'X', 'X', ' ', 'X', ' ', 'X', 'X', 'X', ' ', 'X', ' ', 'X'],
    ['X', ' ', ' ', ' ', 'A', ' ', ' ', ' ', ' ', ' ', 'A', ' ', ' ', ' ', 'X'],
    ['X', ' ', 'X', ' ', 'X', 'X', 'X', 'X', 'X', 'X', 'X', ' ', 'X', ' ', 'E'],
    ['X', 'H', 'X', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', 'X', ' ', 'X'],
];

const TILE_SIZE = 40; // For visual representation

// --- Helper function to find initial positions ---
const findStartPosition = (char) => {
    for (let r = 0; r < MAZE_GRID.length; r++) {
        for (let c = 0; c < MAZE_GRID[r].length; c++) {
            if (MAZE_GRID[r][c] === char) {
                return { row: r, col: c };
            }
        }
    }
    return { row: 0, col: 0 };
};

// --- Helper function to find all animal positions ---
const findAllAnimals = () => {
    const animals = [];
    for (let r = 0; r < MAZE_GRID.length; r++) {
        for (let c = 0; c < MAZE_GRID[r].length; c++) {
            if (MAZE_GRID[r][c] === 'A') {
                animals.push({ row: r, col: c });
            }
        }
    }
    return animals;
};

// --- Audio Engine ---
// We use useRef to ensure Tone.js objects are created only once.
const useAudioEngine = () => {
    const audioInitialized = useRef(false);
    
    const synths = useRef({
        move: null,
        wall: null,
        win: null,
        lose: null,
        playerFootstep: null,
        dangerAlert: null,
    });

    const hunterSound = useRef({
        noise: null,
        panner: null,
        filter: null,
    });
    
    const exitSound = useRef({
        osc: null,
        panner: null,
    });

    const animalSounds = useRef([]);

    // Initialize all audio components
    const initializeAudio = () => {
        if (audioInitialized.current) return;

        // Ensure Tone.js context is started by a user gesture
        Tone.start();

        // Player sounds
        synths.current.move = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.1 } }).toDestination();
        synths.current.wall = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.1 } }).toDestination();
        synths.current.win = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.1, decay: 0.5, sustain: 0.3, release: 1 } }).toDestination();
        synths.current.lose = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.2, decay: 1, sustain: 0.2, release: 1 } }).toDestination();
        
        // Remove player footstep and danger alert for cleaner spatial audio

        // Custom wolf sounds using .mp3 file for all animals in the maze
        const animals = findAllAnimals();
        
        // Load the wolf sound once and clone it for each animal
        const wolfAudioUrl = '/wolf-growl.mp3'; // Place your .mp3 file in the public folder
        
        animals.forEach((animal, index) => {
            // Create fallback synthesized wolf sound
            const fallbackSynth = new Tone.Synth({
                oscillator: { 
                    type: 'sawtooth',
                    modulationType: 'sine',
                    modulationFrequency: 8,
                    harmonicity: 0.5
                },
                envelope: { attack: 0.3, decay: 0.4, sustain: 0.6, release: 0.8 }
            });

            // Try to use Tone.Player for custom audio file, fallback to synth
            let customPlayer;
            try {
                customPlayer = new Tone.Player({
                    url: wolfAudioUrl,
                    loop: true, // Enable looping for continuous sound
                    autostart: false,
                    fadeIn: 0.1,
                    fadeOut: 0.1,
                    onload: () => {
                        console.log(`Wolf sound ${index} loaded successfully`);
                    },
                    onerror: (error) => {
                        console.error(`Failed to load wolf sound ${index}, using fallback:`, error);
                    }
                });
            } catch (error) {
                console.error('Failed to create Player, using fallback synth:', error);
                customPlayer = fallbackSynth;
            }

            const animalSound = {
                synth: customPlayer, // Use player or fallback synth
                fallbackSynth: fallbackSynth, // Keep fallback available
                animalType: 'Wolf', // All animals are wolves
                isUsingPlayer: customPlayer !== fallbackSynth, // Track if using custom audio
                // Enhanced stereo panner for better directional audio
                panner: new Tone.Panner(0),
                // Add a filter for distance simulation
                filter: new Tone.Filter({
                    frequency: 2000,
                    type: 'lowpass',
                    rolloff: -12
                }),
                // Add reverb for spatial depth
                reverb: new Tone.Reverb({
                    roomSize: 0.8,
                    dampening: 3000
                }),
                position: animal,
                isPlaying: false,
                // Remove warning sound - redundant with main animal sound
                lastWarningTime: 0
            };
            
            // Create clean audio chain for spatial audio with custom wolf sound
            animalSound.synth.connect(animalSound.filter);
            animalSound.filter.connect(animalSound.reverb);
            animalSound.reverb.connect(animalSound.panner);
            animalSound.panner.toDestination();
            
            // Also connect fallback synth to the same chain
            animalSound.fallbackSynth.connect(animalSound.filter);
            
            animalSound.synth.volume.value = -Infinity;
            animalSound.fallbackSynth.volume.value = -Infinity;
            animalSounds.current.push(animalSound);
        });

        // Remove hunter and exit sounds for cleaner spatial audio focus

        audioInitialized.current = true;
        console.log("Audio Engine Initialized");
    };

    return { initializeAudio, synths, hunterSound, exitSound, animalSounds, audioInitialized };
};


// --- Main Game Component ---
export default function AudioMazeGame() {
    const [rabbitPos, setRabbitPos] = useState(findStartPosition('R'));
    const [hunterPos, setHunterPos] = useState(findStartPosition('H'));
    const [animalPositions] = useState(findAllAnimals());
    const [exitPos] = useState(findStartPosition('E'));
    const [status, setStatus] = useState('playing'); // 'playing', 'won', 'lost'
    const [message, setMessage] = useState('Use arrow keys to move. Find the exit!');
    const [detectedAnimals, setDetectedAnimals] = useState(new Set()); // Track which animals have been detected

    const { initializeAudio, synths, hunterSound, exitSound, animalSounds, audioInitialized } = useAudioEngine();

    // --- Sound Playback Functions ---

    const playSound = useCallback((sound, note, duration) => {
        if (!audioInitialized.current || !synths.current[sound]) return;
        synths.current[sound].triggerAttackRelease(note, duration);
    }, [audioInitialized, synths]);

    const playPlayerFootstep = useCallback(() => {
        // Removed for cleaner spatial audio experience
    }, []);

    const playHunterStep = useCallback(() => {
        // Removed for cleaner spatial audio experience
    }, []);

    const announceDanger = useCallback((distanceLevel, animalIndex) => {
        // Removed danger alerts - using only animal sounds for cleaner spatial audio
    }, []);

    // Calculate enhanced stereo positioning for clear left/right audio separation
    const calculateSpatialAudio = useCallback((playerPos, targetPos, distance) => {
        // Calculate relative position
        const dx = targetPos.col - playerPos.col;
        const dy = targetPos.row - playerPos.row;
        
        // ENHANCED panning calculation for CLEAR left/right separation
        // Use the full stereo field and make it more aggressive
        const panValue = Math.max(-1, Math.min(1, dx / 2)); // More aggressive panning (was dx/3)
        
        // Apply stereo boost - make left/right even more pronounced
        const boostedPan = panValue * 1.5; // Boost the panning effect
        const finalPan = Math.max(-1, Math.min(1, boostedPan));
        
        // Calculate front/back perception using frequency filtering
        // Objects behind sound more muffled (lower frequency)
        const frontBackFactor = dy; // Positive = in front, negative = behind
        const filterFreq = frontBackFactor > 0 
            ? 2000 + (frontBackFactor * 300)  // In front: brighter
            : 1200 - (Math.abs(frontBackFactor) * 200); // Behind: more muffled
        
        // Distance-based reverb for depth perception
        const reverbWet = Math.min(distance / 8, 0.7); // More reverb = further away
        
        return {
            pan: finalPan, // Use the boosted panning for clear left/right
            filterFreq: Math.max(300, Math.min(4000, filterFreq)),
            reverbWet: reverbWet,
            distance: distance
        };
    }, []);

    // Enhanced spatial audio positioning with aggressive left/right separation
    const updateSpatialAudio = useCallback((animalSound, playerPos, distance) => {
        const spatialParams = calculateSpatialAudio(playerPos, animalSound.position, distance);
        
        // Update stereo panning with immediate effect for clear left/right
        animalSound.panner.pan.rampTo(spatialParams.pan, 0.05); // Faster response (was 0.1)
        
        // Update filter for front/back perception
        animalSound.filter.frequency.rampTo(spatialParams.filterFreq, 0.2);
        
        // Update reverb for distance perception
        animalSound.reverb.wet.rampTo(spatialParams.reverbWet, 0.3);
        
        // Debug logging to verify panning values
        console.log(`Animal ${animalSound.position.row},${animalSound.position.col}: Pan=${spatialParams.pan.toFixed(2)}, Distance=${distance.toFixed(1)}`);
        
    }, [calculateSpatialAudio]);
    
    // --- Update Audio Cues based on Game State ---
    useEffect(() => {
        if (status !== 'playing' || !audioInitialized.current) {
            if (exitSound.current.osc) {
                exitSound.current.osc.stop();
            }
            // Stop all animal sounds
            animalSounds.current.forEach(animalSound => {
                if (animalSound.isPlaying) {
                    try {
                        animalSound.synth.stop();
                        animalSound.isPlaying = false;
                    } catch (error) {
                        console.error('Error stopping wolf sound on game end:', error);
                        animalSound.isPlaying = false;
                    }
                }
            });
            return;
        };

        // --- Focus only on animal spatial audio for clear directional experience ---
        animalSounds.current.forEach((animalSound, index) => {
            const animal = animalSound.position;
            const dxAnimal = rabbitPos.col - animal.col;
            const dyAnimal = rabbitPos.row - animal.row;
            const distanceAnimal = Math.sqrt(dxAnimal * dxAnimal + dyAnimal * dyAnimal);
            
            // Update spatial audio positioning
            updateSpatialAudio(animalSound, rabbitPos, distanceAnimal);
            
            const animalKey = `animal_${index}`;
            
            // Clean distance-based audio system - only animal sounds with spatial positioning
            if (distanceAnimal <= 6) {
                // Animal is in detection range
                if (!detectedAnimals.has(animalKey)) {
                    setDetectedAnimals(prev => new Set([...prev, animalKey]));
                    const proximity = distanceAnimal <= 3 ? '- VERY CLOSE!' : '- nearby';
                    
                    // Calculate direction for user feedback
                    const dx = animal.col - rabbitPos.col;
                    let direction = '';
                    if (dx > 1) direction = '→ RIGHT';
                    else if (dx < -1) direction = '← LEFT';
                    else direction = '↕ CENTER';
                    
                    setMessage(`🐺 Wolf detected ${proximity} ${direction}`);
                }
                
                if (!animalSound.isPlaying) {
                    // Start playing the wolf sound (custom .mp3 or fallback synth)
                    try {
                        if (animalSound.isUsingPlayer) {
                            // Using custom .mp3 file
                            if (animalSound.synth.loaded) {
                                animalSound.synth.start();
                                animalSound.isPlaying = true;
                            } else {
                                console.log('Wolf sound not yet loaded, using fallback...');
                                // Use fallback synth
                                const frequency = 120 + Math.random() * 30;
                                animalSound.fallbackSynth.triggerAttack(frequency);
                                animalSound.isPlaying = true;
                            }
                        } else {
                            // Using fallback synth
                            const frequency = 120 + Math.random() * 30;
                            animalSound.synth.triggerAttack(frequency);
                            animalSound.isPlaying = true;
                        }
                    } catch (error) {
                        console.error('Error starting wolf sound, using fallback:', error);
                        // Last resort fallback
                        const frequency = 120 + Math.random() * 30;
                        animalSound.fallbackSynth.triggerAttack(frequency);
                        animalSound.isPlaying = true;
                    }
                }
                
                // Simple volume calculation based on distance
                const volumeAnimal = -8 - (distanceAnimal * 2.5);
                animalSound.synth.volume.rampTo(volumeAnimal, 0.2);
                
                
            } else {
                // Animal is too far - stop sound
                if (detectedAnimals.has(animalKey)) {
                    setDetectedAnimals(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(animalKey);
                        return newSet;
                    });
                    if (detectedAnimals.size === 1) {
                        setMessage('✓ Area clear. Listen for animals...');
                    }
                }
                
                if (animalSound.isPlaying) {
                    animalSound.synth.volume.rampTo(-Infinity, 0.5);
                    setTimeout(() => {
                        if (animalSound.isPlaying) {
                            try {
                                animalSound.synth.stop();
                                animalSound.isPlaying = false;
                            } catch (error) {
                                console.error('Error stopping wolf sound:', error);
                                animalSound.isPlaying = false;
                            }
                        }
                    }, 500);
                }
            }
        });

    }, [rabbitPos, animalPositions, status, audioInitialized, animalSounds, updateSpatialAudio, detectedAnimals, setDetectedAnimals, setMessage]);


    // --- Game Logic ---
    const moveHunter = useCallback((currentRabbitPos) => {
        let { row, col } = hunterPos;
        const dRow = currentRabbitPos.row - row;
        const dCol = currentRabbitPos.col - col;

        let nextHunterPos = { row, col };

        // Simple greedy AI: move along the axis with the greatest distance
        if (Math.abs(dRow) > Math.abs(dCol)) {
            nextHunterPos.row += Math.sign(dRow);
        } else if (dCol !== 0) {
            nextHunterPos.col += Math.sign(dCol);
        } else if (dRow !== 0) { // If on same column, move vertically
            nextHunterPos.row += Math.sign(dRow);
        }

        // Check if the hunter's next move is valid (not a wall)
        if (MAZE_GRID[nextHunterPos.row]?.[nextHunterPos.col] !== 'X') {
            setHunterPos(nextHunterPos);
            
            // Check if hunter caught the player after moving
            if (nextHunterPos.row === currentRabbitPos.row && nextHunterPos.col === currentRabbitPos.col) {
                setStatus('lost');
                setMessage('The hunter caught you! Game Over.');
                playSound('lose', 'C2', '2s');
                if (exitSound.current.osc) exitSound.current.osc.volume.value = -Infinity;
                return; // Don't play hunter step sound if game ends
            }
        }
        
        playHunterStep();

    }, [hunterPos, playHunterStep, playSound, exitSound, setStatus, setMessage]);


    const handleKeyDown = useCallback((e) => {
        if (status !== 'playing') return;
        if (!audioInitialized.current) {
            initializeAudio();
            setMessage("Audio started! Use arrow keys to move.");
        }

        let { row, col } = rabbitPos;
        if (e.key === 'ArrowUp') row--;
        else if (e.key === 'ArrowDown') row++;
        else if (e.key === 'ArrowLeft') col--;
        else if (e.key === 'ArrowRight') col++;
        else return;

        const nextTile = MAZE_GRID[row]?.[col];

        if (!nextTile) {
            playSound('wall', 'C2', '0.2s');
            return;
        }

        if (nextTile === 'X') {
            playSound('wall', 'C2', '0.2s');
        } else {
            playSound('move', 'C4', '0.1s');
            // Removed player footstep for cleaner spatial audio
            const newRabbitPos = { row, col };
            setRabbitPos(newRabbitPos);

            // Check for game end conditions after moving
            if (nextTile === 'E') {
                setStatus('won');
                setMessage('You escaped! Congratulations!');
                playSound('win', 'G5', '1s');
                if (exitSound.current.osc) exitSound.current.osc.stop();
            } else if (nextTile === 'A') {
                setStatus('lost');
                setMessage('You ran into a dangerous animal! Game Over.');
                playSound('lose', 'D2', '2s');
                if (exitSound.current.osc) exitSound.current.osc.stop();
            } else {
                 // If game continues, move the hunter
                 moveHunter(newRabbitPos);
            }
        }

    }, [rabbitPos, hunterPos, status, playSound, playPlayerFootstep, moveHunter, audioInitialized, initializeAudio, exitSound]);

    const restartGame = () => {
        setRabbitPos(findStartPosition('R'));
        setHunterPos(findStartPosition('H'));
        setStatus('playing');
        setMessage('Game restarted! Use arrow keys to move.');
        setDetectedAnimals(new Set()); // Reset detected animals
        
        // Reset audio state - focus only on animal sounds
        if (audioInitialized.current) {
            // Reset all animal sounds
            animalSounds.current.forEach(animalSound => {
                if (animalSound.isPlaying) {
                    try {
                        animalSound.synth.stop();
                        animalSound.isPlaying = false;
                    } catch (error) {
                        console.error('Error stopping wolf sound on restart:', error);
                        animalSound.isPlaying = false;
                    }
                }
                animalSound.lastWarningTime = 0;
            });
        } else {
            initializeAudio();
        }
    };

    // Add keyboard listener
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    // --- Visual Rendering ---
    const getTileContent = (row, col) => {
        if (row === rabbitPos.row && col === rabbitPos.col) return '🐰';
        if (status === 'playing' && row === hunterPos.row && col === hunterPos.col) return '👨‍🌾';
        const tile = MAZE_GRID[row][col];
        switch (tile) {
            case 'X': return '🌲';
            case 'E': return '🏠';
            case 'A': 
                // Show wolf emoji for all animals - consistent visual
                return '🐺';
            default: return '';
        }
    };

    return (
        <div className="bg-gray-800 text-white min-h-screen flex flex-col items-center justify-center font-sans p-4">
            <div className="text-center mb-4">
                <h1 className="text-4xl font-bold text-green-400 mb-2">Audio Maze Challenge</h1>
                <p className="text-lg text-gray-300">{message}</p>
                 {!audioInitialized.current && (
                    <p className="text-yellow-400 animate-pulse mt-2">Press any arrow key to start audio and begin.</p>
                )}
                <div className="mt-2 text-sm text-gray-400">
                    <p>🐰 You • 👨‍🌾 Hunter • 🐺 Wolves • 🏠 Exit • 🌲 Walls</p>
                    <p>Listen for: Wolf growls (with ENHANCED left/right positioning)</p>
                    <p className="text-yellow-300 mt-1">🎧 HEADPHONES REQUIRED for clear left/right audio!</p>
                    <p className="text-blue-300">🔊 Left ear = Wolf to your LEFT • Right ear = Wolf to your RIGHT</p>
                    <p className="text-blue-300">Muffled = Behind you • Clear = In front of you</p>
                </div>
            </div>

            <div
                className="bg-green-900 border-4 border-green-600 rounded-lg shadow-lg"
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${MAZE_GRID[0].length}, ${TILE_SIZE}px)`,
                    gridTemplateRows: `repeat(${MAZE_GRID.length}, ${TILE_SIZE}px)`,
                }}
            >
                {MAZE_GRID.map((row, r_idx) =>
                    row.map((_, c_idx) => (
                        <div
                            key={`${r_idx}-${c_idx}`}
                            className="flex items-center justify-center text-2xl"
                            style={{
                                width: TILE_SIZE,
                                height: TILE_SIZE,
                                backgroundColor: MAZE_GRID[r_idx][c_idx] === 'X' ? '#5a3825' : '#789c64',
                            }}
                        >
                            {getTileContent(r_idx, c_idx)}
                        </div>
                    ))
                )}
            </div>
            
            {status !== 'playing' && (
                <button 
                    onClick={restartGame}
                    className="mt-6 px-6 py-3 bg-green-500 text-white font-bold rounded-lg shadow-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 transition-transform transform hover:scale-105"
                >
                    Play Again
                </button>
            )}
        </div>
    );
}
