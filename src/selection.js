import * as THREE from "three";
import {CAD} from "./core.js";
import "./objects.js";
import "./history.js";
import "./dimensions.js";

CAD.topSelectable=o=>{let x=o;while(x?.userData?.groupParent)x=x.userData.groupParent;return x;};
CAD.clearMultiVisuals=()=>{CAD.multiBoxes.forEach(b=>CAD.scene.remove(b));CAD.multiBoxes=[];};
CAD.setInputsEnabled=on=>["selectedName","posX","posY","posZ","applyPos","rename","deleteObj"].forEach(id=>CAD.$(id).disabled=!on);

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
  CAD.updateDimensions(CAD.selected);
};

CAD.selectObject=(o,preserveMulti=false)=>{
  if(!preserveMulti){CAD.multiSelected=o?[CAD.topSelectable(o)]:[];CAD.clearMultiVisuals();}
  CAD.selected=o?CAD.topSelectable(o):null;
  if(CAD.selectionBox){CAD.scene.remove(CAD.selectionBox);CAD.selectionBox=null;}
  if(!CAD.selected){CAD.transform.detach();CAD.clearDimensions();CAD.setInputsEnabled(false);CAD.$("copyHub").disabled=true;CAD.$("info").style.display="none";CAD.$("selKind").textContent="-";CAD.$("selSX").textContent=CAD.$("selSY").textContent=CAD.$("selSZ").textContent=CAD.$("selRot").textContent="-";if(!preserveMulti)CAD.multiSelected=[];CAD.updateGroupUI();return;}
  CAD.selectionBox=new THREE.BoxHelper(CAD.selected,0x1e6fa8);CAD.scene.add(CAD.selectionBox);CAD.transform.attach(CAD.selected);CAD.setInputsEnabled(true);CAD.refreshSelectedUI();CAD.updateGroupUI();
};
CAD.clearSelection=()=>CAD.selectObject(null);

CAD.showMultiSelection=()=>{
  CAD.clearDimensions();CAD.clearMultiVisuals();if(CAD.selectionBox){CAD.scene.remove(CAD.selectionBox);CAD.selectionBox=null;}CAD.transform.detach();CAD.selected=null;CAD.setInputsEnabled(false);CAD.$("copyHub").disabled=true;
  CAD.$("info").style.display="block";CAD.$("infoTitle").textContent=`다중 선택 ${CAD.multiSelected.length}개`;CAD.$("infoBody").innerHTML=CAD.multiSelected.map(o=>`• ${o.userData.name}`).join("<br>");
  CAD.multiSelected.forEach(o=>{const b=new THREE.BoxHelper(o,0x1e6fa8);CAD.scene.add(b);CAD.multiBoxes.push(b);});CAD.$("selKind").textContent="다중 선택";CAD.$("selSX").textContent=CAD.$("selSY").textContent=CAD.$("selSZ").textContent=CAD.$("selRot").textContent="-";CAD.$("selNote").textContent="Ctrl+G 또는 그룹화 버튼을 누르면 하나의 객체 그룹이 됩니다.";CAD.updateGroupUI();
};

CAD.toggleMultiObject=o=>{
  if(!o)return;o=CAD.topSelectable(o);const i=CAD.multiSelected.indexOf(o);if(i>=0)CAD.multiSelected.splice(i,1);else CAD.multiSelected.push(o);
  if(CAD.multiSelected.length===0){CAD.clearSelection();return;}if(CAD.multiSelected.length===1){CAD.selectObject(CAD.multiSelected[0],true);return;}CAD.showMultiSelection();
};

function restoreOwners(child){child.traverse(c=>{if(c!==child)c.userData.owner=child;});}
function attachGroup(g,members){
  if(!g.parent)CAD.scene.add(g);if(!CAD.objects.includes(g))CAD.objects.push(g);g.updateMatrixWorld(true);
  members.forEach(o=>{g.attach(o);CAD.removeObject(o);o.userData.groupParent=g;});g.userData.members=members;CAD.updateDataFromTransform(g);
}
function detachGroup(g,members){
  members.forEach(o=>{CAD.scene.attach(o);delete o.userData.groupParent;restoreOwners(o);CAD.updateDataFromTransform(o);if(!CAD.objects.includes(o))CAD.objects.push(o);});CAD.removeObject(g);g.parent?.remove(g);
}

CAD.groupSelectedObjects=()=>{
  const members=[...CAD.multiSelected];if(members.length<2||members.some(o=>o.userData.locked))return;
  const center=new THREE.Vector3();members.forEach(o=>{const w=new THREE.Vector3();o.getWorldPosition(w);center.add(w);});center.multiplyScalar(1/members.length);
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
  if(!CAD.selected)return;const o=CAD.selected,before=CAD.captureTransform(o),snap=Math.max(.1,+CAD.$("moveSnap").value||1)*mult,u=CAD.worldToUser(o.position);
  o.position.copy(CAD.userToWorld(u.x+dx*snap,u.y+dy*snap,u.z+dz*snap));CAD.updateDataFromTransform(o);CAD.refreshSelectedUI();CAD.selectionBox?.update();CAD.pushTransformCommand(o,before,CAD.captureTransform(o),"키보드 이동");
};

CAD.setMode=mode=>{CAD.transform.setMode(mode);CAD.$("moveMode").classList.toggle("active",mode==="translate");CAD.$("rotateMode").classList.toggle("active",mode==="rotate");CAD.$("status").textContent="모드: "+(mode==="translate"?"이동":"회전");};

CAD.transform.addEventListener("dragging-changed",e=>{
  CAD.transforming=e.value;CAD.orbit.enabled=!e.value;
  if(e.value&&CAD.selected)CAD.transformStart=CAD.captureTransform(CAD.selected);
  if(!e.value){CAD.blockSelectUntil=performance.now()+180;if(CAD.selected){CAD.updateDataFromTransform(CAD.selected);CAD.refreshSelectedUI();CAD.selectionBox?.update();if(CAD.transformStart)CAD.pushTransformCommand(CAD.selected,CAD.transformStart,CAD.captureTransform(CAD.selected),CAD.transform.mode==="rotate"?"객체 회전":"객체 이동");CAD.transformStart=null;}}
});
CAD.transform.addEventListener("objectChange",()=>{if(CAD.selected){CAD.updateDataFromTransform(CAD.selected);CAD.refreshSelectedUI();CAD.selectionBox?.update();}});

CAD.renderer.domElement.addEventListener("pointerdown",e=>{if(e.button===0)CAD.pointerDown={x:e.clientX,y:e.clientY};});
CAD.renderer.domElement.addEventListener("pointermove",e=>{const p=CAD.groundPoint(e);if(p){const u=CAD.worldToUser(p);CAD.$("pointerStatus").textContent=`포인터: X ${u.x.toFixed(0)}, Y ${u.y.toFixed(0)}, Z 0 mm`;}});
CAD.renderer.domElement.addEventListener("pointerup",e=>{
  if(e.button!==0||!CAD.pointerDown)return;const dist=Math.hypot(e.clientX-CAD.pointerDown.x,e.clientY-CAD.pointerDown.y);CAD.pointerDown=null;if(dist>5||CAD.transforming||performance.now()<CAD.blockSelectUntil)return;
  if(CAD.measuring){const p=CAD.groundPoint(e);if(p)CAD.addMeasurePoint(p);return;}
  const picked=CAD.pickObject(e);if(e.shiftKey)CAD.toggleMultiObject(picked);else CAD.selectObject(picked);
});
