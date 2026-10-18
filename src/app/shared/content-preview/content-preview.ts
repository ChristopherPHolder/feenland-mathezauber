import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { LocaleService } from '../../core/locale';
import { MessageKey } from '../../core/messages';
import { Icon } from '../icon';
export interface PreviewDetails {
  readonly title: MessageKey;
  readonly description: MessageKey;
  readonly state: 'soon' | 'locked';
  readonly requirements: readonly { readonly id: string; readonly title: MessageKey }[];
}
@Component({
  selector: 'app-content-preview',
  imports: [Icon],
  template: `<dialog
    #dialog
    aria-labelledby="content-preview-title"
    aria-describedby="content-preview-description"
    (close)="restoreFocus()"
  >
    @if (details(); as details) {
      <span class="preview-state"
        ><app-icon [kind]="details.state === 'locked' ? 'lock' : 'star'" />{{
          i.t(details.state)
        }}</span
      >
      <h2 id="content-preview-title">{{ i.t(details.title) }}</h2>
      <p id="content-preview-description">{{ i.t(details.description) }}</p>
      @if (details.state === 'locked') {
        <p>{{ i.t('prerequisiteHelp') }}</p>
        <ul>
          @for (requirement of details.requirements; track requirement.id) {
            <li>{{ i.t(requirement.title) }}</li>
          }
        </ul>
      } @else {
        <p>{{ i.t('preview') }}</p>
      }
    }
    <button class="button primary" autofocus (click)="dialog.close()">{{ i.t('close') }}</button>
  </dialog>`,
  styles: `
    dialog {
      width: 480px;
      max-height: calc(100dvh - 32px);
      overflow-y: auto;
    }
    h2 {
      font-size: 28px;
    }
    .preview-state {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .button {
      width: 100%;
      margin-top: 24px;
    }
  `,
})
export class ContentPreview {
  protected readonly i = inject(LocaleService);
  private readonly document = inject(DOCUMENT);
  protected readonly details = signal<PreviewDetails | null>(null);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private opener: HTMLElement | null = null;
  open(details: PreviewDetails) {
    const active = this.document.activeElement;
    this.opener = active instanceof HTMLElement ? active : null;
    this.details.set(details);
    this.dialog().nativeElement.showModal();
  }
  protected restoreFocus() {
    this.opener?.focus();
  }
}
