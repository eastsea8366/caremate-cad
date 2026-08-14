import * as THREE from "three";
import {CAD} from "./core.js";

// CAD식 마우스 역할 분리
// 왼쪽 버튼은 객체 선택/박스 선택 전용으로 사용하고 OrbitControls가 가져가지 않게 한다.
CAD.orbit.mouseButtons.LEFT = null;
CAD.orbit.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
CAD.orbit.mouseButtons.RIGHT = THREE.MOUSE.PAN;

// 휠은 OrbitControls 기본 줌을 유지한다.
CAD.orbit.enableZoom = true;

// 브라우저 기본 우클릭 메뉴가 CAD 조작 중 방해하지 않도록 뷰포트에서만 막는다.
CAD.renderer.domElement.addEventListener("contextmenu", e => e.preventDefault());

// 화면 안내 문구도 실제 조작 방식에 맞춰 갱신한다.
const help = CAD.$("help");
if (help) {
  help.innerHTML = [
    "<b>왼쪽 클릭</b>: 객체 선택",
    "<b>왼쪽 드래그</b>: 박스 다중 선택",
    "<b>가운데 드래그</b>: 화면 회전",
    "<b>오른쪽 드래그</b>: 화면 이동",
    "<b>휠</b>: 확대/축소",
    "<b>Shift+드래그</b>: 기존 선택에 추가"
  ].join("<br>");
}
