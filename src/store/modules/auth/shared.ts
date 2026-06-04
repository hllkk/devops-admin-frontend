import { localStg } from '@/utils/storage';

/** Get authentication status - checks cookie-based auth flag */
export function getToken(): string {
  const isAuthenticated = localStg.get('isAuthenticated');
  return isAuthenticated ? 'authenticated' : '';
}

/** Clear auth storage */
export function clearAuthStorage() {
  localStg.remove('isAuthenticated');
}
