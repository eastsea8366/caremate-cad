import * as THREE from "three";
import {STLLoader} from "three/addons/loaders/STLLoader.js";
import {CAD} from "./core.js";
import "./selection.js";
import "./sidebar.js";
import "./input-controls.js";

CAD.$("applySpace").onclick=()=>CAD.rebuildSpace(true);
CAD.$("buildFrame").onclick=CAD.buildFrame;

CAD.$("addBox").onclick=()=>{
  const g=CAD.makeBox(CAD.scene,CAD.$("boxName").value||"부품",+CAD.$("boxSX").value||100,+CAD.$("boxSY").value||100,+CAD.$("boxSZ").value||100,+CAD.$("boxX").value||0,+CAD.$("boxY").value||0,+CAD.$("boxZ").value||0,"box",0x8798a6,false);
  CAD.selectObject(g);CAD.pushAddCommand(g,"직육면체 추가");
};

CAD.$("addHub").onclick=()=>{const g=CAD.createHub();CAD.pushAddCommand(g,"허브 추가");};
CAD.$("copyHub").onclick=()=>{
  if(CAD.selected?.userData.kind!=="hub")return;
  const h=CAD.selected.userData.hub,u=CAD.selected.userData;
  const g=CAD.createHub({name:u.name+" 복제",od:h.od,t:h.t,bore:h.bore,pcd:h.pcd,axis:h.axis,x:u.px+40,y:u.py,z:u.pz});CAD.pushAddCommand(g,"허브 복제");
};

CAD.$("moveMode").onclick=()=>CAD.setMode("translate");
CAD.$("rotateMode").onclick=()=>CAD.setMode("rotate");
CAD.$("moveSnap").oninput=()=>{const v=+CAD.$("moveSnap").value||0;CAD.transform.setTranslationSnap(v>0?v:null);};
CAD.$("rotSnap").oninput=()=>{const v=+CAD.$("rotSnap").value||0;CAD.transform.setRotationSnap(v>0?CAD.rad(v):null);};
CAD.$("moveSnap").dispatchEvent(new Event("input"));CAD.$("rotSnap").dispatchEvent(new Event("input"));

CAD.$("applyPos").onclick=()=>{
  if(!CAD.selected)return;const o=CAD.selected,before=CAD.captureTransform(o);
  o.position.copy(CAD.userToWorld(+CAD.$("posX").value||0,+CAD.$("posY").value||0,+CAD.$("posZ").value||0));
  CAD.updateDataFromTransform(o);CAD.refreshSelectedUI();CAD.selectionBox?.update();CAD.pushTransformCommand(o,before,CAD.captureTransform(o),"좌표 이동");
};
CAD.$("rename").onclick=()=>{
  if(!CAD.selected)return;const o=CAD.selected,before=o.userData.name,after=CAD.$("selectedName").value.trim()||before;if(before===after)return;o.userData.name=after;CAD.refreshSelectedUI();
  CAD.pushCommand({label:"이름 변경",undo:()=>{o.userData.name=before;CAD.selectObject?.(o);},redo:()=>{o.userData.name=after;CAD.selectObject?.(o);}});
};
CAD.$("detach").onclick=CAD.clearSelection;
CAD.$("deleteObj").onclick=()=>{if(CAD.selected)CAD.deleteWithHistory(CAD.selected);CAD.updateGroupUI();};

CAD.$("groupBtn").onclick=CAD.groupSelectedObjects;
CAD.$("ungroupBtn").onclick=CAD.ungroupSelectedObject;
CAD.$("shortcutBtn").onclick=()=>{const p=CAD.$("shortcutPanel");p.style.display=p.style.display==="block"?"none":"block";};

CAD.$("measureBtn").onclick=()=>{
  CAD.measuring=!CAD.measuring;CAD.$("measureBtn").classList.toggle("active",CAD.measuring);CAD.transform.enabled=!CAD.measuring;CAD.orbit.enabled=!CAD.measuring;
  CAD.$("status").textContent=CAD.measuring?"모드: 2점 측정":"모드: "+(CAD.transform.mode==="rotate"?"회전":"이동");if(!CAD.measuring)CAD.clearMeasure();
};

document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>CAD.setView(b.dataset.view));

CAD.$("stlInput").addEventListener("change",async e=>{
  const f=e.target.files?.[0];if(!f)return;
  const geo=new STLLoader().parse(await f.arrayBuffer());geo.computeVertexNormals();geo.computeBoundingBox();
  const s=new THREE.Vector3();geo.boundingBox.getSize(s);const center=new THREE.Vector3();geo.boundingBox.getCenter(center);geo.translate(-center.x,-center.y,-center.z);
  const g=new THREE.Group(),m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x687b8d,roughness:.7,metalness:.05}));m.userData.owner=g;g.add(m);CAD.scene.add(g);
  CAD.registerObject(g,f.name,"stl",s.x,s.z,s.y,CAD.SX/2,CAD.SY/2,s.y/2,false);CAD.selectObject(g);CAD.pushAddCommand(g,"STL 추가");e.target.value="";
});

window.addEventListener("keydown",e=>{
  const editing=["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName);
  const k=e.key,lower=k.toLowerCase(),cmd=e.ctrlKey||e.metaKey;
  if(editing)return;

  if(cmd&&lower==="z"){e.preventDefault();e.shiftKey?CAD.redo():CAD.undo();return;}
  if(cmd&&lower==="y"){e.preventDefault();CAD.redo();return;}
  if(cmd&&lower==="c"){e.preventDefault();CAD.copySelection();return;}
  if(cmd&&lower==="v"){e.preventDefault();CAD.pasteClipboard();return;}
  if(cmd&&lower==="d"){e.preventDefault();CAD.duplicateSelection();return;}
  if(cmd&&lower==="g"){e.preventDefault();if(e.shiftKey)CAD.ungroupSelectedObject();else CAD.groupSelectedObjects();return;}

  if(k==="w"||k==="W")CAD.setMode("translate");
  else if(k==="e"||k==="E")CAD.setMode("rotate");
  else if(k==="Escape")CAD.clearSelection();
  else if(k==="Delete")CAD.$("deleteObj").click();
  else if(k==="ArrowLeft"){e.preventDefault();CAD.nudgeSelected(-1,0,0,e.shiftKey?10:1);}
  else if(k==="ArrowRight"){e.preventDefault();CAD.nudgeSelected(1,0,0,e.shiftKey?10:1);}
  else if(k==="ArrowUp"){e.preventDefault();CAD.nudgeSelected(0,1,0,e.shiftKey?10:1);}
  else if(k==="ArrowDown"){e.preventDefault();CAD.nudgeSelected(0,-1,0,e.shiftKey?10:1);}
  else if(k==="PageUp"){e.preventDefault();CAD.nudgeSelected(0,0,1,e.shiftKey?10:1);}
  else if(k==="PageDown"){e.preventDefault();CAD.nudgeSelected(0,0,-1,e.shiftKey?10:1);}
  else if(k==="?")CAD.$("shortcutBtn").click();
});

window.addEventListener("resize",CAD.resize);
CAD.rebuildSpace(false);CAD.buildFrame();CAD.resize();CAD.setView("iso");CAD.updateGroupUI();CAD.animate();
