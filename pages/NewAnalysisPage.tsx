
import React, { useRef } from 'react';
import { ChevronLeft, Upload, Video, X } from 'lucide-react';
import { Screen, SportType } from '../types';
import { SPORTS_LIST, SPORT_ACTIONS } from '../constants';

interface NewAnalysisPageProps {
  selectedSport: SportType;
  setSelectedSport: (sport: SportType) => void;
  selectedAction: string;
  setSelectedAction: (action: string) => void;
  videoPreview: string | null;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearVideo: () => void;
  onOpenCamera: () => void;
  onAnalyze: () => void;
  onBack: () => void;
}

const NewAnalysisPage: React.FC<NewAnalysisPageProps> = ({
  selectedSport,
  setSelectedSport,
  selectedAction,
  setSelectedAction,
  videoPreview,
  onFileSelect,
  onClearVideo,
  onOpenCamera,
  onAnalyze,
  onBack
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col h-full bg-dark-900 pb-20 overflow-y-auto">
      <div className="sticky top-0 bg-dark-900/95 backdrop-blur-sm z-10 px-4 py-4 flex items-center justify-between border-b border-dark-800">
        <button onClick={onBack} className="text-gray-400"><ChevronLeft size={24} /></button>
        <h2 className="text-lg font-bold text-white">New Analysis</h2>
        <div className="w-6" /> 
      </div>
      <div className="p-5 space-y-6">
        <div>
          <label className="text-gray-500 text-xs font-bold uppercase mb-3 block">Sport Type *</label>
          <div className="grid grid-cols-2 gap-2">
            {SPORTS_LIST.map((sport) => (
               <button 
                  key={sport.type} 
                  onClick={() => setSelectedSport(sport.type)} 
                  className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${ selectedSport === sport.type ? 'bg-dark-700 text-primary border border-primary/30' : 'bg-dark-800 text-gray-400 border border-dark-700' }`}
               >
                  <span>{sport.icon}</span>
                  <span className="truncate">{sport.type}</span>
               </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-gray-500 text-xs font-bold uppercase mb-3 block">Action Type *</label>
          <select 
            value={selectedAction} 
            onChange={(e) => setSelectedAction(e.target.value)} 
            className="w-full bg-dark-800 text-white p-4 rounded-xl border border-dark-600 outline-none"
          >
            <option value="" disabled>Select an action</option>
            {SPORT_ACTIONS[selectedSport].map(action => <option key={action.id} value={action.name}>{action.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-gray-500 text-xs font-bold uppercase mb-3 block">Video *</label>
          {videoPreview ? (
             <div className="relative rounded-xl overflow-hidden border border-dark-600 bg-black flex justify-center">
                <video src={videoPreview} className="w-full max-h-[500px] object-contain" controls />
                <button onClick={onClearVideo} className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full">
                  <X size={16} />
                </button>
             </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => fileInputRef.current?.click()} className="bg-dark-700 rounded-xl p-6 flex flex-col items-center gap-2 text-gray-300">
                <Upload className="text-primary" size={24} />
                Gallery
              </button>
              <button onClick={onOpenCamera} className="bg-dark-700 rounded-xl p-6 flex flex-col items-center gap-2 text-gray-300">
                <Video className="text-secondary" size={24} />
                Record
              </button>
            </div>
          )}
          <input type="file" ref={fileInputRef} onChange={onFileSelect} accept="video/*" className="hidden" />
        </div>
        <button 
          onClick={onAnalyze} 
          disabled={!videoPreview || !selectedAction} 
          className={`w-full py-4 rounded-xl font-bold text-black ${ !videoPreview || !selectedAction ? 'bg-dark-700 text-gray-500' : 'bg-primary shadow-lg shadow-primary/20' }`}
        >
          Analyze Motion
        </button>
      </div>
    </div>
  );
};

export default NewAnalysisPage;
