import { useEffect, useState, useRef, useCallback } from 'react';

function mergeStep(steps, incoming) {
  const idx = steps.findIndex(s => s.step === incoming.step);
  if (idx >= 0) {
    const next = [...steps];
    next[idx] = { ...next[idx], ...incoming };
    return next;
  }
  const next = [...steps, incoming];
  next.sort((a, b) => a.step - b.step);
  return next;
}

export default function useLiveStatus() {
  const [runStatus,  setRunStatus]  = useState('idle');
  const [steps,      setSteps]      = useState([]);
  const [runId,      setRunId]      = useState(null);
  const [durationMs, setDurationMs] = useState(null);
  const esRef      = useRef(null);
  // Buffer incoming step events and flush in one batch every 80ms
  // This prevents rapid "running→pass" pairs from causing two renders per step
  const bufferRef  = useRef([]);
  const timerRef   = useRef(null);

  const flushBuffer = useCallback(() => {
    timerRef.current = null;
    const batch = bufferRef.current.splice(0);
    if (!batch.length) return;
    setSteps(prev => {
      let next = prev;
      for (const incoming of batch) {
        next = mergeStep(next, incoming);
      }
      return next;
    });
  }, []);

  const queueStep = useCallback((d) => {
    bufferRef.current.push(d);
    if (!timerRef.current) {
      timerRef.current = setTimeout(flushBuffer, 80);
    }
  }, [flushBuffer]);

  const connect = useCallback(() => {
    if (esRef.current) esRef.current.close();

    const es = new EventSource('/api/live');
    esRef.current = es;

    es.addEventListener('init', e => {
      try {
        const d = JSON.parse(e.data);
        setRunStatus(d.status || 'idle');
        setRunId(d.runId || null);
        const sorted = [...(d.steps || [])].sort((a, b) => a.step - b.step);
        setSteps(sorted);
      } catch (_) {}
    });

    es.addEventListener('start', e => {
      try {
        const d = JSON.parse(e.data);
        bufferRef.current = [];
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        setRunStatus('running');
        setRunId(d.runId);
        setSteps([]);
        setDurationMs(null);
      } catch (_) {}
    });

    es.addEventListener('step', e => {
      try { queueStep(JSON.parse(e.data)); } catch (_) {}
    });

    es.addEventListener('done', e => {
      try {
        const d = JSON.parse(e.data);
        // Flush any buffered steps immediately before marking done
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        flushBuffer();
        setRunStatus(d.status);
        setRunId(d.runId);
        setDurationMs(d.durationMs || null);
        setSteps(prev => prev.map(s =>
          s.status === 'running' ? { ...s, status: 'fail', error: 'Step did not complete (process exited)' } : s
        ));
      } catch (_) {}
    });

    es.onerror = () => {
      es.close();
      setTimeout(connect, 3000);
    };
  }, [queueStep, flushBuffer]);

  useEffect(() => {
    connect();
    return () => {
      if (esRef.current) esRef.current.close();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [connect]);

  return { runStatus, steps, runId, durationMs };
}
