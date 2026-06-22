export interface DashboardStats {
  totalScooters: number;
  availableScooters: number;
  inRideScooters: number;
  chargingScooters: number;
  maintenanceScooters: number;
  totalUsers: number;
  activeRides: number;
  todayRevenue: number;
  totalRevenue: number;
  averageBatteryLevel: number;
  timestamp: Date;
}

export interface RevenueAnalytics {
  totalRevenue: number;
  todayRevenue: number;
  thisWeekRevenue: number;
  thisMonthRevenue: number;
  averageRideCost: number;
  totalCompletedRides: number;
  revenueChart: RevenueDataPoint[];
  topScooters: TopScooter[];
}

export interface RevenueDataPoint {
  label: string;
  revenue: number;
  ridesCount: number;
}

export interface TopScooter {
  scooterId: string;
  model: string;
  totalRides: number;
  totalRevenue: number;
}

export interface FleetAnalytics {
  totalScooters: number;
  availableScooters: number;
  inRideScooters: number;
  chargingScooters: number;
  maintenanceScooters: number;
  retiredScooters: number;
  averageBatteryLevel: number;
  lowBatteryCount: number;
  criticalBatteryCount: number;
  statusDistribution: StatusDistribution[];
  batteryDistribution: BatteryDistribution[];
}

export interface StatusDistribution {
  status: string;
  count: number;
  percentage: number;
}

export interface BatteryDistribution {
  range: string;
  count: number;
}