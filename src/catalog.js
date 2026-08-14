import {CAD} from "./core.js";

const $=CAD.$;
const drawer=$("objectLibrary"),backdrop=$("libraryBackdrop"),home=$("libraryHome"),categoryView=$("libraryCategory"),editorView=$("libraryEditor");
const backBtn=$("libraryBackBtn"),title=$("libraryTitle"),sub=$("librarySubtitle"),folderGrid=$("folderGrid"),objectGrid=$("objectGrid"),categoryTitle=$("categoryTitle"),categoryCount=$("categoryCount");
let currentCategory=null,currentEditor=null;

const categories={
  basic:{name:"기본 형상",desc:"기본 도형과 판재",items:[
    {id:"box",name:"직육면체",desc:"X·Y·Z 치수 지정",icon:"box"},
    {id:"plate",name:"판재",desc:"얇은 판 형상 프리셋",icon:"plate"}
  ]},
  caremate:{name:"CareMate 부품",desc:"프로젝트 전용 기계 부품",items:[
    {id:"bpHub",name:"BP-Hub-8",desc:"Ø25.5 · 10T · Ø8",icon:"hub"},
    {id:"customHub",name:"원형 허브",desc:"허브 치수 직접 지정",icon:"hub"}
  ]},
  import:{name:"파일 가져오기",desc:"외부 3D 객체",items:[
    {id:"stl",name:"STL 불러오기",desc:"STL 파일을 mm 단위로 배치",icon:"file"}
  ]}
};

function folderHTML(key,c){return `<button class="folder-card" data-category="${key}" type="button"><div class="folder-icon"></div><b>${c.name}</b><small>${c.desc}<br>${c.items.length}개 객체</small></button>`;}
function itemHTML(i){return `<button class="object-card" data-item="${i.id}" type="button"><div class="object-thumb"><div class="shape-${i.icon}"></div></div><b>${i.name}</b><small>${i.desc}</small></button>`;}
function renderFolders(){folderGrid.innerHTML=Object.entries(categories).map(([k,c])=>folderHTML(k,c)).join("");folderGrid.querySelectorAll("[data-category]").forEach(b=>b.addEventListener("click",()=>showCategory(b.dataset.category)));}
function renderItems(key){const c=categories[key];objectGrid.innerHTML=c.items.map(itemHTML).join("");categoryTitle.textContent=c.name;categoryCount.textContent=`${c.items.length}개 객체 · 2열 보기`;objectGrid.querySelectorAll("[data-item]").forEach(b=>b.addEventListener("click",()=>openItem(b.dataset.item)));}

function setHead(t,s,back=false){title.textContent=t;sub.textContent=s;backBtn.classList.toggle("hidden",!back);}
function showHome(){currentCategory=null;currentEditor=null;home.style.display="block";categoryView.style.display="none";editorView.classList.remove("active");setHead("객체 추가","대분류 폴더에서 객체 종류를 선택하세요",false);}
function showCategory(key){currentCategory=key;currentEditor=null;home.style.display="none";categoryView.style.display="block";editorView.classList.remove("active");renderItems(key);const c=categories[key];setHead(c.name,c.desc,true);}
function showEditor(type,label){currentEditor=type;home.style.display="none";categoryView.style.display="none";editorView.classList.add("active");$("boxEditor").style.display=type==="box"?"block":"none";$("hubEditor").style.display=type==="hub"?"block":"none";$("editorTitleText").textContent=label;setHead(label,"치수와 배치 값을 확인한 뒤 추가하세요",true);}

function setBoxPreset(name,sx,sy,sz){$("boxName").value=name;$("boxSX").value=sx;$("boxSY").value=sy;$("boxSZ").value=sz;$("boxX").value=(CAD.SX/2).toFixed(1);$("boxY").value=(CAD.SY/2).toFixed(1);$("boxZ").value=(sz/2).toFixed(1);}
function setHubPreset(name,od,t,bore,pcd){$("hubName").value=name;$("hubOD").value=od;$("hubT").value=t;$("hubBore").value=bore;$("hubPCD").value=pcd;$("hubAxis").value="X";$("hubX").value=(CAD.SX/2).toFixed(1);$("hubY").value=(CAD.SY/2).toFixed(1);const fh=+$("frameH")?.value||250;$("hubZ").value=(fh+50).toFixed(1);}

function openItem(id){
  if(id==="box"){setBoxPreset("직육면체",500,300,100);showEditor("box","직육면체 추가");}
  else if(id==="plate"){setBoxPreset("판재",500,500,15);showEditor("box","판재 추가");}
  else if(id==="bpHub"){setHubPreset("BP-Hub-8",25.5,10,8,20);showEditor("hub","BP-Hub-8 추가");}
  else if(id==="customHub"){setHubPreset("원형 허브",30,10,8,20);showEditor("hub","원형 허브 추가");}
  else if(id==="stl"){$("stlInput").click();}
}

function openLibrary(){drawer.classList.add("open");backdrop.classList.add("open");showHome();}
function closeLibrary(){drawer.classList.remove("open");backdrop.classList.remove("open");}

$("objectLibraryBtn").addEventListener("click",openLibrary);
$("libraryCloseBtn").addEventListener("click",closeLibrary);
backdrop.addEventListener("click",closeLibrary);
backBtn.addEventListener("click",()=>{if(currentEditor&&currentCategory)showCategory(currentCategory);else showHome();});
$("addBox").addEventListener("click",()=>setTimeout(closeLibrary,30));
$("addHub").addEventListener("click",()=>setTimeout(closeLibrary,30));
$("stlInput").addEventListener("change",()=>{if($("stlInput").files?.length)setTimeout(closeLibrary,60);});
window.addEventListener("keydown",e=>{if(e.key==="Escape"&&drawer.classList.contains("open")){closeLibrary();e.stopPropagation();}});

renderFolders();showHome();
