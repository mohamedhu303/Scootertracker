import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { catchError, delay, timeout } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// ========== Mock Data ==========

const mockAdmin = {
  id: 'admin-001',
  fullName: 'Admin User',
  email: 'admin@scooter.com',
  role: 'Administrator',
  accountStatus: 'Active',
};

const mockToken = {
  accessToken: 'mock-access-token-123456',
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  refreshToken: 'mock-refresh-token-654321',
  refreshTokenExpiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

const mockScootersList = [
  {
    id: 'scooter-1',
    serialNumber: 'SC-1001',
    batteryLevel: 87,
    status: 'Available',
    modelName: 'Xiaomi Pro 2',
  },
  {
    id: 'scooter-2',
    serialNumber: 'SC-1002',
    batteryLevel: 43,
    status: 'InUse',
    modelName: 'Segway Ninebot',
  },
  {
    id: 'scooter-3',
    serialNumber: 'SC-1003',
    batteryLevel: 15,
    status: 'Maintenance',
    modelName: 'Xiaomi Essential',
  },
  {
    id: 'scooter-4',
    serialNumber: 'SC-1004',
    batteryLevel: 92,
    status: 'Available',
    modelName: 'Segway Max',
  },
  {
    id: 'scooter-5',
    serialNumber: 'SC-1005',
    batteryLevel: 68,
    status: 'Charging',
    modelName: 'Xiaomi Pro 2',
  },
  {
    id: 'scooter-6',
    serialNumber: 'SC-1006',
    batteryLevel: 5,
    status: 'Offline',
    modelName: 'Segway Ninebot',
  },
];

const mockUsersList = [
  {
    id: 'user-1',
    fullName: 'Ahmed Ali',
    email: 'ahmed@test.com',
    phoneNumber: '01011111111',
    avatarUrl: null,
    idVerificationStatus: 'Approved',
    accountStatus: 'Active',
    walletBalance: 150.5,
    phoneVerified: true,
  },
  {
    id: 'user-2',
    fullName: 'Sara Mohamed',
    email: 'sara@test.com',
    phoneNumber: '01022222222',
    avatarUrl: null,
    idVerificationStatus: 'Pending',
    accountStatus: 'Active',
    walletBalance: 80,
    phoneVerified: true,
  },
  {
    id: 'user-3',
    fullName: 'Omar Hassan',
    email: 'omar@test.com',
    phoneNumber: '01033333333',
    avatarUrl: null,
    idVerificationStatus: 'Rejected',
    accountStatus: 'Suspended',
    walletBalance: 20,
    phoneVerified: false,
  },
];

const mockTransactions = [
  {
    id: 'tx-1',
    amount: 100,
    type: 'TopUp',
    referenceId: 'ref-001',
    description: 'Wallet top up',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'tx-2',
    amount: -25,
    type: 'RidePayment',
    referenceId: 'ride-001',
    description: 'Ride payment',
    timestamp: new Date().toISOString(),
  },
  {
    id: 'tx-3',
    amount: -10,
    type: 'Penalty',
    referenceId: 'ride-002',
    description: 'Parking violation penalty',
    timestamp: new Date().toISOString(),
  },
];

const mockTariff = {
  id: 'tariff-1',
  name: 'Default Tariff',
  unlockFee: 5,
  perMinuteRate: 1.5,
  isActive: true,
  createdAt: new Date().toISOString(),
};

const mockZonesList = [
  {
    id: 'zone-1',
    name: 'Downtown',
    type: 'Parking',
    speedLimitKmH: null,
    isActive: true,
    boundary: [
      { longitude: 31.2357, latitude: 30.0444 },
      { longitude: 31.2367, latitude: 30.0444 },
      { longitude: 31.2367, latitude: 30.0454 },
      { longitude: 31.2357, latitude: 30.0454 },
    ],
  },
  {
    id: 'zone-2',
    name: 'University Zone',
    type: 'Slow',
    speedLimitKmH: 15,
    isActive: true,
    boundary: [
      { longitude: 31.24, latitude: 30.05 },
      { longitude: 31.241, latitude: 30.05 },
      { longitude: 31.241, latitude: 30.051 },
      { longitude: 31.24, latitude: 30.051 },
    ],
  },
];

const mockPendingPhotos = [
  {
    rideId: 'ride-1',
    endPhotoUrl: 'https://placehold.co/300x200',
    scooterSerialNumber: 'SC-1001',
    userPhoneNumber: '01011111111',
    endTime: new Date().toISOString(),
  },
  {
    rideId: 'ride-2',
    endPhotoUrl: 'https://placehold.co/300x200',
    scooterSerialNumber: 'SC-1002',
    userPhoneNumber: '01022222222',
    endTime: new Date().toISOString(),
  },
];

const mockRidesList = [
  {
    id: 'ride-001',
    scooterSerialNumber: 'SC-1001',
    userPhoneNumber: '01011111111',
    userName: 'Ahmed Ali',
    startTime: new Date().toISOString(),
    endTime: null,
    durationInMinutes: null,
    totalCost: null,
    status: 'Active',
    endPhotoUrl: null,
    startLocation: 'Downtown Cairo',
    endLocation: null,
  },
  {
    id: 'ride-002',
    scooterSerialNumber: 'SC-1002',
    userPhoneNumber: '01022222222',
    userName: 'Sara Mohamed',
    startTime: new Date(Date.now() - 45 * 60000).toISOString(),
    endTime: new Date(Date.now() - 15 * 60000).toISOString(),
    durationInMinutes: 30,
    totalCost: 50,
    status: 'Completed',
    endPhotoUrl: 'https://placehold.co/300x200',
    startLocation: 'Zamalek',
    endLocation: 'Dokki',
  },
  {
    id: 'ride-003',
    scooterSerialNumber: 'SC-1003',
    userPhoneNumber: '01033333333',
    userName: 'Omar Hassan',
    startTime: new Date(Date.now() - 120 * 60000).toISOString(),
    endTime: new Date(Date.now() - 90 * 60000).toISOString(),
    durationInMinutes: 30,
    totalCost: 45,
    status: 'Completed',
    endPhotoUrl: 'https://placehold.co/300x200',
    startLocation: 'Nasr City',
    endLocation: 'Heliopolis',
  },
  {
    id: 'ride-004',
    scooterSerialNumber: 'SC-1004',
    userPhoneNumber: '01011111111',
    userName: 'Ahmed Ali',
    startTime: new Date(Date.now() - 180 * 60000).toISOString(),
    endTime: new Date(Date.now() - 160 * 60000).toISOString(),
    durationInMinutes: 20,
    totalCost: 35,
    status: 'Completed',
    endPhotoUrl: 'https://placehold.co/300x200',
    startLocation: 'Maadi',
    endLocation: 'Old Cairo',
  },
  {
    id: 'ride-005',
    scooterSerialNumber: 'SC-1005',
    userPhoneNumber: '01022222222',
    userName: 'Sara Mohamed',
    startTime: new Date(Date.now() - 240 * 60000).toISOString(),
    endTime: null,
    durationInMinutes: null,
    totalCost: null,
    status: 'Cancelled',
    endPhotoUrl: null,
    startLocation: 'New Cairo',
    endLocation: null,
  },
  {
    id: 'ride-006',
    scooterSerialNumber: 'SC-1001',
    userPhoneNumber: '01033333333',
    userName: 'Omar Hassan',
    startTime: new Date(Date.now() - 10 * 60000).toISOString(),
    endTime: null,
    durationInMinutes: null,
    totalCost: null,
    status: 'Active',
    endPhotoUrl: null,
    startLocation: '6th October',
    endLocation: null,
  },
];

// ========== Helper ==========

function ok(responseBody: any) {
  return of(new HttpResponse({ status: 200, body: responseBody })).pipe(delay(300));
}
function paginate(data: any[], params: any) {
  const rawPageIndex = params.get('PageIndex');
  const rawPageSize = params.get('PageSize');

  let pageIndex = rawPageIndex !== null && rawPageIndex !== undefined && rawPageIndex !== ''
    ? Number(rawPageIndex)
    : 1;
  
  if (pageIndex < 1) pageIndex = 1;

  const pageSize = rawPageSize !== null && rawPageSize !== undefined && rawPageSize !== ''
    ? Number(rawPageSize)
    : 10;

  return {
    pageIndex,
    pageSize,
    totalCount: data.length,
    data: data.slice((pageIndex - 1) * pageSize, pageIndex * pageSize),
  };
}

// ========== Mock Route Handler ==========

function handleMockRoute(url: string, method: string, body: any, params: any): any {
  // Login
  if (
    (url.includes('/api/Auth/login') || url.includes('/api/Auth/Login-admin')) &&
    method === 'POST'
  ) {
    const email = body?.email;
    const phoneNumber = body?.phoneNumber;
    const password = body?.password;

    if ((!email && !phoneNumber) || !password) {
      return throwError(() => ({
        status: 400,
        error: { message: 'Email/Phone and password are required' },
      })).pipe(delay(300));
    }

    const validEmail = email === 'admin@scooter.com';
    const validPhone = phoneNumber === '01012345678';
    const validPassword = password === '123456';

    if ((validEmail || validPhone) && validPassword) {
      return ok({ admin: mockAdmin, token: mockToken });
    }

    return throwError(() => ({
      status: 401,
      error: { message: 'Invalid email/phone or password' },
    })).pipe(delay(300));
  }

  // Profile
  if (url.includes('/api/Auth/profile') && method === 'GET') {
    return ok({
      id: 'admin-001',
      fullName: 'Admin User',
      email: 'admin@scooter.com',
      phoneNumber: '01012345678',
      avatarUrl: null,
      idVerificationStatus: 'Approved',
      accountStatus: 'Active',
      walletBalance: 0,
      phoneVerified: true,
    });
  }

  // Users
  if (url.endsWith('/api/User') && method === 'GET') {
    return ok(paginate(mockUsersList, params));
  }

  if (/\/api\/User\/[^/]+$/.test(url) && method === 'GET') {
    const userId = url.split('/').pop();
    const user = mockUsersList.find((u) => u.id === userId);
    return user
      ? ok(user)
      : throwError(() => ({ status: 404, error: { message: 'User not found' } }));
  }

  if (/\/api\/User\/[^/]+\/suspend$/.test(url) && method === 'POST') {
    return ok({ message: 'User suspended successfully' });
  }

  if (/\/api\/User\/[^/]+\/activate$/.test(url) && method === 'POST') {
    return ok({ message: 'User activated successfully' });
  }

  // Create Scooter
  if (url.endsWith('/api/Scooter') && method === 'POST') {
    const newScooter = {
      id: 'scooter-' + Date.now(),
      serialNumber: body?.serialNumber || 'SC-NEW',
      batteryLevel: 100,
      status: 'Available',
      modelName: 'New Scooter',
    };
    return ok(newScooter);
  }

  // Delete Scooter
  if (/\/api\/Scooter\/[^/]+$/.test(url) && method === 'DELETE') {
    return ok(true);
  }

// Live Map
if (url.endsWith('/api/Scooter/live-map') && method === 'GET') {
  const baseLat = 30.0444;
  const baseLng = 31.2357;

  return ok({
    scooters: mockScootersList.map((s, idx) => ({
      id: s.id,
      serialNumber: s.serialNumber,
      batteryLevel: s.batteryLevel,
      status: s.status,           
      modelName: s.modelName,   
      latitude: baseLat + Math.sin(idx * 0.5) * 0.02,
      longitude: baseLng + Math.cos(idx * 0.5) * 0.02,
      unlockFee: 5,
      feePerMinute: 1.5,
    })),
    zones: mockZonesList.map((z) => ({
      id: z.id,
      name: z.name,
      type: z.type,
      boundary: z.boundary,
    })),
  });
}

  // Scooters
  if (url.endsWith('/api/Scooter') && method === 'GET') {
    return ok(paginate(mockScootersList, params));
  }

  if (/\/api\/Scooter\/[^/]+$/.test(url) && method === 'GET') {
    const scooterId = url.split('/').pop();
    const scooter = mockScootersList.find((s) => s.id === scooterId);
    return scooter
      ? ok(scooter)
      : throwError(() => ({ status: 404, error: { message: 'Scooter not found' } }));
  }

  if (
    /\/api\/Scooter\/[^/]+\/(unlock|lock|start|stop|ping|maintenance|retire)$/.test(url) &&
    method === 'POST'
  ) {
    return ok({ message: 'Scooter action completed successfully' });
  }

  // Tariffs
  if (url.endsWith('/api/Tariff/active') && method === 'GET') {
    return ok(mockTariff);
  }

  if (url.endsWith('/api/Tariff') && method === 'GET') {
    return ok(paginate([mockTariff], params));
  }

  // Zones
  if (url.endsWith('/api/Zone') && method === 'GET') {
    return ok(paginate(mockZonesList, params));
  }

  if (/\/api\/Zone\/[^/]+$/.test(url) && method === 'GET') {
    const zoneId = url.split('/').pop();
    const zone = mockZonesList.find((z) => z.id === zoneId);
    return zone
      ? ok(zone)
      : throwError(() => ({ status: 404, error: { message: 'Zone not found' } }));
  }

  // Rides - list (we don't have a rides list endpoint in swagger, but mock it anyway)
  if (url.endsWith('/api/Ride') && method === 'GET') {
    return ok(paginate(mockRidesList, params));
  }

  // Rides - pending photos
  if (url.includes('/api/Ride/parking-photos/pending') && method === 'GET') {
    return ok(paginate(mockPendingPhotos, params));
  }

  // Rides - review
  if (/\/api\/Ride\/parking-photos\/[^/]+\/review$/.test(url) && method === 'POST') {
    return ok({ message: 'Parking photo reviewed successfully' });
  }

  // Wallet
  if (url.includes('/api/Wallet/transactions') && method === 'GET') {
    return ok(paginate(mockTransactions, params));
  }

  // Create Zone
  if (url.endsWith('/api/Zone') && method === 'POST') {
    const newZone = {
      id: 'zone-' + Date.now(),
      name: body?.name || 'New Zone',
      type: body?.type || 'Parking',
      speedLimitKmH: body?.speedLimitKmH || null,
      isActive: true,
      boundary: body?.boundary || [],
    };
    return ok(newZone);
  }

  // Update Zone
  if (/\/api\/Zone\/[^/]+$/.test(url) && method === 'PUT') {
    const updatedZone = {
      id: url.split('/').pop(),
      name: body?.name || 'Updated Zone',
      type: body?.type || 'Parking',
      speedLimitKmH: body?.speedLimitKmH || null,
      isActive: body?.isActive ?? true,
      boundary: body?.boundary || [],
    };
    return ok(updatedZone);
  }

  // Delete Zone
  if (/\/api\/Zone\/[^/]+$/.test(url) && method === 'DELETE') {
    return ok(true);
  }

  // Create Tariff
  if (url.endsWith('/api/Tariff') && method === 'POST') {
    const newTariff = {
      id: 'tariff-' + Date.now(),
      name: body?.name || 'New Tariff',
      unlockFee: body?.unlockFee || 0,
      perMinuteRate: body?.perMinuteRate || 0,
      isActive: false,
      createdAt: new Date().toISOString(),
    };
    return ok(newTariff);
  }

  // Activate Tariff
  if (/\/api\/Tariff\/[^/]+\/activate$/.test(url) && method === 'POST') {
    return ok({ message: 'Tariff activated successfully' });
  }

  // Delete Tariff
  if (/\/api\/Tariff\/[^/]+$/.test(url) && method === 'DELETE') {
    return ok({ message: 'Tariff deleted successfully' });
  }

  // Change Password
  if (url.includes('/api/Auth/change-password') && method === 'POST') {
    if (!body?.currentPassword || !body?.newPassword) {
      return throwError(() => ({
        status: 400,
        error: { message: 'Current password and new password are required' },
      })).pipe(delay(300));
    }
    if (body.currentPassword === '000000') {
      return throwError(() => ({
        status: 400,
        error: { message: 'Current password is incorrect' },
      })).pipe(delay(300));
    }
    return ok({ message: 'Password changed successfully' });
  }

  // Create Admin
  if (url.includes('/api/Auth/create-admin') && method === 'POST') {
    if (!body?.email || !body?.password || !body?.name) {
      return throwError(() => ({
        status: 400,
        error: { message: 'Email, password and name are required' },
      })).pipe(delay(300));
    }

    return ok({
      admin: {
        id: 'admin-' + Date.now(),
        fullName: body.name,
        email: body.email,
        accountStatus: 'Active',
        createdAt: new Date().toISOString(),
      },
      token: {
        accessToken: 'new-admin-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        refreshToken: 'new-refresh-token',
        refreshTokenExpiration: new Date(Date.now() + 604800000).toISOString(),
      },
    });
  }

  if (url.includes('/api/Wallet/adjust') && method === 'POST') {
    if (!body?.userId || body?.amount == null || !body?.reason) {
      return throwError(() => ({
        status: 400,
        error: { message: 'userId, amount and reason are required' },
      })).pipe(delay(300));
    }
    return ok({ message: 'Wallet adjusted successfully' });
  }

  return null;
}

// ========== Main Interceptor ==========

export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  const { url, method, params } = req;
  const body: any = req.body ?? {};

  // Mode 1: useMockApi = true → always use mock
  if (environment.useMockApi) {
    const mockResponse = handleMockRoute(url, method, body, params);
    if (mockResponse) {
      console.log(`🟡 MOCK: ${method} ${url}`);
      return mockResponse;
    }
  }

  // Mode 2: useMockApi = false → try real API, fallback to mock if server down
  return next(req).pipe(
    timeout(10000),
    catchError((err) => {
      // Server is down or unreachable
      if (err.status === 0 || err.name === 'TimeoutError') {
        console.warn(`🔴 API unreachable, falling back to mock: ${method} ${url}`);
        const mockResponse = handleMockRoute(url, method, body, params);
        if (mockResponse) {
          return mockResponse;
        }
      }
      return throwError(() => err);
    }),
  );
};
