import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tokenStorage } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { setUserFromTokens } = useAuth();

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = hash.get('accessToken');
    const refreshToken = hash.get('refreshToken');
    if (accessToken && refreshToken) {
      tokenStorage.set(accessToken, refreshToken);
      setUserFromTokens().finally(() => navigate('/', { replace: true }));
    } else {
      navigate('/login', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen items-center justify-center text-slate-500">
      Signing you in…
    </div>
  );
}
