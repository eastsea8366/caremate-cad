import * as THREE from "three";
import {CAD} from "./core.js";

CAD.dimensionGroup=new THREE.Group();CAD.scene.add(CAD.dimensionGroup);
CAD.clearDimensions=()=>{while(CAD.dimensionGroup.children.length){const o=CAD.dimensionGroup.children[0];CAD.dimensionGroup.remove(o);o.traverse?.(c=>{c.geometry?.dispose?.();if(c.material){(Array.isArray(c.material)?c.material:[c.material]).forEach(m=>{m.map?.dispose?.();m.dispose?.();});}});}};

function labelSprite(text,color){
  const c=document.createElement("canvas"),ctx=c.getContext("2d");c.width=512;c.height=128;
  ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle="rgba(255,255,255,.94)";ctx.strokeStyle=color;ctx.lineWidth=6;
  const r=22,x=4,y=4,w=504,h=120;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();ctx.stroke();
  ctx.fillStyle=color;ctx.font='700 44px "Malgun Gothic",Arial';ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(text,256,66);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false});const s=new THREE.Sprite(mat);s.renderOrder=999;s.userData.isDimension=true;return s;
}
function addLine(a,b,color,opacity=1){const g=new THREE.BufferGeometry().setFromPoints([a,b]);const m=new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity,depthTest:false});const l=new THREE.Line(g,m);l.renderOrder=998;CAD.dimensionGroup.add(l);return l;}
function coneAt(pos,dir,color,size){const geo=new THREE.ConeGeometry(size*.32,size,18);const mat=new THREE.MeshBasicMaterial({color,depthTest:false});const m=new THREE.Mesh(geo,mat);m.position.copy(pos);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize());m.renderOrder=999;CAD.dimensionGroup.add(m);}
function dimension(a,b,label,color,size,labelOffset=new THREE.Vector3()){
  const dir=b.clone().sub(a),len=dir.length();if(len<1e-6)return;
  const n=dir.clone().normalize();addLine(a,b,color,1);coneAt(a,n,color,size);coneAt(b,n.clone().negate(),color,size);
  const s=labelSprite(label,"#"+new THREE.Color(color).getHexString());const mid=a.clone().add(b).multiplyScalar(.5).add(labelOffset);const labelW=Math.max(size*7,70),labelH=Math.max(size*1.9,22);s.position.copy(mid);s.scale.set(labelW,labelH,1);CAD.dimensionGroup.add(s);
}
function ext(a,b,color){addLine(a,b,color,.5);}

CAD.updateDimensions=o=>{
  CAD.clearDimensions();if(!o)return;
  const box=new THREE.Box3().setFromObject(o);if(box.isEmpty())return;const min=box.min,max=box.max;
  const sx=max.x-min.x,sy=max.z-min.z,sz=max.y-min.y,maxD=Math.max(sx,sy,sz,1),off=THREE.MathUtils.clamp(maxD*.12,18,90),head=THREE.MathUtils.clamp(maxD*.025,4,15),lab=THREE.MathUtils.clamp(maxD*.025,4,16);
  const red=0xd9342b,green=0x15934a,blue=0x2a5fd2;
  const xA=new THREE.Vector3(min.x,max.y+off,min.z-off*.35),xB=new THREE.Vector3(max.x,max.y+off,min.z-off*.35);
  ext(new THREE.Vector3(min.x,max.y,min.z),xA,red);ext(new THREE.Vector3(max.x,max.y,min.z),xB,red);dimension(xA,xB,`X  ${sx.toFixed(1)} mm`,red,head,new THREE.Vector3(0,lab*1.5,0));
  const yA=new THREE.Vector3(max.x+off,min.y,min.z),yB=new THREE.Vector3(max.x+off,min.y,max.z);
  ext(new THREE.Vector3(max.x,min.y,min.z),yA,green);ext(new THREE.Vector3(max.x,min.y,max.z),yB,green);dimension(yA,yB,`Y  ${sy.toFixed(1)} mm`,green,head,new THREE.Vector3(lab*2,0,0));
  const zA=new THREE.Vector3(min.x-off,min.y,max.z+off*.35),zB=new THREE.Vector3(min.x-off,max.y,max.z+off*.35);
  ext(new THREE.Vector3(min.x,min.y,max.z),zA,blue);ext(new THREE.Vector3(min.x,max.y,max.z),zB,blue);dimension(zA,zB,`Z  ${sz.toFixed(1)} mm`,blue,head,new THREE.Vector3(-lab*2,0,0));
};
