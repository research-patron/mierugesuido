import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.DATASET_QA_URL||'http://127.0.0.1:3200';
const output=process.env.DATASET_QA_OUTPUT||'artifacts/dataset-stage2';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
try{
 for(const width of [1491,390]){
  const page=await browser.newPage({viewport:{width,height:width===1491?1055:844},hasTouch:width===390});
  const errors=[];const external=[];page.on("request",request=>{if(request.url().startsWith("http")&&!request.url().startsWith(base))external.push(new URL(request.url()).origin);});page.on('pageerror',error=>errors.push(error.message));
  for(const [name,url] of [['home','/'],['datasets','/datasets/'],['product','/datasets/public-sewer-2024-national/'],['history','/municipalities/151009/?business=17-1-000&fiscalYear=2024']]){
   const response=await page.goto(base+url);assert.equal(response.status(),200);await page.waitForTimeout(600);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name} overflow ${width}`);
   if(name==='home'){
    const heading=page.getByRole('heading',{name:'自分のまちの下水道経営状況を見る'});
    const y=(await heading.boundingBox()).y;
    const cards=await page.locator('.home-kpi-cards').boundingBox();
    const zone=await page.locator('.home-kpi-zone').boundingBox();
    assert(cards.y>y);
    assert(cards.y+cards.height<=zone.y+zone.height,"KPI cards must not be clipped by heading");
   }
   if(name==='product'){
    assert.equal(await page.getByRole('link',{name:'noteで購入する（外部サイト）'}).count(),0);
    assert((await page.locator('body').innerText()).includes('価格\n未確定'));
    assert((await page.locator('meta[name="robots"]').getAttribute('content')).includes('noindex'));
    const sampleLink=page.getByRole("link",{name:"見本CSVをダウンロード"});
    await sampleLink.focus();const downloadPromise=page.waitForEvent("download");await page.keyboard.press("Enter");const download=await downloadPromise;assert.equal(download.suggestedFilename(),"sample.csv");
    const sampleHref=await page.getByRole('link',{name:'見本CSVをダウンロード'}).getAttribute('href');
    const sample=await page.request.get(base+sampleHref);assert.equal(sample.status(),200);assert((await sample.text()).includes('011002'));
    await page.getByRole('heading',{name:'無料見本',exact:true}).scrollIntoViewIfNeeded();
    if(width===390){const table=page.getByRole("region",{name:"無料見本の表（横スクロール）"});await table.focus();await page.keyboard.press("ArrowRight");await page.waitForTimeout(200);assert(await table.evaluate(el=>el.scrollLeft>0));await table.evaluate(el=>el.scrollLeft=0);}

   }
   if(name==='history'){
    const section=page.locator('section[aria-labelledby="trend-heading"]');
    assert((await section.innerText()).includes('R2 3,047円 法適用'));
    assert((await section.innerText()).includes('R5 3,047円 法適用'));
    await section.scrollIntoViewIfNeeded();
   }
   await page.waitForTimeout(500);
   await page.screenshot({path:`${output}/${name}-${width}.png`});results.push(`${name}-${width}`);
  }
  await page.goto(base+'/municipalities/151009/?business=17-1-000&fiscalYear=2023');await page.waitForTimeout(500);
  assert((await page.locator('section[aria-labelledby="trend-heading"]').innerText()).includes('R1—R5'));
  await page.goto(base+'/municipalities/151009/?business=17-1-000&fiscalYear=2099');await page.waitForTimeout(500);
  assert((await page.locator('body').innerText()).includes('指定した年度・事業のデータは未収録'));
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);results.push(`past-and-absent-year-${width}`);await page.close();
 }
 const noJs=await browser.newContext({javaScriptEnabled:false});const p=await noJs.newPage();
 await p.goto(base+'/datasets/public-sewer-2024-national/');
 const text=await p.locator('body').innerText();for(const marker of ['1,168','2024年度','札幌市','出典','無料見本'])assert(text.includes(marker));
 results.push('product-initial-html');await noJs.close();
 console.log(JSON.stringify({passed:results.length,results}));await fs.writeFile(`${output}/results.json`,JSON.stringify({passed:results.length,results},null,2));
}finally{await browser.close();}
