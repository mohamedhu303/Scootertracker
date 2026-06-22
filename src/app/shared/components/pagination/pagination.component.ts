import {
  Component, Input, Output, EventEmitter,
  OnChanges, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pagination-wrapper">

      <!-- Info & Page Size -->
      <div class="pagination-info">
        <span class="info-text">
          Showing
          <strong>{{ startItem }}</strong>
          -
          <strong>{{ endItem }}</strong>
          of
          <strong>{{ totalItems }}</strong>
        </span>

        <div class="page-size-selector">
          <label>Show:</label>
          <select [(ngModel)]="pageSize" (change)="onPageSizeChange()">
            @for (size of pageSizeOptions; track size) {
              <option [value]="size">{{ size }}</option>
            }
          </select>
        </div>
      </div>

      <!-- Pagination Controls -->
      @if (totalPages > 1) {
        <div class="pagination-controls">

          <!-- First Page -->
          <button
            class="page-btn nav-btn"
            (click)="goToPage(1)"
            [disabled]="currentPage === 1"
            title="First page"
            aria-label="First page"
            type="button"
          >
            <span class="material-icons">first_page</span>
          </button>

          <!-- Previous -->
          <button
            class="page-btn nav-btn"
            (click)="goToPage(currentPage - 1)"
            [disabled]="currentPage === 1"
            title="Previous"
            aria-label="Previous page"
            type="button"
          >
            <span class="material-icons">chevron_left</span>
          </button>

          <!-- Page Numbers -->
          @for (page of visiblePages; track $index) {
            @if (page === -1) {
              <span class="page-ellipsis">…</span>
            } @else {
              <button
                class="page-btn"
                [class.active]="page === currentPage"
                (click)="goToPage(page)"
                [attr.aria-label]="'Page ' + page"
                [attr.aria-current]="page === currentPage ? 'page' : null"
                type="button"
              >
                {{ page }}
              </button>
            }
          }

          <!-- Next -->
          <button
            class="page-btn nav-btn"
            (click)="goToPage(currentPage + 1)"
            [disabled]="currentPage === totalPages"
            title="Next"
            aria-label="Next page"
            type="button"
          >
            <span class="material-icons">chevron_right</span>
          </button>

          <!-- Last Page -->
          <button
            class="page-btn nav-btn"
            (click)="goToPage(totalPages)"
            [disabled]="currentPage === totalPages"
            title="Last page"
            aria-label="Last page"
            type="button"
          >
            <span class="material-icons">last_page</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;

      /* ─── CSS Variables (Light Mode) ─── */
      --pg-surface:       #ffffff;
      --pg-surface-muted: #f8fafc;
      --pg-text:          #0f172a;
      --pg-text-sec:      #475569;
      --pg-text-muted:    #94a3b8;
      --pg-border:        #e2e8f0;
      --pg-border-strong: #cbd5e1;
      --pg-brand:         #4f46e5;
      --pg-brand-hover:   #4338ca;
      --pg-brand-shadow:  rgba(79, 70, 229, 0.32);
      --pg-input-bg:      #ffffff;
    }

    /* ─── Dark Mode (متعدد المستويات) ─── */
    :host-context(.dark-mode),
    :host-context([data-theme='dark']),
    :host-context(body.dark-mode),
    :host-context(body[data-theme='dark']),
    :host-context(html.dark-mode),
    :host-context(html[data-theme='dark']) {
      --pg-surface:       #111827;
      --pg-surface-muted: #1f2937;
      --pg-text:          #f8fafc;
      --pg-text-sec:      #cbd5e1;
      --pg-text-muted:    #94a3b8;
      --pg-border:        #253145;
      --pg-border-strong: #334155;
      --pg-brand:         #818cf8;
      --pg-brand-hover:   #6366f1;
      --pg-brand-shadow:  rgba(129, 140, 248, 0.4);
      --pg-input-bg:      #0f172a;
    }

    /* ─── Wrapper ─── */
    .pagination-wrapper {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 20px;
      background: var(--pg-surface);
      border: 1px solid var(--pg-border);
      border-radius: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }

    /* ─── Info Section ─── */
    .pagination-info {
      display: flex;
      align-items: center;
      gap: 20px;
      font-size: 0.84rem;
      color: var(--pg-text-sec);
      flex-wrap: wrap;
    }

    .info-text {
      font-weight: 500;

      strong {
        color: var(--pg-text);
        font-weight: 800;
        font-variant-numeric: tabular-nums;
      }
    }

    /* ─── Page Size Selector ─── */
    .page-size-selector {
      display: flex;
      align-items: center;
      gap: 8px;

      label {
        font-size: 0.82rem;
        color: var(--pg-text-sec);
        font-weight: 600;
      }

      select {
        padding: 7px 28px 7px 12px;
        border: 1.5px solid var(--pg-border);
        border-radius: 10px;
        background-color: var(--pg-input-bg);
        color: var(--pg-text);
        font-size: 0.84rem;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        outline: none;
        transition: border-color 0.18s ease, box-shadow 0.18s ease;

        /* Custom arrow */
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 10px center;

        &:hover {
          border-color: var(--pg-border-strong);
        }

        &:focus {
          border-color: var(--pg-brand);
          box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.12);
        }

        option {
          background: var(--pg-surface);
          color: var(--pg-text);
        }
      }
    }

    :host-context(.dark-mode) .page-size-selector select,
    :host-context([data-theme='dark']) .page-size-selector select,
    :host-context(body.dark-mode) .page-size-selector select,
    :host-context(body[data-theme='dark']) .page-size-selector select,
    :host-context(html.dark-mode) .page-size-selector select,
    :host-context(html[data-theme='dark']) .page-size-selector select {
      background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");

      &:focus {
        box-shadow: 0 0 0 4px rgba(129, 140, 248, 0.2);
      }
    }

    /* ─── Pagination Controls ─── */
    .pagination-controls {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .page-btn {
      min-width: 38px;
      height: 38px;
      padding: 0 10px;
      border: 1.5px solid var(--pg-border);
      border-radius: 11px;
      background: var(--pg-surface);
      color: var(--pg-text-sec);
      font-size: 0.84rem;
      font-weight: 700;
      cursor: pointer;
      transition:
        background 0.18s ease,
        border-color 0.18s ease,
        color 0.18s ease,
        transform 0.18s ease,
        box-shadow 0.18s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-variant-numeric: tabular-nums;
      font-family: inherit;

      &:hover:not(:disabled):not(.active) {
        background: var(--pg-surface-muted);
        border-color: var(--pg-border-strong);
        color: var(--pg-text);
        transform: translateY(-1px);
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      &.active {
        background: var(--pg-brand);
        color: #ffffff;
        border-color: var(--pg-brand);
        box-shadow: 0 4px 12px var(--pg-brand-shadow);
        cursor: default;
      }

      &:focus-visible {
        outline: none;
        box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.18);
      }

      &.nav-btn {
        .material-icons {
          font-size: 19px;
        }
      }
    }

    /* ─── Ellipsis ─── */
    .page-ellipsis {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 38px;
      color: var(--pg-text-muted);
      font-weight: 700;
      font-size: 1rem;
      user-select: none;
    }

    /* ─── Responsive ─── */
    @media (max-width: 768px) {
      .pagination-wrapper {
        padding: 12px 14px;
        border-radius: 14px;
      }

      .pagination-info {
        gap: 14px;
        font-size: 0.8rem;
      }

      .page-size-selector {
        label { font-size: 0.78rem; }
        select {
          padding: 6px 26px 6px 10px;
          font-size: 0.8rem;
        }
      }

      .page-btn {
        min-width: 34px;
        height: 34px;
        padding: 0 8px;
        font-size: 0.8rem;
        border-radius: 10px;

        &.nav-btn .material-icons {
          font-size: 17px;
        }
      }

      .page-ellipsis {
        min-width: 22px;
        height: 34px;
      }
    }

    @media (max-width: 640px) {
      .pagination-wrapper {
        flex-direction: column;
        gap: 14px;
        align-items: stretch;
      }

      .pagination-info {
        flex-direction: column;
        align-items: center;
        gap: 8px;
        text-align: center;
      }

      .pagination-controls {
        justify-content: center;
        flex-wrap: wrap;
      }
    }

    @media (max-width: 400px) {
      .pagination-wrapper {
        padding: 10px;
      }

      .page-btn {
        min-width: 32px;
        height: 32px;
        padding: 0 6px;
        font-size: 0.76rem;
        border-radius: 9px;

        &.nav-btn .material-icons {
          font-size: 16px;
        }
      }

      .page-ellipsis {
        min-width: 18px;
        height: 32px;
      }

      .pagination-controls {
        gap: 3px;
      }

      /* خفي الـ ellipsis في الموبايل الصغير */
      .page-ellipsis {
        display: none;
      }
    }

    /* ─── Touch devices ─── */
    @media (hover: none) {
      .page-btn:hover:not(:disabled):not(.active) {
        transform: none;
      }
    }

    /* ─── Reduced motion ─── */
    @media (prefers-reduced-motion: reduce) {
      .page-btn {
        transition: none;
      }
    }
  `]
})
export class PaginationComponent implements OnChanges {
  @Input() currentPage = 1;
  @Input() pageSize = 10;
  @Input() totalItems = 0;
  @Input() pageSizeOptions: number[] = [5, 10, 25, 50, 100];

  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  totalPages = 0;
  startItem = 0;
  endItem = 0;
  visiblePages: number[] = [];

  ngOnChanges() {
    this.calculate();
  }

  private calculate() {
    this.totalPages = Math.max(1, Math.ceil(this.totalItems / this.pageSize));
    this.startItem = this.totalItems === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
    this.endItem = Math.min(this.currentPage * this.pageSize, this.totalItems);
    this.visiblePages = this.getVisiblePages();
  }

  private getVisiblePages(): number[] {
    const pages: number[] = [];
    const total = this.totalPages;
    const current = this.currentPage;

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);

      if (current > 3) pages.push(-1);

      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);

      for (let i = start; i <= end; i++) pages.push(i);

      if (current < total - 2) pages.push(-1);

      pages.push(total);
    }

    return pages;
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.pageChange.emit(page);
  }

  onPageSizeChange() {
    this.pageSize = +this.pageSize;
    this.pageSizeChange.emit(this.pageSize);
  }
}