import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { practiceLevels } from '../../core/practice';
import { FairyDefenseComponent } from './fairy-defense.component';
@Component({
  selector: 'app-practice-defense',
  imports: [FairyDefenseComponent],
  template: `@if (config(); as config) {
    <app-fairy-defense [practiceConfig]="config" />
  }`,
})
export class PracticeDefense {
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  protected readonly config = computed(
    () => practiceLevels.find((level) => level.id === this.params()?.get('id'))?.practice,
  );
}
