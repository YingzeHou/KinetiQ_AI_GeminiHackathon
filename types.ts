
export enum Screen {
  HOME = 'HOME',
  NEW_ANALYSIS = 'NEW_ANALYSIS',
  ANALYZING = 'ANALYZING',
  RESULT = 'RESULT',
  LIVE_COACH = 'LIVE_COACH',
  PROFILE = 'PROFILE',
  MORE = 'MORE'
}

export enum SportType {
  TENNIS = 'Tennis',
  BADMINTON = 'Badminton',
  BASKETBALL = 'Basketball',
  FOOTBALL = 'Football (Soccer)',
  GOLF = 'Golf',
  SWIMMING = 'Swimming',
  SKIING = 'Alpine Skiing',
  SNOWBOARDING = 'Snowboarding',
}

export interface SportAction {
  id: string;
  name: string;
}

export interface AnalysisLabel {
  text: string;
  x: number;
  y: number;
  direction: 'left' | 'right';
  status?: boolean; // Added for color coding: true = good (green), false = bad (red)
}

export interface AnalysisResult {
  overallScore: number;
  bodyPartScores: {
    head: number;
    shoulders: number;
    arms: number;
    hips: number;
    legs: number;
    footwork: number;
  };
  timestamps: {
    frame: number;
    timestamp: number;
    displayTime: string;
    issue: string;
    bodyPartFeedback: Record<string, string>;
    bodyPartTags: Record<string, string>;
    bodyPartStatuses: Record<string, boolean>; // Added: true for PASS (green), false for FIX (red)
    coachingCues: string[];
    isPositive: boolean;
    visualImage?: string;
  }[];
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

export interface AnalysisSession {
  id: string;
  date: string;
  sport: SportType;
  action: string;
  videoUrl?: string;
  result?: AnalysisResult;
}
