export interface Ride {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  scooterId: string;
  scooterModel: string;
  status: string;
  startTime: Date;
  endTime?: Date;
  durationMinutes?: number;
  totalCost?: number;
  ratePerMinute: number;
  startLatitude: number;
  startLongitude: number;
  endLatitude?: number;
  endLongitude?: number;
  createdAt: Date;
}

export interface RidesListResult {
  rides: Ride[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}