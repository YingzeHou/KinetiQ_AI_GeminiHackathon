import React, { useRef, useState, useEffect } from 'react';
import { X, RefreshCcw, AlertCircle } from 'lucide-react';

interface CameraRecorderProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
}

const CameraRecorder: React.FC<CameraRecorderProps> = ({ onCapture, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let localStream: MediaStream | null = null;
    let isMounted = true;

    const initCamera = async () => {
      try {
        setCameraError(null);
        
        // Attempt to get media stream
        // Strategy: Try Video + Audio first. If that fails (e.g. mic denied), try Video only.
        try {
          localStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facingMode },
            audio: true
          });
        } catch (audioErr) {
          console.warn("Audio/Video access failed, falling back to Video only.", audioErr);
          localStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facingMode },
            audio: false
          });
        }

        if (isMounted && localStream) {
          setStream(localStream);
          if (videoRef.current) {
            videoRef.current.srcObject = localStream;
          }
        } else if (localStream) {
            // Component unmounted during promise resolution, clean up immediately
            localStream.getTracks().forEach(track => track.stop());
        }
      } catch (err: any) {
        if (isMounted) {
            console.error("Camera Error:", err);
            let msg = "Unable to access camera.";
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                msg = "Permission denied. Please allow camera access in browser settings.";
            } else if (err.name === 'NotFoundError') {
                msg = "No camera found on this device.";
            } else if (err.name === 'NotReadableError') {
                msg = "Camera is currently in use by another app.";
            }
            setCameraError(msg);
        }
      }
    };

    initCamera();

    return () => {
      isMounted = false;
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [facingMode]);

  const toggleCamera = () => {
    if (isRecording) return;
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const startRecording = () => {
    if (!stream) return;

    // Use a widely supported mime type, prioritize webm/vp9, fall back to mp4 or default
    let mimeType = '';
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      mimeType = 'video/webm;codecs=vp9';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    } else {
      mimeType = 'video/webm'; // Default fallback
    }

    try {
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const type = mimeType || 'video/webm';
        const blob = new Blob(chunksRef.current, { type });
        // Generate a file with appropriate extension
        const ext = type.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `recording_${Date.now()}.${ext}`, { type });
        onCapture(file);
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      // Reset and start timer
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 20) { // Max 20s
            stopRecording();
            return 20;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (e) {
      console.error("MediaRecorder error:", e);
      setCameraError("Failed to start recording. MediaRecorder not supported?");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      <div className="relative flex-1 bg-black overflow-hidden">
        {/* Video Preview */}
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Top Controls */}
        <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-10 safe-top">
           <button 
             onClick={onCancel}
             className="bg-black/40 backdrop-blur-md text-white p-2 rounded-full hover:bg-black/60 transition-colors"
           >
             <X size={24} />
           </button>
           
           <div className={`px-3 py-1 rounded-full font-mono font-bold text-sm backdrop-blur-md ${isRecording ? 'bg-red-500/80 text-white animate-pulse' : 'bg-black/40 text-gray-300'}`}>
              00:{recordingTime.toString().padStart(2, '0')} / 00:20
           </div>

           <button 
             onClick={toggleCamera}
             disabled={isRecording}
             className={`bg-black/40 backdrop-blur-md text-white p-2 rounded-full transition-colors ${isRecording ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black/60'}`}
           >
             <RefreshCcw size={20} />
           </button>
        </div>

        {/* Error Message */}
        {cameraError && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-dark-800 p-6 rounded-xl border border-red-900/50 text-center w-4/5 max-w-sm shadow-2xl z-20">
             <AlertCircle className="mx-auto text-red-500 mb-2" size={32} />
             <p className="text-white font-medium mb-1">Camera Error</p>
             <p className="text-gray-400 text-sm mb-4">{cameraError}</p>
             <button 
               onClick={onCancel} 
               className="bg-dark-700 hover:bg-dark-600 px-6 py-2 rounded-lg text-sm text-white transition-colors"
             >
               Close
             </button>
          </div>
        )}

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 w-full p-8 pb-12 flex justify-center items-center bg-gradient-to-t from-black/90 via-black/50 to-transparent z-10">
          {isRecording ? (
             <button 
               onClick={stopRecording}
               className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center group transition-transform active:scale-95"
             >
                <div className="w-8 h-8 bg-red-500 rounded-lg group-hover:rounded-md transition-all duration-300 shadow-[0_0_15px_rgba(239,68,68,0.5)]"></div>
             </button>
          ) : (
            <button 
               onClick={startRecording}
               disabled={!!cameraError}
               className="w-20 h-20 rounded-full border-4 border-white/80 flex items-center justify-center p-1 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
             >
                <div className="w-full h-full bg-red-500 rounded-full shadow-inner hover:bg-red-600 transition-colors"></div>
             </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraRecorder;