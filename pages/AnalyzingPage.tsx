
import React from 'react';
import { Loader2 } from 'lucide-react';

interface AnalyzingPageProps {
  stage?: string;
}

const AnalyzingPage: React.FC<AnalyzingPageProps> = ({ stage = "Professional technical analysis in progress..." }) => {
  return (
    <div className="flex flex-col h-screen items-center justify-center bg-dark-900 px-8 text-center">
      <div className="relative w-24 h-24 mb-8">
        <div className="absolute inset-0 border-4 border-dark-700 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
        <Loader2 className="absolute inset-0 m-auto text-primary animate-pulse" size={40} />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Analyzing Motion</h2>
      <p className="text-gray-400 text-sm h-10">{stage}</p>
    </div>
  );
};

export default AnalyzingPage;