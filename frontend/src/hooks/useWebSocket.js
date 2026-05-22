import { useEffect, useRef, useState, useCallback } from 'react';

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [lastNotification, setLastNotification] = useState(null);
  const [scanComplete, setScanComplete] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) { /* ignore */ }
      wsRef.current = null;
    }

    const wsUrl = `ws://localhost:3001/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        setConnected(true);
        console.log('[WS] Connected');
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'notification') {
            setLastNotification(msg.data);
          } else if (msg.type === 'scan_complete') {
            setScanComplete(msg.data);
            console.log('[WS] 收到 scan_complete 事件');
          }
        } catch (e) { /* ignore */ }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        wsRef.current = null;
        reconnectTimer.current = setTimeout(() => connect(), 10000);
      };

      ws.onerror = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
          setConnected(false);
        }
      };
    } catch (e) {
      if (mountedRef.current) {
        reconnectTimer.current = setTimeout(() => connect(), 15000);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const initTimer = setTimeout(() => connect(), 2000);

    return () => {
      mountedRef.current = false;
      clearTimeout(initTimer);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (e) { /* ignore */ }
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { connected, lastNotification, setLastNotification, scanComplete };
}
