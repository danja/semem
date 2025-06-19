import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  let foundLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    foundLogs.push(text);
    if (text.includes('fallback') || text.includes('Simple parser') || text.includes('Parsed RDF')) {
      console.log('FOUND:', text);
    }
  });
  
  console.log('Loading page...');
  await page.goto('http://localhost:4120');
  
  console.log('Waiting for events...');
  await page.waitForTimeout(8000);
  
  console.log('Checking logs...');
  const relevantLogs = foundLogs.filter(log => 
    log.includes('GraphVisualizer') || 
    log.includes('fallback') || 
    log.includes('Simple parser') || 
    log.includes('Parsed RDF')
  );
  
  console.log('Relevant logs found:', relevantLogs.length);
  relevantLogs.slice(0, 10).forEach(log => console.log('  -', log));
  
  await browser.close();
})();