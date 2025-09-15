import { chromium } from 'playwright';

async function testVSOMError() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const errors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            errors.push(msg.text());
        }
    });

    try {
        await page.goto('http://localhost:4103', { waitUntil: 'networkidle' });
        await page.waitForSelector('.vsom-app', { timeout: 10000 });

        // Click refresh to trigger the error
        const refreshBtn = await page.locator('#refresh-map');
        if (await refreshBtn.isVisible()) {
            await refreshBtn.click();
            await page.waitForTimeout(3000);
        }

        if (errors.length > 0) {
            console.log('❌ Errors found:');
            errors.forEach(error => console.log('  ', error));
        } else {
            console.log('✅ No errors detected');
        }

    } catch (error) {
        console.error('❌ Test error:', error);
    } finally {
        await browser.close();
    }
}

testVSOMError().catch(console.error);