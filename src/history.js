import * as THREE from "three";
import {CAD} from "./core.js";

CAD.undoStack=[];CAD.redoStack=[];CAD.clipboard=[];CAD.historyLocked=false;CAD.transformStart=null;

CAD.setHistoryStatus=(msg)=>{if(CAD.$("status"))CAD.$("status").textContent=msg;};
CAD.pushCommand=cmd=>{if(CAD.historyLocked||!cmd)return;CAD.undoStack.push(cmd);if(CAD.undoStack.length>100)CAD.undoStack.shift();CAD.redoStack=[];};
CAD.undo=()=>{const c=CAD.undoStack.pop();if(!c)return;CAD.historyLocked=true;try{c.undo();}finally{CAD.historyLocked=false;}CAD.redoStack.push(c);CAD.setHistoryStatus(`실행 취소: ${c.label||"작업"}`);};
CAD.redo=()=>{const c=CAD.redoStack.pop();if(!c)return;CAD.historyLocked=true;try{c.redo();}finally{CAD.historyLocked=false;}CAD.undoStack.push(c);CAD.setHistoryStatus(`다시 실행: ${c.label||"작업"}`);};

CAD.captureTransform=o=>({position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()});
CAD.applyTransformState=(o,s)=>{if(!o||!s)return;o.position.copy(s.position);o.quaternion.copy(s.quaternion);o.scale.copy(s.scale);o.updateMatrixWorld(true);CAD.updateDataFromTransform?.(o);CAD.refreshSelectedUI?.();CAD.selectionBox?.update();CAD.updateDimensions?.(o);};
CAD.sameTransform=(a,b)=>a&&b&&a.position.distanceToSquared(b.position)<1e-8&&1-Math.abs(a.quaternion.dot(b.quaternion))<1e-8&&a.scale.distanceToSquared(b.scale)<1e-8;
CAD.pushTransformCommand=(o,before,after,label="객체 이동")=>{if(!o||CAD.sameTransform(before,after))return;CAD.pushCommand({label,undo:()=>CAD.applyTransformState(o,before),redo:()=>CAD.applyTransformState(o,after)});};

function cleanData(d){const out={};for(const [k,v] of Object.entries(d||{})){if(["owner","groupParent","members"].includes(k))continue;try{out[k]=JSON.parse(JSON.stringify(v));}catch{}}return out;}
function cloneMaterial(m){return Array.isArray(m)?m.map(x=>x?.clone?.()||x):(m?.clone?.()||m);}
function cloneNode(src){let dst;if(src.isMesh)dst=new THREE.Mesh(src.geometry?.clone?.(),cloneMaterial(src.material));else if(src.isLineSegments)dst=new THREE.LineSegments(src.geometry?.clone?.(),cloneMaterial(src.material));else if(src.isLine)dst=new THREE.Line(src.geometry?.clone?.(),cloneMaterial(src.material));else dst=new THREE.Group();dst.name=src.name;dst.position.copy(src.position);dst.quaternion.copy(src.quaternion);dst.scale.copy(src.scale);dst.visible=src.visible;dst.userData=cleanData(src.userData);src.children.forEach(c=>dst.add(cloneNode(c)));return dst;}
CAD.restoreOwners=root=>{if(root.userData.kind==="group"){const members=root.children.filter(c=>c.userData.kind);root.userData.members=members;members.forEach(m=>{m.userData.groupParent=root;m.traverse(c=>{if(c!==m)c.userData.owner=m;});});}else root.traverse(c=>{if(c!==root)c.userData.owner=root;});};
CAD.cloneSelectable=src=>{const c=cloneNode(src);CAD.restoreOwners(c);return c;};

CAD.addExistingObject=(o,parent=CAD.scene)=>{if(!o)return;(parent||CAD.scene).add(o);if(!CAD.objects.includes(o))CAD.objects.push(o);CAD.restoreOwners(o);CAD.updateDataFromTransform?.(o);};
CAD.removeExistingObject=o=>{if(!o)return;CAD.removeObject(o);o.parent?.remove(o);};
CAD.pushAddCommand=(o,label="객체 추가")=>{if(!o)return;CAD.pushCommand({label,undo:()=>{if(CAD.selected===o)CAD.clearSelection?.();CAD.removeExistingObject(o);},redo:()=>{CAD.addExistingObject(o);CAD.selectObject?.(o);}});};
CAD.deleteWithHistory=o=>{if(!o||o.userData.locked)return;const parent=o.parent||CAD.scene;CAD.clearSelection?.();CAD.removeExistingObject(o);CAD.pushCommand({label:"객체 삭제",undo:()=>{CAD.addExistingObject(o,parent);CAD.selectObject?.(o);},redo:()=>{if(CAD.selected===o)CAD.clearSelection?.();CAD.removeExistingObject(o);}});};

CAD.copySelection=()=>{let src=CAD.multiSelected?.length>1?CAD.multiSelected:(CAD.selected?[CAD.selected]:[]);src=src.filter(o=>o&&!o.userData.locked);if(!src.length)return;CAD.clipboard=src.map(o=>CAD.cloneSelectable(o));CAD.setHistoryStatus(`복사: ${src.length}개 객체`);};
CAD.pasteClipboard=()=>{if(!CAD.clipboard.length)return;const pasted=CAD.clipboard.map(t=>{const c=CAD.cloneSelectable(t);c.position.x+=20;c.position.z+=20;c.userData.name=(c.userData.name||"객체")+" 복사";CAD.addExistingObject(c);return c;});CAD.pushCommand({label:"붙여넣기",undo:()=>{pasted.forEach(o=>CAD.removeExistingObject(o));CAD.clearSelection?.();},redo:()=>{pasted.forEach(o=>CAD.addExistingObject(o));if(pasted.length===1)CAD.selectObject?.(pasted[0]);}});if(pasted.length===1)CAD.selectObject?.(pasted[0]);else{CAD.multiSelected=pasted;CAD.showMultiSelection?.();}CAD.setHistoryStatus(`붙여넣기: ${pasted.length}개 객체`);};
CAD.duplicateSelection=()=>{CAD.copySelection();CAD.pasteClipboard();};
