import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { AppUpdate } from './app-update';
import { UpdateNotice } from '../shared/update-notice';

describe('PWA updates', () => {
  let events: Subject<VersionEvent>;
  let errors: Subject<{ reason: string }>;
  let check: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    events = new Subject();
    errors = new Subject();
    check = vi.fn().mockResolvedValue(false);
    TestBed.configureTestingModule({
      providers: [
        { provide: ApplicationRef, useValue: { whenStable: () => Promise.resolve() } },
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: true,
            versionUpdates: events,
            unrecoverable: errors,
            checkForUpdate: check,
          },
        },
      ],
    });
  });

  it('offers a reload only once the new version is fully downloaded', () => {
    const updates = TestBed.inject(AppUpdate);
    events.next({ type: 'VERSION_DETECTED', version: { hash: 'new' } });
    expect(updates.available()).toBe(false);
    events.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });
    expect(updates.available()).toBe(true);
  });

  it('renders an accessible update action without reloading an exercise automatically', () => {
    TestBed.resetTestingModule();
    const available = signal(false);
    const reload = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: AppUpdate, useValue: { available, reload } }],
    });
    const fixture = TestBed.createComponent(UpdateNotice);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    available.set(true);
    fixture.detectChanges();
    const status = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(status).toBeTruthy();
    expect(reload).not.toHaveBeenCalled();
    status.querySelector('button')!.click();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('checks after startup and when connectivity returns', async () => {
    TestBed.inject(AppUpdate);
    await Promise.resolve();
    expect(check).toHaveBeenCalledTimes(1);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    window.dispatchEvent(new Event('online'));
    expect(check).toHaveBeenCalledTimes(2);
  });

  it('allows retry after an offline check fails and cleans up listeners', async () => {
    check.mockRejectedValueOnce(new Error('offline'));
    TestBed.inject(AppUpdate);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    window.dispatchEvent(new Event('online'));
    expect(check).toHaveBeenCalledTimes(2);
    TestBed.resetTestingModule();
    window.dispatchEvent(new Event('online'));
    expect(check).toHaveBeenCalledTimes(2);
  });

  it('offers recovery when the cached version is unrecoverable', () => {
    const updates = TestBed.inject(AppUpdate);
    errors.next({ reason: 'missing chunk' });
    expect(updates.available()).toBe(true);
  });

  it('does nothing when service workers are disabled', async () => {
    TestBed.overrideProvider(SwUpdate, { useValue: { isEnabled: false } });
    TestBed.inject(AppUpdate);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    window.dispatchEvent(new Event('online'));
    expect(check).not.toHaveBeenCalled();
  });
});
