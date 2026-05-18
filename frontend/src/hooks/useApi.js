import { useState, useCallback } from 'react';

const BASE = '/api';

async function request(url, options = {}) {
  try {
    const res = await fetch(`${BASE}${url}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { success: false, error: 'Invalid response' };
    }
  } catch {
    return { success: false, error: 'Network error' };
  }
}

export function useApi() {
  const [loading, setLoading] = useState(false);

  const get = useCallback(async (url) => {
    setLoading(true);
    try {
      return await request(url);
    } finally {
      setLoading(false);
    }
  }, []);

  const post = useCallback(async (url, data) => {
    setLoading(true);
    try {
      return await request(url, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const put = useCallback(async (url, data) => {
    setLoading(true);
    try {
      return await request(url, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const del = useCallback(async (url) => {
    setLoading(true);
    try {
      return await request(url, { method: 'DELETE' });
    } finally {
      setLoading(false);
    }
  }, []);

  return { get, post, put, del, loading };
}
