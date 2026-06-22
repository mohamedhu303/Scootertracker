import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    @switch (type) {
      @case ('table') {
        <div class="skeleton-table">
          <div class="skeleton-header">
            @for (col of cols; track col) {
              <div class="skeleton-cell header-cell"></div>
            }
          </div>
          @for (row of rows; track row) {
            <div class="skeleton-row">
              @for (col of cols; track col) {
                <div class="skeleton-cell"></div>
              }
            </div>
          }
        </div>
      }
      @case ('cards') {
        <div class="skeleton-cards">
          @for (card of cardsArray; track card) {
            <div class="skeleton-card">
              <div class="skeleton-line wide"></div>
              <div class="skeleton-line medium"></div>
              <div class="skeleton-line narrow"></div>
            </div>
          }
        </div>
      }
      @case ('stats') {
        <div class="skeleton-stats">
          @for (stat of statsArray; track stat) {
            <div class="skeleton-stat-card">
              <div class="skeleton-circle"></div>
              <div class="skeleton-stat-text">
                <div class="skeleton-line narrow"></div>
                <div class="skeleton-line medium"></div>
              </div>
            </div>
          }
        </div>
      }
      @case ('detail') {
        <div class="skeleton-detail">
          <div class="skeleton-line wide"></div>
          <div class="skeleton-line medium"></div>
          <div class="skeleton-line wide"></div>
          <div class="skeleton-line narrow"></div>
          <div class="skeleton-line medium"></div>
          <div class="skeleton-line wide"></div>
        </div>
      }
      @default {
        <div class="skeleton-line" [class]="width"></div>
      }
    }
  `,
  styles: [`
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    .skeleton-line, .skeleton-cell, .skeleton-circle {
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s ease-in-out infinite;
      border-radius: 6px;
    }

    .skeleton-line {
      height: 14px;
      margin-bottom: 12px;
      &.wide { width: 100%; }
      &.medium { width: 70%; }
      &.narrow { width: 40%; }
    }

    .skeleton-circle {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* Table */
    .skeleton-table {
      background: white;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
    }

    .skeleton-header {
      display: flex;
      gap: 16px;
      padding: 14px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }

    .skeleton-row {
      display: flex;
      gap: 16px;
      padding: 16px;
      border-bottom: 1px solid #f1f5f9;
    }

    .skeleton-cell {
      flex: 1;
      height: 16px;
    }

    .header-cell { height: 12px; }

    /* Cards */
    .skeleton-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }

    .skeleton-card {
      background: white;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      padding: 24px;
    }

    /* Stats */
    .skeleton-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
    }

    .skeleton-stat-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: white;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
    }

    .skeleton-stat-text {
      flex: 1;
      .skeleton-line { margin-bottom: 6px; }
    }

    /* Detail */
    .skeleton-detail {
      background: white;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      padding: 24px;
    }
  `]
})
export class SkeletonComponent {
  @Input() type: 'table' | 'cards' | 'stats' | 'detail' | 'line' = 'line';
  @Input() width: 'wide' | 'medium' | 'narrow' = 'wide';
  @Input() rowCount = 5;
  @Input() colCount = 5;
  @Input() cardCount = 4;
  @Input() statCount = 4;

  get rows() { return Array(this.rowCount); }
  get cols() { return Array(this.colCount); }
  get cardsArray() { return Array(this.cardCount); }
  get statsArray() { return Array(this.statCount); }
}