export interface DashboardStats {
  activeRides: number;
  availableScooters: number;
  todayRevenue: number;
  totalUsers: number;
  onlineScooters: number;
  offlineScooters: number;
}

export interface ScooterLocation {
  id: string;
  scooterId: string;
  latitude: number;
  longitude: number;
  batteryLevel: number;
  status: ScooterStatus;
  lastSeen: string;
}

export enum ScooterStatus {
  Available = 'Available',
  InRide = 'InRide',
  Charging = 'Charging',
  Maintenance = 'Maintenance',
  Offline = 'Offline'
}

export interface RecentRide {
  id: string;
  userId: string;
  userName: string;
  scooterId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  cost?: number;
  status: 'Active' | 'Completed' | 'Cancelled';
}