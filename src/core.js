import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {TransformControls} from "three/addons/controls/TransformControls.js";

export const CAD={};
CAD.$=id=>document.getElementById(id);
CAD.vp=CAD.$("vp");
CAD.scene=new THREE.Scene();
CAD.scene.background=new THREE.Color(0xe2e8ed);
CAD.camera=new THREE.PerspectiveCamera(42,1,1,30000);
CAD.renderer=new THREE.WebGLRenderer({antialias:true});
CAD.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
CAD.vp.prepend(CAD.renderer.domElement);

CAD.orbit=new OrbitControls(CAD.camera,CAD.renderer.domElement);
CAD.orbit.enableDamping=true;
CAD.orbit.dampingFactor=.08;
CAD.orbit.screenSpacePanning=true;
CAD.transform=new TransformControls(CAD.camera,CAD.renderer.domElement);
CAD.scene.add(CAD.transform.getHelper());
CAD.transform.setMode("translate");
CAD.transform.setSpace("world");

CAD.scene.add(new THREE.HemisphereLight(0xffffff,0x788694,2.1));
const sun=new THREE.DirectionalLight(0xffffff,1.1);sun.position.set(3200,4500,2800);CAD.scene.add(sun);

Object.assign(CAD,{
  SX:2500,SY:2500,SZ:2500,
  gridGroup:null,boundsGroup:null,frameRoot:null,
  objects:[],selected:null,selectionBox:null,multiSelected:[],multiBoxes:[],groupSerial:1,
  measuring:false,measurePts:[],measureGroup:new THREE.Group(),
  transforming:false,blockSelectUntil:0,pointerDown:null
});
CAD.scene.add(CAD.measureGroup);
CAD.raycaster=new THREE.Raycaster();
CAD.pointer=new THREE.Vector2();
CAD.userToWorld=(x,y,z)=>new THREE.Vector3(x,z,y);
CAD.worldToUser=v=>({x:v.x,y:v.z,z:v.y});
CAD.deg=r=>THREE.MathUtils.radToDeg(r);
CAD.rad=d=>THREE.MathUtils.degToRad(d);

CAD.dispose=o=>{
  o?.traverse?.(x=>{
    x.geometry?.dispose?.();
    if(x.material)(Array.isArray(x.material)?x.material:[x.material]).forEach(m=>m.dispose?.());
  });
  o?.parent?.remove(o);
};
CAD.removeObject=o=>{CAD.objects=CAD.objects.filter(x=>x!==o);};

CAD.buildGrid=()=>{
  if(CAD.gridGroup)CAD.dispose(CAD.gridGroup);
  CAD.gridGroup=new THREE.Group();
  const minor=[],major=[],step=100;
  for(let x=0;x<=CAD.SX+.01;x+=step)(x%500===0?major:minor).push(new THREE.Vector3(x,0,0),new THREE.Vector3(x,0,CAD.SY));
  for(let y=0;y<=CAD.SY+.01;y+=step)(y%500===0?major:minor).push(new THREE.Vector3(0,0,y),new THREE.Vector3(CAD.SX,0,y));
  if(minor.length)CAD.gridGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(minor),new THREE.LineBasicMaterial({color:0xb8c2cb,transparent:true,opacity:.65})));
  if(major.length)CAD.gridGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(major),new THREE.LineBasicMaterial({color:0x7f8e9b,transparent:true,opacity:.8})));
  CAD.scene.add(CAD.gridGroup);
};

CAD.buildBounds=()=>{
  if(CAD.boundsGroup)CAD.dispose(CAD.boundsGroup);
  CAD.boundsGroup=new THREE.Group();
  const v=[[0,0,0],[CAD.SX,0,0],[CAD.SX,0,CAD.SY],[0,0,CAD.SY],[0,CAD.SZ,0],[CAD.SX,CAD.SZ,0],[CAD.SX,CAD.SZ,CAD.SY],[0,CAD.SZ,CAD.SY]].map(a=>new THREE.Vector3(...a));
  const e=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]],pts=[];
  e.forEach(([a,b])=>pts.push(v[a],v[b]));
  CAD.boundsGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x30485d})));
  CAD.scene.add(CAD.boundsGroup);
};

CAD.setView=(v="iso")=>{
  const c=new THREE.Vector3(CAD.SX/2,CAD.SZ*.45,CAD.SY/2),d=Math.max(CAD.SX,CAD.SY,CAD.SZ)*1.65;
  CAD.orbit.target.copy(c);
  if(v==="top")CAD.camera.position.set(c.x,CAD.SZ+d,c.z+.01);
  else if(v==="front")CAD.camera.position.set(c.x,c.y,-d);
  else if(v==="right")CAD.camera.position.set(CAD.SX+d,c.y,c.z);
  else CAD.camera.position.set(CAD.SX+d*.66,CAD.SZ+d*.52,CAD.SY+d*.72);
  CAD.camera.lookAt(c);CAD.orbit.update();
};

CAD.rebuildSpace=(reset=true)=>{
  CAD.SX=+CAD.$("spaceX").value||2500;CAD.SY=+CAD.$("spaceY").value||2500;CAD.SZ=+CAD.$("spaceZ").value||2500;
  CAD.buildGrid();CAD.buildBounds();if(reset)CAD.setView("iso");
};

CAD.pointerNDC=e=>{
  const r=CAD.renderer.domElement.getBoundingClientRect();
  CAD.pointer.x=((e.clientX-r.left)/r.width)*2-1;
  CAD.pointer.y=-((e.clientY-r.top)/r.height)*2+1;
};
CAD.groundPoint=e=>{
  CAD.pointerNDC(e);CAD.raycaster.setFromCamera(CAD.pointer,CAD.camera);
  const p=new THREE.Vector3(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  return CAD.raycaster.ray.intersectPlane(plane,p)?p:null;
};

CAD.clearMeasure=()=>{
  while(CAD.measureGroup.children.length)CAD.dispose(CAD.measureGroup.children[0]);
  CAD.measurePts=[];
};
CAD.addMeasurePoint=p=>{
  CAD.measurePts.push(p);
  const m=new THREE.Mesh(new THREE.SphereGeometry(12,16,10),new THREE.MeshBasicMaterial({color:0xc23a35}));m.position.copy(p);CAD.measureGroup.add(m);
  if(CAD.measurePts.length===2){
    CAD.measureGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(CAD.measurePts),new THREE.LineBasicMaterial({color:0xc23a35})));
    CAD.$("status").textContent=`측정: ${CAD.measurePts[0].distanceTo(CAD.measurePts[1]).toFixed(1)} mm`;
    CAD.measurePts=[];
  }
};

CAD.resize=()=>{
  CAD.renderer.setSize(CAD.vp.clientWidth,CAD.vp.clientHeight,false);
  CAD.camera.aspect=CAD.vp.clientWidth/CAD.vp.clientHeight;CAD.camera.updateProjectionMatrix();
};

CAD.animate=()=>{
  requestAnimationFrame(CAD.animate);CAD.orbit.update();CAD.selectionBox?.update();CAD.multiBoxes.forEach(b=>b.update());CAD.renderer.render(CAD.scene,CAD.camera);
};
