// Viewport-only profiles: TesterArmy 0.16 does not emulate isMobile, hasTouch or device scale.
export const browserTargets = [
  { name: 'desktop-chromium', browser: 'chromium', viewport: { width: 1280, height: 900 } },
  { name: 'desktop-firefox', browser: 'firefox', viewport: { width: 1280, height: 900 } },
  { name: 'desktop-webkit', browser: 'webkit', viewport: { width: 1280, height: 900 } },
  { name: 'mobile-chromium', browser: 'chromium', viewport: { width: 390, height: 844 } },
  { name: 'mobile-webkit', browser: 'webkit', viewport: { width: 390, height: 844 } },
  { name: 'narrow-chromium', browser: 'chromium', viewport: { width: 320, height: 700 } },
];
