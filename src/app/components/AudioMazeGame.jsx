'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as Tone from 'tone';

// --- Game Configuration ---
const MAZE_GRID = [
    ['R', ' ', 'W', ' ', 'X', ' ', 'X', ' ', 'X', ' '],
    ['X', ' ', 'X', ' ', 'X', ' ', 'X', ' ', 'X', ' '],
    ['X', ' ', 'X', ' ', ' ', ' ', ' ', ' ', 'X', ' '],
    ['X', ' ', 'X', 'X', 'X', 'X', 'X', ' ', 'X', ' '],
    ['X', ' ', ' ', ' ', ' ', ' ', 'X', ' ', 'X', ' '],
    ['X', ' ', 'X', 'X', 'X', ' ', 'X', ' ', 'X', ' '],
    ['X', ' ', 'X', 'A', 'X', ' ', 'X', ' ', ' ', ' '],
    ['X', ' ', 'X', ' ', 'X', ' ', 'X', 'X', 'X', ' '],
    ['X', ' ', ' ', ' ', 'X', ' ', ' ', ' ', 'X', 'E'],
    ['X', 'H', 'X', ' ', 'X', 'X', 'X', ' ', 'X', 'X'],
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

// --- Audio Engine ---
// We use useRef to ensure Tone.js objects are created only once.
const useAudioEngine = () => {
    const audioInitialized = useRef(false);
    
    const synths = useRef({
        move: null,
        wall: null,
        win: null,
        lose: null,
        animal: null,
    });

    const hunterSound = useRef({
        laugh: null,
        panner: null,
        filter: null,
    });
    
    const exitSound = useRef({
        osc: null,
        panner: null,
    });

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
        
        // Ambient dangerous animal sound
        synths.current.animal = new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.5, decay: 0.2, sustain: 0.1 } }).toDestination();
        synths.current.animal.volume.value = -20;

        // Hunter sound (using audio file with looping and 3D positioning)
        hunterSound.current.panner = new Tone.Panner(0).toDestination();
        hunterSound.current.filter = new Tone.Filter(400, "lowpass").connect(hunterSound.current.panner);
        hunterSound.current.laugh = new Tone.Player({
            url: "./sounds/evil-laugh.mp3",
            loop: true,
            autostart: false,
            volume: -Infinity // Start silent
        }).connect(hunterSound.current.filter);

        // Exit beacon sound
        exitSound.current.panner = new Tone.Panner(0).toDestination();
        exitSound.current.osc = new Tone.Oscillator(440, "sine").connect(exitSound.current.panner).start();
        exitSound.current.osc.volume.value = -Infinity; // Start silent

        audioInitialized.current = true;
        console.log("Audio Engine Initialized");
    };

    return { initializeAudio, synths, hunterSound, exitSound, audioInitialized };
};


// --- Main Game Component ---
export default function AudioMazeGame() {
    const [rabbitPos, setRabbitPos] = useState(findStartPosition('R'));
    const [hunterPos, setHunterPos] = useState(findStartPosition('H'));
    const [animalPos] = useState(findStartPosition('A'));
    const [exitPos] = useState(findStartPosition('E'));
    const [status, setStatus] = useState('playing'); // 'playing', 'won', 'lost'
    const [message, setMessage] = useState('Use arrow keys to move. Find the exit!');

    const { initializeAudio, synths, hunterSound, exitSound, audioInitialized } = useAudioEngine();

    // --- Sound Playback Functions ---

    const playSound = useCallback((sound, note, duration) => {
        if (!audioInitialized.current || !synths.current[sound]) return;
        synths.current[sound].triggerAttackRelease(note, duration);
    }, [audioInitialized, synths]);

    const playHunterStep = useCallback(() => {
        if (!audioInitialized.current || !hunterSound.current.laugh) return;
        // Start the looping laugh if it's not already playing
        if (hunterSound.current.laugh.loaded && hunterSound.current.laugh.state !== 'started') {
            hunterSound.current.laugh.start();
        }
    }, [audioInitialized]);
    
    // --- Update Audio Cues based on Game State ---
    useEffect(() => {
        if (status !== 'playing' || !audioInitialized.current) {
            if (exitSound.current.osc) exitSound.current.osc.volume.value = -Infinity;
            // Stop hunter laugh when game ends
            if (hunterSound.current.laugh && hunterSound.current.laugh.state === 'started') {
                hunterSound.current.laugh.stop();
            }
            return;
        }

        // --- Hunter Proximity and Direction ---
        const dxHunter = rabbitPos.col - hunterPos.col;
        const dyHunter = rabbitPos.row - hunterPos.row;
        const distanceHunter = Math.sqrt(dxHunter * dxHunter + dyHunter * dyHunter);
        
        // Panning: -1 is left, 1 is right
        const panHunter = Math.max(-1, Math.min(1, dxHunter / 5));
        if (hunterSound.current.panner) {
            hunterSound.current.panner.pan.rampTo(panHunter, 0.1);
        }

        // Start the hunter laugh when game is playing
        if (hunterSound.current.laugh && hunterSound.current.laugh.loaded) {
            if (hunterSound.current.laugh.state !== 'started') {
                hunterSound.current.laugh.start();
            }
            
            // Volume based on distance: closer = louder, farther = quieter
            const maxDistance = 10; // Adjust this value to control max hearing distance
            const volumeHunter = distanceHunter >= maxDistance 
                ? -Infinity 
                : -5 - (distanceHunter * 4); // Gets louder as hunter gets closer
            
            hunterSound.current.laugh.volume.rampTo(volumeHunter, 0.2);
        }

        // --- Exit Beacon Proximity and Direction ---
        const dxExit = rabbitPos.col - exitPos.col;
        const dyExit = rabbitPos.row - exitPos.row;
        const distanceExit = Math.sqrt(dxExit * dxExit + dyExit * dyExit);

        const panExit = Math.max(-1, Math.min(1, dxExit / 5));
        exitSound.current.panner.pan.rampTo(panExit, 0.1);
        
        // Volume increases as player gets closer
        const volumeExit = -15 - distanceExit * 2.5;
        exitSound.current.osc.volume.rampTo(volumeExit, 0.1);
        // Pitch increases as player gets closer
        const freqExit = 440 + (15 - distanceExit) * 20;
        exitSound.current.osc.frequency.rampTo(freqExit, 0.1);

        // --- Dangerous Animal Proximity ---
        const dxAnimal = rabbitPos.col - animalPos.col;
        const dyAnimal = rabbitPos.row - animalPos.row;
        const distanceAnimal = Math.sqrt(dxAnimal * dxAnimal + dyAnimal * dyAnimal);
        if (distanceAnimal < 3) {
            if (synths.current.animal.volume.value === -Infinity) {
                 synths.current.animal.triggerAttack();
            }
            synths.current.animal.volume.rampTo(-20 - distanceAnimal * 5, 0.2);
        } else {
            synths.current.animal.volume.rampTo(-Infinity, 0.5, "+0.2");
             if (synths.current.animal.volume.value <= -Infinity) {
                  synths.current.animal.triggerRelease();
             }
        }

    }, [rabbitPos, hunterPos, exitPos, animalPos, status, audioInitialized, synths, hunterSound, exitSound]);


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
        }
        
        playHunterStep();

    }, [hunterPos, playHunterStep]);


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
            const newRabbitPos = { row, col };
            setRabbitPos(newRabbitPos);

            // Check for game end conditions after moving
            if (nextTile === 'E') {
                setStatus('won');
                setMessage('You escaped! Congratulations!');
                playSound('win', 'G5', '1s');
                if (exitSound.current.osc) exitSound.current.osc.volume.value = -Infinity;
                // Stop hunter laugh
                if (hunterSound.current.laugh && hunterSound.current.laugh.state === 'started') {
                    hunterSound.current.laugh.stop();
                }
            } else if (row === hunterPos.row && col === hunterPos.col) {
                setStatus('lost');
                setMessage('The hunter caught you! Game Over.');
                playSound('lose', 'C2', '2s');
                if (exitSound.current.osc) exitSound.current.osc.volume.value = -Infinity;
                // Stop hunter laugh
                if (hunterSound.current.laugh && hunterSound.current.laugh.state === 'started') {
                    hunterSound.current.laugh.stop();
                }
            } else if (nextTile === 'A') {
                setStatus('lost');
                setMessage('You ran into a dangerous animal! Game Over.');
                playSound('lose', 'D2', '2s');
                if (exitSound.current.osc) exitSound.current.osc.volume.value = -Infinity;
                // Stop hunter laugh
                if (hunterSound.current.laugh && hunterSound.current.laugh.state === 'started') {
                    hunterSound.current.laugh.stop();
                }
            } else {
                 // If game continues, move the hunter
                 moveHunter(newRabbitPos);
            }
        }

    }, [rabbitPos, hunterPos, status, playSound, moveHunter, audioInitialized, initializeAudio, exitSound, hunterSound]);

    const restartGame = () => {
        setRabbitPos(findStartPosition('R'));
        setHunterPos(findStartPosition('H'));
        setStatus('playing');
        setMessage('Game restarted! Use arrow keys to move.');
        if (!audioInitialized.current) {
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