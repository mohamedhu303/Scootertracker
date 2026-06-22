import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogService, DialogState } from '../../services/dialog.service';
import { animate, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  animations: [
    trigger('backdropAnimation', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0 }))
      ])
    ]),
    trigger('dialogAnimation', [
      transition(':enter', [
        style({ transform: 'scale(0.9) translateY(20px)', opacity: 0 }),
        animate('250ms ease-out', style({ transform: 'scale(1) translateY(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ transform: 'scale(0.9) translateY(20px)', opacity: 0 }))
      ])
    ])
  ],
  template: `
    @if (state.isOpen && state.config) {
      <div class="dialog-backdrop" [@backdropAnimation] (click)="cancel()">
        <div class="dialog" [@dialogAnimation] (click)="$event.stopPropagation()">

          <div class="dialog-icon" [class]="'icon-' + state.config.type">
            <span class="material-icons">{{ state.config.icon }}</span>
          </div>

          <h3 class="dialog-title">{{ state.config.title }}</h3>
          <p class="dialog-message">{{ state.config.message }}</p>

          @if (state.config.showInput) {
            <div class="dialog-input">
              @if (state.config.inputLabel) {
                <label>{{ state.config.inputLabel }}</label>
              }
              <input
                type="text"
                [(ngModel)]="inputValue"
                [placeholder]="state.config.inputPlaceholder || ''"
                (keyup.enter)="confirmAction()"
              />
            </div>
          }

          <div class="dialog-actions">
            <button class="cancel-btn" (click)="cancel()">
              {{ state.config.cancelText }}
            </button>
            <button
              class="confirm-btn"
              [class]="'btn-' + state.config.type"
              (click)="confirmAction()"
            >
              {{ state.config.confirmText }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .dialog-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 20px;
    }

    .dialog {
      background: white;
      border-radius: 20px;
      padding: 32px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    }

    .dialog-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }

    .dialog-icon .material-icons { font-size: 32px; }

    .icon-confirm { background: #e0e7ff; color: #4338ca; }
    .icon-danger { background: #fee2e2; color: #dc2626; }
    .icon-warning { background: #fef3c7; color: #d97706; }
    .icon-info { background: #dbeafe; color: #2563eb; }

    .dialog-title {
      font-size: 18px;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 8px;
    }

    .dialog-message {
      font-size: 14px;
      color: #64748b;
      margin: 0 0 24px;
      line-height: 1.5;
    }

    .dialog-input {
      margin-bottom: 24px;
      text-align: left;

      label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: #374151;
        margin-bottom: 6px;
      }

      input {
        width: 100%;
        padding: 10px 14px;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        font-size: 14px;

        &:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }
      }
    }

    .dialog-actions {
      display: flex;
      gap: 10px;
    }

    .cancel-btn, .confirm-btn {
      flex: 1;
      padding: 12px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .cancel-btn {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      color: #475569;
      &:hover { background: #e2e8f0; }
    }

    .confirm-btn { border: none; color: white; }

    .btn-confirm { background: #6366f1; &:hover { background: #4f46e5; } }
    .btn-danger { background: #ef4444; &:hover { background: #dc2626; } }
    .btn-warning { background: #f59e0b; &:hover { background: #d97706; } }
    .btn-info { background: #3b82f6; &:hover { background: #2563eb; } }
  `]
})
export class ConfirmDialogComponent {
  private dialogService = inject(DialogService);

  state: DialogState = { isOpen: false, config: null };
  inputValue = '';

  constructor() {
    this.dialogService.state$.subscribe(state => {
      this.state = state;
      if (state.config?.inputValue) {
        this.inputValue = state.config.inputValue;
      } else {
        this.inputValue = '';
      }
    });
  }

  confirmAction() {
    this.dialogService.close({
      confirmed: true,
      inputValue: this.inputValue
    });
  }

  cancel() {
    this.dialogService.close({ confirmed: false });
  }
}