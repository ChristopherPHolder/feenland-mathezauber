import { DOCUMENT } from '@angular/common';
import { ApplicationRef, DestroyRef, Service, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';

@Service()
export class AppUpdate {
  private readonly worker = inject(SwUpdate, { optional: true });
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ready = signal(false);
  readonly available = this.ready.asReadonly();
  private checking = false;

  constructor() {
    if (!this.worker?.isEnabled) return;
    this.worker.versionUpdates.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event.type === 'VERSION_READY') this.ready.set(true);
    });
    this.worker.unrecoverable.pipe(takeUntilDestroyed()).subscribe(() => this.ready.set(true));

    // Starting timers before stability would delay service worker registration.
    void inject(ApplicationRef)
      .whenStable()
      .then(() => {
        if (this.destroyRef.destroyed) return;
        this.check();
        const window = this.document.defaultView;
        const onVisible = () => {
          if (this.document.visibilityState === 'visible') this.check();
        };
        const onOnline = () => this.check();
        const interval = window?.setInterval(onVisible, 5 * 60 * 1000);
        this.document.addEventListener('visibilitychange', onVisible);
        window?.addEventListener('online', onOnline);
        this.destroyRef.onDestroy(() => {
          window?.clearInterval(interval);
          this.document.removeEventListener('visibilitychange', onVisible);
          window?.removeEventListener('online', onOnline);
        });
      });
  }

  reload() {
    // Reload atomically; activateUpdate alone can mix old code with new lazy chunks.
    this.document.defaultView?.location.reload();
  }

  private check() {
    if (this.checking || !this.worker?.isEnabled) return;
    this.checking = true;
    void this.worker
      .checkForUpdate()
      .catch(() => {
        // Offline launches remain usable; retry on reconnect, resume, or the next interval.
      })
      .finally(() => {
        this.checking = false;
      });
  }
}
