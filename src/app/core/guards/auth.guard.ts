import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // ✅ Check if authenticated
  const isAuth = auth.isAuthenticated();
  
  console.log('🔐 Auth Guard Check:', {
    isAuthenticated: isAuth,
    hasToken: auth.hasToken(),
    route: state.url
  });

  if (isAuth) {
    return true;
  }

  // Redirect to login
  console.log('🔒 Not authenticated, redirecting to login');
  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: state.url }
  });
};