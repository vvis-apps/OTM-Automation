import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Registry() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/registry/poland', { replace: true }); }, [navigate]);
  return null;
}
