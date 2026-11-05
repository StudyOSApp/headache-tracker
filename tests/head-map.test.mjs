import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, validateEntry, persistState, loadState } from '../assets/storage.js';
import { captureDraft, isDraft } from '../assets/draft.js';
import { painDataForEntry, entryPainFields, validatePainData } from '../assets/head-map/data.js';

const sample = () => ({ id:'entry-1',start:'2020-01-01T10:00:00Z',end:null,severity:6,location:[],characteristics:[],symptoms:[],triggers:[],medications:[] });
function point(entryId='entry-1') { const C=globalThis.PainCore,e={...C.createEpisode(),id:entryId};return C.addPoint(e,[.5,1.5,1.9],[0,0,1],{mesh:'Head_neck_trapezius',faceIndex:0,vertexIndices:[0,1,2],barycentric:[.2,.3,.5]}).hotspot; }
test('old entries remain compatible; map records live inside the existing entry/storage envelope',()=>{
 const old=sample();assert.doesNotThrow(()=>validateEntry(old));
 const data=painDataForEntry(old);data.painLocations=[point()];data.behindEye=['retro_orbital_l'];data.activePainPointId=data.painLocations[0].id;
 const entry={...old,...entryPainFields(data)},state={...emptyState(),entries:[entry]};let raw;
 persistState({setItem:(k,v)=>raw=v},state);assert.deepEqual(loadState({getItem:()=>raw}),state);
 assert.deepEqual(entry.painLocations[0].position,[.5,1.5,1.9]);assert.equal(entry.painLocations[0].episodeId,entry.id);
});
test('corrupt pain records, wrong episode/model IDs, and unsupported map data are rejected',()=>{
 const e=sample(),data=painDataForEntry(e);data.painLocations=[point()];
 assert.doesNotThrow(()=>validatePainData(data));
 for(const alter of [d=>d.painLocations[0].intensity=11,d=>d.painLocations[0].episodeId='another',d=>d.painLocations[0].radius=99,d=>d.behindEye=['unrecognized'],d=>d.activePainPointId='missing']){const bad=structuredClone(data);alter(bad);assert.throws(()=>validatePainData(bad));}
 assert.throws(()=>validateEntry({...e,painLocations:null}));
 assert.throws(()=>validateEntry({...e,painLocations:[],painModelVersion:'unknown'}));
});
test('unfinished drafts retain exact point data and their stable entry ID; legacy drafts remain valid',()=>{
 const form={elements:[{name:'severity',dataset:{},type:'hidden',value:'6'}],querySelectorAll:s=>s==='.medication'?[]:[{open:false},{open:false}]};
 const data=painDataForEntry(sample());data.painLocations=[point()];const draft=captureDraft(form,null,data);
 assert(isDraft(draft));assert.deepEqual(draft.headMap,data);assert.equal(draft.headMap.entryId,'entry-1');
 assert(isDraft(captureDraft(form,null)));assert(!isDraft({...draft,editingId:'another'}));
 const broken=structuredClone(draft);broken.headMap.painLocations[0].normal=[0,0,0];assert(!isDraft(broken));
});
