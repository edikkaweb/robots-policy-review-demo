import test from 'node:test';import assert from 'node:assert/strict';import Ajv from 'ajv';import {readFile} from 'node:fs/promises';
import {expectations,corrected,EXAMPLES} from '../build/examples.mjs';import {review} from '../build/report.mjs';import {syntheticCapture} from '../build/capture.mjs';
const ajv=new Ajv({allErrors:true,strict:true});const load=async n=>ajv.compile(JSON.parse(await readFile('schemas/'+n+'.schema.json','utf8')));
test('Canonical expectations, generated reports and captures conform to published schemas',async()=>{
 const validateE=await load('expectations'),validateR=await load('report'),validateC=await load('capture');
 assert.ok(validateE(expectations),JSON.stringify(validateE.errors));assert.equal(validateE({...expectations,cases:[]}),false);
 for(const e of EXAMPLES){const r=JSON.parse(JSON.stringify(await review(e.manifest,e.after,e.before)));assert.ok(validateR(r),JSON.stringify(validateR.errors));}
 const bad=JSON.parse(JSON.stringify(await review({schemaVersion:2,origin:'invalid',cases:[null]},corrected)));assert.ok(validateR(bad),JSON.stringify(validateR.errors));
 const capture=await syntheticCapture(corrected);assert.ok(validateC(capture),JSON.stringify(validateC.errors));assert.equal(validateC({...capture,bytes:3e6}),false);
});
