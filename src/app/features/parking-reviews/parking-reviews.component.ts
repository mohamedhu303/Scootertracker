import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import {
  RideService,
  PendingParkingPhotoDto,
} from '../../core/services/ride';
import { ToastService } from '../../shared/services/toast.service';
import { ImageUrlPipe } from '../../shared/pipes/image-url.pipe';

@Component({
  selector: 'app-parking-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule, ImageUrlPipe], // ✅ ضفت ImageUrlPipe
  templateUrl: './parking-reviews.component.html',
  styleUrl: './parking-reviews.component.scss',
})
export class ParkingReviewsComponent implements OnInit, OnDestroy {
  private rideService = inject(RideService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  photos: PendingParkingPhotoDto[] = [];
  isLoading = false;
  totalCount = 0;

  // Reject dialog
  showRejectDialog = false;
  selectedPhoto: PendingParkingPhotoDto | null = null;
  rejectionReason = '';
  penaltyAmount = 0;

  // Image preview
  showImagePreview = false;
  previewImageUrl = '';

  // Action loading
  actionLoading: string | null = null;

  ngOnInit() {
    // 1. Subscribe to reactive stream for live updates
    this.rideService
      .watchPendingParkingPhotos(1, 50)
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        this.photos = data.data || [];
        this.totalCount = data.totalCount || 0;
        this.isLoading = false;
        this.cdr.detectChanges();
      });

    // 2. Cache-first
    const cached = this.rideService.getCachedPhotos(1, 50);
    if (cached) {
      this.photos = cached.data || [];
      this.totalCount = cached.totalCount || 0;
      this.isLoading = false;
    } else {
      this.isLoading = true;
    }
    this.cdr.detectChanges();

    // 3. Fetch fresh data
    this.rideService
      .getPendingParkingPhotos(1, 50, false)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.photos = result.data || [];
          this.totalCount = result.totalCount || 0;
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          if (!this.photos.length) {
            this.toast.error('Error', 'Could not load parking photos');
          }
          this.isLoading = false;
          this.cdr.detectChanges();
        },
      });

    // 4. Start live sync
    this.rideService.startPhotosLiveSync(1, 50);
  }

  ngOnDestroy() {
    this.rideService.stopLiveSync();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════
  //  LOAD / REFRESH
  // ═══════════════════════════════

  loadData() {
    this.toast.info('Refreshing', 'Updating parking photos...');

    this.rideService
      .getPendingParkingPhotos(1, 50, true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.photos = result.data || [];
          this.totalCount = result.totalCount || 0;
          this.cdr.detectChanges();
          this.toast.success('Updated', 'Parking photos refreshed');
        },
        error: () => {
          this.toast.error('Error', 'Could not refresh photos');
          this.cdr.detectChanges();
        },
      });
  }

  // ═══════════════════════════════
  //  APPROVE
  // ═══════════════════════════════

  approvePhoto(photo: PendingParkingPhotoDto) {
    this.actionLoading = photo.rideId;
    this.cdr.detectChanges();

    this.rideService
      .reviewParkingPhoto(photo.rideId, {
        isApproved: true,
        rejectionReason: null,
        penaltyAmount: 0,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.photos = this.photos.filter((p) => p.rideId !== photo.rideId);
          this.totalCount = Math.max(0, this.totalCount - 1);
          this.actionLoading = null;
          this.toast.success('Approved', 'Parking photo approved');
          this.cdr.detectChanges();
        },
        error: () => {
          this.actionLoading = null;
          this.toast.error('Error', 'Could not approve photo');
          this.cdr.detectChanges();
        },
      });
  }

  // ═══════════════════════════════
  //  REJECT
  // ═══════════════════════════════

  openRejectDialog(photo: PendingParkingPhotoDto) {
    this.selectedPhoto = photo;
    this.rejectionReason = '';
    this.penaltyAmount = 0;
    this.showRejectDialog = true;
    this.cdr.detectChanges();
  }

  closeRejectDialog() {
    this.showRejectDialog = false;
    this.selectedPhoto = null;
    this.rejectionReason = '';
    this.penaltyAmount = 0;
    this.cdr.detectChanges();
  }

  confirmReject() {
    if (!this.selectedPhoto) return;
    if (!this.rejectionReason.trim()) return;

    this.actionLoading = this.selectedPhoto.rideId;
    this.cdr.detectChanges();

    this.rideService
      .reviewParkingPhoto(this.selectedPhoto.rideId, {
        isApproved: false,
        rejectionReason: this.rejectionReason.trim(),
        penaltyAmount: this.penaltyAmount || 0,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.photos = this.photos.filter(
            (p) => p.rideId !== this.selectedPhoto!.rideId,
          );
          this.totalCount = Math.max(0, this.totalCount - 1);
          this.actionLoading = null;
          this.toast.success(
            'Rejected',
            `Photo rejected${this.penaltyAmount > 0 ? ` with ${this.penaltyAmount} EGP penalty` : ''}`,
          );
          this.closeRejectDialog();
        },
        error: () => {
          this.actionLoading = null;
          this.toast.error('Error', 'Could not reject photo');
          this.cdr.detectChanges();
        },
      });
  }

  // ═══════════════════════════════
  //  IMAGE PREVIEW
  // ═══════════════════════════════

  openImagePreview(url: string) {
    this.previewImageUrl = url;
    this.showImagePreview = true;
    this.cdr.detectChanges();
  }

  closeImagePreview() {
    this.showImagePreview = false;
    this.previewImageUrl = '';
    this.cdr.detectChanges();
  }

  // ═══════════════════════════════
  //  TIME HELPER
  // ═══════════════════════════════

  getTimeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  // ═══════════════════════════════
  //  🖼️ IMAGE URL HELPER (للـ TypeScript)
  // ═══════════════════════════════

  /**
   * 🖼️ يحوّل المسار النسبي لـ full URL
   * مفيدة للاستخدام في الـ TypeScript (مش الـ template)
   */
  getFullImageUrl(url: string | null | undefined): string {
    if (!url) return '';

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    const baseUrl = (this.rideService as any).baseUrl || '';
    const path = url.startsWith('/') ? url : `/${url}`;

    return `${baseUrl}${path}`;
  }

  onImageError(event: Event) {
  const img = event.target as HTMLImageElement;
  // ممكن تعرض placeholder أو تخفي الصورة
  img.style.opacity = '0.3';
  img.alt = 'Image not available';
}
}