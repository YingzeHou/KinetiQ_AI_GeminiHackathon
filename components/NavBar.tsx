import React from 'react';
import { NAV_ITEMS } from '../constants';
import { Plus } from 'lucide-react';
import { Screen } from '../types';

interface NavBarProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
}

const NavBar: React.FC<NavBarProps> = ({ currentScreen, onNavigate }) => {
  return (
    <div className="fixed bottom-0 left-0 w-full bg-dark-800 border-t border-dark-600 pb-safe pt-2 px-4 z-50">
      <div className="flex justify-between items-end pb-4">
        {NAV_ITEMS.map((item) => {
          if (item.id === 'add') {
            return (
              <div key={item.id} className="relative -top-5">
                <button
                  onClick={() => onNavigate(Screen.NEW_ANALYSIS)}
                  className="w-14 h-14 rounded-full bg-primary hover:bg-secondary text-white flex items-center justify-center shadow-lg shadow-primary/30 transition-transform active:scale-95"
                >
                  <Plus size={28} strokeWidth={3} />
                </button>
              </div>
            );
          }

          const isActive = 
            (item.id === 'home' && currentScreen === Screen.HOME) ||
            (item.id === 'analysis' && currentScreen === Screen.RESULT); // Keep active for result too
            
          const Icon = item.icon!;

          return (
            <button
              key={item.id}
              onClick={() => {
                if(item.id === 'home') onNavigate(Screen.HOME);
                // Other tabs are placeholders for now
              }}
              className={`flex flex-col items-center justify-center w-16 space-y-1 ${
                isActive ? 'text-primary' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Icon size={22} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default NavBar;