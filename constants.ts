import { SportType, SportAction } from './types';
import { Activity, CircleDashed, Award, User, MoreHorizontal, Home } from 'lucide-react';

export const SPORT_ACTIONS: Record<SportType, SportAction[]> = {
  [SportType.TENNIS]: [
    { id: 'forehand', name: 'Forehand' },
    { id: 'backhand', name: 'Backhand' },
    { id: 'serve', name: 'Serve' },
    { id: 'volley', name: 'Volley' },
  ],
  [SportType.BADMINTON]: [
    { id: 'smash', name: 'Smash' },
    { id: 'clear', name: 'Clear' },
    { id: 'drop', name: 'Drop Shot' },
    { id: 'serve', name: 'Serve' },
  ],
  [SportType.BASKETBALL]: [
    { id: 'shooting', name: 'Shooting Form' },
    { id: 'dribble', name: 'Dribbling' },
    { id: 'layup', name: 'Layup' },
  ],
  [SportType.FOOTBALL]: [
    { id: 'shooting', name: 'Shooting' },
    { id: 'passing', name: 'Passing' },
    { id: 'dribbling', name: 'Dribbling' },
  ],
  [SportType.GOLF]: [
    { id: 'drive', name: 'Drive' },
    { id: 'iron', name: 'Iron Swing' },
    { id: 'putt', name: 'Putting' },
  ],
  [SportType.SWIMMING]: [
    { id: 'freestyle', name: 'Freestyle' },
    { id: 'breaststroke', name: 'Breaststroke' },
    { id: 'backstroke', name: 'Backstroke' },
    { id: 'butterfly', name: 'Butterfly' },
  ],
  [SportType.SKIING]: [
    { id: 'parallel', name: 'Parallel Turn' },
    { id: 'carving', name: 'Carving' },
  ],
  [SportType.SNOWBOARDING]: [
    { id: 'carving', name: 'Carving' },
    { id: 'jump', name: 'Jump' },
  ],
};

export const SPORTS_LIST = [
  { type: SportType.TENNIS, icon: '🎾' },
  { type: SportType.BADMINTON, icon: '🏸' },
  { type: SportType.BASKETBALL, icon: '🏀' },
  { type: SportType.FOOTBALL, icon: '⚽' },
  { type: SportType.GOLF, icon: '⛳' },
  { type: SportType.SWIMMING, icon: '🏊' },
  { type: SportType.SKIING, icon: '🎿' },
  { type: SportType.SNOWBOARDING, icon: '🏂' },
];

export const NAV_ITEMS = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'analysis', icon: Activity, label: 'Analysis' },
  { id: 'add', icon: null, label: '' }, // Special case for the FAB
  { id: 'profile', icon: User, label: 'Profile' },
  { id: 'more', icon: MoreHorizontal, label: 'More' },
];
