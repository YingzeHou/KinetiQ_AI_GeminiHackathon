
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { ChevronLeft, Award, PlayCircle, Eye, MonitorPlay, LayoutGrid, PauseCircle, Play, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Check, X } from 'lucide-react';
import { AnalysisResult, SportType } from '../types';
import CustomRadarChart from '../components/RadarChart';
import { calculateVideoContentRect, VideoContentRect } from '../services/motionGeometry';

interface ResultPageProps {
  analysisResult: AnalysisResult;
  videoPreview: string;
  selectedSport: SportType;
  onBack: () => void;
  onViewVisualization: (image: string) => void;
}

const ResultPage: React.FC<ResultPageProps> = ({
  analysisResult,
  videoPreview,
  selectedSport,
  onBack,
  onViewVisualization,
}) => {
  const [activeTab, setActiveTab] = useState<'visual' | 'data'>('visual');
  const [smartPlayEnabled, setSmartPlayEnabled] = useState(true);
  const [videoContentRect, setVideoContentRect] = useState<VideoContentRect | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [currentDisplayFeedback, setCurrentDisplayFeedback] = useState<{
    title: string;
    feedback: Record<string, string>;
    isPositive: boolean;
    image?: string;
  } | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const processedTimestamps = useRef<Set<number>>(new Set());
  const resumeTimerRef = useRef<number | null>(null);
  const lastCheckTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  const updateVideoRect = () => {
    if (videoRef.current) {
      const rect = calculateVideoContentRect(videoRef.current);
      setVideoContentRect(rect);
    }
  };

  const safePlay = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.warn("Video play was interrupted or failed:", err);
      }
    }
  };

  useLayoutEffect(() => {
    updateVideoRect();
    window.addEventListener('resize', updateVideoRect);
    return () => window.removeEventListener('resize', updateVideoRect);
  }, [activeTab]);

  useEffect(() => {
    const monitorFrames = () => {
      const video = videoRef.current;
      if (!video || !smartPlayEnabled || video.paused) {
        rafRef.current = requestAnimationFrame(monitorFrames);
        return;
      }

      const currentTime = video.currentTime;
      const prevTime = lastCheckTimeRef.current;

      if (currentTime < prevTime - 0.5) {
        analysisResult.timestamps.forEach(t => {
          if (t.timestamp > currentTime) processedTimestamps.current.delete(t.timestamp);
        });
      }

      const match = analysisResult.timestamps.find(t => {
        const targetTime = t.timestamp;
        return prevTime <= targetTime && currentTime >= targetTime && !processedTimestamps.current.has(t.timestamp);
      });

      if (match) {
        video.pause();
        video.currentTime = match.timestamp;
        processedTimestamps.current.add(match.timestamp);
        
        setCurrentDisplayFeedback({ 
          title: match.issue, 
          feedback: match.bodyPartFeedback, 
          isPositive: match.isPositive,
          image: match.visualImage
        });
        
        if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
        
        resumeTimerRef.current = window.setTimeout(() => {
          setCurrentDisplayFeedback(null);
          if (smartPlayEnabled && videoRef.current?.paused) {
            safePlay();
          }
        }, 3000);
      }

      lastCheckTimeRef.current = currentTime;
      rafRef.current = requestAnimationFrame(monitorFrames);
    };

    rafRef.current = requestAnimationFrame(monitorFrames);
    return () => { 
      if (rafRef.current) cancelAnimationFrame(rafRef.current); 
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [smartPlayEnabled, analysisResult.timestamps]);

  const jumpToTime = (timestamp: number) => {
    setActiveTab('visual');
    setTimeout(() => {
      if (videoRef.current) {
        processedTimestamps.current.delete(timestamp);
        lastCheckTimeRef.current = timestamp - 0.1;
        videoRef.current.currentTime = timestamp;
        safePlay();
      }
    }, 100);
  };

  const radarData = [
    { subject: 'Head', A: analysisResult.bodyPartScores.head, fullMark: 10 },
    { subject: 'Shoulders', A: analysisResult.bodyPartScores.shoulders, fullMark: 10 },
    { subject: 'Arms', A: analysisResult.bodyPartScores.arms, fullMark: 10 },
    { subject: 'Hips', A: analysisResult.bodyPartScores.hips, fullMark: 10 },
    { subject: 'Legs', A: analysisResult.bodyPartScores.legs, fullMark: 10 },
    { subject: 'Footwork', A: analysisResult.bodyPartScores.footwork, fullMark: 10 },
  ];

  const toggleExpand = (idx: number) => {
    setExpandedIdx(expandedIdx === idx ? null : idx);
  };

  return (
    <div className="flex flex-col h-screen bg-dark-900 overflow-hidden relative">
      <div className="bg-dark-900/95 backdrop-blur-sm z-50 px-4 py-3 border-b border-dark-800">
        <div className="flex items-center justify-between mb-4">
           <button onClick={onBack} className="text-gray-400"><ChevronLeft size={24} /></button>
           <h2 className="text-lg font-black text-white uppercase tracking-tight">Analysis Report</h2>
           <button className="text-primary font-bold text-sm">SHARE</button>
        </div>
        
        <div className="flex bg-dark-800 p-1 rounded-xl border border-dark-700 mx-auto w-full max-w-[280px]">
           <button onClick={() => setActiveTab('visual')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-black uppercase transition-all duration-300 ${activeTab === 'visual' ? 'bg-primary text-black' : 'text-gray-400'}`}>
              <MonitorPlay size={14} /> AI Vision
           </button>
           <button onClick={() => setActiveTab('data')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-black uppercase transition-all duration-300 ${activeTab === 'data' ? 'bg-primary text-black' : 'text-gray-400'}`}>
              <LayoutGrid size={14} /> Tech Data
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative bg-black">
        {/* TAB 1: AI VISION */}
        <div className={`absolute inset-0 transition-all duration-500 transform ${activeTab === 'visual' ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}`}>
           <div className="relative w-full h-full flex flex-col justify-center bg-black">
              <video 
                ref={videoRef}
                src={videoPreview} 
                className="w-full h-full object-contain" 
                controls 
                playsInline
                onLoadedMetadata={updateVideoRect}
                onLoadedData={updateVideoRect}
              />
              
              {currentDisplayFeedback?.image && (
                <div className="absolute inset-0 z-30 bg-black animate-in fade-in duration-300">
                  <img 
                    src={currentDisplayFeedback.image} 
                    className="w-full h-full object-contain" 
                    alt="AI Infographic Replay"
                  />
                </div>
              )}

              <button 
                onClick={() => {
                  if (smartPlayEnabled) {
                    setCurrentDisplayFeedback(null);
                    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
                  }
                  setSmartPlayEnabled(!smartPlayEnabled);
                }} 
                className={`absolute top-4 right-4 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black shadow-2xl backdrop-blur-xl border transition-all ${smartPlayEnabled ? 'bg-primary/90 text-black border-primary/20' : 'bg-black/40 text-gray-300 border-white/10'}`}
              >
                {smartPlayEnabled ? <PauseCircle size={12} /> : <Play size={12} />} SMART COACH {smartPlayEnabled ? 'ON' : 'OFF'}
              </button>
           </div>
        </div>

        {/* TAB 2: TECHNICAL DATA */}
        <div className={`absolute inset-0 transition-all duration-500 transform overflow-y-auto ${activeTab === 'data' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
          <div className="p-5 pb-32 space-y-6">
             <div className="flex items-center justify-between bg-dark-800 p-6 rounded-3xl border border-dark-700">
                <div>
                  <h3 className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">Performance Index</h3>
                  <div className="flex items-baseline gap-1"><span className="text-5xl font-black text-white">{analysisResult.overallScore}</span><span className="text-gray-500 text-xs">/100</span></div>
                </div>
                <div className="h-16 w-16 rounded-2xl border border-primary/30 flex items-center justify-center bg-primary/10"><Award className="text-primary" size={32} /></div>
             </div>

             <div className="bg-dark-800 p-6 rounded-3xl border border-dark-700 shadow-xl">
                <h3 className="text-white font-black text-xs uppercase tracking-widest mb-6">Biomechanics Breakdown</h3>
                <CustomRadarChart data={radarData} />
             </div>

             <div className="space-y-4">
                <h3 className="text-white font-black text-xs uppercase tracking-widest mb-2 flex items-center gap-2"><PlayCircle size={16} className="text-primary" /> Technical Callouts</h3>
                <div className="grid gap-3">
                   {analysisResult.timestamps.map((ts, idx) => {
                     const isExpanded = expandedIdx === idx;
                     return (
                       <div key={idx} className={`bg-dark-800/80 rounded-2xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-primary/40 ring-1 ring-primary/20' : 'border-dark-700'}`}>
                          {/* CARD HEADER */}
                          <div 
                            onClick={() => toggleExpand(idx)}
                            className="p-3 flex items-center gap-3 cursor-pointer active:bg-dark-700 transition-colors"
                          >
                             <div className={`w-14 h-9 flex-shrink-0 rounded-lg flex items-center justify-center font-mono text-[10px] font-black tracking-tighter ${ts.isPositive ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-400'}`}>
                               {ts.displayTime}
                             </div>
                             <div className="flex-1 min-w-0">
                               <div className="text-white font-bold text-[13px] leading-tight truncate">{ts.issue}</div>
                             </div>
                             <div className="flex items-center gap-1.5 flex-shrink-0">
                                {ts.visualImage && (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); onViewVisualization(ts.visualImage!); }}
                                    className="p-2 bg-dark-700 text-purple-400 rounded-lg hover:bg-dark-600 active:scale-95 transition-all"
                                  >
                                    <Eye size={14} />
                                  </button>
                                )}
                                <button 
                                  onClick={(e) => { e.stopPropagation(); jumpToTime(ts.timestamp); }}
                                  className="p-2 bg-dark-700 text-primary rounded-lg hover:bg-dark-600 active:scale-95 transition-all"
                                >
                                  <Play size={14} fill="currentColor" />
                                </button>
                                <div className="text-gray-500 ml-1">
                                   {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </div>
                             </div>
                          </div>

                          {/* EXPANDABLE BODY PART FEEDBACK */}
                          {isExpanded && (
                            <div className="px-3 pb-4 pt-1 border-t border-dark-700/50 bg-dark-900/30 animate-in slide-in-from-top-2 duration-300">
                               <div className="space-y-3">
                                  {Object.keys(ts.bodyPartFeedback).map((part) => {
                                    const feedback = ts.bodyPartFeedback[part];
                                    const status = ts.bodyPartStatuses[part]; // true = PASS, false = FIX
                                    return (
                                      <div key={part} className="flex gap-3 items-start">
                                         <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${status ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-400'}`}>
                                            {status ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
                                         </div>
                                         <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-0.5">
                                               <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{part}</span>
                                               <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${status ? 'bg-primary text-black' : 'bg-red-500 text-white'}`}>
                                                  {status ? 'PASS' : 'FAIL'}
                                               </span>
                                            </div>
                                            <p className="text-gray-300 text-[11px] leading-snug">{feedback}</p>
                                         </div>
                                      </div>
                                    );
                                  })}
                               </div>
                            </div>
                          )}
                       </div>
                     );
                   })}
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultPage;
