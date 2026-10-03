export const browserProjects = [
  { name: 'desktop-chromium', use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } } },
  { name: 'desktop-firefox', use: { browserName: 'firefox', viewport: { width: 1280, height: 900 } } },
  { name: 'desktop-webkit', use: { browserName: 'webkit', viewport: { width: 1280, height: 900 } } },
  { name: 'mobile-chromium', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  { name: 'mobile-webkit', use: { browserName: 'webkit', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  { name: 'narrow-chromium', use: { browserName: 'chromium', viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true } },
];
