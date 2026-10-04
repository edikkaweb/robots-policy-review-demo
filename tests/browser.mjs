import {chromium,firefox} from 'playwright';import AxeBuilder from '@axe-core/playwright';import assert from 'node:assert/strict';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {resolve} from 'node:path';
import {review} from '../build/report.mjs';import {expectations,before,corrected} from '../build/examples.mjs';
const url=process.env.TEST_URL??'http://127.0.0.1:4187/robots-policy-review-demo/';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});const page=await context.newPage();
const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
const checks=[];const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);};
try{
 await page.goto(url,{waitUntil:'networkidle'});
 check('Initial story is generated and reveals the mismatch',await page.locator('#demo-result').innerText().then(t=>t.includes('1 écart sur 5')&&t.includes('/documents/guide.pdf')));
 await page.screenshot({path:'test-results/desktop.png',fullPage:false});
 await page.locator('#show-correction').click();await page.locator('#demo-result .summary').getByText('Aucun écart sur les 5 attentes évaluées',{exact:true}).waitFor();checks.push('Guided correction meets expectations');
 await page.locator('#understand').click();check('Understanding action exposes proof and focuses summary',await page.locator('#demo-result details').first().evaluate(el=>el.open&&el.querySelector('summary')===document.activeElement));
 for(const id of ['exception','fallback','usage','preproduction','delivery']){
  await page.locator('#example').selectOption(id);
  await page.waitForFunction(id=>document.querySelector('#example').value===id && document.querySelector('#example-intro').textContent.length>0,id);
  if(id==='usage'){await page.locator('#demo-result').getByText('Google-Extended',{exact:true}).waitFor();check('Usage and crawl shown separately',(await page.locator('#demo-result').innerText()).includes('usage'));}
  if(id==='preproduction')await page.locator('#demo-result .summary').getByText('2 écarts sur 2 attentes évaluées',{exact:true}).waitFor();
  if(id==='delivery'){await page.locator('#demo-result').getByText(/Aucun changement sur les cas testés/).waitFor();await page.locator('#delivery-rule').click();await page.locator('#demo-result .summary').getByText('1 écart sur 5 attentes évaluées',{exact:true}).waitFor();}
 }
 checks.push('All complementary examples exercised');
 const axe=await new AxeBuilder({page}).analyze();await writeFile('test-results/axe.json',JSON.stringify(axe.violations,null,2));check('No automated axe violation',axe.violations.length===0);
 const baseline=requests.length;
 await context.setOffline(true);
 await page.locator('#before-file').setInputFiles(resolve('examples/before.txt'));
 await page.locator('#after-file').setInputFiles(resolve('examples/corrected.txt'));
 await page.locator('#expect-file').setInputFiles(resolve('examples/expectations.json'));
 await page.locator('#analyze').click();await page.locator('#analysis-status').getByText(/Analyse terminée : 5 attentes évaluées, 0 écarts/).waitFor();
 let downloaded=page.waitForEvent('download');await page.locator('#export-json').click();const reportDownload=await downloaded;const exportPath=await reportDownload.path();const exported=JSON.parse(await readFile(exportPath,'utf8'));
 const expected=JSON.parse(JSON.stringify(await review(expectations,corrected,before))); assert.deepEqual(exported.after,expected.after);assert.deepEqual(exported.before,expected.before);assert.deepEqual(exported.catalog,expected.catalog);checks.push('Browser / shared CLI-module parity, file import and JSON export');
 const crlf=corrected.replaceAll('\n','\r\n');await page.locator('#after-file').setInputFiles({name:'crlf.txt',mimeType:'text/plain',buffer:Buffer.from(crlf)});await page.locator('#analyze').click();await page.locator('#analysis-status').getByText(/Analyse terminée : 5 attentes évaluées, 0 écarts/).waitFor();downloaded=page.waitForEvent('download');await page.locator('#export-json').click();const crlfReport=JSON.parse(await readFile(await(await downloaded).path(),'utf8'));check('Imported CRLF bytes hashed without textarea normalization',crlfReport.after.sha256===(await review(expectations,crlf)).after.sha256);await page.locator('#after-file').setInputFiles(resolve('examples/corrected.txt'));await page.locator('#analyze').click();await page.locator('#analysis-status').getByText(/Analyse terminée : 5 attentes évaluées, 0 écarts/).waitFor();
 downloaded=page.waitForEvent('download');await page.locator('#export-expect').click();const manifestPath=await(await downloaded).path();await page.locator('#expect-file').setInputFiles(manifestPath);await page.locator('#analyze').click();await page.locator('#analysis-status').getByText(/Analyse terminée : 5 attentes évaluées, 0 écarts/).waitFor();checks.push('Exported expectations reimport with identical result');
 await page.locator('#filter').selectOption('fail');check('Filter with zero results remains honest',(await page.locator('#pagination-label').innerText()).includes('0–0 sur 0'));await page.locator('#filter').selectOption('all');
 downloaded=page.waitForEvent('download');await page.locator('#export-csv').click();check('CSV export contains enrichment',(await readFile(await(await downloaded).path(),'utf8')).includes('edikka_decisive_lines'));
 const hostile={...expectations,cases:[{...expectations.cases[0],reason:'<img src="https://evil.invalid/pixel" onerror="alert(1)">',extra:'=1+1'}]};await page.locator('#expect-text').fill(JSON.stringify(hostile));await page.locator('#analyze').click();await page.locator('#analysis-status').getByText(/Analyse terminée : 1 attentes évaluées/).waitFor();check('Imported HTML cannot create image elements',await page.locator('#review-output img').count()===0);
 const hostileExpected={...expectations,cases:[{...expectations.cases[0],expected:'<img src=x onerror=alert(1)>'}]};await page.locator('#expect-text').fill(JSON.stringify(hostileExpected));await page.locator('#analyze').click();await page.locator('#analysis-status').getByText(/Contrôle non concluant/).waitFor();check('Invalid expectation escaped in proof and table',await page.locator('#review-output img').count()===0);
 const invalid={...expectations,schemaVersion:2};await page.locator('#expect-text').fill(JSON.stringify(invalid));await page.locator('#analyze').click();await page.locator('#analysis-status').getByText(/Contrôle non concluant/).waitFor();check('Invalid schema version never green',(await page.locator('#input-errors').innerText()).includes('Version 1 requise'));
 await page.locator('#expect-text').fill('{ invalid');await page.locator('#analyze').click();check('Malformed JSON shows associated error',(await page.locator('#input-errors').innerText()).includes('JSON invalide'));
 const csv='id;profile;dimension;url;expected;reason;owner\r\n"csv-1";GPTBot;crawl;/documents/a;disallow;"raison; ligne\n2";"=2+2"';
 await page.locator('#expect-file').setInputFiles({name:'expectations.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await page.locator('#apply-csv').waitFor();check('CSV preview before analysis',(await page.locator('#import-preview').innerText()).includes('1 lignes conservées'));
 await page.locator('#apply-csv').click();await page.locator('#analyze').click();await page.locator('#analysis-status').getByText(/Analyse terminée : 1 attentes évaluées, 0 écarts/).waitFor();
 downloaded=page.waitForEvent('download');await page.locator('#export-csv').click();check('Formula protected in CSV',(await readFile(await(await downloaded).path(),'utf8')).includes("'=2+2"));
 await page.locator('#expect-file').setInputFiles(resolve('examples/preproduction/expectations.json'));
 await page.locator('#before-file').setInputFiles(resolve('examples/preproduction/before.txt'));
 await page.locator('.capture-import summary').click();await page.locator('#capture-file').setInputFiles(resolve('examples/preproduction/capture.json'));await page.locator('#analyze').click();await page.locator('#analysis-status').getByText(/Analyse terminée : 2 attentes évaluées, 2 écarts/).waitFor();check('Synthetic capture replay preserves delivery and intended origin',(await page.locator('#delivery-status').innerText()).includes('synthétique'));
 const many={...expectations,cases:Array.from({length:5000},(_,i)=>({...expectations.cases[0],id:'b-'+i,url:'/documents/'+i}))};await page.locator('#clear-capture').click();await page.locator('#after-text').fill(corrected);await page.locator('#expect-text').fill(JSON.stringify(many));await page.evaluate(()=>{document.getElementById('analyze').click();document.getElementById('cancel').click();});check('Worker cancellation is actual termination',(await page.locator('#analysis-status').innerText()).includes('interrompue'));
 await page.locator('#analyze').click();await page.locator('#analysis-status').getByText(/Analyse terminée : 5000 attentes évaluées/).waitFor();check('Large output paginated',await page.locator('#review-table .proof').count()===25);await page.locator('#next').click();check('Next page is rendered',(await page.locator('#pagination-label').innerText()).includes('26–50'));
 await page.locator('#reset').click();check('Reset removes rendered private report',await page.locator('#review-table').textContent()==='');check('Reset removes session inputs',await page.locator('#after-text').inputValue()===''&&await page.locator('#origin').inputValue()==='');
 await writeFile('test-results/requests-after-load.json',JSON.stringify(requests.slice(baseline),null,2));check('Import/analyse/filter/export/reset work offline with zero HTTP requests',requests.slice(baseline).every(r=>r.url.startsWith('blob:')));
 check('No automatic persistent storage',await page.evaluate(()=>localStorage.length===0&&sessionStorage.length===0));
 const afterInitialRequests=requests.slice(baseline).filter(r=>/^https?:/.test(r.url)).length; const localBlobLoads=requests.length-baseline;
 await context.setOffline(false);
 await page.goto(url,{waitUntil:'networkidle'});await page.keyboard.press('Tab');check('Skip link reachable by keyboard',await page.evaluate(()=>document.activeElement?.classList.contains('skip')));await page.keyboard.press('Enter');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/mobile.png',fullPage:true});check('Mobile has no page-level horizontal clipping',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 const mobileAxe=await new AxeBuilder({page}).analyze();check('Mobile no axe violation',mobileAxe.violations.length===0);
 await page.emulateMedia({reducedMotion:'reduce'});check('Reduced motion disables smooth scrolling',await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior==='auto'));
 for(const path of ['methode.html','catalogue.html']){await page.goto(url+path,{waitUntil:'networkidle'});const a=await new AxeBuilder({page}).analyze();check(path+' rendered and accessible',await page.locator('h1').count()===1&&a.violations.length===0);}
 const nojs=await browser.newContext({javaScriptEnabled:false});const staticPage=await nojs.newPage();await staticPage.goto(url);check('No-JS story and correction present',await staticPage.locator('#demo-result').innerText().then(t=>t.includes('1 écart sur 5'))&&await staticPage.locator('#static-correction').textContent().then(t=>t.includes('Aucun écart sur les 5')));await nojs.close();
 check('No page JavaScript error',errors.length===0);
 const ff=await firefox.launch({headless:true});const fp=await ff.newPage();await fp.goto(url);await fp.locator('#analyze').click();await fp.locator('#analysis-status').getByText(/Analyse terminée : 5 attentes évaluées, 0 écarts/).waitFor();checks.push('Firefox worker / crypto / analysis succeeds');await ff.close();
 await writeFile('proofs/browser.json',JSON.stringify({runAt:new Date().toISOString(),url,chromium:browser.version(),node:process.version,checks,errors,afterInitialRequests,localBlobLoads,limit:'Targeted automatic checks and keyboard smoke test; no RGAA certification.'},null,2)+'\n');
 console.log(`${checks.length} browser checks passed.`);
}finally{await browser.close();}
