import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MockDataService {

  getDashboardStats() {
    return {
      activeRides: 24,
      availableScooters: 87,
      todayRevenue: 3420.50,
      totalUsers: 1284,
      onlineScooters: 92,
      offlineScooters: 8,
      totalScooters: 100
    };
  }

  getScooters() {
    return [
      {
        id: 'SCT-001',
        model: 'Xiaomi Pro 2',
        status: 'Available',
        batteryLevel: 85,
        lastSeen: '2 min ago',
        location: 'Cairo - Maadi'
      },
      {
        id: 'SCT-002',
        model: 'Segway Ninebot',
        status: 'InRide',
        batteryLevel: 62,
        lastSeen: '1 min ago',
        location: 'Cairo - Zamalek'
      },
      {
        id: 'SCT-003',
        model: 'Xiaomi Pro 2',
        status: 'Available',
        batteryLevel: 91,
        lastSeen: '5 min ago',
        location: 'Cairo - Heliopolis'
      },
      {
        id: 'SCT-004',
        model: 'Segway ES4',
        status: 'Charging',
        batteryLevel: 34,
        lastSeen: '10 min ago',
        location: 'Cairo - Nasr City'
      },
      {
        id: 'SCT-005',
        model: 'Xiaomi Mi 3',
        status: 'Maintenance',
        batteryLevel: 15,
        lastSeen: '1 hour ago',
        location: 'Cairo - 6th October'
      },
      {
        id: 'SCT-006',
        model: 'Segway Ninebot',
        status: 'Available',
        batteryLevel: 78,
        lastSeen: '3 min ago',
        location: 'Cairo - Dokki'
      }
    ];
  }

  getUsers() {
    return [
      {
        id: 'USR-001',
        fullName: 'Ahmed Mohamed',
        email: 'ahmed@example.com',
        phone: '+201001234567',
        status: 'Active',
        verificationStatus: 'Verified',
        walletBalance: 150.00,
        totalRides: 23,
        joinedAt: '2024-01-15'
      },
      {
        id: 'USR-002',
        fullName: 'Sara Hassan',
        email: 'sara@example.com',
        phone: '+201009876543',
        status: 'Active',
        verificationStatus: 'Verified',
        walletBalance: 75.50,
        totalRides: 11,
        joinedAt: '2024-02-20'
      },
      {
        id: 'USR-003',
        fullName: 'Omar Khaled',
        email: 'omar@example.com',
        phone: '+201112345678',
        status: 'Suspended',
        verificationStatus: 'Verified',
        walletBalance: 0,
        totalRides: 5,
        joinedAt: '2024-03-10'
      },
      {
        id: 'USR-004',
        fullName: 'Nour Ali',
        email: 'nour@example.com',
        phone: '+201234567890',
        status: 'Active',
        verificationStatus: 'Pending',
        walletBalance: 200.00,
        totalRides: 0,
        joinedAt: '2024-04-05'
      },
      {
        id: 'USR-005',
        fullName: 'Mostafa Ibrahim',
        email: 'mostafa@example.com',
        phone: '+201098765432',
        status: 'Active',
        verificationStatus: 'Verified',
        walletBalance: 320.75,
        totalRides: 47,
        joinedAt: '2024-01-08'
      },
      {
        id: 'USR-006',
        fullName: 'Yasmin Mahmoud',
        email: 'yasmin@example.com',
        phone: '+201122334455',
        status: 'Active',
        verificationStatus: 'ManualReview',
        walletBalance: 50.00,
        totalRides: 3,
        joinedAt: '2024-04-18'
      }
    ];
  }

  getRides() {
    return [
      {
        id: 'RIDE-001',
        userName: 'Ahmed Mohamed',
        userId: 'USR-001',
        scooterId: 'SCT-002',
        startTime: '2024-04-20T10:30:00',
        endTime: '2024-04-20T10:55:00',
        duration: 25,
        cost: 67.50,
        status: 'Completed',
        startLocation: 'Maadi',
        endLocation: 'Zamalek'
      },
      {
        id: 'RIDE-002',
        userName: 'Sara Hassan',
        userId: 'USR-002',
        scooterId: 'SCT-007',
        startTime: '2024-04-20T11:00:00',
        endTime: null,
        duration: null,
        cost: null,
        status: 'Active',
        startLocation: 'Heliopolis',
        endLocation: null
      },
      {
        id: 'RIDE-003',
        userName: 'Mostafa Ibrahim',
        userId: 'USR-005',
        scooterId: 'SCT-001',
        startTime: '2024-04-20T09:15:00',
        endTime: '2024-04-20T09:45:00',
        duration: 30,
        cost: 80.00,
        status: 'Completed',
        startLocation: 'Nasr City',
        endLocation: 'New Cairo'
      },
      {
        id: 'RIDE-004',
        userName: 'Omar Khaled',
        userId: 'USR-003',
        scooterId: 'SCT-003',
        startTime: '2024-04-20T08:00:00',
        endTime: '2024-04-20T08:20:00',
        duration: 20,
        cost: 55.00,
        status: 'Completed',
        startLocation: 'Dokki',
        endLocation: 'Mohandessin'
      },
      {
        id: 'RIDE-005',
        userName: 'Nour Ali',
        userId: 'USR-004',
        scooterId: 'SCT-006',
        startTime: '2024-04-20T11:30:00',
        endTime: null,
        duration: null,
        cost: null,
        status: 'Active',
        startLocation: '6th October',
        endLocation: null
      }
    ];
  }

  getAnalytics() {
    return {
      revenueChart: {
        labels: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        data: [2100, 1850, 3200, 2800, 3420, 2950, 3800]
      },
      ridesChart: {
        labels: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        data: [45, 38, 67, 58, 72, 61, 80]
      },
      topScooters: [
        { id: 'SCT-001', rides: 47, revenue: 1250 },
        { id: 'SCT-007', rides: 38, revenue: 980 },
        { id: 'SCT-003', rides: 35, revenue: 890 }
      ],
      statusBreakdown: {
        available: 87,
        inRide: 8,
        charging: 3,
        maintenance: 2
      }
    };
  }
}