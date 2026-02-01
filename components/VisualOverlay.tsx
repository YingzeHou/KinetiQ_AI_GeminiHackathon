
import React from 'react';
import { AnalysisLabel } from '../types';
import { VideoContentRect } from '../services/motionGeometry';

interface VisualOverlayProps {
  labels: AnalysisLabel[];
  contentRect: VideoContentRect | null;
}

const VisualOverlay: React.FC<VisualOverlayProps> = ({ labels, contentRect }) => {
  if (!contentRect) return null;

  return (
    <div 
      className="absolute pointer-events-none z-30"
      style={{
        top: contentRect.top,
        left: contentRect.left,
        width: contentRect.width,
        height: contentRect.height,
      }}
    >
      {labels.map((label, i) => {
        // Anchor logic:
        // direction 'right' means [Text] [---> TIP @ x,y]
        // direction 'left' means [TIP @ x,y <---] [Text]
        const isRight = label.direction === 'right';

        return (
          <div 
            key={i} 
            className="absolute flex items-center animate-in fade-in zoom-in duration-300 transition-all"
            style={{ 
              left: `${label.x}%`, 
              top: `${label.y}%`, 
              // If pointing right, the right edge is the anchor. Translate -100% horizontally.
              // If pointing left, the left edge is the anchor. Translate 0% horizontally.
              transform: `translate(${isRight ? '-100%' : '0%'}, -50%)` 
            }}
          >
            {isRight ? (
              <>
                <div className="bg-white/95 backdrop-blur-sm text-black px-2 py-0.5 rounded shadow-xl border border-black/10 flex items-center whitespace-nowrap">
                   <span className="text-[10px] font-black uppercase tracking-tighter leading-none">{label.text}</span>
                </div>
                <div className="w-6 h-[1.5px] bg-white relative flex items-center">
                   <div className="absolute right-0 w-0 h-0 border-t-[3px] border-b-[3px] border-l-[5px] border-transparent border-l-white" />
                </div>
              </>
            ) : (
              <>
                <div className="w-6 h-[1.5px] bg-white relative flex items-center">
                   <div className="absolute left-0 w-0 h-0 border-t-[3px] border-b-[3px] border-r-[5px] border-transparent border-r-white" />
                </div>
                <div className="bg-white/95 backdrop-blur-sm text-black px-2 py-0.5 rounded shadow-xl border border-black/10 flex items-center whitespace-nowrap">
                   <span className="text-[10px] font-black uppercase tracking-tighter leading-none">{label.text}</span>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default VisualOverlay;
