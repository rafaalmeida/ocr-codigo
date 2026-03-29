import React, { createContext, useContext, useReducer, ReactNode } from 'react';

export interface CaptureItem {
  id: string;
  value: string;
  timestamp: Date;
}

export interface Pattern {
  regex: RegExp;
  length: number;
  description: string;
}

interface CaptureState {
  context: string;
  apiKey: string;
  pattern: Pattern | null;
  confirmedExample: string | null;
  captures: CaptureItem[];
}

type Action =
  | { type: 'SET_CONTEXT'; payload: string }
  | { type: 'SET_API_KEY'; payload: string }
  | { type: 'SET_PATTERN'; payload: { pattern: Pattern; example: string } }
  | { type: 'ADD_CAPTURE'; payload: CaptureItem }
  | { type: 'REMOVE_CAPTURE'; payload: string }
  | { type: 'RESET' };

const initialState: CaptureState = {
  context: '',
  apiKey: '',
  pattern: null,
  confirmedExample: null,
  captures: [],
};

function captureReducer(state: CaptureState, action: Action): CaptureState {
  switch (action.type) {
    case 'SET_CONTEXT':
      return { ...state, context: action.payload };
    case 'SET_API_KEY':
      return { ...state, apiKey: action.payload };
    case 'SET_PATTERN':
      return {
        ...state,
        pattern: action.payload.pattern,
        confirmedExample: action.payload.example,
      };
    case 'ADD_CAPTURE': {
      const exists = state.captures.some(c => c.value === action.payload.value);
      if (exists) return state;
      return { ...state, captures: [...state.captures, action.payload] };
    }
    case 'REMOVE_CAPTURE':
      return {
        ...state,
        captures: state.captures.filter(c => c.id !== action.payload),
      };
    case 'RESET':
      return { ...initialState, apiKey: state.apiKey };
    default:
      return state;
  }
}

const CaptureContext = createContext<{
  state: CaptureState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function CaptureProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(captureReducer, initialState);
  return (
    <CaptureContext.Provider value={{ state, dispatch }}>
      {children}
    </CaptureContext.Provider>
  );
}

export function useCapture() {
  const ctx = useContext(CaptureContext);
  if (!ctx) throw new Error('useCapture must be used within CaptureProvider');
  return ctx;
}
