import { originURL } from './url';
import { review } from './report';
import { inspectCapture } from './capture';
self.onmessage=async(event:MessageEvent)=>{
 const {id,manifest,before,after,capture}=event.data;
 try {
  let delivery;
  if(capture){const c=await inspectCapture(capture);delivery={usable:c.usable,diagnostics:c.diagnostics,capture:c.capture};if(c.capture?.origin!==originURL(manifest.origin)){delivery.usable=false;delivery.diagnostics.push('Origine de capture différente de celle des attentes.');}if(c.text!==after){delivery.usable=false;delivery.diagnostics.push('Corps saisi différent du corps capturé.');}}
  const report=await review(manifest,after,before);if(delivery&&!delivery.usable)report.exitCode=2;
  self.postMessage({id,report,delivery});
 } catch(error){self.postMessage({id,error:(error as Error).message});}
};
