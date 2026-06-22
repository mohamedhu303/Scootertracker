export interface User {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  phoneVerified: boolean;
  idVerificationStatus: string;
  accountStatus: string;
  walletBalance: number;
  totalRides: number;
  createdAt: Date;
}

export interface UserDetail extends User {
  totalSpent: number;
  walletTotalToppedUp: number;
  recentRides: UserRide[];
}

export interface UserRide {
  id: string;
  scooterId: string;
  status: string;
  startTime: Date;
  endTime?: Date;
  totalCost?: number;
}

export interface UsersListResult {
  users: User[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}