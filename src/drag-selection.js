import * as THREE from "three";
import {CAD} from "./core.js";

// 왼쪽 마우스는 CAD 선택 전용:
// 클릭 = 단일 선택 / 드래그 = 박스 다중 선택.
// 드래그 시작점이 객체 위여도 박스 선택으로 전환된다.

queueMicrotask(()=>{
  const el=CAD.renderer?.domElement;
  if(!el||!CAD.marquee)return;

  let drag=null;

  const localPoint=e=>{
    const r=el.getBoundingClientRect();
    return {x:e.clientX-r.left,y:e.clientY-r.top};
  };

  const setMarquee=(a,b)=>{
    const left=Math.min(a.x,b.x),top=Math.min(a.y,b.y);
    const w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y);
    const crossing=b.x<a.x;
    Object.assign(CAD.marquee.style,{
      display:"block",left:left+"px",top:top+"px",width:w+"px",height:h+"px"
    });
    CAD.marquee.classList.toggle("crossing",crossing);
    CAD.$("status").textContent=crossing
      ?"교차 선택: 걸친 객체 포함"
      :"창 선택: 완전히 들어온 객체만";
  };

  const hideMarquee=()=>{
    CAD.marquee.style.display="none";
    CAD.marquee.classList.remove("crossing");
  };

  const screenRectForObject=o=>{
    const box=new THREE.Box3().setFromObject(o);
    if(box.isEmpty())return null;
    const min=box.min,max=box.max;
    const corners=[
      [min.x,min.y,min.z],[max.x,min.y,min.z],[min.x,max.y,min.z],[max.x,max.y,min.z],
      [min.x,min.y,max.z],[max.x,min.y,max.z],[min.x,max.y,max.z],[max.x,max.y,max.z]
    ];
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity,visible=false;
    const w=el.clientWidth,h=el.clientHeight;
    for(const c of corners){
      const p=new THREE.Vector3(...c).project(CAD.camera);
      if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
      const x=(p.x+1)*.5*w,y=(1-p.y)*.5*h;
      x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
      if(p.z>=-1&&p.z<=1)visible=true;
    }
    return visible?{x0,y0,x1,y1}:null;
  };

  const candidates=()=>{
    const out=[],seen=new Set();
    for(const raw of CAD.objects||[]){
      const o=CAD.topSelectable?.(raw)||raw;
      if(!o||o.userData?.locked||seen.has(o))continue;
      seen.add(o);out.push(o);
    }
    return out;
  };

  const finishMarquee=(start,end,base,additive)=>{
    const crossing=end.x<start.x;
    const s={
      x0:Math.min(start.x,end.x),x1:Math.max(start.x,end.x),
      y0:Math.min(start.y,end.y),y1:Math.max(start.y,end.y)
    };
    const hit=candidates().filter(o=>{
      const r=screenRectForObject(o);if(!r)return false;
      return crossing
        ?(r.x1>=s.x0&&r.x0<=s.x1&&r.y1>=s.y0&&r.y0<=s.y1)
        :(r.x0>=s.x0&&r.x1<=s.x1&&r.y0>=s.y0&&r.y1<=s.y1);
    });
    const result=additive?[...new Set([...(base||[]),...hit])]:hit;
    CAD.releaseSelectionPivot?.();
    CAD.multiSelected=result;
    if(result.length>1)CAD.showMultiSelection?.();
    else if(result.length===1)CAD.selectObject?.(result[0],true);
    else CAD.clearSelection?.();
    CAD.$("status").textContent=`드래그 선택: ${result.length}개`;
  };

  // 캡처 단계에서 기존 왼쪽 클릭/드래그 이벤트보다 먼저 처리한다.
  el.addEventListener("pointerdown",e=>{
    if(e.button!==0||CAD.measuring||CAD.transforming)return;
    // 이동/회전 기즈모를 잡은 경우 TransformControls에 넘긴다.
    if(CAD.transform?.axis)return;

    const start=localPoint(e);
    drag={
      pointerId:e.pointerId,
      start,
      last:start,
      moved:false,
      shift:e.shiftKey,
      picked:CAD.pickObject?.(e)||null,
      base:e.shiftKey?[...(CAD.multiSelected||[])]:[]
    };
    CAD.orbit.enabled=false;
    try{el.setPointerCapture(e.pointerId);}catch{}
    e.preventDefault();
    e.stopImmediatePropagation();
  },true);

  el.addEventListener("pointermove",e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;
    const p=localPoint(e);drag.last=p;
    const d=Math.hypot(p.x-drag.start.x,p.y-drag.start.y);
    if(d>5){
      drag.moved=true;
      setMarquee(drag.start,p);
    }
    const gp=CAD.groundPoint?.(e);
    if(gp){
      const u=CAD.worldToUser(gp);
      CAD.$("pointerStatus").textContent=`포인터: X ${u.x.toFixed(0)}, Y ${u.y.toFixed(0)}, Z 0 mm`;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
  },true);

  const finish=e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;
    const d=drag;drag=null;
    try{el.releasePointerCapture(e.pointerId);}catch{}
    CAD.orbit.enabled=true;

    if(d.moved){
      finishMarquee(d.start,d.last,d.base,d.shift);
    }else if(d.shift){
      if(d.picked)CAD.toggleMultiObject?.(d.picked);
    }else{
      CAD.selectObject?.(d.picked||null);
    }
    hideMarquee();
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  el.addEventListener("pointerup",finish,true);
  el.addEventListener("pointercancel",e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;
    drag=null;hideMarquee();CAD.orbit.enabled=true;
  },true);
});
