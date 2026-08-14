import * as THREE from "three";
import {CAD} from "./core.js";
import "./objects.js";
import "./history.js";
import "./dimensions.js";
import "./sidebar.js";

CAD.selectionPivot=null;
CAD.selectionDragging=false;
CAD.marqueeStart=null;
CAD.marqueeBase=[];
CAD.marquee=document.createElement("div");
CAD.marquee.className="selection-marquee";
CAD.vp.appendChild(CAD.marquee);

CAD.topSelectable=o=>{let x=o;while(x?.userData?.groupParent)x=x.userData.groupParent;return x;};
CAD.clearMultiVisuals=()=>{CAD.multiBoxes.forEach(b=>CAD.scene.remove(b));CAD.multiBoxes=[];};
CAD.setInputsEnabled=on=>["selectedName","posX","posY","posZ","applyPos","rename","deleteObj"].forEach(id=>CAD.$(id).disabled=!on);

function restoreOwners(child){
  if(child?.userData?.kind==="group"){
    const members=child.userData.members||child.children.filter(c=>c.userData?.kind);
    child.userData.members=members;
    members.forEach(m=>{
      m.userData.groupParent=child;
      m.traverse(c=>{if(c!==m)c.userData.owner=m;});
    });
    return;
  }
  child?.traverse?.(c=>{if(c!==child)c.userData.owner=child;});
}

function captureWorldStates(list){
  return list.map(o=>{
    const position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3();
    o.updateWorldMatrix(true,false);o.getWorldPosition(position);o.getWorldQuaternion(quaternion);o.getWorldScale(scale);
    return {o,position,quaternion,scale};
  });
}

function applyWorldState(s){
  const o=s.o;if(!o)return;
  o.parent?.updateWorldMatrix(true,false);
  const world=new THREE.Matrix4().compose(s.position,s.quaternion,s.scale);
  if(o.parent){
    const inv=new THREE.Matrix4().copy(o.parent.matrixWorld).invert();
    const local=inv.multiply(world);local.decompose(o.position,o.quaternion,o.scale);
  }else{
    o.position.copy(s.position);o.quaternion.copy(s.quaternion);o.scale.copy(s.scale);
  }
  o.updateMatrixWorld(true);CAD.updateDataFromTransform?.(o);
}

function applyWorldStates(states){
  states.forEach(applyWorldState);
  if(CAD.multiSelected?.length>1)CAD.showMultiSelection();
  else if(CAD.selected){CAD.refreshSelectedUI?.();CAD.selectionBox?.update();}
}

CAD.releaseSelectionPivot=()=>{
  const p=CAD.selectionPivot;if(!p)return;
  if(CAD.transform.object===p)CAD.transform.detach();
  const members=[...CAD.multiSelected];
  members.forEach(o=>{
    CAD.scene.attach(o);restoreOwners(o);CAD.updateDataFromTransform?.(o);
  });
  p.parent?.remove(p);CAD.selectionPivot=null;
};

CAD.buildSelectionPivot=()=>{
  const members=CAD.multiSelected.filter(Boolean);if(members.length<2)return null;
  const box=new THREE.Box3();members.forEach(o=>box.expandByObject(o));if(box.isEmpty())return null;
  const center=new THREE.Vector3();box.getCenter(center);
  const p=new THREE.Group();p.name="임시 다중 선택";p.userData={kind:"multiPivot",name:"다중 선택"};p.position.copy(center);
  CAD.scene.add(p);p.updateMatrixWorld(true);
  members.forEach(o=>p.attach(o));
  CAD.selectionPivot=p;CAD.transform.attach(p);return p;
};

CAD.updateGroupUI=()=>{
  CAD.$("multiCount").textContent=CAD.multiSelected.length+"개";
  const valid=CAD.multiSelected.filter(o=>!o.userData.locked);
  CAD.$("groupBtn").disabled=valid.length<2||valid.length!==CAD.multiSelected.length;
  CAD.$("ungroupBtn").disabled=!(CAD.selected?.userData.kind==="group");
};

CAD.refreshSelectedUI=()=>{
  if(!CAD.selected)return;
  CAD.updateDataFromTransform(CAD.selected);
  const d=CAD.selected.userData,s=CAD.getDisplaySize(CAD.selected);
  CAD.$("selectedName").value=d.name||"객체";
  CAD.$("posX").value=d.px.toFixed(1);CAD.$("posY").value=d.py.toFixed(1);CAD.$("posZ").value=d.pz.toFixed(1);
  const kind=d.kind==="hub"?"BP-Hub-8 허브":d.kind==="frame"?"프레임 부품":d.kind==="stl"?"STL 모델":d.kind==="group"?"객체 그룹":"직육면체 부품";
  CAD.$("selKind").textContent=kind;CAD.$("selSX").textContent=s.x.toFixed(1)+" mm";CAD.$("selSY").textContent=s.y.toFixed(1)+" mm";CAD.$("selSZ").textContent=s.z.toFixed(1)+" mm";
  CAD.$("selRot").textContent=`${CAD.deg(CAD.selected.rotation.x).toFixed(1)}° / ${CAD.deg(CAD.selected.rotation.z).toFixed(1)}° / ${CAD.deg(CAD.selected.rotation.y).toFixed(1)}°`;
  CAD.$("infoTitle").textContent=d.name;let extra="";
  if(d.kind==="hub"&&d.hub){const h=d.hub;extra=`<br><b>허브:</b> Ø${h.od} × ${h.t}T · 축홀 Ø${h.bore} · PCD${h.pcd}<br>전면 ${h.front} · 측면 ${h.side}`;CAD.$("selNote").textContent="기존 치수/사진 기준으로 외형과 홀 위치를 표현했습니다. 실제 M3/M4 나사산 깊이는 실측 후 확정해야 합니다.";}
  else if(d.kind==="group")CAD.$("selNote").textContent=`${(d.members||[]).length}개 객체가 묶여 있습니다. 이동·회전하면 함께 움직입니다.`;
  else CAD.$("selNote").textContent=d.locked?"기본 프레임 부품입니다. 구조 다시 배치 시 초기 위치로 돌아갑니다.":"XYZ 화살표 드래그, 중심 좌표 입력, 방향키로 이동할 수 있습니다.";
  CAD.$("infoBody").innerHTML=`${kind}<br>크기 X ${s.x.toFixed(1)} / Y ${s.y.toFixed(1)} / Z ${s.z.toFixed(1)} mm<br>중심 X ${d.px.toFixed(1)} / Y ${d.py.toFixed(1)} / Z ${d.pz.toFixed(1)} mm${extra}`;
  CAD.$("info").style.display="block";CAD.$("copyHub").disabled=d.kind!=="hub";
  CAD.updateDimensions(CAD.selected);CAD.updateQuickInfo?.(CAD.selected);
};

CAD.selectObject=(o,preserveMulti=false)=>{
  CAD.releaseSelectionPivot();
  if(!preserveMulti){CAD.multiSelected=o?[CAD.topSelectable(o)]:[];CAD.clearMultiVisuals();}
  CAD.selected=o?CAD.topSelectable(o):null;
  if(CAD.selectionBox){CAD.scene.remove(CAD.selectionBox);CAD.selectionBox=null;}
  if(!CAD.selected){
    CAD.transform.detach();CAD.clearDimensions();CAD.setInputsEnabled(false);CAD.$("copyHub").disabled=true;CAD.$("info").style.display="none";CAD.$("selKind").textContent="-";CAD.$("selSX").textContent=CAD.$("selSY").textContent=CAD.$("selSZ").textContent=CAD.$("selRot").textContent="-";
    if(!preserveMulti)CAD.multiSelected=[];CAD.updateGroupUI();CAD.onSelectionCleared?.();return;
  }
  CAD.selectionBox=new THREE.BoxHelper(CAD.selected,0x1e6fa8);CAD.scene.add(CAD.selectionBox);CAD.transform.attach(CAD.selected);CAD.setInputsEnabled(true);CAD.refreshSelectedUI();CAD.updateGroupUI();CAD.onObjectSelected?.(CAD.selected);
};
CAD.clearSelection=()=>CAD.selectObject(null);

CAD.showMultiSelection=()=>{
  const members=[...new Set(CAD.multiSelected.filter(Boolean).map(CAD.topSelectable))];
  CAD.releaseSelectionPivot();CAD.multiSelected=members;
  CAD.clearDimensions();CAD.clearMultiVisuals();if(CAD.selectionBox){CAD.scene.remove(CAD.selectionBox);CAD.selectionBox=null;}
  CAD.selected=null;CAD.setInputsEnabled(false);CAD.$("copyHub").disabled=true;
  CAD.$("info").style.display="block";CAD.$("infoTitle").textContent=`다중 선택 ${members.length}개`;CAD.$("infoBody").innerHTML=members.map(o=>`• ${o.userData.name}`).join("<br>");
  members.forEach(o=>{const b=new THREE.BoxHelper(o,0x58a5d8);CAD.scene.add(b);CAD.multiBoxes.push(b);});
  const pivot=CAD.buildSelectionPivot();
  if(pivot){CAD.selectionBox=new THREE.BoxHelper(pivot,0x126d9b);CAD.scene.add(CAD.selectionBox);CAD.updateDimensions(pivot);}
  CAD.$("selKind").textContent="다중 선택";
  if(pivot){const s=CAD.getDisplaySize(pivot);CAD.$("selSX").textContent=s.x.toFixed(1)+" mm";CAD.$("selSY").textContent=s.y.toFixed(1)+" mm";CAD.$("selSZ").textContent=s.z.toFixed(1)+" mm";}else CAD.$("selSX").textContent=CAD.$("selSY").textContent=CAD.$("selSZ").textContent="-";
  CAD.$("selRot").textContent="함께 이동/회전";CAD.$("selNote").textContent="여러 객체가 임시 묶음처럼 선택되었습니다. XYZ 이동·회전 후 Ctrl+G로 영구 그룹화할 수 있습니다.";
  CAD.updateGroupUI();CAD.onMultiSelected?.(members);
};

CAD.toggleMultiObject=o=>{
  CAD.releaseSelectionPivot();if(!o)return;o=CAD.topSelectable(o);if(o.userData.locked)return;
  const i=CAD.multiSelected.indexOf(o);if(i>=0)CAD.multiSelected.splice(i,1);else CAD.multiSelected.push(o);
  if(CAD.multiSelected.length===0){CAD.clearSelection();return;}
  if(CAD.multiSelected.length===1){CAD.selectObject(CAD.multiSelected[0],true);return;}
  CAD.showMultiSelection();
};

function attachGroup(g,members){
  CAD.releaseSelectionPivot();
  if(!g.parent)CAD.scene.add(g);if(!CAD.objects.includes(g))CAD.objects.push(g);g.updateMatrixWorld(true);
  members.forEach(o=>{g.attach(o);CAD.removeObject(o);o.userData.groupParent=g;});g.userData.members=members;CAD.updateDataFromTransform(g);
}
function detachGroup(g,members){
  members.forEach(o=>{CAD.scene.attach(o);delete o.userData.groupParent;restoreOwners(o);CAD.updateDataFromTransform(o);if(!CAD.objects.includes(o))CAD.objects.push(o);});CAD.removeObject(g);g.parent?.remove(g);
}

CAD.groupSelectedObjects=()=>{
  CAD.releaseSelectionPivot();
  const members=[...CAD.multiSelected];if(members.length<2||members.some(o=>o.userData.locked))return;
  const box=new THREE.Box3();members.forEach(o=>box.expandByObject(o));const center=new THREE.Vector3();box.getCenter(center);
  const g=new THREE.Group();g.position.copy(center);g.updateMatrixWorld(true);const name=CAD.$("groupName").value.trim()||`객체 그룹 ${CAD.groupSerial++}`,u=CAD.worldToUser(center);g.userData={name,kind:"group",members,px:u.x,py:u.y,pz:u.z,locked:false};
  attachGroup(g,members);CAD.multiSelected=[];CAD.clearMultiVisuals();CAD.selectObject(g);
  CAD.pushCommand({label:"객체 그룹화",undo:()=>{CAD.clearSelection();detachGroup(g,members);CAD.multiSelected=members;CAD.showMultiSelection();},redo:()=>{CAD.clearMultiVisuals();attachGroup(g,members);CAD.multiSelected=[];CAD.selectObject(g);}});
};

CAD.ungroupSelectedObject=()=>{
  if(CAD.selected?.userData.kind!=="group")return;const g=CAD.selected,members=[...(g.userData.members||[])];CAD.clearSelection();detachGroup(g,members);CAD.multiSelected=members;if(members.length>1)CAD.showMultiSelection();else if(members.length===1)CAD.selectObject(members[0],true);
  CAD.pushCommand({label:"그룹 해제",undo:()=>{CAD.clearMultiVisuals();attachGroup(g,members);CAD.multiSelected=[];CAD.selectObject(g);},redo:()=>{CAD.clearSelection();detachGroup(g,members);CAD.multiSelected=members;if(members.length>1)CAD.showMultiSelection();}});
};

CAD.pickObject=e=>{
  CAD.pointerNDC(e);CAD.raycaster.setFromCamera(CAD.pointer,CAD.camera);const hits=CAD.raycaster.intersectObjects(CAD.objects,true);
  for(const hit of hits){let o=hit.object;if(o.userData?.owner)return CAD.topSelectable(o.userData.owner);while(o){if(CAD.objects.includes(o))return CAD.topSelectable(o);if(o.userData?.owner)return CAD.topSelectable(o.userData.owner);o=o.parent;}}return null;
};

CAD.nudgeSelected=(dx,dy,dz,mult=1)=>{
  const snap=Math.max(.1,+CAD.$("moveSnap").value||1)*mult;
  if(CAD.selectionPivot&&CAD.multiSelected.length>1){
    const before=captureWorldStates(CAD.multiSelected),p=CAD.selectionPivot,delta=CAD.userToWorld(dx*snap,dy*snap,dz*snap);p.position.add(delta);p.updateMatrixWorld(true);
    CAD.multiBoxes.forEach(b=>b.update());CAD.selectionBox?.update();CAD.updateDimensions(p);CAD.updateQuickMulti?.(CAD.multiSelected);
    const after=captureWorldStates(CAD.multiSelected);CAD.pushCommand({label:"다중 객체 이동",undo:()=>applyWorldStates(before),redo:()=>applyWorldStates(after)});return;
  }
  if(!CAD.selected)return;const o=CAD.selected,before=CAD.captureTransform(o),u=CAD.worldToUser(o.position);
  o.position.copy(CAD.userToWorld(u.x+dx*snap,u.y+dy*snap,u.z+dz*snap));CAD.updateDataFromTransform(o);CAD.refreshSelectedUI();CAD.selectionBox?.update();CAD.pushTransformCommand(o,before,CAD.captureTransform(o),"키보드 이동");
};

CAD.setMode=mode=>{CAD.transform.setMode(mode);CAD.$("moveMode").classList.toggle("active",mode==="translate");CAD.$("rotateMode").classList.toggle("active",mode==="rotate");CAD.$("status").textContent="모드: "+(mode==="translate"?"이동":"회전");};

CAD.transform.addEventListener("dragging-changed",e=>{
  CAD.transforming=e.value;CAD.orbit.enabled=!e.value;
  if(e.value){
    if(CAD.selectionPivot&&CAD.multiSelected.length>1)CAD.transformStart=captureWorldStates(CAD.multiSelected);
    else if(CAD.selected)CAD.transformStart=CAD.captureTransform(CAD.selected);
  }
  if(!e.value){
    CAD.blockSelectUntil=performance.now()+180;
    if(CAD.selectionPivot&&CAD.multiSelected.length>1){
      const after=captureWorldStates(CAD.multiSelected),before=CAD.transformStart;CAD.multiBoxes.forEach(b=>b.update());CAD.selectionBox?.update();CAD.updateDimensions(CAD.selectionPivot);CAD.updateQuickMulti?.(CAD.multiSelected);CAD.setPreviewObjects?.(CAD.multiSelected);
      if(Array.isArray(before))CAD.pushCommand({label:CAD.transform.mode==="rotate"?"다중 객체 회전":"다중 객체 이동",undo:()=>applyWorldStates(before),redo:()=>applyWorldStates(after)});
      CAD.transformStart=null;return;
    }
    if(CAD.selected){CAD.updateDataFromTransform(CAD.selected);CAD.refreshSelectedUI();CAD.selectionBox?.update();CAD.setPreviewObject?.(CAD.selected);if(CAD.transformStart)CAD.pushTransformCommand(CAD.selected,CAD.transformStart,CAD.captureTransform(CAD.selected),CAD.transform.mode==="rotate"?"객체 회전":"객체 이동");CAD.transformStart=null;}
  }
});
CAD.transform.addEventListener("objectChange",()=>{
  if(CAD.selectionPivot&&CAD.multiSelected.length>1){CAD.multiBoxes.forEach(b=>b.update());CAD.selectionBox?.update();CAD.updateDimensions(CAD.selectionPivot);CAD.updateQuickMulti?.(CAD.multiSelected);return;}
  if(CAD.selected){CAD.updateDataFromTransform(CAD.selected);CAD.refreshSelectedUI();CAD.selectionBox?.update();}
});

function localPoint(e){const r=CAD.renderer.domElement.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
function setMarquee(a,b){
  const left=Math.min(a.x,b.x),top=Math.min(a.y,b.y),w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y),crossing=b.x<a.x;
  Object.assign(CAD.marquee.style,{display:"block",left:left+"px",top:top+"px",width:w+"px",height:h+"px"});
  CAD.marquee.classList.toggle("crossing",crossing);CAD.$("status").textContent=crossing?"교차 선택: 걸친 객체 포함":"창 선택: 완전히 들어온 객체만";
}
function hideMarquee(){CAD.marquee.style.display="none";CAD.marquee.classList.remove("crossing");}
function screenRectForObject(o){
  const box=new THREE.Box3().setFromObject(o);if(box.isEmpty())return null;const min=box.min,max=box.max;
  const corners=[
    [min.x,min.y,min.z],[max.x,min.y,min.z],[min.x,max.y,min.z],[max.x,max.y,min.z],
    [min.x,min.y,max.z],[max.x,min.y,max.z],[min.x,max.y,max.z],[max.x,max.y,max.z]
  ];
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity,visible=false;
  const w=CAD.renderer.domElement.clientWidth,h=CAD.renderer.domElement.clientHeight;
  for(const c of corners){const p=new THREE.Vector3(...c).project(CAD.camera);if(Number.isFinite(p.x)&&Number.isFinite(p.y)){const x=(p.x+1)*.5*w,y=(1-p.y)*.5*h;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);if(p.z>=-1&&p.z<=1)visible=true;}}
  return visible?{x0,y0,x1,y1}:null;
}
function marqueeCandidates(){
  const unique=[];const seen=new Set();
  for(const raw of CAD.objects){const o=CAD.topSelectable(raw);if(!o||o.userData.locked||seen.has(o))continue;seen.add(o);unique.push(o);}
  return unique;
}
function finishMarquee(end,additive){
  const start=CAD.marqueeStart;if(!start)return;const crossing=end.x<start.x;
  const s={x0:Math.min(start.x,end.x),x1:Math.max(start.x,end.x),y0:Math.min(start.y,end.y),y1:Math.max(start.y,end.y)};
  const hit=marqueeCandidates().filter(o=>{const r=screenRectForObject(o);if(!r)return false;return crossing?(r.x1>=s.x0&&r.x0<=s.x1&&r.y1>=s.y0&&r.y0<=s.y1):(r.x0>=s.x0&&r.x1<=s.x1&&r.y0>=s.y0&&r.y1<=s.y1);});
  const result=additive?[...new Set([...CAD.marqueeBase,...hit])]:hit;
  CAD.releaseSelectionPivot();CAD.multiSelected=result;
  if(result.length>1)CAD.showMultiSelection();else if(result.length===1)CAD.selectObject(result[0],true);else CAD.clearSelection();
  CAD.$("status").textContent=`드래그 선택: ${result.length}개`;
}

CAD.renderer.domElement.addEventListener("pointerdown",e=>{
  if(e.button!==0)return;
  const p=localPoint(e),picked=CAD.pickObject(e),axis=CAD.transform.axis;
  CAD.pointerDown={x:e.clientX,y:e.clientY,local:p,picked,shift:e.shiftKey,alt:e.altKey};
  CAD.marqueeStart=null;CAD.selectionDragging=false;
  if(!CAD.measuring&&!CAD.transforming&&!axis&&!picked&&!e.altKey){
    CAD.marqueeStart=p;CAD.marqueeBase=e.shiftKey?[...CAD.multiSelected]:[];CAD.orbit.enabled=false;
    try{CAD.renderer.domElement.setPointerCapture(e.pointerId);}catch{}
  }
});

CAD.renderer.domElement.addEventListener("pointermove",e=>{
  const gp=CAD.groundPoint(e);if(gp){const u=CAD.worldToUser(gp);CAD.$("pointerStatus").textContent=`포인터: X ${u.x.toFixed(0)}, Y ${u.y.toFixed(0)}, Z 0 mm`;}
  if(!CAD.pointerDown||!CAD.marqueeStart)return;const p=localPoint(e),d=Math.hypot(p.x-CAD.marqueeStart.x,p.y-CAD.marqueeStart.y);
  if(d>5){CAD.selectionDragging=true;setMarquee(CAD.marqueeStart,p);}
});

CAD.renderer.domElement.addEventListener("pointerup",e=>{
  if(e.button!==0||!CAD.pointerDown)return;
  const down=CAD.pointerDown,p=localPoint(e),dist=Math.hypot(e.clientX-down.x,e.clientY-down.y);
  CAD.pointerDown=null;
  if(CAD.marqueeStart){
    if(CAD.selectionDragging)finishMarquee(p,down.shift);else if(!down.shift)CAD.clearSelection();
    hideMarquee();CAD.marqueeStart=null;CAD.selectionDragging=false;CAD.orbit.enabled=true;return;
  }
  if(dist>5||CAD.transforming||performance.now()<CAD.blockSelectUntil)return;
  if(CAD.measuring){const gp=CAD.groundPoint(e);if(gp)CAD.addMeasurePoint(gp);return;}
  const picked=down.picked||CAD.pickObject(e);if(e.shiftKey)CAD.toggleMultiObject(picked);else CAD.selectObject(picked);
});

// 다중 선택 상태에서도 복사/붙여넣기 좌표가 월드 기준으로 유지되게 임시 피벗을 해제 후 다시 생성한다.
const baseCopy=CAD.copySelection;
CAD.copySelection=()=>{
  const multi=CAD.multiSelected.length>1?[...CAD.multiSelected]:null;
  if(multi)CAD.releaseSelectionPivot();baseCopy();
  if(multi){CAD.multiSelected=multi;CAD.showMultiSelection();}
};
const basePaste=CAD.pasteClipboard;
CAD.pasteClipboard=()=>{if(CAD.selectionPivot)CAD.releaseSelectionPivot();basePaste();};
