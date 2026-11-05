(function(root){'use strict';
const DEFAULTS=Object.freeze({version:'connected-surface-v1',minRadius:.38,defaultRadius:.95*Math.SQRT2,maxRadius:2.5,defaultValue:50,focusedBelow:30,broadFrom:70,minFalloff:.12,minRegionShare:.04,minRegionSamples:2,minRegionArea:.002,fadeEndY:-3.5,fadeStartY:-2.2});
function radius(value,c=DEFAULTS){const v=Math.max(0,Math.min(100,value));const lo=v<=50?c.minRadius:c.defaultRadius,hi=v<=50?c.defaultRadius:c.maxRadius,t=v<=50?v/50:(v-50)/50;return Math.sqrt(lo*lo+(hi*hi-lo*lo)*t);}
function valueFromRadius(r,c=DEFAULTS){const v=Math.max(0,Math.min(100,r<=c.defaultRadius?50*(r*r-c.minRadius*c.minRadius)/(c.defaultRadius*c.defaultRadius-c.minRadius*c.minRadius):50+50*(r*r-c.defaultRadius*c.defaultRadius)/(c.maxRadius*c.maxRadius-c.defaultRadius*c.defaultRadius)));return Math.abs(v-Math.round(v))<1e-10?Math.round(v):v;}
const category=(v,c=DEFAULTS)=>v<c.focusedBelow?'focused':v<c.broadFrom?'moderate':'broad';
function falloff(d){const t=Math.max(0,Math.min(1,(d-.65)/.35));return Math.exp(-4.5*d*d)*(1-t*t*(3-2*t));}
function cutoff(c=DEFAULTS){let a=0,b=1;for(let i=0;i<30;i++){const m=(a+b)/2;if(falloff(m)>c.minFalloff)a=m;else b=m;}return(a+b)/2;}
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
class Heap{constructor(){this.a=[];}push(node,d){const x={node,d},a=this.a;let i=a.length;a.push(x);while(i){const p=(i-1)>>1;if(a[p].d<=d)break;a[i]=a[p];i=p;}a[i]=x;}pop(){const a=this.a,first=a[0],last=a.pop();if(a.length){let i=0;while(true){let l=i*2+1,r=l+1;if(l>=a.length)break;let child=r<a.length&&a[r].d<a[l].d?r:l;if(a[child].d>=last.d)break;a[i]=a[child];i=child;}a[i]=last;}return first;}get length(){return this.a.length;}}
function createModel(positions,indices,classify,catalog,config={}){
 const cfg={...DEFAULTS,...config},n=positions.length/3,keys=new Map(),canonical=new Int32Array(n),coords=[],originals=[];
 for(let i=0;i<n;i++){const p=positions.slice(i*3,i*3+3),key=p.map(v=>v.toFixed(4)).join(',');if(!keys.has(key)){keys.set(key,coords.length);coords.push(p);originals.push([]);}const id=keys.get(key);canonical[i]=id;originals[id].push(i);}
 const neighbors=coords.map(()=>new Map()),faces=coords.map(()=>[]),regions=new Map(catalog.map((r,i)=>[r.id,i]));const samples=[];let maxEdge=0;
 for(let f=0;f<indices.length/3;f++){const ids=indices.slice(f*3,f*3+3),nodes=ids.map(i=>canonical[i]),p=ids.map(i=>positions.slice(i*3,i*3+3));nodes.forEach(id=>faces[id].push(f));
  for(let i=0;i<3;i++){const a=nodes[i],b=nodes[(i+1)%3],w=dist(coords[a],coords[b]);maxEdge=Math.max(maxEdge,w);if(a!==b&&coords[a][1]>=cfg.fadeEndY&&coords[b][1]>=cfg.fadeEndY){neighbors[a].set(b,w);neighbors[b].set(a,w);}}
  const u=p[1].map((v,i)=>v-p[0][i]),v=p[2].map((v,i)=>v-p[0][i]);const area=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2;
  for(let s=0;s<3;s++){const bary=[1/6,1/6,1/6];bary[s]=2/3;const point=[0,0,0];for(let k=0;k<3;k++)for(let a=0;a<3;a++)point[a]+=p[k][a]*bary[k];const t=Math.max(0,Math.min(1,(point[1]-cfg.fadeEndY)/(cfg.fadeStartY-cfg.fadeEndY)));samples.push({face:f,nodes,bary,point,visibility:t*t*(3-2*t),area:area/3,region:regions.get(classify(point))});}
 }
 const edges=neighbors.map(m=>[...m]);const cache=new Map(),threshold=cutoff(cfg);
 function field(h){const cacheKey=h.id+':'+h.surface.faceIndex+':'+h.position.join(',');if(cache.has(cacheKey))return cache.get(cacheKey);
  const ds=new Float32Array(coords.length).fill(999),heap=new Heap(),tri=h.surface.vertexIndices.map(i=>canonical[i]);
  tri.forEach(id=>{const d=dist(h.position,coords[id]);if(d<ds[id]){ds[id]=d;heap.push(id,d);}});
  while(heap.length){const q=heap.pop();if(q.d>ds[q.node]+1e-6)continue;if(q.d>cfg.maxRadius+maxEdge)break;for(const [node,w] of edges[q.node]){const d=q.d+w;if(d<ds[node]&&d<=cfg.maxRadius+maxEdge){ds[node]=d;heap.push(node,d);}}}
  const bias=tri.reduce((sum,id,i)=>sum+ds[id]*h.surface.barycentric[i],0),vertexDistances=new Float32Array(n);for(let i=0;i<n;i++)vertexDistances[i]=ds[canonical[i]];
  const candidateIndices=[],sampleDistances=[];for(let i=0;i<samples.length;i++){const s=samples[i];if(s.nodes.some(id=>ds[id]>=999))continue;const d=Math.max(dist(h.position,s.point),s.nodes.reduce((sum,id,k)=>sum+ds[id]*s.bary[k],0)-bias);if(d<=cfg.maxRadius*threshold){candidateIndices.push(i);sampleDistances.push(d);}}
  const result={vertexDistances,bias,candidateIndices:new Int32Array(candidateIndices),sampleDistances:new Float32Array(sampleDistances),cacheKey};cache.set(cacheKey,result);return result;
 }
 function analyze(h){const f=field(h),amounts=new Float64Array(catalog.length),counts=new Uint32Array(catalog.length),limit=h.radius*threshold;let total=0;
  for(let k=0;k<f.candidateIndices.length;k++){if(f.sampleDistances[k]>limit)continue;const s=samples[f.candidateIndices[k]];if(falloff(f.sampleDistances[k]/h.radius)*s.visibility<cfg.minFalloff)continue;amounts[s.region]+=s.area;counts[s.region]++;total+=s.area;}
  const affected=[];for(let i=0;i<amounts.length;i++){const share=total?amounts[i]/total:0;if(share>=cfg.minRegionShare&&counts[i]>=cfg.minRegionSamples&&amounts[i]>=cfg.minRegionArea)affected.push({regionId:catalog[i].id,label:catalog[i].label,relativeCoverage:+share.toFixed(4)});}
  const fallback=!affected.length;if(fallback)affected.push({regionId:h.centerRegionId||h.regionId,label:catalog.find(r=>r.id===(h.centerRegionId||h.regionId)).label,relativeCoverage:1});
  return {method:cfg.version,coverageValue:h.coverageValue,affectedRegionIds:affected.map(r=>r.regionId),affectedRegions:affected,samplingFallback:fallback,meaningfulFalloff:cfg.minFalloff,minRegionShare:cfg.minRegionShare};
 }
 function distanceAt(h,face,bary,point){const f=field(h),ids=indices.slice(face*3,face*3+3);return Math.max(dist(h.position,point),ids.reduce((s,id,i)=>s+f.vertexDistances[id]*bary[i],0)-f.bias);}
 function retain(ids){for(const [key] of cache)if(!ids.some(id=>key.startsWith(id+':')))cache.delete(key);}
 return {config:cfg,field,analyze,distanceAt,retain,stats:{vertices:n,weldedVertices:coords.length,triangles:indices.length/3,samples:samples.length,maxEdge}};
}
const api={DEFAULTS,radius,valueFromRadius,category,falloff,cutoff,createModel};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.SurfaceCoverage=api;
})(typeof window!=='undefined'?window:globalThis);
