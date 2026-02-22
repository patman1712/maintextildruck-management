import { Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from '@/store';

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const currentUser = useAppStore((state) => state.currentUser);
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}