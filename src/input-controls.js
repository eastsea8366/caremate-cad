import * as THREE from "three";
import {CAD} from "./core.js";
import "./drag-selection.js";

// CAD식 마우스 역할 분리
// 왼쪽 버튼 = 객체 선택 / 박스 선택 전용
// 가운데(휠) 버튼 누른 채 드래그 = 화면 회전
// 오른쪽 버튼 드래그 = 화면 이동
CAD.orbit.mouseButtons.LEFT = null;
CAD.orbit.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
CAD.orbit.mouseButtons.RIGHT = THREE.MOUSE.PAN;
CAD.orbit.enableZoom = true;

CAD.renderer.domElement.addEventListener("contextmenu", e => e.preventDefault());

const help = CAD.$("help");
if (help) {
  help.innerHTML = [
    "<b>왼쪽 클릭</b>: 객체 선택",
    "<b>왼쪽 드래그</b>: 박스 다중 선택",
    "<b>가운데(휠) 드래그</b>: 화면 회전",
    "<b>오른쪽 드래그</b>: 화면 이동",
    "<b>휠 회전</b>: 확대/축소",
    "<b>Shift+드래그</b>: 기존 선택에 추가"
  ].join("<br>");
}
