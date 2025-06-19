import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:4120');
  await page.waitForTimeout(3000);
  
  // Check the evb system in detail
  const evbDetails = await page.evaluate(() => {
    return {
      windowEvb: typeof window.evb,
      evbEmit: typeof window.evb?.emit,
      evbOn: typeof window.evb?.on,
      evbListeners: window.evb?._events ? Object.keys(window.evb._events) : 'no _events'
    };
  });
  
  console.log('EVB Details:', evbDetails);
  
  // Try to manually trigger the GraphVisualizer listener
  await page.evaluate(() => {
    if (window.evb && window.evb.emit) {
      console.log('Manually emitting MODEL_SYNCED to window.evb...');
      window.evb.emit('MODEL_SYNCED', '@prefix ex: <http://example.org/> . ex:test ex:prop "value" .');
    }
  });
  
  await page.waitForTimeout(1000);
  await browser.close();
})();