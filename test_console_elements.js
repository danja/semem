import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:4120');
  await page.waitForTimeout(3000); // Wait longer for full initialization
  
  // Find all elements related to console
  const consoleElements = await page.evaluate(() => {
    const consoleRoot = document.getElementById('console-root');
    const consolePanes = document.querySelectorAll('[class*="console"]');
    const hamburgerMenus = document.querySelectorAll('[class*="hamburger"], [class*="menu"]');
    
    return {
      consoleRoot: !!consoleRoot,
      consoleRootHTML: consoleRoot ? consoleRoot.outerHTML.substring(0, 200) : null,
      consolePanes: Array.from(consolePanes).map(el => ({
        tagName: el.tagName,
        className: el.className,
        id: el.id
      })),
      hamburgerMenus: Array.from(hamburgerMenus).map(el => ({
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        text: el.textContent?.substring(0, 50)
      })),
      allMenuButtons: Array.from(document.querySelectorAll('button')).map(btn => ({
        className: btn.className,
        text: btn.textContent?.substring(0, 30),
        id: btn.id
      })).filter(btn => btn.text?.toLowerCase().includes('menu') || btn.className?.toLowerCase().includes('menu'))
    };
  });
  
  console.log('=== CONSOLE ELEMENTS SEARCH ===');
  console.log('Console root found:', consoleElements.consoleRoot);
  if (consoleElements.consoleRootHTML) {
    console.log('Console root HTML:', consoleElements.consoleRootHTML);
  }
  
  console.log('\\nConsole-related elements:', consoleElements.consolePanes.length);
  consoleElements.consolePanes.forEach((el, i) => {
    console.log(`  ${i + 1}: <${el.tagName}> class="${el.className}" id="${el.id}"`);
  });
  
  console.log('\\nHamburger/Menu elements:', consoleElements.hamburgerMenus.length);
  consoleElements.hamburgerMenus.forEach((el, i) => {
    console.log(`  ${i + 1}: <${el.tagName}> class="${el.className}" text="${el.text}"`);
  });
  
  console.log('\\nMenu buttons:', consoleElements.allMenuButtons.length);
  consoleElements.allMenuButtons.forEach((btn, i) => {
    console.log(`  ${i + 1}: class="${btn.className}" text="${btn.text}"`);
  });
  
  await browser.close();
})();