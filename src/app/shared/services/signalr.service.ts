import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DashboardStats, ScooterLocation } from '../../features/dashboard/models/dashboard.model';

@Injectable({
  providedIn: 'root'
})
export class SignalRService {
  private hubConnection!: signalR.HubConnection;
  private connectionEstablished = new BehaviorSubject<boolean>(false);
  
  // حسب RSD Section 18.2 - SignalR Events
  private dashboardStats$ = new BehaviorSubject<DashboardStats | null>(null);
  private scooterLocationUpdated$ = new BehaviorSubject<ScooterLocation | null>(null);

  get isConnected$(): Observable<boolean> {
    return this.connectionEstablished.asObservable();
  }

  get dashboardStatsStream$(): Observable<DashboardStats | null> {
    return this.dashboardStats$.asObservable();
  }

  get scooterLocationStream$(): Observable<ScooterLocation | null> {
    return this.scooterLocationUpdated$.asObservable();
  }

  startConnection(token: string): void {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.apiBaseUrl}/hubs/admin`, {
        accessTokenFactory: () => token,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.hubConnection
      .start()
      .then(() => {
        console.log('✅ SignalR Connected');
        this.connectionEstablished.next(true);
        this.registerListeners();
      })
      .catch(err => {
        console.error('❌ SignalR Connection Error:', err);
        this.connectionEstablished.next(false);
      });

    this.hubConnection.onreconnected(() => {
      console.log('🔄 SignalR Reconnected');
      this.connectionEstablished.next(true);
    });

    this.hubConnection.onreconnecting(() => {
      console.log('⏳ SignalR Reconnecting...');
      this.connectionEstablished.next(false);
    });
  }

  private registerListeners(): void {
    // حسب RSD Section 18.2 - Dashboard Stats (كل 10 ثواني)
    this.hubConnection.on('DashboardStats', (stats: DashboardStats) => {
      this.dashboardStats$.next(stats);
    });

    // حسب RSD - ScooterLocationUpdated (كل 5 ثواني لكل سكوتر)
    this.hubConnection.on('ScooterLocationUpdated', (location: ScooterLocation) => {
      this.scooterLocationUpdated$.next(location);
    });

    // يمكن إضافة listeners تانية حسب الحاجة
    this.hubConnection.on('RideStarted', (data: any) => {
      console.log('🛴 New Ride Started:', data);
    });

    this.hubConnection.on('GeofenceAlert', (data: any) => {
      console.warn('⚠️ Geofence Breach:', data);
    });
  }

  stopConnection(): void {
    if (this.hubConnection) {
      this.hubConnection.stop();
      this.connectionEstablished.next(false);
    }
  }
}