'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as Tone from 'tone';
import { useRouter } from 'next/navigation';

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
    ['X', ' ', 'X', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', 'X', ' ', 'X'],
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

    // Environmental water guidance system (river/waterfall)
    const waterSound = useRef({
        player: null, // Custom audio file player
        fallbackNoise: null, // Fallback synthesized sound
        panner: null,
        lowPassFilter: null,
        highPassFilter: null,
        volume: null,
        isPlaying: false,
        isUsingPlayer: false, // Track if using custom audio
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
        
        // Initialize river/waterfall guidance system (Enhanced 1-8 kHz range for better audibility)
        
        // Create fallback synthesized water sound
        waterSound.current.fallbackNoise = new Tone.Noise({
            type: 'brown', // Brown noise for more natural water sound
            volume: -18, // Further increased base volume for better initial audibility (was -22)
        });
        
        // Try to use custom water audio file, fallback to synthesized sound
        const waterAudioUrl = '/bell.mp3'; // Place your water audio file in the public folder
        let customWaterPlayer;
        
        try {
            customWaterPlayer = new Tone.Player({
                url: waterAudioUrl,
                loop: true, // Enable looping for continuous water sound
                autostart: false,
                fadeIn: 0.2,
                fadeOut: 0.2,
                onload: () => {
                    console.log('Bell sound loaded successfully - using custom audio');
                    waterSound.current.isUsingPlayer = true;
                    // Start the custom audio when loaded
                    if (!waterSound.current.isPlaying) {
                        customWaterPlayer.start();
                        waterSound.current.isPlaying = true;
                        console.log('Started bell audio');
                    }
                },
                onerror: (error) => {
                    console.error('Failed to load bell sound, using fallback brown noise:', error);
                    waterSound.current.isUsingPlayer = false;
                    // Connect and start fallback noise when custom audio fails
                    if (!waterSound.current.isPlaying) {
                        // Disconnect custom player and connect fallback
                        try {
                            customWaterPlayer.disconnect();
                        } catch (e) {
                            // Ignore disconnect errors
                        }
                        waterSound.current.fallbackNoise.connect(waterSound.current.highPassFilter);
                        waterSound.current.fallbackNoise.start();
                        waterSound.current.isPlaying = true;
                        console.log('Started fallback brown noise due to loading error');
                    }
                }
            });
            waterSound.current.player = customWaterPlayer;
        } catch (error) {
            console.error('Failed to create water Player, using fallback noise:', error);
            waterSound.current.player = waterSound.current.fallbackNoise;
            waterSound.current.isUsingPlayer = false;
        }
        
        // High-pass filter - further lowered frequency for better initial audibility
        waterSound.current.highPassFilter = new Tone.Filter({
            frequency: 800, // Further lowered from 1000 Hz for more initial presence
            type: 'highpass',
            rolloff: -12 // Gentler rolloff for smoother transition
        });
        
        // Low-pass filter for distance simulation (makes it muffled when far)
        waterSound.current.lowPassFilter = new Tone.Filter({
            frequency: 8000, // Increased from 6000 Hz for brighter, more audible water sound
            type: 'lowpass',
            rolloff: -12
        });
        
        waterSound.current.panner = new Tone.Panner(0);
        waterSound.current.volume = new Tone.Volume(-14); // Further increased volume control for better initial presence (was -18)
        
        // Create audio chains for both sources but connect only one at a time
        // Custom player chain
        waterSound.current.player.connect(waterSound.current.highPassFilter);
        waterSound.current.highPassFilter.connect(waterSound.current.lowPassFilter);
        waterSound.current.lowPassFilter.connect(waterSound.current.volume);
        waterSound.current.volume.connect(waterSound.current.panner);
        waterSound.current.panner.toDestination();
        
        // Fallback noise chain (separate, will only be used if custom audio fails)
        // DON'T connect fallback noise initially - only connect when needed
        
        // Initialize as not playing - audio will start in the onload/onerror callbacks above
        waterSound.current.isPlaying = false;
        
        // Helper function to connect fallback noise when custom audio fails
        const connectFallbackNoise = () => {
            // Disconnect custom player first
            try {
                waterSound.current.player.disconnect();
            } catch (e) {
                // Ignore disconnect errors
            }
            
            // Connect fallback noise to the audio chain
            waterSound.current.fallbackNoise.connect(waterSound.current.highPassFilter);
            console.log('Connected fallback brown noise to audio chain');
        };
        
        // If custom audio fails to load, we'll connect the fallback in the onerror callback
        // For now, only the custom player is connected
        
        // Set a timeout to check if custom audio loaded, if not use fallback
        setTimeout(() => {
            if (!waterSound.current.isPlaying) {
                console.log('Custom audio did not load in time, using fallback');
                connectFallbackNoise();
                waterSound.current.fallbackNoise.start();
                waterSound.current.isPlaying = true;
                waterSound.current.isUsingPlayer = false;
            }
        }, 2000); // Wait 2 seconds for custom audio to load
        
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

    return { initializeAudio, synths, hunterSound, exitSound, waterSound, animalSounds, audioInitialized };
};

// --- Main Game Component ---
export default function GamePage() {
    const router = useRouter();
    
    // --- Game State ---
    const [rabbitPos, setRabbitPos] = useState(findStartPosition('R'));
    const [animalPositions] = useState(findAllAnimals());
    const [exitPos] = useState(findStartPosition('E'));
    const [status, setStatus] = useState('playing'); // 'playing', 'won', 'lost'
    const [message, setMessage] = useState('Use arrow keys to move. Find the exit!');
    const [detectedAnimals, setDetectedAnimals] = useState(new Set()); // Track which animals have been detected

    const { initializeAudio, synths, hunterSound, exitSound, waterSound, animalSounds, audioInitialized } = useAudioEngine();

    // --- Sound Playback Functions ---
    const playSound = useCallback((sound, note, duration) => {
        if (!audioInitialized.current || !synths.current[sound]) return;
        synths.current[sound].triggerAttackRelease(note, duration);
    }, [audioInitialized, synths]);

    // Calculate enhanced stereo positioning for clear left/right audio separation
    const calculateSpatialAudio = useCallback((playerPos, targetPos, distance) => {
        // Calculate relative position
        const dx = targetPos.col - playerPos.col;
        const dy = targetPos.row - playerPos.row;
        
        // ENHANCED panning calculation for CLEAR left/right separation
        const panValue = Math.max(-1, Math.min(1, dx / 2));
        const boostedPan = panValue * 1.5;
        const finalPan = Math.max(-1, Math.min(1, boostedPan));
        
        // Calculate front/back perception using frequency filtering
        const frontBackFactor = dy;
        const filterFreq = frontBackFactor > 0 
            ? 2000 + (frontBackFactor * 300)
            : 1200 - (Math.abs(frontBackFactor) * 200);
        
        // Distance-based reverb for depth perception
        const reverbWet = Math.min(distance / 8, 0.7);
        
        return {
            pan: finalPan,
            filterFreq: Math.max(300, Math.min(4000, filterFreq)),
            reverbWet: reverbWet,
            distance: distance
        };
    }, []);

    // Enhanced spatial audio positioning with aggressive left/right separation
    const updateSpatialAudio = useCallback((animalSound, playerPos, distance) => {
        const spatialParams = calculateSpatialAudio(playerPos, animalSound.position, distance);
        
        animalSound.panner.pan.rampTo(spatialParams.pan, 0.05);
        animalSound.filter.frequency.rampTo(spatialParams.filterFreq, 0.2);
        animalSound.reverb.wet.rampTo(spatialParams.reverbWet, 0.3);
        
        console.log(`Animal ${animalSound.position.row},${animalSound.position.col}: Pan=${spatialParams.pan.toFixed(2)}, Distance=${distance.toFixed(1)}`);
    }, [calculateSpatialAudio]);

    // River/waterfall guidance system
    const updateWaterSound = useCallback((playerPos, exitPos) => {
        if (!audioInitialized.current || !waterSound.current.isPlaying) return;
        
        const dx = exitPos.col - playerPos.col;
        const dy = exitPos.row - playerPos.row;
        const distanceToExit = Math.sqrt(dx * dx + dy * dy);
        
        const waterPan = Math.max(-1, Math.min(1, dx / 6));
        
        const maxWaterDistance = 15;
        const minWaterIntensity = 0.25;
        const rawIntensity = Math.max(0, 1 - (distanceToExit / maxWaterDistance));
        const waterIntensity = Math.max(minWaterIntensity, rawIntensity);
        
        const baseVolume = -18;
        const maxWaterVolume = -5;
        const waterVolume = baseVolume + (waterIntensity * (maxWaterVolume - baseVolume));
        
        const minFilterFreq = 1500;
        const maxFilterFreq = 8000;
        const waterFilterFreq = minFilterFreq + (waterIntensity * (maxFilterFreq - minFilterFreq));
        
        waterSound.current.panner.pan.rampTo(waterPan, 0.8);
        waterSound.current.volume.volume.rampTo(waterVolume, 1.2);
        waterSound.current.lowPassFilter.frequency.rampTo(waterFilterFreq, 1.0);
        
        const waterHighPassFreq = 800 + (Math.abs(waterPan) * 400);
        waterSound.current.highPassFilter.frequency.rampTo(waterHighPassFreq, 1.0);
        
        if (waterIntensity > 0.05) {
            const audioSource = waterSound.current.isUsingPlayer ? 'Custom Audio' : 'Synthesized';
            console.log(`Water guidance (${audioSource}): Pan=${waterPan.toFixed(2)}, Intensity=${waterIntensity.toFixed(2)}, Volume=${waterVolume.toFixed(1)}dB, Filter=${waterFilterFreq.toFixed(0)}Hz, Distance=${distanceToExit.toFixed(1)}`);
        }
    }, [audioInitialized]);
    
    // --- Update Audio Cues based on Game State ---
    useEffect(() => {
        if (status !== 'playing' || !audioInitialized.current) {
            if (exitSound.current.osc) {
                exitSound.current.osc.stop();
            }
            if (waterSound.current.isPlaying) {
                waterSound.current.volume.volume.rampTo(-Infinity, 0.5);
            }
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
        }

        updateWaterSound(rabbitPos, exitPos);

        animalSounds.current.forEach((animalSound, index) => {
            const animal = animalSound.position;
            const dxAnimal = rabbitPos.col - animal.col;
            const dyAnimal = rabbitPos.row - animal.row;
            const distanceAnimal = Math.sqrt(dxAnimal * dxAnimal + dyAnimal * dyAnimal);
            
            updateSpatialAudio(animalSound, rabbitPos, distanceAnimal);
            
            const animalKey = `animal_${index}`;
            
            if (distanceAnimal <= 6) {
                if (!detectedAnimals.has(animalKey)) {
                    setDetectedAnimals(prev => new Set([...prev, animalKey]));
                    const proximity = distanceAnimal <= 3 ? '- VERY CLOSE!' : '- nearby';
                    
                    const dx = animal.col - rabbitPos.col;
                    let direction = '';
                    if (dx > 1) direction = '→ RIGHT';
                    else if (dx < -1) direction = '← LEFT';
                    else direction = '↕ CENTER';
                    
                    setMessage(`🐺 Wolf detected ${proximity} ${direction}`);
                }
                
                if (!animalSound.isPlaying) {
                    try {
                        if (animalSound.isUsingPlayer) {
                            if (animalSound.synth.loaded) {
                                animalSound.synth.start();
                                animalSound.isPlaying = true;
                            } else {
                                const frequency = 120 + Math.random() * 30;
                                animalSound.fallbackSynth.triggerAttack(frequency);
                                animalSound.isPlaying = true;
                            }
                        } else {
                            const frequency = 120 + Math.random() * 30;
                            animalSound.synth.triggerAttack(frequency);
                            animalSound.isPlaying = true;
                        }
                    } catch (error) {
                        console.error('Error starting wolf sound, using fallback:', error);
                        const frequency = 120 + Math.random() * 30;
                        animalSound.fallbackSynth.triggerAttack(frequency);
                        animalSound.isPlaying = true;
                    }
                }
                
                const volumeAnimal = -8 - (distanceAnimal * 2.5);
                animalSound.synth.volume.rampTo(volumeAnimal, 0.2);
            } else {
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
    }, [rabbitPos, animalPositions, exitPos, status, audioInitialized, animalSounds, updateSpatialAudio, updateWaterSound, detectedAnimals, setDetectedAnimals, setMessage]);

    // --- Game Logic ---
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'r' || e.key === 'R') {
            restartGame();
            return;
        }

        if (e.key === 'i' || e.key === 'I') {
            goToIntro();
            return;
        }

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
            const newRabbitPos = { row, col };
            setRabbitPos(newRabbitPos);

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
            }
        }
    }, [rabbitPos, status, playSound, audioInitialized, initializeAudio, exitSound]);

    const restartGame = () => {
        setRabbitPos(findStartPosition('R'));
        setStatus('playing');
        setMessage('Game restarted! Use arrow keys to move.');
        setDetectedAnimals(new Set());
        
        if (audioInitialized.current) {
            if (waterSound.current.isPlaying) {
                waterSound.current.volume.volume.rampTo(-18, 0.5);
            }
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

    const goToIntro = () => {
        // Stop all audio before navigating
        if (audioInitialized.current) {
            if (waterSound.current.isPlaying) {
                waterSound.current.volume.volume.rampTo(-Infinity, 0.5);
            }
            animalSounds.current.forEach(animalSound => {
                if (animalSound.isPlaying) {
                    try {
                        animalSound.synth.stop();
                        animalSound.isPlaying = false;
                    } catch (error) {
                        console.error('Error stopping wolf sound when going to intro:', error);
                        animalSound.isPlaying = false;
                    }
                }
            });
        }
        router.push('/');
    };

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    const getTileContent = (row, col) => {
        if (row === rabbitPos.row && col === rabbitPos.col) return '🐰';
        const tile = MAZE_GRID[row][col];
        switch (tile) {
            case 'X': return '🌲';
            case 'E': return '🏠';
            case 'A': return '🐺';
            default: return '';
        }
    };

    return (
        <div className="bg-black text-white min-h-screen flex flex-col items-center justify-center font-sans p-4">
            <div className="text-center mb-4">
                <h1 className="text-5xl font-bold text-yellow-300 mb-3 drop-shadow-lg">Audio Maze Game</h1>
                <p className="text-xl text-white font-semibold bg-gray-900 px-4 py-2 rounded-lg mb-3">{message}</p>
                 {!audioInitialized.current && (
                    <p className="text-yellow-200 bg-red-800 px-4 py-2 rounded-lg font-bold animate-pulse mt-2">
                        Press any ARROW KEY to start audio and begin playing
                    </p>
                )}
                <div className="mt-4 text-lg bg-gray-900 p-4 rounded-lg border-2 border-yellow-300">
                    <p className="text-white font-bold mb-2">🎮 CONTROLS:</p>
                    <p className="text-yellow-200 mb-1">Arrow Keys = Move • R Key = Restart Game • I Key = Back to Instructions</p>
                    <p className="text-white font-bold mb-2 mt-3">🎧 AUDIO GUIDE:</p>
                    <p className="text-cyan-200 mb-1">🔔 Bell Sound = Direction to Exit</p>
                    <p className="text-red-200 mb-1">🐺 Wolf Growls = Danger (Left/Right Ear)</p>
                    <p className="text-yellow-200 font-bold mt-3">⚠ HEADPHONES REQUIRED FOR SPATIAL AUDIO</p>
                </div>
            </div>

            <div
                className="bg-black border-4 border-yellow-300 rounded-lg shadow-lg"
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
                            className="flex items-center justify-center text-2xl border border-gray-600"
                            style={{
                                width: TILE_SIZE,
                                height: TILE_SIZE,
                                backgroundColor: MAZE_GRID[r_idx][c_idx] === 'X' ? '#1a1a1a' : '#ffffff',
                                color: MAZE_GRID[r_idx][c_idx] === 'X' ? '#ffffff' : '#000000',
                            }}
                        >
                            {getTileContent(r_idx, c_idx)}
                        </div>
                    ))
                )}
            </div>
            
            {status !== 'playing' && (
                <div className="flex gap-4">
                    <button 
                        onClick={restartGame}
                        className="mt-6 px-6 py-3 bg-yellow-300 text-black font-bold text-lg rounded-lg shadow-lg border-4 border-white hover:bg-yellow-200 focus:outline-none focus:ring-4 focus:ring-yellow-500 transition-transform transform hover:scale-105"
                    >
                        Play Again (or press R)
                    </button>
                    <button 
                        onClick={goToIntro}
                        className="mt-6 px-6 py-3 bg-blue-600 text-white font-bold text-lg rounded-lg shadow-lg border-4 border-blue-300 hover:bg-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500 transition-transform transform hover:scale-105"
                    >
                        Back to Instructions
                    </button>
                </div>
            )}
        </div>
    );
}
