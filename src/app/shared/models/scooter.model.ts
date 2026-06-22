export interface Scooter {
  id: string;
  model: string;
  status: string;
  batteryLevel: number;
  currentLatitude?: number;
  currentLongitude?: number;
  lastSeenAt?: Date;
  isLocked: boolean;
  totalRides: number;
  batteryStatus: string;
}

export interface ScooterDetail extends Scooter {
  totalCompletedRides: number;
  totalRevenue: number;
  createdAt: Date;
  recentRides: ScooterRide[];
}

export interface ScooterRide {
  id: string;
  userId: string;
  userName: string;
  status: string;
  startTime: Date;
  endTime?: Date;
  totalCost?: number;
}