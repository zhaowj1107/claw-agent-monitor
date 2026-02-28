'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { getWsUrl } from '@/lib/auth';
import type { WsMessage } from '../../server/types';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export function useWebSocket(onMessage: (msg: WsMessage) => void) {
  const [state, setState] = useState<ConnectionState>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => setState('connected');

      ws.onmessage = (e) => {
        try {
          onMessageRef.current(JSON.parse(e.data) as WsMessage);
        } catch {
          // skip malformed frames
        }
      };

      ws.onclose = () => {
        setState('disconnected');
        timerRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setState('disconnected');
      timerRef.current = setTimeout(connect, 3000);
    }
  }, []); // stable reference — connect itself never changes

  useEffect(() => {
    connect();
    return () => {
      timerRef.current && clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { state };
}
