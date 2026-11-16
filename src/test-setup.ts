// Vitest loads this before every spec file: it starts Angular's TestBed on the browser testing
// platform (jsdom stands in for the browser) and clears the testing module after each test.
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach } from 'vite-plus/test';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
afterEach(() => getTestBed().resetTestingModule());
