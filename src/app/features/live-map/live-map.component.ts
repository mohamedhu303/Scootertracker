import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  inject,
  ChangeDetectorRef,
  ElementRef,
  ViewChild,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  LiveMapService,
  MapScooter,
  MapZone,
  LiveMapData,
} from '../../core/services/live-map.service';
import { ToastService } from '../../shared/services/toast.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-live-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './live-map.component.html',
  styleUrl: './live-map.component.scss',
})
export class LiveMapComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;

  private liveMapService = inject(LiveMapService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);
  private destroy$ = new Subject<void>();

  private L: any;
  private map: any;
  private scooterMarkers: any[] = [];
  private zonePolygons: any[] = [];
  private mapReady = false;
  private pendingRender = false;
  private isFirstLoad = true; // 🎯 جديد: لتتبع أول تحميل

  scooters: MapScooter[] = [];
  filteredScooters: MapScooter[] = [];
  zones: MapZone[] = [];
  isLoading = false;
  showZones = true;
  selectedStatus = 'All';

  statuses = [
    { value: 'All', label: 'All', color: '#4f46e5' },
    { value: 'Available', label: 'Available', color: '#16a34a' },
    { value: 'InUse', label: 'In Use', color: '#2563eb' },
    { value: 'Charging', label: 'Charging', color: '#d97706' },
    { value: 'Maintenance', label: 'Maintenance', color: '#dc2626' },
    { value: 'Offline', label: 'Offline', color: '#64748b' },
  ];

  stats = {
    total: 0,
    available: 0,
    inUse: 0,
    charging: 0,
    maintenance: 0,
    offline: 0,
  };

  // ============================================================
  // 🔄 LIFECYCLE
  // ============================================================

  ngOnInit() {
    // 1) Subscribe to live state updates
    this.liveMapService.state$.pipe(takeUntil(this.destroy$)).subscribe((data) => {
      if (!data) return;
      this.applyData(data);
      this.isLoading = false;
      this.cdr.detectChanges();
    });

    // 2) Try cache first
    const cached = this.liveMapService.getCached();
    if (cached) {
      this.applyData(cached);
      this.isLoading = false;
    } else if (!this.liveMapService.snapshot) {
      this.isLoading = true;
    }

    this.cdr.detectChanges();

    // 3) Fetch fresh data in the background
    this.liveMapService
      .getLiveMap(false)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          if (!this.scooters.length) {
            this.toast.error('Error', 'Could not load map data');
          }
          this.isLoading = false;
          this.cdr.detectChanges();
        },
      });

    // 4) Live sync
    this.liveMapService.startLiveSync();
  }

  async ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.L = await import('leaflet');
      this.initMap();
    }
  }

  ngOnDestroy() {
    this.liveMapService.stopLiveSync();
    this.mapReady = false;

    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // 🗺️ MAP INITIALIZATION
  // ============================================================

  private initMap() {
    if (!this.L || this.map) return;

    this.map = this.L.map(this.mapContainer.nativeElement, {
      center: [30.0444, 31.2357], // افتراضي القاهرة لو مفيش scooters
      zoom: 13,
      zoomControl: true,
    });

    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.map);

    this.mapReady = true;

    // 🎯 لو البيانات وصلت قبل الخريطة، اعمل render و zoom
    if (this.scooters.length > 0 || this.pendingRender) {
      this.pendingRender = false;
      this.renderMap();
      this.fitMapToScooters();
      this.isFirstLoad = false;
    }
  }

  /**
   * 🎯 يحدد حدود الخريطة تلقائياً بناءً على مواقع الـ scooters
   */
  private fitMapToScooters() {
    if (!this.map || !this.L || this.scooters.length === 0) return;

    // حالة واحدة: scooter واحد بس
    if (this.scooters.length === 1) {
      const s = this.scooters[0];
      this.map.setView([s.latitude, s.longitude], 15, { animate: true });
      return;
    }

    // أكتر من scooter: احسب bounds
    const latlngs = this.scooters.map((s) => [s.latitude, s.longitude]);
    const bounds = this.L.latLngBounds(latlngs);

    this.map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 15,
      animate: true,
    });
  }

  // ============================================================
  // 📊 DATA HANDLING
  // ============================================================

  private applyData(data: LiveMapData) {
    this.scooters = data.scooters;
    this.zones = data.zones;
    this.calculateStats();
    this.filterAndRender();

    // 🎯 أول مرة فقط: اعمل zoom على مكان الـ scooters
    if (this.isFirstLoad && this.scooters.length > 0 && this.mapReady) {
      this.fitMapToScooters();
      this.isFirstLoad = false;
    }
  }

  calculateStats() {
    this.stats = {
      total: this.scooters.length,
      available: this.scooters.filter((s) => s.status === 'Available').length,
      inUse: this.scooters.filter((s) => s.status === 'InUse').length,
      charging: this.scooters.filter((s) => s.status === 'Charging').length,
      maintenance: this.scooters.filter((s) => s.status === 'Maintenance').length,
      offline: this.scooters.filter((s) => s.status === 'Offline').length,
    };
  }

  filterAndRender() {
    this.filteredScooters =
      this.selectedStatus === 'All'
        ? this.scooters
        : this.scooters.filter((s) => s.status === this.selectedStatus);

    if (this.mapReady && this.map) {
      this.renderMap();
    } else {
      this.pendingRender = true;
    }
  }

  // ============================================================
  // 🎛️ USER ACTIONS
  // ============================================================

  onStatusFilter(status: string) {
    this.selectedStatus = status;
    this.filterAndRender();
  }

  toggleZones() {
    this.showZones = !this.showZones;
    if (this.mapReady) {
      this.renderMap();
    }
  }

  refresh() {
    this.toast.info('Refreshing', 'Updating map data...');

    this.liveMapService
      .getLiveMap(true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.applyData(data);
          this.cdr.detectChanges();
        },
        error: () => {
          this.toast.error('Error', 'Could not refresh map data');
          this.cdr.detectChanges();
        },
      });
  }

  /**
   * 🎯 يرجع الخريطة على مكان الـ scooters (مش القاهرة)
   */
  resetView() {
    if (!this.map) return;

    if (this.scooters.length > 0) {
      this.fitMapToScooters();
    } else {
      this.map.setView([30.0444, 31.2357], 13, { animate: true });
    }
  }

  centerOnScooter(scooter: MapScooter) {
    if (!this.map) return;

    this.map.setView([scooter.latitude, scooter.longitude], 16, { animate: true });

    const marker = this.scooterMarkers.find((m: any) => {
      const pos = m.getLatLng();
      return (
        Math.abs(pos.lat - scooter.latitude) < 0.0001 &&
        Math.abs(pos.lng - scooter.longitude) < 0.0001
      );
    });

    if (marker) marker.openPopup();
  }

  // ============================================================
  // 🎨 RENDER MAP
  // ============================================================

  private renderMap() {
    if (!this.map || !this.L) return;

    // Clear existing markers
    this.scooterMarkers.forEach((m) => this.map.removeLayer(m));
    this.scooterMarkers = [];

    this.zonePolygons.forEach((p) => this.map.removeLayer(p));
    this.zonePolygons = [];

    // Render zones
    if (this.showZones) {
      this.zones.forEach((zone) => {
        if (!zone.boundary || zone.boundary.length < 3) return;

        const latlngs = zone.boundary.map((c) => [c.latitude, c.longitude]);
        const color = this.getZoneColor(zone.type);

        const polygon = this.L.polygon(latlngs, {
          color,
          fillColor: color,
          fillOpacity: 0.16,
          weight: 2,
          dashArray:
            zone.type === 'NoParking' || zone.type === 'Forbidden' ? '8, 4' : undefined,
        }).addTo(this.map);

        polygon.bindTooltip(
          `
          <strong>${zone.name}</strong><br>
          Type: ${zone.type}
          ${zone.speedLimitKmH ? `<br>Speed: ${zone.speedLimitKmH} km/h` : ''}
        `,
          { sticky: true },
        );

        this.zonePolygons.push(polygon);
      });
    }

    // Render scooter markers
    this.filteredScooters.forEach((scooter) => {
      const color = this.getStatusColor(scooter.status);
      const colorDark = this.darkenColor(color);
      const batteryColor = this.getBatteryBadgeColor(scooter.batteryLevel);
      const showPulse = scooter.status === 'Available';

      const markerHtml = `
        <div style="position:relative;width:56px;height:68px;cursor:pointer;">
          ${
            showPulse
              ? `
            <div style="
              position:absolute;top:8px;left:50%;
              transform:translateX(-50%);
              width:44px;height:44px;border-radius:50%;
              border:3px solid ${color};opacity:0;
              animation:scooterPulseAnim 2s infinite;z-index:1;pointer-events:none;
            "></div>`
              : ''
          }
          <svg width="56" height="68" viewBox="0 0 56 68" xmlns="http://www.w3.org/2000/svg"
            style="position:relative;z-index:2;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.28));">
            <defs>
              <linearGradient id="g-${scooter.id}" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:${color}"/>
                <stop offset="100%" style="stop-color:${colorDark}"/>
              </linearGradient>
            </defs>
            <path d="M28 4 C16 4,6 13,6 25 C6 38,28 62,28 62 C28 62,50 38,50 25 C50 13,40 4,28 4Z"
              fill="url(#g-${scooter.id})" stroke="white" stroke-width="3"/>
            <g transform="translate(14,13)" stroke="white" fill="none" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <circle cx="5" cy="20" r="3.5"/>
              <circle cx="23" cy="20" r="3.5"/>
              <line x1="5" y1="16" x2="17" y2="16"/>
              <line x1="20" y1="20" x2="20" y2="5"/>
              <line x1="17" y1="16" x2="20" y2="9"/>
              <line x1="16" y1="5" x2="24" y2="5"/>
              <line x1="10" y1="16" x2="10" y2="20"/>
            </g>
          </svg>
          <div style="
            position:absolute;top:0;right:-2px;
            background:white;padding:2px 7px;border-radius:12px;
            font-size:10px;font-weight:800;
            border:2px solid ${batteryColor};color:${batteryColor};
            white-space:nowrap;z-index:3;
            box-shadow:0 2px 6px rgba(0,0,0,0.18);
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1;
          ">${scooter.batteryLevel}%</div>
        </div>`;

      const icon = this.L.divIcon({
        className: 'scooter-marker-custom',
        html: markerHtml,
        iconSize: [56, 68],
        iconAnchor: [28, 62],
        popupAnchor: [0, -62],
      });

      const marker = this.L.marker([scooter.latitude, scooter.longitude], { icon }).addTo(
        this.map,
      );

      marker.bindPopup(this.buildPopup(scooter, color, colorDark, batteryColor), {
        maxWidth: 300,
        closeButton: true,
        autoPan: true,
      });

      marker.on('popupopen', () => {
        setTimeout(() => {
          const btn = document.querySelector(`button[data-scooter-id="${scooter.id}"]`);
          if (btn) {
            btn.addEventListener('click', () => {
              this.router.navigate(['/app/scooters', scooter.id]);
            });
          }
        }, 100);
      });

      this.scooterMarkers.push(marker);
    });
  }

  private buildPopup(
    scooter: MapScooter,
    color: string,
    colorDark: string,
    batteryColor: string,
  ): string {
    return `
      <div style="width:280px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <div style="background:linear-gradient(135deg,${color},${colorDark});padding:16px 18px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:16px;font-weight:800;color:white;">${scooter.serialNumber}</span>
            <span style="background:rgba(255,255,255,0.28);padding:3px 12px;border-radius:12px;
              font-size:10px;font-weight:700;text-transform:uppercase;color:white;letter-spacing:0.5px;">
              ${scooter.status}
            </span>
          </div>
          <div style="font-size:12px;color:rgba(255,255,255,0.92);font-weight:500;">${scooter.modelName}</div>
        </div>
        <div style="padding:16px 18px;background:white;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
            <div style="background:#f8fafc;padding:10px 12px;border-radius:10px;border:1px solid #f1f5f9;">
              <span style="display:block;font-size:10px;color:#94a3b8;text-transform:uppercase;
                letter-spacing:0.5px;margin-bottom:4px;font-weight:600;">Battery</span>
              <span style="display:block;font-size:16px;font-weight:800;color:${batteryColor};">
                ${scooter.batteryLevel}%
              </span>
            </div>
            <div style="background:#f8fafc;padding:10px 12px;border-radius:10px;border:1px solid #f1f5f9;">
              <span style="display:block;font-size:10px;color:#94a3b8;text-transform:uppercase;
                letter-spacing:0.5px;margin-bottom:4px;font-weight:600;">Rate</span>
              <span style="display:block;font-size:16px;font-weight:800;color:#0f172a;">
                ${scooter.feePerMinute || 1.5} EGP/min
              </span>
            </div>
          </div>
          <div style="font-size:10px;color:#94a3b8;text-align:center;padding:8px;
            background:#f8fafc;border-radius:8px;margin-bottom:12px;border:1px solid #f1f5f9;
            font-family:'Courier New',monospace;">
            ${scooter.latitude.toFixed(5)}, ${scooter.longitude.toFixed(5)}
          </div>
          <button data-scooter-id="${scooter.id}"
            style="width:100%;padding:12px;background:linear-gradient(135deg,#4f46e5,#7c3aed);
            color:white;border:none;border-radius:12px;font-size:13px;font-weight:700;
            cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;
            box-shadow:0 4px 14px rgba(79,70,229,0.32);font-family:inherit;"
            onmouseover="this.style.transform='translateY(-2px)'"
            onmouseout="this.style.transform='translateY(0)'">
            View Full Details
          </button>
        </div>
      </div>`;
  }

  // ============================================================
  // 🎨 HELPERS
  // ============================================================

  getStatusColor(status: string): string {
    const s = this.statuses.find((x) => x.value === status);
    return s?.color || '#64748b';
  }

  getZoneColor(type: string): string {
    const colors: Record<string, string> = {
      Parking: '#16a34a',
      NoParking: '#dc2626',
      Slow: '#d97706',
      Forbidden: '#991b1b',
    };
    return colors[type] || '#4f46e5';
  }

  getBatteryBadgeColor(level: number): string {
    if (level >= 50) return '#16a34a';
    if (level >= 25) return '#d97706';
    return '#dc2626';
  }

  private darkenColor(hex: string): string {
    const colors: Record<string, string> = {
      '#16a34a': '#15803d',
      '#2563eb': '#1d4ed8',
      '#d97706': '#b45309',
      '#dc2626': '#b91c1c',
      '#64748b': '#475569',
      '#4f46e5': '#4338ca',
    };
    return colors[hex] || hex;
  }
}