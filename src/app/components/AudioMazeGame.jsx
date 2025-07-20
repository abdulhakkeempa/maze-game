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
        
        // Player footstep sound
        synths.current.playerFootstep = new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 0.005, decay: 0.08, sustain: 0 }
        }).toDestination();
        synths.current.playerFootstep.volume.value = -15;

        // Danger alert sound - for general danger notifications
        synths.current.dangerAlert = new Tone.Synth({
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.3 }
        }).toDestination();
        synths.current.dangerAlert.volume.value = -10;

        // Animal sounds for each animal in the maze
        const animals = findAllAnimals();
        animals.forEach((animal, index) => {
            const animalSound = {
                synth: new Tone.NoiseSynth({ 
                    noise: { type: index % 2 === 0 ? 'brown' : 'pink' }, 
                    envelope: { attack: 0.5, decay: 0.2, sustain: 0.1, release: 0.3 } 
                }),
                panner: new Tone.Panner(0),
                position: animal,
                isPlaying: false,
                warningSound: new Tone.Synth({
                    oscillator: { type: 'triangle' },
                    envelope: { attack: 0.05, decay: 0.1, sustain: 0.3, release: 0.4 }
                }),
                lastWarningTime: 0
            };
            animalSound.synth.connect(animalSound.panner);
            animalSound.warningSound.connect(animalSound.panner);
            animalSound.panner.toDestination();
            animalSound.synth.volume.value = -Infinity;
            animalSound.warningSound.volume.value = -Infinity;
            animalSounds.current.push(animalSound);
        });

        // Hunter sound (footsteps)
        hunterSound.current.panner = new Tone.Panner(0).toDestination();
        hunterSound.current.filter = new Tone.Filter(400, "lowpass").connect(hunterSound.current.panner);
        hunterSound.current.noise = new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0 }
        }).connect(hunterSound.current.filter);

        // Exit beacon sound
        exitSound.current.panner = new Tone.Panner(0).toDestination();
        exitSound.current.osc = new Tone.Oscillator(440, "sine").connect(exitSound.current.panner);
        exitSound.current.osc.volume.value = -Infinity; // Start silent

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
        if (!audioInitialized.current || !synths.current.playerFootstep) return;
        // Use triggerAttackRelease for cleaner sound without echo
        synths.current.playerFootstep.triggerAttackRelease('0.08');
    }, [audioInitialized]);

    const playHunterStep = useCallback(() => {
        if (!audioInitialized.current || !hunterSound.current.noise) return;
        // Use triggerAttackRelease for cleaner sound without echo
        hunterSound.current.noise.triggerAttackRelease('0.1');
    }, [audioInitialized]);

    const announceDanger = useCallback((distanceLevel, animalIndex) => {
        if (!audioInitialized.current || !synths.current.dangerAlert) return;
        
        // Play different danger level sounds
        let alertPattern = [];
        switch (distanceLevel) {
            case 'critical':
                // Rapid urgent beeps
                alertPattern = [800, 900, 800, 900];
                break;
            case 'high':
                // Double beep warning
                alertPattern = [600, 700];
                break;
            case 'moderate':
                // Single warning tone
                alertPattern = [500];
                break;
        }
        
        alertPattern.forEach((freq, i) => {
            setTimeout(() => {
                synths.current.dangerAlert.triggerAttackRelease(freq, "0.1");
            }, i * 150);
        });
    }, [audioInitialized]);
    
    // --- Update Audio Cues based on Game State ---
    useEffect(() => {
        if (status !== 'playing' || !audioInitialized.current) {
            if (exitSound.current.osc) {
                exitSound.current.osc.stop();
            }
            // Stop all animal sounds
            animalSounds.current.forEach(animalSound => {
                if (animalSound.isPlaying) {
                    animalSound.synth.triggerRelease();
                    animalSound.isPlaying = false;
                }
            });
            return;
        };

        // Start exit sound if not already started
        if (exitSound.current.osc && exitSound.current.osc.state === 'stopped') {
            exitSound.current.osc.start();
        }

        // --- Hunter Proximity and Direction ---
        const dxHunter = rabbitPos.col - hunterPos.col;
        const dyHunter = rabbitPos.row - hunterPos.row;
        const distanceHunter = Math.sqrt(dxHunter * dxHunter + dyHunter * dyHunter);
        
        // Panning: -1 is left, 1 is right
        const panHunter = Math.max(-1, Math.min(1, dxHunter / 7));
        if (hunterSound.current.panner) {
            hunterSound.current.panner.pan.rampTo(panHunter, 0.1);
        }

        // Volume: louder when closer. Max volume at distance 1.
        const volumeHunter = -5 - distanceHunter * 3; // dB
        if (hunterSound.current.noise) {
            hunterSound.current.noise.volume.rampTo(volumeHunter, 0.1);
        }

        // --- Exit Beacon Proximity and Direction ---
        const dxExit = rabbitPos.col - exitPos.col;
        const dyExit = rabbitPos.row - exitPos.row;
        const distanceExit = Math.sqrt(dxExit * dxExit + dyExit * dyExit);

        const panExit = Math.max(-1, Math.min(1, dxExit / 7));
        if (exitSound.current.panner) {
            exitSound.current.panner.pan.rampTo(panExit, 0.1);
        }
        
        // Volume increases as player gets closer
        const volumeExit = -15 - distanceExit * 2.5;
        if (exitSound.current.osc && exitSound.current.osc.state === 'started') {
            exitSound.current.osc.volume.rampTo(volumeExit, 0.1);
            // Pitch increases as player gets closer
            const freqExit = 440 + (15 - distanceExit) * 20;
            exitSound.current.osc.frequency.rampTo(freqExit, 0.1);
        }

        // --- Multiple Animals Proximity and Direction ---
        animalSounds.current.forEach((animalSound, index) => {
            const animal = animalSound.position;
            const dxAnimal = rabbitPos.col - animal.col;
            const dyAnimal = rabbitPos.row - animal.row;
            const distanceAnimal = Math.sqrt(dxAnimal * dxAnimal + dyAnimal * dyAnimal);
            
            // Panning for spatial audio
            const panAnimal = Math.max(-1, Math.min(1, dxAnimal / 7));
            animalSound.panner.pan.rampTo(panAnimal, 0.1);
            
            const currentTime = Date.now();
            const animalKey = `animal_${index}`;
            
            // Proximity-based audio system
            if (distanceAnimal <= 1.5) {
                // CRITICAL DANGER: Very close to animal
                if (!detectedAnimals.has(animalKey)) {
                    setDetectedAnimals(prev => new Set([...prev, animalKey]));
                    announceDanger('critical', index);
                    setMessage('⚠️ CRITICAL DANGER! Animal very close!');
                }
                
                if (!animalSound.isPlaying) {
                    animalSound.synth.triggerAttack();
                    animalSound.isPlaying = true;
                }
                // Loud animal sounds
                const volumeAnimal = -10 - distanceAnimal * 2;
                animalSound.synth.volume.rampTo(volumeAnimal, 0.1);
                
                // Critical warning beeps - frequent and urgent
                if (currentTime - animalSound.lastWarningTime > 300) { // Every 300ms
                    const warningFreq = 800 + Math.random() * 200; // High pitched urgent sound
                    animalSound.warningSound.volume.value = -8;
                    animalSound.warningSound.triggerAttackRelease(warningFreq, "0.15");
                    animalSound.lastWarningTime = currentTime;
                }
                
            } else if (distanceAnimal <= 3) {
                // HIGH DANGER: Close to animal
                if (!detectedAnimals.has(animalKey)) {
                    setDetectedAnimals(prev => new Set([...prev, animalKey]));
                    announceDanger('high', index);
                    setMessage('⚠️ HIGH DANGER! Animal nearby!');
                }
                
                if (!animalSound.isPlaying) {
                    animalSound.synth.triggerAttack();
                    animalSound.isPlaying = true;
                }
                // Medium volume animal sounds
                const volumeAnimal = -18 - distanceAnimal * 3;
                animalSound.synth.volume.rampTo(volumeAnimal, 0.2);
                
                // Warning beeps - moderate frequency
                if (currentTime - animalSound.lastWarningTime > 800) { // Every 800ms
                    const warningFreq = 600 + Math.random() * 100;
                    animalSound.warningSound.volume.value = -12;
                    animalSound.warningSound.triggerAttackRelease(warningFreq, "0.2");
                    animalSound.lastWarningTime = currentTime;
                }
                
            } else if (distanceAnimal <= 5) {
                // MODERATE DANGER: Animal in vicinity
                if (!detectedAnimals.has(animalKey)) {
                    setDetectedAnimals(prev => new Set([...prev, animalKey]));
                    announceDanger('moderate', index);
                    setMessage('⚠️ CAUTION: Animal detected in area.');
                }
                
                if (!animalSound.isPlaying) {
                    animalSound.synth.triggerAttack();
                    animalSound.isPlaying = true;
                }
                // Quieter animal sounds
                const volumeAnimal = -25 - distanceAnimal * 2;
                animalSound.synth.volume.rampTo(volumeAnimal, 0.3);
                
                // Gentle warning tones - less frequent
                if (currentTime - animalSound.lastWarningTime > 1500) { // Every 1.5 seconds
                    const warningFreq = 400 + Math.random() * 50;
                    animalSound.warningSound.volume.value = -18;
                    animalSound.warningSound.triggerAttackRelease(warningFreq, "0.3");
                    animalSound.lastWarningTime = currentTime;
                }
                
            } else {
                // SAFE DISTANCE: No immediate danger
                if (detectedAnimals.has(animalKey) && distanceAnimal > 6) {
                    // Remove from detected when far enough away
                    setDetectedAnimals(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(animalKey);
                        return newSet;
                    });
                    if (detectedAnimals.size === 1) { // This was the last detected animal
                        setMessage('✓ Area clear. Continue exploring.');
                    }
                }
                
                if (animalSound.isPlaying) {
                    animalSound.synth.volume.rampTo(-Infinity, 0.5);
                    animalSound.warningSound.volume.value = -Infinity;
                    setTimeout(() => {
                        if (animalSound.isPlaying) {
                            animalSound.synth.triggerRelease();
                            animalSound.isPlaying = false;
                        }
                    }, 500);
                }
            }
        });

    }, [rabbitPos, hunterPos, exitPos, animalPositions, status, audioInitialized, synths, hunterSound, exitSound, animalSounds]);


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
            playPlayerFootstep(); // Add player footstep sound
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
        
        // Reset audio state
        if (audioInitialized.current) {
            // Stop and recreate exit sound to prevent echo
            if (exitSound.current.osc) {
                try {
                    exitSound.current.osc.stop();
                } catch (e) {
                    // Oscillator might already be stopped
                }
            }
            exitSound.current.osc = new Tone.Oscillator(440, "sine").connect(exitSound.current.panner);
            exitSound.current.osc.volume.value = -Infinity;
            
            // Reset all animal sounds
            animalSounds.current.forEach(animalSound => {
                if (animalSound.isPlaying) {
                    animalSound.synth.triggerRelease();
                    animalSound.isPlaying = false;
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
            case 'A': return '🐺';
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
                    <p>🐰 You • 👨‍🌾 Hunter • 🐺 Animals • 🏠 Exit • 🌲 Walls</p>
                    <p>Listen for: Footsteps (hunter), Animal sounds, Exit beacon</p>
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
