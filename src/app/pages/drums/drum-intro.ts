import { Component, computed, inject, input, model, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LocaleService } from '../../core/locale';
import { MessageKey } from '../../core/messages';
import { Icon } from '../../shared/icon';
import { DrumCalibration } from './drum-calibration';
import { DrumChart } from './drum-chart';
import { DrumFrame } from './drum-frame';
import { drumText, DrumMessageKey } from './drum-messages';
import { DrumPath } from './drum-path';
import { barSeconds, DRUM_TEMPOS, DrumStage, drumStages, DrumTempo } from './drum-patterns';
import { DrumScores, PatternPicture } from './drum-scores';

const TEMPO_LABELS: Readonly<Record<DrumTempo, DrumMessageKey>> = {
  free: 'tempoFree',
  slow: 'tempoSlow',
  medium: 'tempoMedium',
  quick: 'tempoQuick',
};

/** The words for a saved pattern, like "Tens from 7". */
export function patternName(
  locale: Parameters<typeof drumText>[0],
  picture: PatternPicture,
  format: (n: number) => string,
) {
  const size = Math.abs(picture.step);
  const step = drumText(locale, `short${size}` as DrumMessageKey);
  return drumText(locale, picture.step < 0 ? 'patternBackFrom' : 'patternFrom', {
    step,
    start: format(picture.start),
  });
}

/**
 * The drums' start screen: the level strip, the story and today's pattern, the tempo cards
 * (free play first and the default), an optional tap-along to set the timing, and the pattern
 * gallery of hundred charts the child has lit so far.
 */
@Component({
  selector: 'app-drum-intro',
  imports: [RouterLink, Icon, DrumPath, DrumChart, DrumCalibration],
  templateUrl: './drum-intro.html',
  styleUrl: './drum-intro.css',
})
export class DrumIntro {
  readonly stage = input.required<DrumStage>();
  readonly preview = input.required<DrumFrame>();
  readonly tempo = model.required<DrumTempo>();
  readonly start = output();
  protected readonly i = inject(LocaleService);
  protected readonly scores = inject(DrumScores);
  protected readonly total = drumStages.length;
  protected readonly tempos = DRUM_TEMPOS;
  protected readonly levelLinks = drumStages.map((stage, index) => ({
    stage: stage.stage,
    position: index + 1,
    route: ['/adventure', `drums-${stage.stage}`],
  }));
  protected readonly levelId = computed(() => `drums-${this.stage().stage}`);
  protected readonly best = computed(() => this.scores.bestFor(this.levelId(), this.tempo()));
  protected readonly gallery = computed(() => {
    const pictures = this.scores.gallery();
    return drumStages
      .filter((stage) => pictures[`drums-${stage.stage}`])
      .map((stage) => {
        const picture = pictures[`drums-${stage.stage}`];
        return {
          id: `drums-${stage.stage}`,
          rows: Math.ceil(Math.max(100, stage.max) / 10),
          picture,
          name: patternName(this.i.locale(), picture, (n) => this.i.format(n)),
        };
      });
  });

  protected t(key: DrumMessageKey, values: Record<string, string | number> = {}) {
    return drumText(this.i.locale(), key, values);
  }
  protected levelKey(stage: number) {
    return `drums${stage}` as MessageKey;
  }
  protected tempoLabel(tempo: DrumTempo) {
    return this.t(TEMPO_LABELS[tempo]);
  }
  protected seconds(tempo: DrumTempo) {
    return this.i.format(Math.round(barSeconds(tempo) * 10) / 10);
  }
}
