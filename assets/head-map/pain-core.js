(function(root){
'use strict';
const Coverage=root.SurfaceCoverage||(typeof require!=='undefined'?require('./surface-coverage'):null);
// Preserve footprint-area semantics: +25% small, large covers twice small's area.
const MODEL='migraine-mate-head-v1',MAPPING='surface-regions-v2',MAX_POINTS=32,LEGACY_RADIUS=.38,PREVIOUS_RADIUS=LEGACY_RADIUS*Math.sqrt(5),DEFAULT_RADIUS=PREVIOUS_RADIUS*Math.sqrt(1.25),SPREAD_VERSION='socket-sizes-v2';
const SIZES={small:DEFAULT_RADIUS,large:DEFAULT_RADIUS*Math.sqrt(2)};
const catalog=[];
function add(id,label,rollup=id){catalog.push({id,label,rollup});}
for(const [part,label,roll] of [['forehead','forehead'],['eye','around eye'],['temple','temple'],['cheek','cheek','face_jaw'],['jaw_tmj','jaw / TMJ','face_jaw'],['frontal_scalp','front scalp','lateral_scalp'],['parietal_scalp','side / parietal scalp','lateral_scalp'],['occiput','back of head'],['skull_base','base of skull'],['lateral_neck','side of neck','neck'],['trapezius','upper trapezius'],['ear','ear']])for(const side of ['l','r'])add(part+'_'+side,(side==='l'?'Left ':'Right ')+label,(roll||part)+'_'+side);
for(const [id,label,roll] of [['forehead_c','Center forehead','forehead'],['vertex','Crown / top of head','vertex'],['skull_base_c','Center base of skull','skull_base'],['posterior_neck_upper','Upper back of neck','neck'],['posterior_neck_lower','Lower back of neck','neck'],['central_face','Center face / nose','face']])add(id,label,roll);
const labels=Object.fromEntries(catalog.map(r=>[r.id,r.label]));
function classify(p){const [x,y,z]=p,s=x>=0?'_l':'_r',ax=Math.abs(x);
 if(y<-2.15 || (y<-1.8&&ax>1.55))return 'trapezius'+s;
 if(y<-.65){if(z<-.65&&ax<.85)return y<-1.45?'posterior_neck_lower':'posterior_neck_upper';return 'lateral_neck'+s;}
 if(y>3.05)return 'vertex';
 if(y<.25&&z<-.65)return ax<.38?'skull_base_c':'skull_base'+s;
 if(z<-.7)return 'occiput'+s;
 if(ax>1.45&&y>.55&&y<1.8)return 'ear'+s;
 if(y>2.35)return z>.55?'frontal_scalp'+s:'parietal_scalp'+s;
 if(y>1.85&&z>.65)return ax<.32?'forehead_c':'forehead'+s;
 if(y>1.12&&y<1.78&&ax>.23&&ax<1.05&&z>1.35)return 'eye'+s;
 if(y>.8&&y<2.35&&ax>.95&&z>.4)return 'temple'+s;
 if(z>.65){if(ax<.28)return 'central_face';return y<.45?'jaw_tmj'+s:'cheek'+s;}
 return 'parietal_scalp'+s;
}
const uid=()=>globalThis.crypto?.randomUUID?.()||'p-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const now=()=>new Date().toISOString();
const integerIntensity=i=>Number.isInteger(i)&&i>=1&&i<=10;
function createEpisode(preference=5,coveragePreference=Coverage.DEFAULTS.defaultValue){const t=now();return {id:uid(),start:t,createdAt:t,updatedAt:t,lastUsedIntensity:integerIntensity(preference)?preference:5,lastUsedCoverage:Number.isFinite(coveragePreference)&&coveragePreference>=0&&coveragePreference<=100?coveragePreference:Coverage.DEFAULTS.defaultValue,painLocations:[],behindEye:[]};}
function addPoint(episode,position,normal,surface){
 const old=episode.painLocations.filter(h=>distance(h.position,position)<.36&&dot(h.normal,normal)>.45).sort((a,b)=>distance(a.position,position)-distance(b.position,position))[0];
 if(old)return {hotspot:old,created:false};
 if(episode.painLocations.length>=MAX_POINTS)throw Error('This prototype supports 32 pain points per entry. Remove a point before adding another.');
 const regionId=classify(position),t=now(),coverageValue=Number.isFinite(episode.lastUsedCoverage)?episode.lastUsedCoverage:Coverage.DEFAULTS.defaultValue;const hotspot={id:uid(),episodeId:episode.id,regionId,centerRegionId:regionId,anatomicalLabel:labels[regionId],position:[...position],normal:[...normal],surface:{...surface},modelVersion:MODEL,mappingVersion:MAPPING,intensity:episode.lastUsedIntensity,radius:Coverage.radius(coverageValue),coverageValue,coverageCategory:Coverage.category(coverageValue),coverageVersion:Coverage.DEFAULTS.version,createdAt:t,updatedAt:t};episode.painLocations.push(hotspot);episode.updatedAt=t;return {hotspot,created:true};
}
function setIntensity(episode,id,value){if(!integerIntensity(value))throw Error('Intensity must be 1–10.');const h=episode.painLocations.find(h=>h.id===id);if(!h)throw Error('Point not found.');h.intensity=value;h.updatedAt=now();episode.lastUsedIntensity=value;episode.updatedAt=h.updatedAt;return h;}
function setCoverage(episode,id,value){if(!Number.isFinite(value)||value<0||value>100)throw Error('Coverage must be 0–100.');const h=episode.painLocations.find(h=>h.id===id);if(!h)throw Error('Point not found.');h.coverageValue=value;h.coverageCategory=Coverage.category(value);h.radius=Coverage.radius(value);h.coverageVersion=Coverage.DEFAULTS.version;delete h.sizePreset;delete h.coverageAnalysis;h.updatedAt=now();episode.lastUsedCoverage=value;episode.updatedAt=h.updatedAt;return h;}
// Retained for importing/integrating earlier records; no preset-size controls remain in the UI.
function setSize(episode,id,size){if(!Object.hasOwn(SIZES,size))throw Error('Unknown hotspot size.');return setCoverage(episode,id,Coverage.valueFromRadius(SIZES[size]));}
function removePoint(episode,id){episode.painLocations=episode.painLocations.filter(h=>h.id!==id);episode.updatedAt=now();}
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const vec=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
function validate(state){if(!state||state.version!==1||!Array.isArray(state.entries)||state.entries.length>200)throw Error('Unsupported saved entry format.');
 const episodeIds=new Set(),hotspotIds=new Set();
 for(const e of state.entries){if(typeof e.id!=='string'||episodeIds.has(e.id)||!Array.isArray(e.painLocations)||e.painLocations.length>MAX_POINTS||!integerIntensity(e.lastUsedIntensity)||!Number.isFinite(Date.parse(e.start))||!Array.isArray(e.behindEye)||e.behindEye.some(s=>!['retro_orbital_l','retro_orbital_r'].includes(s))||(e.lastUsedSize!==undefined&&!Object.hasOwn(SIZES,e.lastUsedSize)))throw Error('Invalid saved entry.');episodeIds.add(e.id);
 for(const h of e.painLocations){if(typeof h.id!=='string'||hotspotIds.has(h.id)||h.episodeId!==e.id||h.modelVersion!==MODEL||!vec(h.position)||!vec(h.normal)||Math.abs(Math.hypot(...h.normal)-1)>.03||h.position.some(v=>Math.abs(v)>6)||!integerIntensity(h.intensity)||!Number.isFinite(h.radius)||h.radius<=0||h.radius>2.5||(h.coverageValue!==undefined&&(!Number.isFinite(h.coverageValue)||h.coverageValue<0||h.coverageValue>100))||(h.sizePreset!==undefined&&!Object.hasOwn(SIZES,h.sizePreset))||!labels[h.regionId]||!Number.isFinite(Date.parse(h.createdAt))||!Number.isFinite(Date.parse(h.updatedAt))||!Number.isInteger(h.surface?.faceIndex)||h.surface.faceIndex<0||h.surface.faceIndex>=17684||!Array.isArray(h.surface.vertexIndices)||h.surface.vertexIndices.length!==3||h.surface.vertexIndices.some(i=>!Number.isInteger(i)||i<0||i>=9279)||!vec(h.surface.barycentric)||h.surface.barycentric.some(v=>v<-.00001||v>1.00001)||Math.abs(h.surface.barycentric.reduce((s,v)=>s+v,0)-1)>.00001)throw Error('Invalid saved pain point.');hotspotIds.add(h.id);}}
 if(!episodeIds.has(state.currentEpisodeId))throw Error('Current entry missing.');
 for(const e of state.entries){if(e.lastUsedCoverage!==undefined&&(!Number.isFinite(e.lastUsedCoverage)||e.lastUsedCoverage<0||e.lastUsedCoverage>100))throw Error('Invalid saved coverage default.');for(const h of e.painLocations){if(h.centerRegionId!==undefined&&!labels[h.centerRegionId])throw Error('Unknown center region.');const a=h.coverageAnalysis;if(a&&(!Array.isArray(a.affectedRegionIds)||!Array.isArray(a.affectedRegions)||a.affectedRegionIds.length!==a.affectedRegions.length||a.affectedRegionIds.some(id=>!labels[id])||a.affectedRegions.some(r=>!labels[r.regionId]||!a.affectedRegionIds.includes(r.regionId)||!Number.isFinite(r.relativeCoverage)||r.relativeCoverage<0||r.relativeCoverage>1)))throw Error('Invalid saved coverage classification.');}}
 return state;
}
function upgradeSpread(state){for(const e of state.entries){if(!e.lastUsedSize)e.lastUsedSize='small';for(const h of e.painLocations){const legacy=(!h.spreadVersion&&Math.abs(h.radius-LEGACY_RADIUS)<1e-6)||(h.spreadVersion==='socket-sized-v1'&&Math.abs(h.radius-PREVIOUS_RADIUS)<1e-6);if(legacy){h.radius=DEFAULT_RADIUS;h.sizePreset='small';h.spreadVersion=SPREAD_VERSION;}}}return state;}
function upgradeCoverage(state){for(const e of state.entries){if(!Number.isFinite(e.lastUsedCoverage))e.lastUsedCoverage=e.lastUsedSize&&SIZES[e.lastUsedSize]?Coverage.valueFromRadius(SIZES[e.lastUsedSize]):Coverage.DEFAULTS.defaultValue;for(const h of e.painLocations){h.centerRegionId=h.centerRegionId||h.regionId;if(!Number.isFinite(h.coverageValue)){h.coverageValue=Coverage.valueFromRadius(h.radius);h.coverageCategory=Coverage.category(h.coverageValue);h.coverageVersion=Coverage.DEFAULTS.version;}h.coverageCategory=Coverage.category(h.coverageValue);}}return state;}
function aggregateRegions(entries){const regions={};for(const e of entries){const episodeValues=new Map();for(const h of e.painLocations)for(const id of h.coverageAnalysis?.affectedRegionIds||[h.centerRegionId||h.regionId]){const values=episodeValues.get(id)||[];values.push(h.intensity);episodeValues.set(id,values);}for(const [id,values] of episodeValues){const r=regions[id]||(regions[id]={episodeCount:0,episodeMeanIntensitySum:0,maxIntensity:0});r.episodeCount++;r.episodeMeanIntensitySum+=values.reduce((a,b)=>a+b,0)/values.length;r.maxIntensity=Math.max(r.maxIntensity,...values);}}return Object.fromEntries(Object.entries(regions).map(([id,r])=>[id,{episodeCount:r.episodeCount,averageEpisodeIntensity:r.episodeMeanIntensitySum/r.episodeCount,maxIntensity:r.maxIntensity}]));}
const API={MODEL,MAPPING,MAX_POINTS,DEFAULT_RADIUS,SPREAD_VERSION,SIZES,catalog,labels,classify,createEpisode,addPoint,setIntensity,setSize,setCoverage,removePoint,validate,upgradeSpread,upgradeCoverage,aggregateRegions,distance};
if(typeof module!=='undefined'&&module.exports)module.exports=API;root.PainCore=API;
})(typeof window!=='undefined'?window:globalThis);
