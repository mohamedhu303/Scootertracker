import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'app/dashboard',
    pathMatch: 'full',
  },
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/overview/overview.component').then(
            (m) => m.OverviewComponent,
          ),
      },
      {
        path: 'scooters',
        loadComponent: () =>
          import('./features/scooters/scooter-list/scooter-list.component').then(
            (m) => m.ScooterListComponent,
          ),
      },
      {
        path: 'scooters/:id',
        loadComponent: () =>
          import('./features/scooters/scooter-detail/scooter-detail.component').then(
            (m) => m.ScooterDetailComponent,
          ),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/users/user-list/user-list.component').then((m) => m.UserListComponent),
      },
      {
        path: 'users/:id',
        loadComponent: () =>
          import('./features/users/user-detail/user-detail.component').then(
            (m) => m.UserDetailComponent,
          ),
      },
      {
        path: 'rides',
        loadComponent: () =>
          import('./features/rides/ride-list/ride-list.component').then((m) => m.RideListComponent),
      },
      {
        path: 'parking-reviews',
        loadComponent: () =>
          import('./features/parking-reviews/parking-reviews.component').then(
            (m) => m.ParkingReviewsComponent,
          ),
      },
      {
        path: 'zones',
        loadComponent: () =>
          import('./features/zones/zones.component').then((m) => m.ZonesComponent),
      },
      {
        path: 'tariffs',
        loadComponent: () =>
          import('./features/tariffs/tariffs.component').then((m) => m.TariffsComponent),
      },
      {
        path: 'create-admin',
        loadComponent: () =>
          import('./features/admin/create-admin.component').then((m) => m.CreateAdminComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.component').then((m) => m.ProfileComponent),
      },
      {
        path: 'live-map',
        loadComponent: () =>
          import('./features/live-map/live-map.component').then((m) => m.LiveMapComponent),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/analytics/analytics-overview/analytics-overview.component').then(
            (m) => m.AnalyticsOverviewComponent,
          ),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () =>
      import('./shared/components/error-pages/not-found.component').then(
        (m) => m.NotFoundComponent,
      ),
  },
];
