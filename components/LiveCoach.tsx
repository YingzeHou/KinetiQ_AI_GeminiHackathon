
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { X, Mic, MicOff, Radio, Zap, Loader2, Target, Play, MessageSquareText, RefreshCw, Camera, Settings, Volume2, Video, Activity, Info } from 'lucide-react';

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
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
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
          const val = Math.max(-1, Math.min(1, buffer[originalIndex] || 0));
          res[i] = val * 32768;
      }
      return res;
  }

  const createPcmData = (data: Int16Array): Blob => {
    return {
      data: encode(new Uint8Array(data.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  };

  const cleanup = useCallback(() => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }
    // We can't easily close sessionPromise without tracking the resolved value, 
    // but the WebSocket should close when garbage collected or on unmount via more robust logic.
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
    sessionPromiseRef.current = null;
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const handleStreamSuccess = (stream: MediaStream, hasAudio: boolean) => {
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
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Browser not supported.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' }, 
        audio: true 
      });
      handleStreamSuccess(stream, true);
    } catch (err: any) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user' },
          audio: false 
        });
        handleStreamSuccess(stream, false);
      } catch (err2: any) {
        if (err2.name === 'NotAllowedError' || err2.name === 'PermissionDeniedError') {
             setPermissionError(true);
             setError("Access denied. Please reset permissions.");
        } else if (err2.name === 'NotFoundError') {
             setError("No camera found.");
        } else {
             setError(`Camera Error: ${err2.name}`);
        }
      }
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  const handleStartSession = async () => {
    if (!isCameraEnabled || !streamRef.current) {
        await enableCamera();
        if (!streamRef.current) {
            setError("Camera required for Live Mode.");
            return;
        }
    }

    setHasStarted(true);
    setIsConnecting(true);
    setStatusMessage("Handshaking...");
    setError(null);
    setTranscripts([]);

    connectTimeoutRef.current = window.setTimeout(() => {
        if (!isActive) {
            setError("Handshake timed out. Ensure your project has the Gemini Live API enabled.");
            setIsConnecting(false);
        }
    }, 15000);

    try {
      // Create new instance right before connection
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      inputAudioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      outputAudioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      if (outputAudioCtx.current.state === 'suspended') await outputAudioCtx.current.resume();
      if (inputAudioCtx.current.state === 'suspended') await inputAudioCtx.current.resume();

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
            setIsConnecting(false);
            setIsActive(true);
            setStatusMessage("Live");
            setTranscripts([{ source: 'system', text: "KinetiQ Link Established." }]);

            // Setup Intervals and Processors after Open
            if (audioInputAvailable && streamRef.current && inputAudioCtx.current) {
               const ctx = inputAudioCtx.current;
               const source = ctx.createMediaStreamSource(streamRef.current);
               const processor = ctx.createScriptProcessor(4096, 1, 1);
               const gainNode = ctx.createGain();
               gainNode.gain.value = 3.0; 
               inputGainNodeRef.current = gainNode;
               scriptProcessorRef.current = processor;

               processor.onaudioprocess = (e) => {
                 if (isMuted) {
                     setMicLevel(0);
                     return;
                 }
                 const inputData = e.inputBuffer.getChannelData(0);
                 let sum = 0;
                 for(let i=0; i<inputData.length; i+=100) sum += Math.abs(inputData[i]);
                 const level = Math.min(1, (sum / (inputData.length/100)) * 5);
                 setMicLevel(level);

                 const resampledData = audioResample(inputData, ctx.sampleRate);
                 const pcmBlob = createPcmData(resampledData);
                 
                 // CRITICAL: CHAIN OFF PROMISE
                 sessionPromise.then(session => {
                    session.sendRealtimeInput({ media: pcmBlob });
                 });
                 
                 setIsTransmitting(level > 0.01);
               };

               source.connect(gainNode);
               gainNode.connect(processor);
               processor.connect(ctx.destination);
            }

            frameIntervalRef.current = window.setInterval(() => {
              if (!videoRef.current || !canvasRef.current) return;
              const ctx = canvasRef.current.getContext('2d');
              if (!ctx) return;
              canvasRef.current.width = 480;
              canvasRef.current.height = 360;
              ctx.drawImage(videoRef.current, 0, 0, 480, 360);
              const base64Data = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
              
              // CRITICAL: CHAIN OFF PROMISE
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } });
              });
            }, 500); // 2 FPS is safer for bandwidth
          },

          onmessage: async (message: LiveServerMessage) => {
             if (message.serverContent?.outputTranscription?.text) {
                const text = message.serverContent.outputTranscription.text;
                setTranscripts(prev => {
                    const last = prev[prev.length - 1];
                    if (last && last.source === 'ai' && !last.text.endsWith('.') && !last.text.endsWith('?')) {
                        return [...prev.slice(0, -1), { ...last, text: last.text + text }];
                    }
                    return [...prev, { source: 'ai', text }];
                });
             }

             const base64Audio = message.serverContent?.modelTurn?.parts?.find(p => p.inlineData)?.inlineData?.data;
             if (base64Audio && outputAudioCtx.current) {
                setIsAiTalking(true);
                const ctx = outputAudioCtx.current;
                const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
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

          onerror: (e: any) => {
             console.error("Live Error:", e);
             if (e.message?.includes("Requested entity was not found")) {
                setError("MODEL_NOT_FOUND: Please check if you have selected a paid API key with access to Gemini 2.5.");
                if (typeof window.aistudio !== 'undefined') {
                    window.aistudio.openSelectKey();
                }
             } else {
                setError("Stream interrupted. Connection was dropped.");
             }
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
          systemInstruction: `You are KinetiQ AI, a world-class biomechanics coach for ${sport}. 
          Briefly greet: "KinetiQ Online. Watching your ${sport}." 
          Observe and provide corrections under 6 words after actions.`,
        },
      });

      sessionPromiseRef.current = sessionPromise;

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
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-300">
      <div className="relative flex-1 bg-black overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${isActive ? 'brightness-[0.8] contrast-[1.1]' : 'grayscale'}`} />
        <canvas ref={canvasRef} className="hidden" />

        <div className="absolute inset-0 pointer-events-none">
           {isActive && (
             <div className="absolute top-0 left-0 w-full h-[1px] bg-primary/40 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-[scan_3s_linear_infinite]" />
           )}
           <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
        </div>

        {isActive && (
            <div className="absolute top-24 left-4 right-4 z-20 pointer-events-none flex flex-col items-start justify-end h-64">
                <div className="w-full h-full overflow-y-auto flex flex-col justify-end space-y-3 p-2 pb-8">
                    {transcripts.slice(-4).map((msg, i) => (
                        <div key={i} className={`px-4 py-3 rounded-2xl text-sm font-bold animate-in slide-in-from-left-4 self-start max-w-[85%] ${msg.source === 'system' ? 'bg-primary text-black' : 'bg-white text-black border border-gray-300'}`}>
                            {msg.source === 'ai' && <span className="text-primary mr-1 text-[10px] uppercase tracking-wider block mb-0.5">Coach</span>}
                            {msg.text}
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </div>
        )}

        {!hasStarted && (
           <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-8 bg-black/40 backdrop-blur-sm">
              <div className="bg-dark-900/95 border border-white/10 p-8 rounded-3xl max-w-xs text-center shadow-2xl backdrop-blur-xl">
                 <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6 text-primary animate-pulse"><Target size={32} /></div>
                 <h2 className="text-2xl font-black text-white mb-2">Live {sport} Coach</h2>
                 <p className="text-gray-400 text-sm mb-8 leading-relaxed">High-frequency biomechanical audit.<br/>AI Vision requires camera access.</p>
                 {!isCameraEnabled ? (
                     <button onClick={enableCamera} className="w-full bg-dark-700 hover:bg-dark-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 border border-white/10"><Camera size={20} /> Enable Camera</button>
                 ) : (
                     <button onClick={handleStartSession} className="w-full bg-primary hover:bg-secondary text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-transform active:scale-95"><Play size={20} fill="currentColor" /> Initialize Link</button>
                 )}
                 <button onClick={onClose} className="mt-4 text-gray-500 text-xs hover:text-white transition-colors">Cancel</button>
              </div>
           </div>
        )}

        <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-10 safe-top pointer-events-none">
          <button onClick={onClose} className="bg-black/40 backdrop-blur-md text-white p-3 rounded-full border border-white/10 pointer-events-auto active:bg-white/10"><X size={24} /></button>
          {hasStarted && (
             <div className={`px-4 py-2 rounded-full flex items-center gap-3 backdrop-blur-md border transition-all ${isActive ? 'bg-primary/20 border-primary text-primary' : 'bg-black/60 border-white/10 text-white'}`}>
                {isActive ? (
                  <>
                    <span className="relative flex h-2 w-2">
                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                       <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest">{isAiTalking ? 'Speaking' : 'Observing'}</span>
                  </>
                ) : (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{statusMessage}</span>
                  </>
                )}
             </div>
          )}
          <div className="w-12" />
        </div>

        {error && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center p-8 bg-black/80 backdrop-blur-md">
             <div className="bg-dark-800 p-8 rounded-2xl border border-red-500/30 text-center shadow-2xl max-w-xs">
                <div className="bg-red-500/20 text-red-500 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"><Zap size={24} /></div>
                <p className="text-white font-bold mb-2">Technical Error</p>
                <p className="text-gray-400 text-xs mb-6 leading-relaxed">{error}</p>
                <button onClick={handleReset} className="bg-white text-black px-6 py-4 rounded-xl font-bold w-full flex items-center justify-center gap-2"><RefreshCw size={16} /> Reconnect</button>
             </div>
          </div>
        )}

        {isActive && (
          <div className="absolute bottom-0 left-0 w-full p-10 pb-16 flex justify-between items-center z-10 px-10 pointer-events-auto">
            <div className="flex flex-col items-center gap-1 opacity-60">
               <div className="relative">
                 <Activity size={20} className={isTransmitting ? "text-green-400" : "text-white/30"} />
                 {isTransmitting && <span className="absolute -top-1 -right-1 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>}
               </div>
               <span className="text-[9px] text-white font-bold">UPLINK</span>
            </div>

            <button onClick={() => setIsMuted(!isMuted)} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl relative ${isMuted ? 'bg-red-600' : 'bg-white'}`}>
              {!isMuted && micLevel > 0.05 && <div className="absolute inset-0 bg-primary/30 rounded-full transition-transform duration-75 ease-out scale-[1.3]" style={{ transform: `scale(${1 + micLevel * 0.4})` }} />}
              <div className="relative z-10">{isMuted ? <MicOff size={32} className="text-white" /> : <Mic size={32} className="text-black" />}</div>
            </button>

            <div className="flex flex-col items-center gap-1 opacity-60">
               <Volume2 size={20} className={isAiTalking ? "text-primary animate-pulse" : "text-white"} />
               <span className="text-[9px] text-white font-bold">DWNLNK</span>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes scan {
          from { top: 0%; }
          to { top: 100%; }
        }
      `}</style>
    </div>
  );
};

export default LiveCoach;
