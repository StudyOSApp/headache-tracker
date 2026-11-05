const assert = require('node:assert/strict');
const { chromium } = require('/Users/ryanelmore/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-webgl','--use-gl=angle','--use-angle=swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.APP_URL || 'http://127.0.0.1:4173');
    assert.equal(await page.locator('header,.prototype').count(),0);
    await page.getByRole('button',{name:'Skip for now',exact:true}).click();
    await page.getByRole('button',{name:/Log Headache/}).first().click();
    await page.waitForSelector('canvas');
    if(await page.getByRole('button',{name:'Got it',exact:true}).isVisible())await page.getByRole('button',{name:'Got it',exact:true}).click();
    const client=await page.context().newCDPSession(page);
    async function swipe(x,y,dx,dy) {
      await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:0}]});
      for(let i=1;i<=8;i++) {
        await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/8,y:y+dy*i/8,id:0}]});
        await page.waitForTimeout(24);
      }
      await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.waitForTimeout(350);
    }
    async function resetScroll() {
      await page.locator('canvas').evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+scrollY-100));
      await page.waitForTimeout(150);
      return page.locator('canvas').boundingBox();
    }
    for(const width of [320,390,430]) {
      await page.setViewportSize({width,height:844});
      let box=await resetScroll(),before=await page.evaluate(()=>scrollY);
      const front=await page.locator('canvas').screenshot();
      await swipe(box.x+3,box.y+box.height*.70,0,-110);
      assert((await page.evaluate(()=>scrollY))>before+35,'left blank space should scroll at '+width);
      box=await resetScroll();
      assert(front.equals(await page.locator('canvas').screenshot()),'blank swipe must not rotate');
      before=await page.evaluate(()=>scrollY);
      await swipe(box.x+box.width-3,box.y+box.height*.28,0,-100);
      assert((await page.evaluate(()=>scrollY))>before+35,'right blank space should scroll at '+width);
    }
    let box=await resetScroll(),before=await page.evaluate(()=>scrollY),image=await page.locator('canvas').screenshot();
    await swipe(box.x+box.width*.5,box.y+box.height*.32,65,45);
    assert(Math.abs((await page.evaluate(()=>scrollY))-before)<2,'head swipe should not scroll');
    assert(!image.equals(await page.locator('canvas').screenshot()),'head swipe should rotate');
    image=await page.locator('canvas').screenshot();
    await swipe(box.x+box.width*.5,box.y+box.height*.32,0,-75);
    assert(Math.abs((await page.evaluate(()=>scrollY))-before)<2,'vertical head swipe should not scroll');
    assert(!image.equals(await page.locator('canvas').screenshot()),'vertical head swipe should tilt');
    assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('headache-tracker.draft.v1'))?.headMap.painLocations.length || 0),0);
    assert.deepEqual(errors,[]);
    console.log('PASS: no header, native side scrolling at 320/390/430px, blank swipes do not rotate, head swipes rotate/tilt without scrolling or adding points.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
