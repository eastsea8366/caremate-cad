import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {CAD} from "./core.js";

const kindName=d=>d?.kind==="hub"?"BP-Hub-8 허브":d?.kind==="frame"?"프레임 부품":d?.kind==="stl"?"STL 모델":d?.kind==="group"?"객체 그룹":"직육면체 부품";

// ── 왼쪽 상단 선택 객체 3D 미리보기 ────────────────────────────────
const previewHost=CAD.$("objectPreview");
const previewScene=new THREE.Scene();
previewScene.background=new THREE.Color(0xf1f5f8);
const previewCamera=new THREE.PerspectiveCamera(38,1,.1,20000);
const previewRenderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
previewHost.prepend(previewRenderer.domElement);
const previewOrbit=new OrbitControls(previewCamera,previewRenderer.domElement);
previewOrbit.enableDamping=true;previewOrbit.dampingFactor=.08;previewOrbit.enablePan=false;
previewScene.add(new THREE.HemisphereLight(0xffffff,0x788694,2.4));
const previewLight=new THREE.DirectionalLight(0xffffff,1.2);previewLight.position.set(3,5,4);previewScene.add(previewLight);
const previewRoot=new THREE.Group();previewScene.add(previewRoot);

function clearPreviewRoot(){
  while(previewRoot.children.length){
    const o=previewRoot.children[0];
    previewRoot.remove(o);
    o.traverse?.(c=>{c.geometry?.dispose?.();if(c.material)(Array.isArray(c.material)?c.material:[c.material]).forEach(m=>m.dispose?.());});
  }
}
function resizePreview(){
  const w=Math.max(1,previewHost.clientWidth),h=Math.max(1,previewHost.clientHeight);
  previewRenderer.setSize(w,h,false);previewCamera.aspect=w/h;previewCamera.updateProjectionMatrix();
}
function fitPreview(){
  const box=new THREE.Box3().setFromObject(previewRoot);if(box.isEmpty())return;
  const size=new THREE.Vector3(),center=new THREE.Vector3();box.getSize(size);box.getCenter(center);
  previewRoot.position.sub(center);previewRoot.updateMatrixWorld(true);
  const maxD=Math.max(size.x,size.y,size.z,1),fov=THREE.MathUtils.degToRad(previewCamera.fov);
  const dist=Math.max(12,maxD/(2*Math.tan(fov/2))*1.7);
  previewCamera.position.set(dist*.72,dist*.55,dist);previewOrbit.target.set(0,0,0);previewCamera.lookAt(0,0,0);previewOrbit.update();
}
CAD.setPreviewObject=o=>{
  clearPreviewRoot();
  CAD.$("previewEmpty").style.display=o?"none":"grid";
  if(!o){resizePreview();return;}
  const clone=CAD.cloneSelectable?.(o);
  if(!clone)return;
  previewRoot.position.set(0,0,0);previewRoot.add(clone);fitPreview();resizePreview();
};
CAD.setPreviewObjects=list=>{
  clearPreviewRoot();CAD.$("previewEmpty").style.display=list?.length?"none":"grid";previewRoot.position.set(0,0,0);
  (list||[]).forEach(o=>{const c=CAD.cloneSelectable?.(o);if(c)previewRoot.add(c);});
  if(list?.length)fitPreview();resizePreview();
};

// ── 선택 객체 빠른 값 ─────────────────────────────────────────────
CAD.updateQuickInfo=o=>{
  if(!o){
    CAD.$("quickName").textContent="선택 없음";CAD.$("quickKind").textContent="객체를 클릭하세요";
    ["quickX","quickY","quickZ","quickPX","quickPY","quickPZ"].forEach(id=>CAD.$(id).textContent="-");
    CAD.$("refocusBtn").disabled=true;return;
  }
  CAD.updateDataFromTransform?.(o);const d=o.userData,s=CAD.getDisplaySize?.(o)||{x:0,y:0,z:0};
  CAD.$("quickName").textContent=d.name||"객체";CAD.$("quickKind").textContent=kindName(d);
  CAD.$("quickX").textContent=s.x.toFixed(1);CAD.$("quickY").textContent=s.y.toFixed(1);CAD.$("quickZ").textContent=s.z.toFixed(1);
  CAD.$("quickPX").textContent=d.px.toFixed(1);CAD.$("quickPY").textContent=d.py.toFixed(1);CAD.$("quickPZ").textContent=d.pz.toFixed(1);
  CAD.$("refocusBtn").disabled=false;
};
CAD.updateQuickMulti=list=>{
  const box=new THREE.Box3();(list||[]).forEach(o=>box.expandByObject(o));const s=new THREE.Vector3(),c=new THREE.Vector3();if(!box.isEmpty()){box.getSize(s);box.getCenter(c);}
  CAD.$("quickName").textContent=`다중 선택 ${list.length}개`;CAD.$("quickKind").textContent="묶기 전 선택 상태";
  CAD.$("quickX").textContent=s.x.toFixed(1);CAD.$("quickY").textContent=s.z.toFixed(1);CAD.$("quickZ").textContent=s.y.toFixed(1);
  const u=CAD.worldToUser(c);CAD.$("quickPX").textContent=u.x.toFixed(1);CAD.$("quickPY").textContent=u.y.toFixed(1);CAD.$("quickPZ").textContent=u.z.toFixed(1);CAD.$("refocusBtn").disabled=false;
};

// ── 메인 화면 선택 객체 자동 줌 ────────────────────────────────────
CAD.focusBox=(box,animate=true)=>{
  if(!box||box.isEmpty())return;
  const size=new THREE.Vector3(),center=new THREE.Vector3();box.getSize(size);box.getCenter(center);
  const radius=Math.max(size.length()*.5,8),fov=THREE.MathUtils.degToRad(CAD.camera.fov);
  const dist=Math.max(35,radius/Math.sin(fov/2)*1.32);
  let dir=CAD.camera.position.clone().sub(CAD.orbit.target);if(dir.lengthSq()<1e-6)dir.set(1,.65,1);dir.normalize();
  const endPos=center.clone().add(dir.multiplyScalar(dist)),startPos=CAD.camera.position.clone(),startTarget=CAD.orbit.target.clone();
  if(!animate){CAD.camera.position.copy(endPos);CAD.orbit.target.copy(center);CAD.camera.lookAt(center);CAD.orbit.update();return;}
  const t0=performance.now(),duration=300;
  const step=now=>{const p=Math.min(1,(now-t0)/duration),e=1-Math.pow(1-p,3);CAD.camera.position.lerpVectors(startPos,endPos,e);CAD.orbit.target.lerpVectors(startTarget,center,e);CAD.camera.lookAt(CAD.orbit.target);CAD.orbit.update();if(p<1)requestAnimationFrame(step);};
  requestAnimationFrame(step);
};
CAD.focusObject=(o,animate=true)=>{if(o)CAD.focusBox(new THREE.Box3().setFromObject(o),animate);};
CAD.focusObjects=(list,animate=true)=>{const box=new THREE.Box3();(list||[]).forEach(o=>box.expandByObject(o));CAD.focusBox(box,animate);};
CAD.onObjectSelected=o=>{
  CAD.updateQuickInfo(o);CAD.setPreviewObject(o);
  if(o&&CAD.$("autoZoom")?.checked)CAD.focusObject(o,true);
};
CAD.onMultiSelected=list=>{
  CAD.updateQuickMulti(list);CAD.setPreviewObjects(list);
  if(list?.length&&CAD.$("autoZoom")?.checked)CAD.focusObjects(list,true);
};
CAD.onSelectionCleared=()=>{CAD.updateQuickInfo(null);CAD.setPreviewObject(null);};
CAD.$("refocusBtn").addEventListener("click",()=>{if(CAD.selected)CAD.focusObject(CAD.selected,true);else if(CAD.multiSelected?.length)CAD.focusObjects(CAD.multiSelected,true);});

// ── 공간/프레임 슬라이더 + 숫자 동기화 ─────────────────────────────
function debounce(fn,delay=90){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),delay);};}
const liveSpace=debounce(()=>{CAD.rebuildSpace(false);CAD.buildFrame?.();},100);
const liveFrame=debounce(()=>CAD.buildFrame?.(),80);
function bindRange(rangeId,numId,callback){
  const r=CAD.$(rangeId),n=CAD.$(numId);if(!r||!n)return;
  r.value=n.value;
  r.addEventListener("input",()=>{n.value=r.value;callback?.();});
  n.addEventListener("change",()=>{let v=+n.value;if(!Number.isFinite(v))v=+r.value;v=Math.max(+r.min,Math.min(+r.max,v));n.value=v;r.value=v;callback?.();});
}
[
  ["spaceXRange","spaceX"],["spaceYRange","spaceY"],["spaceZRange","spaceZ"]
].forEach(([r,n])=>bindRange(r,n,liveSpace));
[
  ["frameWRange","frameW"],["frameLRange","frameL"],["frameHRange","frameH"],
  ["railWRange","railW"],["railHRange","railH"],["crossCountRange","crossCount"]
].forEach(([r,n])=>bindRange(r,n,liveFrame));

window.addEventListener("resize",resizePreview);
CAD.updateQuickInfo(null);resizePreview();
(function previewLoop(){requestAnimationFrame(previewLoop);previewOrbit.update();previewRenderer.render(previewScene,previewCamera);})();
