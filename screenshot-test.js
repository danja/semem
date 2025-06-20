import { chromium } from 'playwright';

async function takeScreenshot() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    try {
        // Navigate to the application
        await page.goto('http://localhost:4120');
        await page.waitForLoadState('networkidle');
        
        // Wait for the search form to be visible
        await page.waitForSelector('#search-form', { state: 'visible' });
        
        // Take a screenshot of the search form area
        await page.screenshot({ 
            path: 'search-form-improved.png',
            clip: { x: 0, y: 0, width: 1200, height: 700 }
        });
        
        console.log('Screenshot saved as search-form-improved.png');
        
    } catch (error) {
        console.error('Error taking screenshot:', error);
    } finally {
        await browser.close();
    }
}

takeScreenshot();