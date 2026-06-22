import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExportService } from '../../services/export.service';
import { ToastService } from '../../services/toast.service';

export interface ExportConfig {
  data: any[];
  filename: string;
  title: string;
  headers: { key: string; label: string }[];
}

@Component({
  selector: 'app-export-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="export-menu-wrapper">
      <button class="export-trigger" (click)="toggleMenu($event)" [class.open]="isOpen">
        <span class="material-icons">file_download</span>
        Export
        <span class="material-icons arrow">expand_more</span>
      </button>

      @if (isOpen) {
        <div class="export-backdrop" (click)="closeMenu()"></div>
        <div class="export-dropdown">
          <button class="export-option" (click)="exportCSV()">
            <div class="opt-icon csv">
              <span class="material-icons">table_chart</span>
            </div>
            <div class="opt-info">
              <span class="opt-label">Export as CSV</span>
              <span class="opt-desc">Spreadsheet format (Excel)</span>
            </div>
          </button>

          <button class="export-option" (click)="exportJSON()">
            <div class="opt-icon json">
              <span class="material-icons">code</span>
            </div>
            <div class="opt-info">
              <span class="opt-label">Export as JSON</span>
              <span class="opt-desc">Developer format</span>
            </div>
          </button>

          <button class="export-option" (click)="printData()">
            <div class="opt-icon print">
              <span class="material-icons">print</span>
            </div>
            <div class="opt-info">
              <span class="opt-label">Print / PDF</span>
              <span class="opt-desc">Print or save as PDF</span>
            </div>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .export-menu-wrapper {
      position: relative;
      display: inline-block;
    }

    .export-trigger {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 9px 16px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: white;
      color: #475569;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;

      .material-icons:first-child {
        font-size: 18px;
        color: #6366f1;
      }

      .arrow {
        font-size: 18px;
        transition: transform 0.3s;
      }

      &:hover {
        background: #f1f5f9;
        border-color: #cbd5e1;
      }

      &.open {
        background: #eef2ff;
        border-color: #c7d2fe;
        color: #6366f1;

        .arrow { transform: rotate(180deg); }
      }
    }

    .export-backdrop {
      position: fixed;
      inset: 0;
      z-index: 998;
    }

    .export-dropdown {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      width: 260px;
      background: white;
      border-radius: 14px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
      border: 1px solid #e2e8f0;
      z-index: 999;
      overflow: hidden;
      animation: slideDown 0.2s ease-out;
    }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .export-option {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: transparent;
      border: none;
      cursor: pointer;
      transition: background 0.15s;
      text-align: left;

      &:hover { background: #f8fafc; }
      &:not(:last-child) { border-bottom: 1px solid #f1f5f9; }
    }

    .opt-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      .material-icons { font-size: 18px; }

      &.csv { background: #d1fae5; color: #10b981; }
      &.json { background: #e0e7ff; color: #6366f1; }
      &.print { background: #fef3c7; color: #f59e0b; }
    }

    .opt-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .opt-label {
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
    }

    .opt-desc {
      font-size: 11px;
      color: #94a3b8;
    }

    /* Dark Mode */
    :host-context(body.dark-mode) {
      .export-trigger {
        background: #1e293b;
        color: #cbd5e1;
        border-color: #334155;

        &:hover { background: #334155; }
      }

      .export-dropdown {
        background: #1e293b;
        border-color: #334155;
      }

      .export-option {
        &:hover { background: #334155; }
        &:not(:last-child) { border-color: #334155; }
      }

      .opt-label { color: #f1f5f9; }
    }
  `]
})
export class ExportMenuComponent {
  @Input() config!: ExportConfig;

  private exportService = inject(ExportService);
  private toast = inject(ToastService);

  isOpen = false;

  toggleMenu(event: Event) {
    event.stopPropagation();
    this.isOpen = !this.isOpen;
  }

  closeMenu() {
    this.isOpen = false;
  }

  exportCSV() {
    if (!this.config?.data?.length) {
      this.toast.warning('No data', 'There is no data to export');
      this.closeMenu();
      return;
    }
    this.exportService.exportToCSV(this.config.data, this.config.filename, this.config.headers);
    this.toast.success('Exported', `${this.config.filename}.csv has been downloaded`);
    this.closeMenu();
  }

  exportJSON() {
    if (!this.config?.data?.length) {
      this.toast.warning('No data', 'There is no data to export');
      this.closeMenu();
      return;
    }
    this.exportService.exportToJSON(this.config.data, this.config.filename);
    this.toast.success('Exported', `${this.config.filename}.json has been downloaded`);
    this.closeMenu();
  }

  printData() {
    if (!this.config?.data?.length) {
      this.toast.warning('No data', 'There is no data to print');
      this.closeMenu();
      return;
    }
    this.exportService.printTable(this.config.title, this.config.data, this.config.headers);
    this.closeMenu();
  }
}