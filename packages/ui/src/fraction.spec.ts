import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vite-plus/test';
import { StackedFraction } from './fraction';

@Component({
  imports: [StackedFraction],
  template: `<button type="button">
    <ui-fraction [numerator]="3" [denominator]="4" label="three quarters" />
  </button>`,
})
class Host {}

describe('StackedFraction', () => {
  it('stacks the numbers for the eye and speaks the words', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLElement;
    const stack = button.querySelector('.stack') as HTMLElement;
    expect(stack.getAttribute('aria-hidden')).toBe('true');
    expect(button.querySelector('.n')?.textContent).toBe('3');
    expect(button.querySelector('.d')?.textContent).toBe('4');
    expect(button.querySelector('.words')?.textContent).toBe('three quarters');
  });
});
