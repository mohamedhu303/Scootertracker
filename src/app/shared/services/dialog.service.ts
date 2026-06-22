import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

export interface DialogConfig {
  title: string;
  message: string;
  type?: 'confirm' | 'danger' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
  icon?: string;
  showInput?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
  inputValue?: string;
}

export interface DialogState {
  isOpen: boolean;
  config: DialogConfig | null;
}

export interface DialogResult {
  confirmed: boolean;
  inputValue?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DialogService {
  private stateSubject = new BehaviorSubject<DialogState>({
    isOpen: false,
    config: null
  });

  private resultSubject = new Subject<DialogResult>();

  state$ = this.stateSubject.asObservable();

  private getIcon(type: string): string {
    const icons: Record<string, string> = {
      confirm: 'help_outline',
      danger: 'warning',
      warning: 'error_outline',
      info: 'info'
    };
    return icons[type] || 'help_outline';
  }

  open(config: DialogConfig): Observable<DialogResult> {
    const type = config.type ?? 'confirm';
    const icon = config.icon ?? this.getIcon(type);
    const confirmText = config.confirmText ?? (type === 'danger' ? 'Delete' : 'Confirm');
    const cancelText = config.cancelText ?? 'Cancel';

    this.stateSubject.next({
      isOpen: true,
      config: { ...config, type, icon, confirmText, cancelText }
    });

    return new Observable<DialogResult>(observer => {
      const sub = this.resultSubject.subscribe(result => {
        observer.next(result);
        observer.complete();
        sub.unsubscribe();
      });
    });
  }

  confirm(title: string, message: string): Observable<DialogResult> {
    return this.open({ title, message, type: 'confirm' });
  }

  danger(title: string, message: string, confirmText = 'Delete'): Observable<DialogResult> {
    return this.open({ title, message, type: 'danger', confirmText });
  }

  warning(title: string, message: string): Observable<DialogResult> {
    return this.open({ title, message, type: 'warning' });
  }

  close(result: DialogResult) {
    this.stateSubject.next({ isOpen: false, config: null });
    this.resultSubject.next(result);
  }
}