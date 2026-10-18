import { afterNextRender, Component, ElementRef, viewChild } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Berry } from '../../shared/berry/berry';
import { MagicIcon } from '../../shared/magic-icon/magic-icon';

@Component({
  selector: 'app-playground',
  imports: [NgOptimizedImage, RouterLink, Berry, MagicIcon],
  templateUrl: './playground.html',
  styleUrl: './playground.css',
})
export class Playground {
  private readonly title = viewChild<ElementRef<HTMLHeadingElement>>('title');

  constructor() {
    afterNextRender(() => this.title()?.nativeElement.focus({ preventScroll: true }));
  }
}
