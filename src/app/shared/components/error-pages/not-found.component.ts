import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="error-page">
      <div class="error-content">
        <span class="error-code">404</span>
        <div class="error-icon">
          <span class="material-icons">search_off</span>
        </div>
        <h1>Page Not Found</h1>
        <p>The page you're looking for doesn't exist or has been moved.</p>
        <div class="error-actions">
          <a routerLink="/app/dashboard" class="primary-btn">
            <span class="material-icons">home</span>
            Go to Dashboard
          </a>
          <button class="secondary-btn" (click)="goBack()">
            <span class="material-icons">arrow_back</span>
            Go Back
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .error-page {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; background: #f8fafc; padding: 20px;
    }
    .error-content {
      text-align: center; max-width: 480px;
    }
    .error-code {
      font-size: 120px; font-weight: 800; color: #e2e8f0;
      line-height: 1; display: block; margin-bottom: -20px;
    }
    .error-icon {
      width: 80px; height: 80px; border-radius: 50%;
      background: #fee2e2; color: #ef4444;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 24px;
      .material-icons { font-size: 40px; }
    }
    h1 { font-size: 24px; color: #1e293b; margin: 0 0 8px; }
    p { color: #64748b; margin: 0 0 32px; line-height: 1.5; }
    .error-actions { display: flex; gap: 12px; justify-content: center; }
    .primary-btn, .secondary-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 12px 24px; border-radius: 12px;
      font-size: 14px; font-weight: 600; cursor: pointer;
      text-decoration: none; transition: all 0.2s;
    }
    .primary-btn {
      background: #6366f1; color: white; border: none;
      &:hover { background: #4f46e5; }
    }
    .secondary-btn {
      background: white; color: #475569;
      border: 1px solid #e2e8f0;
      &:hover { background: #f1f5f9; }
    }
  `]
})
export class NotFoundComponent {
  goBack() {
    window.history.back();
  }
}