import React, { createContext, useContext } from 'react';
import useLiveStatus from '../hooks/useLiveStatus';

const RunContext = createContext({ runStatus: 'idle', steps: [], runId: null, durationMs: null });

export function RunProvider({ children }) {
  const value = useLiveStatus();
  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}

export function useRunContext() {
  return useContext(RunContext);
}
