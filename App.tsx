
import React, { useState, useEffect } from 'react';
import { Screen, SportType, AnalysisResult } from './types';
import { analyzeVideo, generateVisualCorrection } from './services/geminiService';

// Pages
import HomePage from './pages/HomePage';
import NewAnalysisPage from './pages/NewAnalysisPage';
import AnalyzingPage from './pages/AnalyzingPage';
import ResultPage from './pages/ResultPage';

// Components
import NavBar from './components/NavBar';
import CameraRecorder from './components/CameraRecorder';
import LiveCoach from './components/LiveCoach';
import { Sparkles, X, ShieldCheck, ExternalLink, Zap } from 'lucide-react';

const App: React.FC = () => {
  const [isKeySelected, setIsKeySelected] = useState<boolean | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.HOME);
  const [selectedSport, setSelectedSport] = useState<SportType>(SportType.TENNIS);
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState('Starting professional analysis...');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (typeof window.aistudio !== 'undefined') {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setIsKeySelected(hasKey);
      } else {
        // Fallback for non-AI Studio environments (if applicable)
        setIsKeySelected(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (typeof window.aistudio !== 'undefined') {
      await window.aistudio.openSelectKey();
      // Assume success as per guidelines to avoid race condition
      setIsKeySelected(true);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  const handleAnalyze = async () => {
    if (!videoFile || !selectedAction) return;
    setIsAnalyzing(true);
    setCurrentScreen(Screen.ANALYZING);
    setAnalysisStage('Analyzing biomechanics with Gemini 3 Pro...');
    
    try {
      const reader = new FileReader();
      reader.readAsDataURL(videoFile);
      reader.onload = async () => {
        const base64String = (reader.result as string).split(',')[1];
        try {
          const result = await analyzeVideo(base64String, selectedSport, selectedAction, videoFile.type);
          
          const tempVideo = document.createElement('video');
          tempVideo.src = videoPreview!;
          tempVideo.crossOrigin = "anonymous";
          await new Promise(resolve => tempVideo.onloadedmetadata = resolve);

          const updatedTimestamps = [];
          for (let i = 0; i < result.timestamps.length; i++) {
            const ts = result.timestamps[i];
            setAnalysisStage(`AI Vision Scan ${i + 1}/${result.timestamps.length}...`);
            
            const frameBase64 = await new Promise<string>((resolve) => {
              const onSeeked = () => {
                tempVideo.removeEventListener('seeked', onSeeked);
                const canvas = document.createElement('canvas');
                canvas.width = tempVideo.videoWidth;
                canvas.height = tempVideo.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) ctx.drawImage(tempVideo, 0, 0);
                resolve(canvas.toDataURL('image/jpeg').split(',')[1]);
              };
              tempVideo.currentTime = ts.timestamp;
              tempVideo.addEventListener('seeked', onSeeked);
            });

            try {
              const visualImage = await generateVisualCorrection(
                frameBase64, 
                ts.issue, 
                selectedSport, 
                ts.bodyPartTags,
                ts.bodyPartStatuses
              );
              updatedTimestamps.push({ ...ts, visualImage });
            } catch (vErr) {
              console.error("Failed visualization", vErr);
              updatedTimestamps.push(ts);
            }
          }

          setAnalysisResult({ ...result, timestamps: updatedTimestamps });
          setIsAnalyzing(false);
          setCurrentScreen(Screen.RESULT);
        } catch (err) {
          console.error(err);
          setIsAnalyzing(false);
          setCurrentScreen(Screen.NEW_ANALYSIS);
          alert("Analysis failed. Please check your internet and try again.");
        }
      };
    } catch (e) {
      setIsAnalyzing(false);
      setCurrentScreen(Screen.NEW_ANALYSIS);
    }
  };

  const handleViewVisualization = (image: string) => {
    setSelectedImage(image);
  };

  if (isKeySelected === false) {
    return (
      <div className="bg-dark-900 min-h-screen text-white flex flex-col items-center justify-center p-8 max-w-md mx-auto">
        <div className="w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center mb-8 text-primary shadow-2xl shadow-primary/20">
          <ShieldCheck size={48} />
        </div>
        <h1 className="text-3xl font-black mb-4 text-center">KinetiQ Pro</h1>
        <p className="text-gray-400 text-center mb-10 leading-relaxed">
          To access elite real-time biomechanical analysis, you must link an API key from a paid Google Cloud project.
        </p>
        <div className="w-full space-y-4">
          <button 
            onClick={handleSelectKey}
            className="w-full bg-primary hover:bg-secondary text-black font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-transform active:scale-95 shadow-xl shadow-primary/20"
          >
            <Zap size={20} fill="currentColor" /> Link Gemini AI Key
          </button>
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full bg-dark-800 border border-white/5 text-gray-400 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-dark-700 transition-colors"
          >
            Billing Documentation <ExternalLink size={16} />
          </a>
        </div>
        <p className="mt-12 text-[10px] text-gray-600 uppercase tracking-widest font-black">AI Technical Biomechanics v3.0</p>
      </div>
    );
  }

  if (isKeySelected === null) {
    return (
      <div className="bg-dark-900 min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-black min-h-screen text-white font-sans max-w-md mx-auto relative shadow-2xl overflow-hidden">
      <div className="h-full overflow-hidden">
        {currentScreen === Screen.HOME && (
          <HomePage 
            onNavigate={setCurrentScreen} 
            onSelectSport={setSelectedSport} 
            analysisResult={analysisResult}
            selectedSport={selectedSport}
            selectedAction={selectedAction}
          />
        )}
        
        {currentScreen === Screen.NEW_ANALYSIS && (
          <NewAnalysisPage 
            selectedSport={selectedSport}
            setSelectedSport={setSelectedSport}
            selectedAction={selectedAction}
            setSelectedAction={setSelectedAction}
            videoPreview={videoPreview}
            onFileSelect={handleFileSelect}
            onClearVideo={() => { setVideoFile(null); setVideoPreview(null); }}
            onOpenCamera={() => setShowCamera(true)}
            onAnalyze={handleAnalyze}
            onBack={() => setCurrentScreen(Screen.HOME)}
          />
        )}

        {currentScreen === Screen.ANALYZING && <AnalyzingPage stage={analysisStage} />}

        {currentScreen === Screen.RESULT && analysisResult && (
          <ResultPage 
            analysisResult={analysisResult}
            videoPreview={videoPreview!}
            selectedSport={selectedSport}
            onBack={() => setCurrentScreen(Screen.HOME)}
            onViewVisualization={handleViewVisualization}
          />
        )}

        {currentScreen === Screen.LIVE_COACH && (
          <LiveCoach 
            sport={selectedSport} 
            onClose={() => setCurrentScreen(Screen.HOME)} 
          />
        )}
      </div>

      {showCamera && (
        <CameraRecorder 
          onCapture={(file) => { 
            setVideoFile(file); 
            setVideoPreview(URL.createObjectURL(file)); 
            setShowCamera(false); 
          }} 
          onCancel={() => setShowCamera(false)} 
        />
      )}

      {selectedImage && (
        <div className="fixed inset-0 z-[110] bg-black/95 flex flex-col items-center justify-center p-4">
           <button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 text-white/70 p-2 bg-dark-800 rounded-full">
             <X size={32} />
           </button>
           <h3 className="text-white font-bold text-xl mb-4 flex items-center gap-2">
             <Sparkles className="text-emerald-400" /> AI Vision Correction
           </h3>
           <div className="relative w-full max-w-lg aspect-square bg-dark-800 rounded-xl overflow-hidden shadow-2xl">
              <img src={selectedImage} alt="AI Scan" className="w-full h-full object-contain" />
           </div>
           <p className="text-gray-400 text-center text-sm mt-4 max-w-xs">
             AI technical overlay: Errors highlighted in <span className="text-red-400 font-bold">RED</span>, elite biomechanics in <span className="text-emerald-400 font-bold">GREEN</span>.
           </p>
        </div>
      )}

      {currentScreen === Screen.HOME && (
        <NavBar currentScreen={currentScreen} onNavigate={setCurrentScreen} />
      )}
    </div>
  );
};

export default App;
