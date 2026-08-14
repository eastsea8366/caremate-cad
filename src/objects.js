import * as THREE from "three";
import {CAD} from "./core.js";

CAD.registerObject=(g,name,kind,sx,sy,sz,x,y,z,locked=false)=>{
  g.userData={...g.userData,name,kind,sx,sy,sz,px:x,py:y,pz:z,locked};
  g.position.copy(CAD.userToWorld(x,y,z));
  g.traverse(c=>{if(c!==g)c.userData.owner=g;});
  CAD.objects.push(g);return g;
};

CAD.makeBox=(parent,name,sx,sy,sz,x,y,z,kind="box",color=0x8798a6,locked=false)=>{
  const g=new THREE.Group();
  const geo=new THREE.BoxGeometry(sx,sz,sy);
  const mat=new THREE.MeshStandardMaterial({color,roughness:.72,metalness:kind==="frame"?.28:.06});
  const mesh=new THREE.Mesh(geo,mat);mesh.userData.owner=g;g.add(mesh);
  const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geo),new THREE.LineBasicMaterial({color:0x152536,transparent:true,opacity:.82}));edges.userData.owner=g;g.add(edges);
  (parent||CAD.scene).add(g);
  return CAD.registerObject(g,name,kind,sx,sy,sz,x,y,z,locked);
};

CAD.buildFrame=()=>{
  if(CAD.selected?.userData.kind==="frame")CAD.clearSelection?.();
  if(CAD.frameRoot){CAD.objects.filter(o=>o.userData.kind==="frame").forEach(CAD.removeObject);CAD.dispose(CAD.frameRoot);}
  CAD.frameRoot=new THREE.Group();CAD.scene.add(CAD.frameRoot);
  const W=+CAD.$("frameW").value||900,L=+CAD.$("frameL").value||2000,H=+CAD.$("frameH").value||250;
  const rw=+CAD.$("railW").value||20,rh=+CAD.$("railH").value||40,n=Math.max(0,Math.round(+CAD.$("crossCount").value||0));
  const cx=CAD.SX/2,cy=CAD.SY/2,z=H-rh/2,xL=cx-W/2+rw/2,xR=cx+W/2-rw/2;
  CAD.makeBox(CAD.frameRoot,"좌측 외곽레일",rw,L,rh,xL,cy,z,"frame",0x30373d,true);
  CAD.makeBox(CAD.frameRoot,"우측 외곽레일",rw,L,rh,xR,cy,z,"frame",0x30373d,true);
  CAD.makeBox(CAD.frameRoot,"앞쪽 가로 프레임",W-2*rw,rw,rh,cx,cy-L/2+rw/2,z,"frame",0x30373d,true);
  CAD.makeBox(CAD.frameRoot,"뒤쪽 가로 프레임",W-2*rw,rw,rh,cx,cy+L/2-rw/2,z,"frame",0x30373d,true);
  for(let i=1;i<=n;i++)CAD.makeBox(CAD.frameRoot,`가로 지지대 ${i}`,W-2*rw,18,18,cx,cy-L/2+L*i/(n+1),H-9,"frame",0x66737e,true);
  const legH=H-rh,lx=[cx-W/2+20,cx+W/2-20],ly=[cy-L/2+55,cy+L/2-55];let idx=1;
  for(const x of lx)for(const y of ly)CAD.makeBox(CAD.frameRoot,`다리 ${idx++}`,40,40,legH,x,y,legH/2,"frame",0x343b41,true);
};

function hubGeometry(od,bore,t,pcd){
  const s=new THREE.Shape();s.absarc(0,0,od/2,0,Math.PI*2,false);
  const center=new THREE.Path();center.absarc(0,0,bore/2,0,Math.PI*2,true);s.holes.push(center);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,holeD=i%2===0?2.5:3.0;
    const h=new THREE.Path();h.absarc(Math.cos(a)*pcd/2,Math.sin(a)*pcd/2,holeD/2,0,Math.PI*2,true);s.holes.push(h);
  }
  const g=new THREE.ExtrudeGeometry(s,{depth:t,bevelEnabled:true,bevelThickness:.22,bevelSize:.22,bevelSegments:2,curveSegments:96});
  g.translate(0,0,-t/2);g.computeVertexNormals();return g;
}

function addSideM4(g,od){
  const mat=new THREE.MeshStandardMaterial({color:0x1d2328,metalness:.55,roughness:.38}),base=new THREE.Vector3(0,1,0);
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2,dir=new THREE.Vector3(Math.cos(a),Math.sin(a),0).normalize();
    const m=new THREE.Mesh(new THREE.CylinderGeometry(1.7,1.7,2.2,32),mat);m.quaternion.setFromUnitVectors(base,dir);m.position.copy(dir).multiplyScalar(od/2-.55);m.userData.owner=g;g.add(m);
  }
}

CAD.createHub=(opts={})=>{
  const name=opts.name??(CAD.$("hubName").value||"BP-Hub-8"),od=+(opts.od??CAD.$("hubOD").value)||25.5,t=+(opts.t??CAD.$("hubT").value)||10;
  const bore=+(opts.bore??CAD.$("hubBore").value)||8,pcd=+(opts.pcd??CAD.$("hubPCD").value)||20,axis=opts.axis??CAD.$("hubAxis").value;
  const x=+(opts.x??CAD.$("hubX").value)||0,y=+(opts.y??CAD.$("hubY").value)||0,z=+(opts.z??CAD.$("hubZ").value)||0;
  const g=new THREE.Group(),mat=new THREE.MeshStandardMaterial({color:0xa8afb5,metalness:.88,roughness:.27});
  const body=new THREE.Mesh(hubGeometry(od,bore,t,pcd),mat);body.userData.owner=g;g.add(body);
  const edges=new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry,18),new THREE.LineBasicMaterial({color:0x3d4850,transparent:true,opacity:.72}));edges.userData.owner=g;g.add(edges);addSideM4(g,od);
  if(axis==="X")g.rotation.y=Math.PI/2;else if(axis==="Z")g.rotation.x=-Math.PI/2;
  const sx=axis==="X"?t:od,sy=axis==="Y"?t:od,sz=axis==="Z"?t:od;
  g.userData={hub:{od,t,bore,pcd,axis,front:"4-M3 + 4-Ø3",side:"4-M4"}};CAD.scene.add(g);CAD.registerObject(g,name,"hub",sx,sy,sz,x,y,z,false);CAD.selectObject?.(g);return g;
};

CAD.updateDataFromTransform=o=>{if(!o)return;const u=CAD.worldToUser(o.position);o.userData.px=u.x;o.userData.py=u.y;o.userData.pz=u.z;};
CAD.getDisplaySize=o=>{if(!o)return{x:0,y:0,z:0};const b=new THREE.Box3().setFromObject(o),s=new THREE.Vector3();b.getSize(s);return{x:s.x,y:s.z,z:s.y};};
