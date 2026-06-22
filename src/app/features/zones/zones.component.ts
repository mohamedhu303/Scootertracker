import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  inject,
  ChangeDetectorRef,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, filter } from 'rxjs';
import {
  ZoneService,
  ZoneDto,
  ZoneForCreationDto,
  CoordinateDto,
  ZonesData,
} from '../../core/services/zone.service';
import { DialogService } from '../../shared/services/dialog.service';
import { ToastService } from '../../shared/services/toast.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-zones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './zones.component.html',
  styleUrl: './zones.component.scss',
})
export class ZonesComponent implements OnInit, OnDestroy {
  private zoneService = inject(ZoneService);
  private cdr = inject(ChangeDetectorRef);
  private toast = inject(ToastService);
  private dialog = inject(DialogService);
  private destroy$ = new Subject<void>();

  zones: ZoneDto[] = [];
  filteredZones: ZoneDto[] = [];
  isLoading = false;
  selectedType = 'All';

  zoneTypes = ['All', 'Parking', 'NoParking', 'Slow', 'Forbidden'];

  // Dialog
  showDialog = false;
  isEditing = false;
  editingZoneId: string | null = null;
  dialogLoading = false;
  errorMessage = '';

  formData = {
    name: '',
    type: 'Parking',
    speedLimitKmH: null as number | null,
    isActive: true,
  };

  // Map
  @ViewChild('zoneMapContainer') mapContainer!: ElementRef;
  private dialogMap: L.Map | null = null;
  private drawnMarkers: L.Marker[] = [];
  private drawnPolyline: L.Polyline | null = null;
  private drawnPolygon: L.Polygon | null = null;
  boundaryPoints: CoordinateDto[] = [];

  // Default center: Alexandria, Egypt
  private readonly DEFAULT_CENTER: L.LatLngExpression = [31.2001, 29.9187];
  private readonly DEFAULT_ZOOM = 13;

  // Delete
  deleteLoading: string | null = null;

  // ─── Lifecycle ──────────────────────────────────────────

  ngOnInit() {
    this.zoneService.state$
      .pipe(
        takeUntil(this.destroy$),
        filter((data): data is ZonesData => data !== null),
      )
      .subscribe((data: ZonesData) => {
        this.zones = data.zones;
        this.filterZones();
        this.isLoading = false;
        this.cdr.detectChanges();
      });

    const cached = this.zoneService.getCached();
    if (cached) {
      this.zones = cached.zones;
      this.filterZones();
      this.isLoading = false;
    } else {
      this.isLoading = true;
    }
    this.cdr.detectChanges();

    this.zoneService
      .getZonesData(false)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: ZonesData) => {
          this.zones = data.zones;
          this.filterZones();
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error('Zone error:', err);
          this.toast.error('Error', 'Could not load zones');
          this.isLoading = false;
          this.cdr.detectChanges();
        },
      });

    this.zoneService.startLiveSync();
  }

  ngOnDestroy() {
    this.zoneService.stopLiveSync();
    this.destroyDialogMap();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Filter ─────────────────────────────────────────────

  filterZones() {
    const normalize = (type: string) =>
      String(type || '')
        .replace(/\s+/g, '')
        .toLowerCase();

    this.filteredZones =
      this.selectedType === 'All'
        ? [...this.zones]
        : this.zones.filter((z) => normalize(z.type) === normalize(this.selectedType));
  }

  onTypeFilter(type: string) {
    this.selectedType = type;
    this.filterZones();
  }

  // ─── Stats helpers ──────────────────────────────────────

  get totalZones() {
    return this.zones.length;
  }
  get activeZones() {
    return this.zones.filter((z) => z.isActive).length;
  }
  get inactiveZones() {
    return this.zones.filter((z) => !z.isActive).length;
  }

  // ─── Add ────────────────────────────────────────────────

  openAddDialog() {
    this.isEditing = false;
    this.editingZoneId = null;
    this.errorMessage = '';
    this.boundaryPoints = [];
    this.formData = {
      name: '',
      type: 'Parking',
      speedLimitKmH: null,
      isActive: true,
    };
    this.showDialog = true;
    this.cdr.detectChanges();

    // Initialize map after dialog renders
    setTimeout(() => this.initDialogMap(), 100);
  }

  // ─── Edit ───────────────────────────────────────────────

  openEditDialog(zone: ZoneDto) {
    this.isEditing = true;
    this.editingZoneId = zone.id;
    this.errorMessage = '';
    this.boundaryPoints = zone.boundary.map((c) => ({
      latitude: c.latitude,
      longitude: c.longitude,
    }));
    this.formData = {
      name: zone.name,
      type: zone.type,
      speedLimitKmH: zone.speedLimitKmH,
      isActive: zone.isActive,
    };
    this.showDialog = true;
    this.cdr.detectChanges();

    // Initialize map after dialog renders, then draw existing points
    setTimeout(() => {
      this.initDialogMap();
      this.drawExistingPoints();
    }, 100);
  }

  closeDialog() {
    this.showDialog = false;
    this.errorMessage = '';
    this.destroyDialogMap();
    this.cdr.detectChanges();
  }

  // ─── Map Logic ──────────────────────────────────────────

  private initDialogMap() {
    if (!this.mapContainer?.nativeElement) return;
    this.destroyDialogMap();

    this.dialogMap = L.map(this.mapContainer.nativeElement, {
      center: this.DEFAULT_CENTER,
      zoom: this.DEFAULT_ZOOM,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.dialogMap);

    // Click to add point
    this.dialogMap.on('click', (e: L.LeafletMouseEvent) => {
      this.addBoundaryPoint(e.latlng.lat, e.latlng.lng);
    });

    // Fix map rendering in dialog
    setTimeout(() => {
      this.dialogMap?.invalidateSize();
    }, 200);
  }

  private destroyDialogMap() {
    if (this.dialogMap) {
      this.dialogMap.off();
      this.dialogMap.remove();
      this.dialogMap = null;
    }
    this.drawnMarkers = [];
    this.drawnPolyline = null;
    this.drawnPolygon = null;
  }

  private addBoundaryPoint(lat: number, lng: number) {
    const point: CoordinateDto = { latitude: lat, longitude: lng };
    this.boundaryPoints.push(point);
    this.redrawMap();
    this.cdr.detectChanges();
  }

  removeLastPoint() {
    if (this.boundaryPoints.length === 0) return;
    this.boundaryPoints.pop();
    this.redrawMap();
    this.cdr.detectChanges();
  }

  clearAllPoints() {
    this.boundaryPoints = [];
    this.redrawMap();
    this.cdr.detectChanges();
  }

  private drawExistingPoints() {
    if (!this.dialogMap || this.boundaryPoints.length === 0) return;
    this.redrawMap();

    // Fit map to existing boundary
    const latLngs = this.boundaryPoints.map((p) => L.latLng(p.latitude, p.longitude));
    if (latLngs.length > 0) {
      const bounds = L.latLngBounds(latLngs);
      this.dialogMap.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  private redrawMap() {
    if (!this.dialogMap) return;

    // Clear old drawings
    this.drawnMarkers.forEach((m) => m.remove());
    this.drawnMarkers = [];
    if (this.drawnPolyline) {
      this.drawnPolyline.remove();
      this.drawnPolyline = null;
    }
    if (this.drawnPolygon) {
      this.drawnPolygon.remove();
      this.drawnPolygon = null;
    }

    if (this.boundaryPoints.length === 0) return;

    const latLngs = this.boundaryPoints.map((p) => L.latLng(p.latitude, p.longitude));

    // Draw markers
    this.boundaryPoints.forEach((p, i) => {
      const isFirst = i === 0;
      const isLast = i === this.boundaryPoints.length - 1;

      const markerColor = isFirst ? '#10b981' : isLast ? '#ef4444' : '#6366f1';
      const markerLabel = isFirst ? '1' : isLast ? `${i + 1}` : `${i + 1}`;

      const icon = L.divIcon({
        className: 'zone-marker-icon',
        html: `<div style="
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: ${markerColor};
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          cursor: pointer;
        ">${markerLabel}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([p.latitude, p.longitude], {
        icon,
        draggable: true,
      }).addTo(this.dialogMap!);

      // Drag to reposition
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        this.boundaryPoints[i] = { latitude: pos.lat, longitude: pos.lng };
        this.redrawMap();
        this.cdr.detectChanges();
      });

      this.drawnMarkers.push(marker);
    });

    // Draw lines
    if (this.boundaryPoints.length >= 2) {
      if (this.boundaryPoints.length >= 3) {
        // Draw closed polygon
        this.drawnPolygon = L.polygon(latLngs, {
          color: '#6366f1',
          weight: 3,
          fillColor: '#6366f1',
          fillOpacity: 0.15,
          dashArray: undefined,
        }).addTo(this.dialogMap);
      } else {
        // Draw open polyline (only 2 points)
        this.drawnPolyline = L.polyline(latLngs, {
          color: '#6366f1',
          weight: 3,
          dashArray: '8, 8',
        }).addTo(this.dialogMap);
      }
    }
  }

  // ─── Save ───────────────────────────────────────────────

  saveZone() {
    if (!this.formData.name.trim()) {
      this.errorMessage = 'Zone name is required';
      return;
    }

    if (this.boundaryPoints.length < 3) {
      this.errorMessage = 'At least 3 boundary points required. Click on the map to add points.';
      return;
    }

    // Auto-close: ensure last point = first point
    const boundary = this.getClosedBoundary();

    this.dialogLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    if (this.isEditing && this.editingZoneId) {
      this.zoneService
        .updateZone(this.editingZoneId, {
          name: this.formData.name.trim(),
          type: this.formData.type,
          speedLimitKmH: this.formData.speedLimitKmH,
          isActive: this.formData.isActive,
          boundary,
        })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (updated) => {
            this.dialogLoading = false;
            this.closeDialog();
            this.toast.success('Zone updated', `"${updated.name}" saved`);
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Update zone error =>', err);
            this.errorMessage =
              err?.error?.errorMessage ||
              err?.error?.message ||
              err?.message ||
              'Failed to update zone';
            this.dialogLoading = false;
            this.cdr.detectChanges();
          },
        });
    } else {
      this.zoneService
        .createZone({
          name: this.formData.name.trim(),
          type: this.formData.type,
          speedLimitKmH: this.formData.speedLimitKmH,
          boundary,
        })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (created) => {
            this.dialogLoading = false;
            this.closeDialog();
            this.toast.success('Zone created', `"${created.name}" added`);
            this.cdr.detectChanges();
          },
          error: (err) => {
            this.errorMessage = err?.error?.message || 'Failed to create zone';
            this.dialogLoading = false;
            this.cdr.detectChanges();
          },
        });
    }
  }

  /**
   * Auto-close the polygon:
   * If last point != first point, add first point at the end
   */
  private getClosedBoundary(): CoordinateDto[] {
    if (this.boundaryPoints.length < 3) return [...this.boundaryPoints];

    const points = [...this.boundaryPoints];
    const first = points[0];
    const last = points[points.length - 1];

    // Check if already closed (same point within ~1 meter)
    const isClosed =
      Math.abs(first.latitude - last.latitude) < 0.00001 &&
      Math.abs(first.longitude - last.longitude) < 0.00001;

    if (!isClosed) {
      points.push({ latitude: first.latitude, longitude: first.longitude });
    }

    return points;
  }

  // ─── Delete ─────────────────────────────────────────────

  deleteZone(zone: ZoneDto) {
    this.dialog
      .danger(
        'Delete Zone',
        `Are you sure you want to delete "${zone.name}"? This cannot be undone.`,
        'Delete Zone',
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        if (!result.confirmed) return;

        this.deleteLoading = zone.id;
        this.cdr.detectChanges();

        this.zoneService
          .deleteZone(zone.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.deleteLoading = null;
              this.toast.success('Zone deleted', `"${zone.name}" has been removed`);
              this.cdr.detectChanges();
            },
            error: (err) => {
              this.toast.error('Delete failed', err?.error?.message || 'Could not delete zone');
              this.deleteLoading = null;
              this.cdr.detectChanges();
            },
          });
      });
  }

  // ─── Helpers ────────────────────────────────────────────

  getTypeColor(type: string): string {
    const m: Record<string, string> = {
      Parking: '#10b981',
      NoParking: '#ef4444',
      Slow: '#f59e0b',
      Forbidden: '#dc2626',
    };
    return m[type] || '#6366f1';
  }

  getTypeBg(type: string): string {
    const m: Record<string, string> = {
      Parking: '#d1fae5',
      NoParking: '#fee2e2',
      Slow: '#fef3c7',
      Forbidden: '#fecaca',
    };
    return m[type] || '#e0e7ff';
  }

  getTypeIcon(type: string): string {
    const m: Record<string, string> = {
      Parking: 'local_parking',
      NoParking: 'no_transfer',
      Slow: 'speed',
      Forbidden: 'block',
    };
    return m[type] || 'map';
  }

  private refreshZonesFromServer() {
    this.zoneService
      .getZonesData(true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.zones = data.zones;
          this.filterZones();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Refresh zones failed:', err);
        },
      });
  }
}
