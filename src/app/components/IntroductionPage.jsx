'use client';

import React, { useState, useCallback, useRef } from 'react';

export default function IntroductionPage({ onStartGame }) {
    // --- Audio Instructions State ---
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const audioRef = useRef(null);

    // --- Play pre-recorded instructions ---
    const playInstructions = useCallback(() => {
        if (audioRef.current) {
            setIsAudioPlaying(true);
            audioRef.current.currentTime = 0; // Reset to beginning
            audioRef.current.play().catch(error => {
                console.error('Error playing instructions audio:', error);
                setIsAudioPlaying(false);
            });
        }
    }, []);

    // --- Handle audio events ---
    const handleAudioEnded = useCallback(() => {
        setIsAudioPlaying(false);
    }, []);

    const handleAudioError = useCallback(() => {
        console.error('Error loading instructions audio');
        setIsAudioPlaying(false);
    }, []);

    return (
        <div className="bg-black text-white min-h-screen flex flex-col items-center justify-center font-sans p-4">
            <div className="max-w-lg w-full mx-auto text-center bg-gray-900 rounded-xl border-4 border-yellow-300 shadow-xl p-8">
                <h1 className="text-4xl font-bold text-yellow-300 mb-4 drop-shadow-lg">Audio Maze Game</h1>
                <p className="text-lg text-white mb-6">Navigate the maze using sound. Find the exit, avoid wolves, and use headphones for the best experience.</p>
                <div className="bg-gray-800 text-yellow-200 rounded-lg p-4 mb-6 text-left text-base" style={{lineHeight: '1.6'}}>
                    <strong>Instructions:</strong>
                    <ul className="list-disc ml-6 mt-2 mb-2">
                        <li>Use <b>Arrow Keys</b> to move</li>
                        <li>Press <b>R</b> to restart the game</li>
                        <li>Press <b>Play Instructions</b> to hear audio guide</li>
                    </ul>
                    <strong>Goal:</strong>
                    <ul className="list-disc ml-6 mt-2">
                        <li>Find the exit, guided by the sound of a bell</li>
                        <li>Avoid wolves, which growl when you are close</li>
                    </ul>
                    <span className="block mt-2 text-yellow-300 font-bold">Headphones recommended!</span>
                </div>
                
                {/* Hidden audio element for pre-recorded instructions */}
                <audio
                    ref={audioRef}
                    src="/download.wav"
                    onEnded={handleAudioEnded}
                    onError={handleAudioError}
                    preload="auto"
                    style={{ display: 'none' }}
                />
                
                <div className="flex flex-col items-center gap-4">
                    <button
                        className={`px-6 py-3 font-bold text-lg rounded-lg shadow-lg border-4 transition-all transform ${
                            isAudioPlaying 
                                ? 'bg-blue-500 text-white border-blue-300 cursor-not-allowed animate-pulse' 
                                : 'bg-blue-600 text-white border-blue-300 hover:bg-blue-500 hover:scale-105'
                        }`}
                        onClick={playInstructions}
                        disabled={isAudioPlaying}
                    >
                        {isAudioPlaying ? '🔊 Playing Instructions...' : '🎧 Play Instructions'}
                    </button>
                    
                    <button
                        className="px-8 py-4 font-bold text-xl rounded-lg shadow-lg border-4 transition-all transform bg-yellow-300 text-black border-white hover:bg-yellow-200 hover:scale-105"
                        onClick={onStartGame}
                        autoFocus
                    >
                        Start Game
                    </button>
                </div>
                
                <p className="mt-4 text-green-400 text-sm">Ready to play! Good luck!</p>
            </div>
        </div>
    );
}
