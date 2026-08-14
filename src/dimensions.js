import * as THREE from "three";
import {CAD} from "./core.js";

CAD.dimensionGroup=new THREE.Group();
CAD.scene.add(CAD.dimensionGroup);
CAD.dimensionTarget=null;
CAD.dimensionRefreshQueued=false;

CAD.clearDimensions=()=>{
  CAD.dimensionTarget=null;
  while(CAD.dimensionGroup.children.length){
    const o=CAD.dimensionGroup.children[0];
    CAD.dimensionGroup.remove(o);
    o.traverse?.(c=>{
      c.geometry?.dispose?.();
      if(c.material){
        (Array.isArray(c.material)?c.material:[c.material]).forEach(m=>{
          m.map?.dispose?.();
          m.dispose?.();
        });
      }
    });
  }
};

function clearDimensionVisuals(){
  while(CAD.dimensionGroup.children.length){
    const o=CAD.dimensionGroup.children[0];
    CAD.dimensionGroup.remove(o);
    o.traverse?.(c=>{
      c.geometry?.dispose?.();
      if(c.material){
        (Array.isArray(c.material)?c.material:[c.material]).forEach(m=>{
          m.map?.dispose?.();
          m.dispose?.();
        });
      }
    });
  }
}

function labelSprite(text,color){
  const c=document.createElement("canvas"),ctx=c.getContext("2d");
  c.width=640;c.height=160;
  ctx.clearRect(0,0,c.width,c.height);
  ctx.fillStyle="rgba(255,255,255,.96)";
  ctx.strokeStyle=color;
  ctx.lineWidth=7;
  const r=24,x=5,y=5,w=630,h=150;
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();ctx.stroke();
  ctx.fillStyle=color;
  ctx.font='700 48px "Malgun Gothic",Arial';
  ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.fillText(text,320,82);
  const tex=new THREE.CanvasTexture(c);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.minFilter=THREE.LinearFilter;
  const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false});
  const s=new THREE.Sprite(mat);
  s.renderOrder=1002;
  s.userData.isDimension=true;
  return s;
}

function addLine(a,b,color,opacity=1){
  const g=new THREE.BufferGeometry().setFromPoints([a,b]);
  const m=new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity,depthTest:false,depthWrite:false});
  const l=new THREE.Line(g,m);
  l.renderOrder=1000;
  CAD.dimensionGroup.add(l);
  return l;
}

function coneAt(pos,dir,color,size){
  const geo=new THREE.ConeGeometry(size*.34,size,18);
  const mat=new THREE.MeshBasicMaterial({color,depthTest:false,depthWrite:false});
  const m=new THREE.Mesh(geo,mat);
  m.position.copy(pos);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize());
  m.renderOrder=1001;
  CAD.dimensionGroup.add(m);
}

function extension(a,b,color){addLine(a,b,color,.42);}

function dimension(a,b,label,color,headSize,labelW,labelH,labelOffset){
  const dir=b.clone().sub(a),len=dir.length();
  if(len<1e-6)return;
  const n=dir.clone().normalize();
  addLine(a,b,color,1);
  coneAt(a,n,color,headSize);
  coneAt(b,n.clone().negate(),color,headSize);
  const s=labelSprite(label,"#"+new THREE.Color(color).getHexString());
  s.position.copy(a.clone().add(b).multiplyScalar(.5).add(labelOffset));
  s.scale.set(labelW,labelH,1);
  CAD.dimensionGroup.add(s);
}

function worldPerPixelAt(point){
  const distance=Math.max(1,CAD.camera.position.distanceTo(point));
  const h=Math.max(1,CAD.renderer.domElement.clientHeight||CAD.vp?.clientHeight||700);
  return 2*distance*Math.tan(THREE.MathUtils.degToRad(CAD.camera.fov*.5))/h;
}

function supportPoint(box,axis,outward,atMax){
  const p=new THREE.Vector3();
  p.x=axis==="x"?(atMax?box.max.x:box.min.x):(outward.x>=0?box.max.x:box.min.x);
  p.y=axis==="y"?(atMax?box.max.y:box.min.y):(outward.y>=0?box.max.y:box.min.y);
  p.z=axis==="z"?(atMax?box.max.z:box.min.z):(outward.z>=0?box.max.z:box.min.z);
  return p;
}

function cameraOutward(center,axis){
  const v=CAD.camera.position.clone().sub(center);
  if(axis==="x")v.x=0;
  else if(axis==="y")v.y=0;
  else v.z=0;
  if(v.lengthSq()<1e-8){
    if(axis==="x")v.set(0,1,1);
    else if(axis==="y")v.set(1,0,1);
    else v.set(1,1,0);
  }
  return v.normalize();
}

function drawAxisDimension(box,center,axis,value,label,color,offsetScale,metrics){
  const outward=cameraOutward(center,axis);
  const baseA=supportPoint(box,axis,outward,false);
  const baseB=supportPoint(box,axis,outward,true);
  const off=metrics.offset*offsetScale;
  const a=baseA.clone().addScaledVector(outward,off);
  const b=baseB.clone().addScaledVector(outward,off);
  extension(baseA,a,color);
  extension(baseB,b,color);
  const labelOffset=outward.clone().multiplyScalar(metrics.labelGap);
  dimension(a,b,`${label}  ${value.toFixed(1)} mm`,color,metrics.head,metrics.labelW,metrics.labelH,labelOffset);
}

CAD.renderAdaptiveDimensions=()=>{
  const o=CAD.dimensionTarget;
  clearDimensionVisuals();
  if(!o||!o.parent)return;

  const box=new THREE.Box3().setFromObject(o);
  if(box.isEmpty())return;
  const center=new THREE.Vector3(),size=new THREE.Vector3();
  box.getCenter(center);box.getSize(size);

  // Three.js world: X=사용자 X, Y=사용자 Z(높이), Z=사용자 Y(길이)
  const xSize=size.x,ySize=size.z,zSize=size.y;
  const maxD=Math.max(xSize,ySize,zSize,1);
  const wpp=worldPerPixelAt(center);

  // CAD처럼 화면에서 거의 일정한 글자/화살표 크기를 유지하면서,
  // 큰 부품에서는 객체 크기에 비례해 조금 더 떨어뜨린다.
  const metrics={
    offset:Math.max(wpp*24,Math.min(maxD*.11,wpp*90)),
    head:THREE.MathUtils.clamp(wpp*7,2.5,Math.max(16,maxD*.05)),
    labelGap:wpp*15,
    labelW:wpp*142,
    labelH:wpp*36
  };

  const red=0xd9342b,green=0x15934a,blue=0x2a5fd2;

  // 세 치수선을 완전히 같은 모서리에 겹치지 않게 살짝 다른 거리로 배치한다.
  drawAxisDimension(box,center,"x",xSize,"X",red,1.00,metrics);
  drawAxisDimension(box,center,"z",ySize,"Y",green,1.22,metrics);
  drawAxisDimension(box,center,"y",zSize,"Z",blue,1.44,metrics);
};

CAD.updateDimensions=o=>{
  CAD.dimensionTarget=o||null;
  CAD.renderAdaptiveDimensions();
};

CAD.queueDimensionRefresh=()=>{
  if(CAD.dimensionRefreshQueued||!CAD.dimensionTarget)return;
  CAD.dimensionRefreshQueued=true;
  requestAnimationFrame(()=>{
    CAD.dimensionRefreshQueued=false;
    if(CAD.dimensionTarget)CAD.renderAdaptiveDimensions();
  });
};

// 카메라를 회전/줌/팬하면 치수선을 현재 카메라에서 가장 가까운 외곽 모서리로 재배치한다.
CAD.orbit.addEventListener("change",CAD.queueDimensionRefresh);
window.addEventListener("resize",CAD.queueDimensionRefresh);
