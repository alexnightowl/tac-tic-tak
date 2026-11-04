'use client';

import { useEffect } from 'react';

import { setToken } from '@/lib/api';

export function DevSession() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const q = new URLSearchParams(window.location.search);
    const token = q.get('token');
    const next = q.get('next') ?? '/dashboard';
    if (token) setToken(token);
    // A full load, so Providers fetch /users/me with the new token.
    if (next.startsWith('/')) window.location.replace(next);
  }, []);
  return null;
}
