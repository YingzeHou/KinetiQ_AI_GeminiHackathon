
import React from 'react';
import { Radio, ChevronRight, BarChart3, LayoutGrid } from 'lucide-react';
import { Screen, SportType, AnalysisResult } from '../types';
import { SPORTS_LIST } from '../constants';

interface HomePageProps {
  onNavigate: (screen: Screen) => void;
  onSelectSport: (sport: SportType) => void;
  analysisResult: AnalysisResult | null;
  selectedSport: SportType;
  selectedAction: string;
}

const HomePage: React.FC<HomePageProps> = ({ 
  onNavigate, 
  onSelectSport, 
  analysisResult, 
  selectedSport, 
  selectedAction 
}) => {
  return (
    <div className="p-5 pb-24 h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-6 mt-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <span className="bg-white text-black p-1 rounded font-black text-lg">K</span> KinetiQ
        </h1>
        <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center text-xs text-gray-400">JM</div>
      </div>
      
      <div className="bg-dark-800 rounded-3xl p-6 mb-8 border border-dark-600/50 relative overflow-hidden group">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
             <Radio className="text-primary animate-pulse" size={18} />
             <span className="text-[10px] text-primary font-black uppercase tracking-widest">Experimental</span>
          </div>
          <h2 className="text-2xl font-black text-white mb-2 leading-tight">Live Real-time Coaching</h2>
          <p className="text-gray-400 text-sm mb-6 max-w-[220px]">Get instant technical audio feedback while you train.</p>
          <button 
            onClick={() => onNavigate(Screen.LIVE_COACH)}
            className="bg-primary hover:bg-secondary text-black px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95"
          >
            Start Live Session <ChevronRight size={18} />
          </button>
        </div>
        <div className="absolute top-0 right-0 w-32 h-full opacity-10 flex items-center justify-center transform translate-x-4">
           <Radio size={120} className="text-white" />
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-bold text-white mb-4">Recent Analysis</h2>
        <div className="bg-dark-700 rounded-2xl p-8 flex flex-col items-center justify-center text-center border border-dark-600 h-48">
          {analysisResult ? (
             <div className="text-left w-full">
                <span className="text-primary text-sm font-bold uppercase tracking-wider">{selectedSport}</span>
                <h3 className="text-xl font-bold text-white">{selectedAction}</h3>
                <button onClick={() => onNavigate(Screen.RESULT)} className="text-gray-400 text-sm hover:text-white underline mt-2">View Result</button>
             </div>
          ) : (
            <div className="text-gray-500 text-sm">
              <BarChart3 className="mx-auto mb-2 opacity-50" /> 
              No recent analysis
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {SPORTS_LIST.slice(0, 3).map((sport) => (
          <button 
            key={sport.type} 
            onClick={() => { onSelectSport(sport.type); onNavigate(Screen.NEW_ANALYSIS); }} 
            className="bg-dark-700 rounded-2xl p-4 flex flex-col items-center gap-2 border border-dark-600 transition-colors hover:bg-dark-600"
          >
            <span className="text-2xl">{sport.icon}</span>
            <span className="text-xs text-gray-300">{sport.type}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default HomePage;
