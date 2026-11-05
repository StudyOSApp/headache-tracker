import './vendor/three-browser.js';
import './model-data.js';
import { validatePainData } from './data.js';

const T = globalThis.THREE, C = globalThis.PainCore, Coverage = globalThis.SurfaceCoverage;
const MODEL = globalThis.HEAD_MODEL;
const GUIDE_KEY = 'headache-tracker.head-guidance.v1';
const template = `
  <div class="hm-instructions"><span>Tap where it hurts. Drag to rotate.</span><button type="button" class="hm-help text-button" aria-expanded="false">How to select</button></div>
  <section class="hm-guide" hidden><h2>Just tap where it hurts.</h2><p>You don't need to be exact. We'll record the approximate location and help you track patterns over time.</p><p>Drag to rotate the head.</p><button type="button" class="hm-got-it">Got it</button></section>
  <div class="hm-scene" role="img" aria-label="Rotatable anatomical head pain map"><p class="hm-render-status" role="status">Loading head…</p></div>
  <div class="hm-edit-controls">
    <div class="hm-control"><div class="hm-label"><label>Pain intensity <output class="hm-intensity-value">5</output><span>/10</span></label><button type="button" class="hm-remove text-button" disabled>Remove</button></div><input class="hm-intensity" aria-label="Pain intensity" type="range" min="0" max="10" step="1" value="5"><div class="hm-ends"><span>Mild</span><span>Severe</span></div></div>
    <div class="hm-control"><label>Pain coverage<input class="hm-coverage" aria-label="Pain coverage" type="range" min="0" max="100" step="1" value="50"></label><div class="hm-ends"><span>Focused</span><span>Broad</span></div></div>
  </div>
  <fieldset class="hm-eye"><legend>Behind the eye</legend><div><label><input class="hm-behind" type="checkbox" value="retro_orbital_l">Left</label><label><input class="hm-behind" type="checkbox" value="retro_orbital_r">Right</label></div></fieldset>
  <p class="hm-status" role="status" aria-live="polite"></p>`;

export function mountPainMap(host, initial, { onChange = () => {}, readOnly = false } = {}) {
  validatePainData(initial);
  host.classList.add('head-map');host.innerHTML = template;
  const $ = selector => host.querySelector(selector);
  const seed = structuredClone(initial);
  const episode = { ...C.createEpisode(seed.lastUsedIntensity, seed.lastUsedCoverage),
    id: seed.entryId, painLocations: seed.painLocations, behindEye: seed.behindEye };
  C.upgradeCoverage({ entries: [episode] });
  let activeId = seed.activePainPointId || episode.painLocations.at(-1)?.id || null;
  let overallSeverity = seed.severity, destroyed = false, pending = null, renderer = null, resizeObserver, animation;
  let engine, uniforms, atlasData, distanceTexture, geometry, indexed, material, head, group, camera;
  let atlasSignature = '', yaw = 0, pitch = 0, start = null;
  const active = () => episode.painLocations.find(p => p.id === activeId);
  const status = message => $('.hm-status').textContent = message;
  const minPitch = T.MathUtils.degToRad(-10), maxPitch = T.MathUtils.degToRad(45);
  function snapshot() {
    flush(false);
    return { entryId: episode.id, severity: episode.painLocations.length ? Math.max(...episode.painLocations.map(p => p.intensity)) : overallSeverity,
      painLocations: structuredClone(episode.painLocations), behindEye: [...episode.behindEye],
      lastUsedIntensity: episode.lastUsedIntensity, lastUsedCoverage: episode.lastUsedCoverage,
      activePainPointId: activeId };
  }
  function emit() { if (!destroyed && !readOnly) onChange(snapshot()); }
  function finishGuide() { $('.hm-guide').hidden = true;$('.hm-help').setAttribute('aria-expanded','false');try { localStorage.setItem(GUIDE_KEY,'done'); } catch {} }
  let guidanceDone = false;try { guidanceDone = localStorage.getItem(GUIDE_KEY) === 'done'; } catch {}
  $('.hm-guide').hidden = guidanceDone || readOnly;
  $('.hm-help').setAttribute('aria-expanded',String(!$('.hm-guide').hidden));
  $('.hm-help').onclick = () => { $('.hm-guide').hidden = !$('.hm-guide').hidden;$('.hm-help').setAttribute('aria-expanded',String(!$('.hm-guide').hidden)); };
  $('.hm-got-it').onclick = finishGuide;
  $('.hm-edit-controls').hidden = readOnly;$('.hm-instructions').hidden = readOnly;
  for (const input of host.querySelectorAll('.hm-behind')) input.disabled = readOnly;

  function analyze(point) {
    if (engine && (point.coverageAnalysis?.method !== engine.config.version || point.coverageAnalysis.coverageValue !== point.coverageValue))
      point.coverageAnalysis = engine.analyze(point);
  }
  function flush(notify = true) {
    if (!pending) return;
    cancelAnimationFrame(pending.frame);
    const p = episode.painLocations.find(p => p.id === pending.id);pending = null;
    if (p) analyze(p);refresh();if (notify) emit();
  }
  function updateSurface() {
    if (!engine || !uniforms) return;
    const points = episode.painLocations;uniforms.painCount.value = points.length;
    const signature = points.map(p => p.id + ':' + p.position.join(',')).join('|'), rebuild = signature !== atlasSignature;
    if (rebuild) { atlasData.fill(999);engine.retain(points.map(p => p.id)); }
    points.forEach((p,i) => {
      uniforms.painPositions.value[i].fromArray(p.position);uniforms.painData.value[i].set(p.radius,p.intensity);
      if (rebuild) { const field = engine.field(p);uniforms.painBias.value[i] = field.bias;const slot = Math.floor(i/4), channel = i%4;
        for (let v=0;v<field.vertexDistances.length;v++) atlasData[(slot*atlasRows*atlasWidth+v)*4+channel] = field.vertexDistances[v]; }
    });
    if (rebuild) { distanceTexture.needsUpdate = true;atlasSignature = signature; }
  }
  function refresh() {
    if (destroyed) return;
    const p = active();updateSurface();
    $('.hm-intensity').min = p ? '1' : '0';
    $('.hm-intensity').value = p?.intensity ?? overallSeverity;
    $('.hm-intensity-value').textContent = p?.intensity ?? overallSeverity;
    $('.hm-remove').disabled = !p;
    $('.hm-coverage').value = p?.coverageValue ?? episode.lastUsedCoverage;
    $('.hm-coverage').setAttribute('aria-valuetext',Coverage.category(Number($('.hm-coverage').value)) + ' pain coverage');
    for (const checkbox of host.querySelectorAll('.hm-behind')) checkbox.checked = episode.behindEye.includes(checkbox.value);
  }
  $('.hm-intensity').oninput = e => {
    const value = Number(e.target.value);flush(false);const p = active();
    if (p) { C.setIntensity(episode,p.id,value);overallSeverity = Math.max(...episode.painLocations.map(p => p.intensity)); }
    else { overallSeverity = value;episode.lastUsedIntensity = Math.max(1,value); }
    refresh();emit();
  };
  $('.hm-coverage').oninput = e => {
    const value = Number(e.target.value), p = active();
    if (!p) { episode.lastUsedCoverage = value;refresh();emit();return; }
    C.setCoverage(episode,p.id,value);updateSurface();
    $('.hm-coverage').setAttribute('aria-valuetext',Coverage.category(value)+' pain coverage');
    if (pending) cancelAnimationFrame(pending.frame);
    pending = { id:p.id, frame:requestAnimationFrame(() => flush()) };
  };
  $('.hm-coverage').onchange = () => flush();
  function removeActive(id) {
    C.removePoint(episode,id);if (activeId === id) activeId = episode.painLocations.at(-1)?.id || null;
    if (episode.painLocations.length) overallSeverity = Math.max(...episode.painLocations.map(p => p.intensity));
    refresh();emit();status('Pain location removed.');
  }
  $('.hm-remove').onclick = () => { flush(false);if (active()) removeActive(activeId); };
  for (const checkbox of host.querySelectorAll('.hm-behind')) checkbox.onchange = () => {
    episode.behindEye = [...host.querySelectorAll('.hm-behind:checked')].map(c => c.value);emit();
  };

  const atlasWidth = 256, atlasRows = Math.ceil(MODEL.positions.length/3/atlasWidth), atlasGroups = Math.ceil(C.MAX_POINTS/4), atlasHeight = atlasRows*atlasGroups;
  try {
    // Validate the reconstruction against the unchanged mesh before accepting edits.
    for (const p of episode.painLocations) {
      const ids = MODEL.indices.slice(p.surface.faceIndex*3,p.surface.faceIndex*3+3), reconstructed = [0,0,0];
      if (ids.some((v,i) => v !== p.surface.vertexIndices[i])) throw Error('Saved mesh reference does not match.');
      ids.forEach((v,k) => reconstructed.forEach((_,i) => reconstructed[i] += MODEL.positions[v*3+i]*p.surface.barycentric[k]));
      if (C.distance(reconstructed,p.position)>1e-4) throw Error('Saved surface position does not match.');
    }
    renderer = new T.WebGLRenderer({ antialias:true });renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0xf5f6f2);$('.hm-scene').append(renderer.domElement);
    const scene = new T.Scene();camera = new T.PerspectiveCamera(30,1,.01,100);camera.position.set(0,.15,17);camera.lookAt(0,.15,0);
    scene.add(new T.HemisphereLight(0xffffff,0xe4e3df,2));
    for (const [x,y,z,power] of [[-6,8,12,.7],[8,3,6,.35],[0,4,-8,.4]]) { const light = new T.DirectionalLight(0xffffff,power);light.position.set(x,y,z);scene.add(light); }
    group = new T.Group();scene.add(group);
    indexed = new T.BufferGeometry();indexed.setAttribute('position',new T.Float32BufferAttribute(MODEL.positions,3));indexed.setAttribute('normal',new T.Float32BufferAttribute(MODEL.normals,3));indexed.setIndex(MODEL.indices);geometry = indexed.toNonIndexed();
    engine = Coverage.createModel(MODEL.positions,MODEL.indices,C.classify,C.catalog);
    atlasData = new Float32Array(atlasWidth*atlasHeight*4).fill(999);
    distanceTexture = new T.DataTexture(atlasData,atlasWidth,atlasHeight,T.RGBAFormat,T.FloatType);distanceTexture.minFilter=T.NearestFilter;distanceTexture.magFilter=T.NearestFilter;distanceTexture.generateMipmaps=false;distanceTexture.needsUpdate=true;
    const bary = new Float32Array(geometry.attributes.position.count*3), uv = [0,1,2].map(() => new Float32Array(geometry.attributes.position.count*2));
    for (let f=0;f<MODEL.indices.length/3;f++) for (let v=0;v<3;v++) { bary[(f*3+v)*3+v]=1;for (let c=0;c<3;c++) {const id=MODEL.indices[f*3+c],o=(f*3+v)*2;uv[c][o]=(id%atlasWidth+.5)/atlasWidth;uv[c][o+1]=(Math.floor(id/atlasWidth)+.5)/atlasHeight;}}
    geometry.setAttribute('painBarycentric',new T.BufferAttribute(bary,3));uv.forEach((a,i)=>geometry.setAttribute('vertexUv'+i,new T.BufferAttribute(a,2)));
    uniforms = { painCount:{value:0},painPositions:{value:Array.from({length:C.MAX_POINTS},()=>new T.Vector3())},painData:{value:Array.from({length:C.MAX_POINTS},()=>new T.Vector2())},painBias:{value:new Float32Array(C.MAX_POINTS)},painDistanceAtlas:{value:distanceTexture},atlasGroupHeight:{value:1/atlasGroups} };
    material = new T.MeshStandardMaterial({color:0xe4e3df,roughness:1,metalness:0,side:T.DoubleSide});
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader = 'attribute vec3 painBarycentric;attribute vec2 vertexUv0;attribute vec2 vertexUv1;attribute vec2 vertexUv2;varying vec3 vPainPosition;varying vec3 vPainBary;varying vec2 vUv0;varying vec2 vUv1;varying vec2 vUv2;\n' + shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPainPosition=position;vPainBary=painBarycentric;vUv0=vertexUv0;vUv1=vertexUv1;vUv2=vertexUv2;');
      shader.fragmentShader = `varying vec3 vPainPosition;varying vec3 vPainBary;varying vec2 vUv0;varying vec2 vUv1;varying vec2 vUv2;uniform int painCount;uniform vec3 painPositions[${C.MAX_POINTS}];uniform vec2 painData[${C.MAX_POINTS}];uniform float painBias[${C.MAX_POINTS}];uniform sampler2D painDistanceAtlas;uniform float atlasGroupHeight;\n` + shader.fragmentShader.replace('#include <opaque_fragment>',`
float strongest=0.0;vec3 painColor=vec3(0.94,0.015,0.006);
for(int i=0;i<${C.MAX_POINTS};i++){if(i>=painCount)break;vec2 offset=vec2(0.0,floor(float(i)/4.0)*atlasGroupHeight);vec4 distances=texture2D(painDistanceAtlas,vUv0+offset)*vPainBary.x+texture2D(painDistanceAtlas,vUv1+offset)*vPainBary.y+texture2D(painDistanceAtlas,vUv2+offset)*vPainBary.z;float ch=mod(float(i),4.0);float sd=ch<.5?distances.x:ch<1.5?distances.y:ch<2.5?distances.z:distances.w;float d=max(distance(vPainPosition,painPositions[i]),sd-painBias[i])/painData[i].x;float falloff=exp(-4.5*d*d)*(1.0-smoothstep(.65,1.0,d));float strength=falloff*(.30+.067*painData[i].y);if(strength>strongest){strongest=strength;painColor=mix(vec3(.95,.045,.006),vec3(1.0,.012,.003),exp(-24.0*d*d));}}
outgoingLight=mix(outgoingLight,painColor,clamp(strongest,0.0,.98));
#include <opaque_fragment>`).replace('#include <dithering_fragment>',`#include <dithering_fragment>\ngl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(245.0/255.0,246.0/255.0,242.0/255.0),1.0-smoothstep(${engine.config.fadeEndY},${engine.config.fadeStartY},vPainPosition.y));`);
    };
    head = new T.Mesh(geometry,material);group.add(head);
    const canvas = renderer.domElement,ray = new T.Raycaster(),pointer = new T.Vector2();
    function hitAt(x,y) { group.updateMatrixWorld(true);const r=canvas.getBoundingClientRect();pointer.set((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObject(head)[0]; }
    function recordFromHit(hit) {
      const p=head.worldToLocal(hit.point.clone()),ids=MODEL.indices.slice(hit.faceIndex*3,hit.faceIndex*3+3),vs=ids.map(i=>new T.Vector3().fromArray(MODEL.positions,i*3));
      const bary=new T.Triangle(...vs).getBarycoord(p,new T.Vector3()),normal=new T.Vector3();ids.forEach((id,i)=>normal.addScaledVector(new T.Vector3().fromArray(MODEL.normals,id*3),bary.getComponent(i)));normal.normalize();
      return {position:p.toArray(),normal:normal.toArray(),surface:{mesh:'Head_neck_trapezius',faceIndex:hit.faceIndex,vertexIndices:ids,barycentric:bary.toArray()}};
    }
    function selectHit(hit) {
      if (readOnly || !hit) return;flush(false);const rec=recordFromHit(hit);if(rec.position[1]<-2.85)return;
      let covered=null,strongest=-1;
      for(const p of episode.painLocations){const d=engine.distanceAt(p,hit.faceIndex,rec.surface.barycentric,rec.position)/p.radius,f=Coverage.falloff(d);if(f<engine.config.minFalloff)continue;const strength=f*(.30+.067*p.intensity);if(strength>strongest){covered=p;strongest=strength;}}
      if(covered){if(activeId===covered.id)removeActive(covered.id);else{activeId=covered.id;refresh();emit();status('Pain location selected. Adjust the sliders, or tap it again to remove.');}return;}
      try {const result=C.addPoint(episode,rec.position,rec.normal,rec.surface);if(!result.created&&activeId===result.hotspot.id){removeActive(result.hotspot.id);return;}activeId=result.hotspot.id;analyze(result.hotspot);overallSeverity=Math.max(...episode.painLocations.map(p=>p.intensity));refresh();emit();status('Pain location selected.');}catch(e){status(e.message);}
    }
    canvas.onpointerdown=e=>{if(start)return;start={x:e.clientX,y:e.clientY,yaw,pitch,id:e.pointerId,moved:false};canvas.setPointerCapture(e.pointerId);};
    canvas.onpointermove=e=>{if(!start||e.pointerId!==start.id)return;if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>8)start.moved=true;if(!start.moved)return;yaw=start.yaw+(e.clientX-start.x)*.008;pitch=T.MathUtils.clamp(start.pitch+(e.clientY-start.y)*.006,minPitch,maxPitch);};
    canvas.onpointerup=e=>{if(!start||e.pointerId!==start.id)return;const moved=start.moved;start=null;if(!moved)selectHit(hitAt(e.clientX,e.clientY));if(!readOnly)finishGuide();};canvas.onpointercancel=()=>start=null;canvas.onlostpointercapture=()=>start=null;
    resizeObserver = new ResizeObserver(()=>{const w=$('.hm-scene').clientWidth,h=$('.hm-scene').clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.position.z=Math.max(16.8,13.5/(w/h));camera.updateProjectionMatrix();});resizeObserver.observe($('.hm-scene'));
    for(const point of episode.painLocations)analyze(point);refresh();$('.hm-render-status').hidden=true;
    const animate=()=>{if(destroyed)return;group.rotation.set(pitch,yaw,0);renderer.render(scene,camera);animation=requestAnimationFrame(animate);};animate();
  } catch(error) {
    $('.hm-render-status').textContent='The 3D map could not be displayed. You can still record intensity and behind-the-eye pain.';
    // Existing point records are retained; a graphics failure never silently clears them.
    refresh();
  }
  function onPageHide(){flush();}window.addEventListener('pagehide',onPageHide);refresh();
  return { snapshot, flush:()=>flush(false), destroy(){flush(false);destroyed=true;cancelAnimationFrame(animation);resizeObserver?.disconnect();window.removeEventListener('pagehide',onPageHide);geometry?.dispose();indexed?.dispose();material?.dispose();distanceTexture?.dispose();renderer?.dispose();renderer?.forceContextLoss();host.replaceChildren();} };
}
