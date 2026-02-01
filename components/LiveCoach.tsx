import React, { useRef, useState, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { X, Mic, MicOff, Radio, Zap, Loader2, Target, Play, MessageSquareText, RefreshCw, Camera, Settings, Volume2, Video, Activity } from 'lucide-react';

interface LiveCoachProps {
  onClose: () => void;
  sport: string;
}

interface TranscriptItem {
  source: 'ai' | 'system';
  text: string;
}

const LiveCoach: React.FC<LiveCoachProps> = ({ onClose, sport }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // State
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAiTalking, setIsAiTalking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioInputAvailable, setAudioInputAvailable] = useState(true);
  const [statusMessage, setStatusMessage] = useState("Ready to connect");
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [micLevel, setMicLevel] = useState(0);
  const [isTransmitting, setIsTransmitting] = useState(false);

  // Audio/Video Refs
  const inputAudioCtx = useRef<AudioContext | null>(null);
  const outputAudioCtx = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const inputGainNodeRef = useRef<GainNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const connectTimeoutRef = useRef<number | null>(null);

  // Helper: Base64
  const encode = (bytes: Uint8Array) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  };

  // Helper: Decode PCM
  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  // Helper: Resample and convert to 16kHz PCM 16-bit
  const audioResample = (buffer: Float32Array, sampleRate: number): Int16Array => {
      const targetRate = 16000;
      if (sampleRate === targetRate) {
          const res = new Int16Array(buffer.length);
          for (let i = 0; i < buffer.length; i++) res[i] = buffer[i] * 32768;
          return res;
      }
      const ratio = sampleRate / targetRate;
      const newLength = Math.ceil(buffer.length / ratio);
      const res = new Int16Array(newLength);
      for (let i = 0; i < newLength; i++) {
          const originalIndex = Math.floor(i * ratio);
          // Clamp to valid range
          const val = Math.max(-1, Math.min(1, buffer[originalIndex]));
          res[i] = val * 32768;
      }
      return res;
  }

  // Helper: Create PCM Blob from resampled data
  const createPcmData = (data: Int16Array): Blob => {
    return {
      data: encode(new Uint8Array(data.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  };

  // Cleanup Function
  const cleanup = useCallback(() => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }
    if (sessionRef.current) sessionRef.current.close();
    audioSourcesRef.current.forEach(s => s.stop());
    if (inputAudioCtx.current) inputAudioCtx.current.close();
    if (outputAudioCtx.current) outputAudioCtx.current.close();
    if (scriptProcessorRef.current) scriptProcessorRef.current.disconnect();
    if (inputGainNodeRef.current) inputGainNodeRef.current.disconnect();
    
    setIsActive(false);
    setIsConnecting(false);
    setIsCameraEnabled(false);
    setMicLevel(0);
    setIsTransmitting(false);
  }, []);

  // Use Effect for cleanup only on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const handleStreamSuccess = (stream: MediaStream, hasAudio: boolean) => {
      console.log("Stream acquired successfully. Audio:", hasAudio);
      streamRef.current = stream;
      setIsCameraEnabled(true);
      setError(null);
      setPermissionError(false);
      setAudioInputAvailable(hasAudio);
      
      if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.onloadedmetadata = () => {
             videoRef.current?.play().catch(e => console.warn("Video play failed:", e));
          };
      }
  };

  const enableCamera = async () => {
    setError(null);
    setPermissionError(false);
    
    // 1. Cleanup existing
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Browser not supported.");
      return;
    }

    try {
      console.log("Requesting camera (Attempt 1: Audio + Video)...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' }, 
        audio: true 
      });
      handleStreamSuccess(stream, true);
    } catch (err: any) {
      console.warn("Initial request failed:", err.name, err.message);

      // FALLBACK: Try Video Only.
      try {
        console.log("Retrying (Attempt 2: Video Only)...");
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user' },
          audio: false 
        });
        handleStreamSuccess(stream, false);
      } catch (err2: any) {
        console.error("Fallback failed:", err2);
        
        if (err2.name === 'NotAllowedError' || err2.name === 'PermissionDeniedError') {
             setPermissionError(true);
             setError("Access denied. Please reset permissions.");
        } else if (err2.name === 'NotFoundError') {
             setError("No camera found.");
        } else if (err2.name === 'NotReadableError') {
             setError("Camera in use by another app.");
        } else {
             setError(`Camera Error: ${err2.name}`);
        }
      }
    }
  };

  // Scroll to bottom of transcript
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  const handleStartSession = async () => {
    if (!isCameraEnabled || !streamRef.current) {
        await enableCamera();
        if (!streamRef.current) {
            setError("Camera lost. Please try enabling again.");
            return;
        }
    }

    setHasStarted(true);
    setIsConnecting(true);
    setStatusMessage("Handshaking...");
    setError(null);
    setTranscripts([]);

    // Set a timeout for connection
    connectTimeoutRef.current = window.setTimeout(() => {
        if (!isActive) {
            setError("Connection timed out. Firewalls might be blocking WebSocket.");
            setIsConnecting(false);
        }
    }, 15000);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // 1. Setup Audio Contexts
      inputAudioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      outputAudioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Force resume
      if (outputAudioCtx.current.state === 'suspended') await outputAudioCtx.current.resume();
      if (inputAudioCtx.current.state === 'suspended') await inputAudioCtx.current.resume();

      // 2. Connect Live API
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log("WebSocket Opened.");
            if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
            setIsConnecting(false);
            setIsActive(true);
            setStatusMessage("Live");
            setTranscripts([{ source: 'system', text: "Link Established. Waiting for AI..." }]);

            // --- B. Audio Streaming (Only if audio input is available) ---
            if (audioInputAvailable && streamRef.current && inputAudioCtx.current) {
               const audioTracks = streamRef.current.getAudioTracks();
               if (audioTracks.length > 0) {
                   const ctx = inputAudioCtx.current;
                   const source = ctx.createMediaStreamSource(streamRef.current);
                   const processor = ctx.createScriptProcessor(4096, 1, 1);
                   
                   // Add Gain Node to boost volume (Mic Booster)
                   const gainNode = ctx.createGain();
                   gainNode.gain.value = 3.0; // Boost input by 300%
                   inputGainNodeRef.current = gainNode;

                   scriptProcessorRef.current = processor;

                   processor.onaudioprocess = (e) => {
                     if (isMuted) {
                         setMicLevel(0);
                         return;
                     }
                     const inputData = e.inputBuffer.getChannelData(0);
                     
                     // Calculate mic level for UI
                     let sum = 0;
                     for(let i=0; i<inputData.length; i+=100) sum += Math.abs(inputData[i]);
                     const level = Math.min(1, (sum / (inputData.length/100)) * 5);
                     setMicLevel(level);

                     // Resample to 16000Hz
                     const resampledData = audioResample(inputData, ctx.sampleRate || 48000);
                     const pcmBlob = createPcmData(resampledData);
                     
                     // Send to Gemini
                     if (sessionRef.current) {
                        sessionRef.current.sendRealtimeInput({ media: pcmBlob });
                        if (level > 0.01) setIsTransmitting(true);
                        else setIsTransmitting(false);
                     }
                   };

                   source.connect(gainNode);
                   gainNode.connect(processor);
                   processor.connect(ctx.destination);
               }
            }

            // --- C. Video Streaming (~3.3 FPS) ---
            frameIntervalRef.current = window.setInterval(() => {
              if (!videoRef.current || !canvasRef.current || !sessionRef.current) return;
              const ctx = canvasRef.current.getContext('2d');
              if (!ctx) return;
              
              // Downscale for bandwidth efficiency
              canvasRef.current.width = 480;
              canvasRef.current.height = 360;
              ctx.drawImage(videoRef.current, 0, 0, 480, 360);
              
              const base64Data = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
              sessionRef.current.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } });
            }, 300);
          },

          onmessage: async (message: LiveServerMessage) => {
             // 1. Handle Text Transcript
             if (message.serverContent?.outputTranscription?.text) {
                const text = message.serverContent.outputTranscription.text;
                if (text) {
                    setTranscripts(prev => {
                        const last = prev[prev.length - 1];
                        if (last && last.source === 'ai' && !last.text.endsWith('.') && !last.text.endsWith('!') && !last.text.endsWith('?')) {
                            return [...prev.slice(0, -1), { ...last, text: last.text + text }];
                        }
                        return [...prev, { source: 'ai', text }];
                    });
                }
             }

             // 2. Handle Audio Output
             const parts = message.serverContent?.modelTurn?.parts || [];
             let audioBase64: string | null = null;
             for (const part of parts) {
                if (part.inlineData && part.inlineData.data) {
                    audioBase64 = part.inlineData.data;
                    break;
                }
             }

             if (audioBase64 && outputAudioCtx.current) {
                setIsAiTalking(true);
                const ctx = outputAudioCtx.current;
                const audioBuffer = await decodeAudioData(decode(audioBase64), ctx, 24000, 1);
                
                const now = ctx.currentTime;
                if (nextStartTimeRef.current < now) nextStartTimeRef.current = now;
                
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                
                audioSourcesRef.current.add(source);
                source.onended = () => {
                  audioSourcesRef.current.delete(source);
                  if (audioSourcesRef.current.size === 0) setIsAiTalking(false);
                };
             }

             if (message.serverContent?.interrupted) {
                audioSourcesRef.current.forEach(s => s.stop());
                audioSourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                setIsAiTalking(false);
             }
          },

          onerror: (e) => {
             console.error(e);
             setError("Connection Error. Please restart.");
             setIsConnecting(false);
             setIsActive(false);
          },
          
          onclose: () => {
             setIsActive(false);
             setStatusMessage("Disconnected");
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          outputAudioTranscription: {}, 
          systemInstruction: `
            You are KinetiQ Live, an elite biomechanics AI coach for ${sport}.
            
            When connection starts, IMMEDIATELY say exactly: "KinetiQ System Online. I am watching your ${sport}."

            # BEHAVIORAL PROTOCOL:

            1.  **MODE: SILENT OBSERVER (Default)**
                - Watch the video stream constantly.
                - IGNORE background noise, standing still, or non-sport movements.
                - DO NOT speak while the user is simply preparing.

            2.  **MODE: ACTION DETECTOR**
                - Wait specifically for the *completion* of a ${sport} repetition.
                - Trigger your response ONLY immediately after the follow-through.

            3.  **MODE: INSTANT CORRECTION**
                - When you speak, you must be RAPID and TECHNICAL.
                - MAX LENGTH: 6 words.
                - FORMAT: [Correction] + [Cue].
                - Example: "Elbow too low. Keep it high."
          `,
        },
      });
      
      // Store session immediately
      sessionRef.current = await sessionPromise;

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to start session.");
      setIsConnecting(false);
    }
  };

  const handleReset = () => {
    cleanup();
    setHasStarted(false); 
    setError(null);
    setIsCameraEnabled(false);
    setAudioInputAvailable(true);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-300">
      <div className="relative flex-1 bg-black overflow-hidden">
        {/* Video Background */}
        <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${isActive ? 'grayscale-[0.2]' : 'grayscale hover:grayscale-0'}`} 
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />

        {/* --- LIVE TRANSCRIPT UI --- */}
        {isActive && (
            <div className="absolute top-24 left-4 right-4 z-20 pointer-events-none flex flex-col items-start justify-end h-64">
                <div className="w-full h-full overflow-y-auto flex flex-col justify-end space-y-3 p-2 mask-linear-fade pb-8">
                    {transcripts.slice(-4).map((msg, i) => (
                        <div 
                            key={i} 
                            className={`
                                px-4 py-3 rounded-2xl text-sm font-bold shadow-xl animate-in slide-in-from-left-4 self-start max-w-[85%]
                                ${msg.source === 'system' 
                                    ? 'bg-primary text-black border-none' 
                                    : 'bg-white text-black border border-gray-300'
                                }
                            `}
                        >
                            {msg.source === 'ai' && <span className="text-primary mr-1 text-[10px] uppercase tracking-wider block mb-0.5">Coach</span>}
                            {msg.text}
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </div>
        )}

        {/* Pre-Start Overlay / Setup Screen */}
        {!hasStarted && (
           <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-8 bg-black/40 backdrop-blur-sm animate-in zoom-in-95">
              <div className="bg-dark-900/95 border border-white/10 p-8 rounded-3xl max-w-xs text-center shadow-2xl backdrop-blur-xl">
                 <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 text-primary animate-pulse">
                    <Target size={32} />
                 </div>
                 <h2 className="text-2xl font-black text-white mb-2">Live {sport} Coach</h2>
                 <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                   Real-time AI corrections. <br/> Please enable camera access to begin.
                 </p>
                 
                 {!isCameraEnabled ? (
                     <button 
                        onClick={enableCamera}
                        className="w-full bg-dark-700 hover:bg-dark-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 border border-white/10"
                     >
                        <Camera size={20} /> Enable Camera
                     </button>
                 ) : (
                     <button 
                        onClick={handleStartSession}
                        className="w-full bg-primary hover:bg-secondary text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-primary/20"
                     >
                        <Play size={20} fill="currentColor" /> Start Session
                     </button>
                 )}
                 
                 <button onClick={onClose} className="mt-4 text-gray-500 text-xs hover:text-white transition-colors">Cancel</button>
              </div>
           </div>
        )}

        {/* Header HUD */}
        <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-10 safe-top pointer-events-none">
          <button onClick={onClose} className="bg-black/40 backdrop-blur-md text-white p-3 rounded-full border border-white/10 pointer-events-auto active:bg-white/10">
            <X size={24} />
          </button>

          <div className="flex flex-col items-center gap-2">
             {hasStarted && (
               <div className={`px-4 py-2 rounded-full flex items-center gap-3 backdrop-blur-md transition-all duration-500 ${isActive ? 'bg-primary border border-primary text-black' : 'bg-black/60 border border-white/10 text-white'}`}>
                  {isActive ? (
                    <>
                      <div className="flex items-center gap-1">
                          {isAiTalking ? (
                             <div className="flex gap-0.5 items-end h-3">
                                <div className="w-1 bg-black animate-[pulse_0.5s_ease-in-out_infinite] h-2"></div>
                                <div className="w-1 bg-black animate-[pulse_0.3s_ease-in-out_infinite] h-3"></div>
                                <div className="w-1 bg-black animate-[pulse_0.4s_ease-in-out_infinite] h-1"></div>
                             </div>
                          ) : (
                             <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-black"></span>
                             </span>
                          )}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        {isAiTalking ? 'SPEAKING' : 'WATCHING'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Loader2 size={14} className="text-primary animate-spin" />
                      <span className="text-gray-300 text-[10px] font-bold uppercase tracking-widest">{statusMessage}</span>
                    </>
                  )}
               </div>
             )}
          </div>
          <div className="w-12" />
        </div>

        {/* Error Modal */}
        {error && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center p-8 bg-black/80 backdrop-blur-md">
             <div className="bg-dark-800 p-8 rounded-2xl border border-red-500/50 text-center shadow-2xl max-w-xs">
                <Zap className="mx-auto text-red-500 mb-4" size={40} />
                <p className="text-white font-bold mb-2">Connection Failed</p>
                <p className="text-gray-400 text-xs mb-6 break-words">{error}</p>
                
                {permissionError ? (
                    <div className="text-left bg-dark-900 p-4 rounded-lg mb-4 border border-white/5">
                        <p className="text-xs text-gray-300 font-bold mb-1 flex items-center gap-2"><Settings size={12}/> How to fix:</p>
                        <ol className="text-xs text-gray-500 list-decimal pl-4 space-y-1">
                            <li>Click the 🔒 icon in the URL bar.</li>
                            <li>Find "Camera" & "Microphone".</li>
                            <li>Set them to "Allow".</li>
                            <li>Reload the page.</li>
                        </ol>
                    </div>
                ) : null}

                <button 
                    onClick={handleReset} 
                    className="bg-white text-black px-6 py-3 rounded-xl font-bold w-full flex items-center justify-center gap-2"
                >
                    <RefreshCw size={16} /> Retry
                </button>
             </div>
          </div>
        )}

        {/* Bottom Controls */}
        {isActive && (
          <div className="absolute bottom-0 left-0 w-full p-10 pb-16 flex justify-between items-center z-10 px-10 pointer-events-auto">
            <div className="flex flex-col items-center gap-1 opacity-60">
               {/* Transmit (TX) Indicator */}
               <div className="relative">
                 <Activity size={20} className={isTransmitting ? "text-green-400" : "text-white/30"} />
                 {isTransmitting && <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                 </span>}
               </div>
               <span className="text-[9px] text-white font-bold">TX</span>
            </div>

            {audioInputAvailable ? (
                <button 
                  onClick={() => setIsMuted(!isMuted)}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl relative group overflow-hidden ${isMuted ? 'bg-red-600 border-red-400' : 'bg-white border-transparent'}`}
                >
                  {/* Mic Level Visualizer Ring */}
                  {!isMuted && micLevel > 0.05 && (
                      <div 
                        className="absolute inset-0 bg-primary/30 rounded-full transition-transform duration-75 ease-out"
                        style={{ transform: `scale(${0.8 + micLevel * 0.4})` }}
                      />
                  )}
                  <div className="relative z-10">
                     {isMuted ? <MicOff size={32} className="text-white" /> : <Mic size={32} className="text-black" />}
                  </div>
                </button>
            ) : (
                <div className="w-20 h-20 rounded-full bg-dark-700 flex items-center justify-center border border-dark-600">
                    <MicOff size={32} className="text-gray-500" />
                </div>
            )}

            <div className="flex flex-col items-center gap-1 opacity-60">
               <Volume2 size={20} className={isAiTalking ? "text-primary animate-pulse" : "text-white"} />
               <span className="text-[9px] text-white font-bold">RX</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveCoach;