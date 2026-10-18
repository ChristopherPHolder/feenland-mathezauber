import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { LocaleService } from '../../core/locale';
import { ProgressService } from '../../core/progress';
import { Icon } from '../../shared/icon';
@Component({
  selector: 'app-welcome',
  imports: [RouterLink, NgOptimizedImage, Icon],
  template: ` <section class="home" aria-labelledby="welcome-title">
    <div class="hero">
      <div class="hero-copy">
        <p class="greeting">{{ i.t('welcome') }}</p>
        <h1 id="welcome-title">Feenland<br /><span>Mathezauber</span></h1>
        <p class="intro">{{ i.t('intro') }}</p>
      </div>
      <div class="illustration">
        <img ngSrc="/images/feenland.webp" width="1536" height="1024" priority alt="" />
      </div>
      <div class="adventure-actions">
        @if (p.next(); as next) {
          <a class="button primary" [routerLink]="['/adventure', next.id]"
            ><span class="play" aria-hidden="true">▶</span
            ><span
              >{{
                i.t(
                  next.format === 'challenge-preview'
                    ? 'previewAdventure'
                    : p.progress().mastered.length
                      ? 'continue'
                      : 'start'
                )
              }}<small>{{ i.t(p.nextWorld()?.title ?? 'missing') }}</small></span
            ><app-icon kind="arrow"
          /></a>
        } @else {
          <div class="caught">
            <strong>{{ i.t('caught') }}</strong>
            <p>{{ i.t('caughtText') }}</p>
          </div>
        }
        <a class="button secondary" routerLink="/worlds"
          ><app-icon kind="book" />{{ i.t('worlds') }}</a
        >
      </div>
    </div>
    <section class="journey" aria-labelledby="journey-title">
      <h2 id="journey-title">{{ i.t('journey') }}</h2>
      <dl>
        <div>
          <dt><app-icon kind="star" />{{ i.t('mastered') }}</dt>
          <dd>{{ i.format(p.progress().mastered.length) }}</dd>
        </div>
        <div>
          <dt><app-icon kind="cup" />{{ i.t('chapters') }}</dt>
          <dd>{{ i.format(p.progress().chapters.length) }}</dd>
        </div>
        <div>
          <dt><app-icon kind="gem" />{{ i.t('explored') }}</dt>
          <dd>{{ i.format(p.progress().explored.length) }}</dd>
        </div>
      </dl>
    </section>
    <p class="invitation">{{ i.t('invitation') }}</p>
  </section>`,
  styleUrl: './welcome.css',
})
export class Welcome {
  protected readonly i = inject(LocaleService);
  protected readonly p = inject(ProgressService);
}
