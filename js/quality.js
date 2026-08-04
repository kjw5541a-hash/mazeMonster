// ── QUALITY PRESETS ──
// 설계 원칙
//  1) 광원 개수 / 텍스처 해상도 / 재질 타입 / antialias 는 "부팅 시점 상수"로 취급한다.
//     antialias는 WebGL 컨텍스트 생성 파라미터라 런타임 변경이 불가능하고, 나머지도 전면
//     재생성이 필요하다. 따라서 프리셋 변경은 localStorage 저장 후 reload로만 적용한다.
//  2) 런타임에 움직이는 축은 renderScale 하나뿐. 해상도만 건드리므로 셰이더 재컴파일이 없다.
//     (적응형 자동 조절이 광원을 만지면 hitching이 발생한다 — 절대 금지)
//  3) 게임 밸런스 값(fog 밀도, 몬스터 시야·청각·속도)은 프리셋에 넣지 않는다.
//     품질 설정으로 난이도가 달라지면 안 된다.
//
// 총 광원 수 = ambient 1 + 천장등 N + 출구 1
//   LOW 4 / MEDIUM 5 / HIGH 6 / ULTRA 8
// (몬스터 눈 광원은 백룸 개체가 눈 없는 검은 실루엣이 되면서 사라졌다)
// ambient / panelRange / panelPower는 광원 "개수"를 늘리지 않고 밝기를 보정하는 축이다.
// AmbientLight는 픽셀당 광원 순회에 들어가지 않고, PointLight의 distance·intensity는
// 순회 횟수를 바꾸지 않으므로 셋 다 사실상 공짜다.
//
// 백룸에서는 ambient의 역할이 던전 때와 정반대다. 던전에서는 "횃불 사이가 캄캄해지는 것을
// 막는 보정값"이었지만, 여기서는 천장등이 없는 어두운 구역의 밝기를 "단독으로" 결정한다.
// 그리고 어두운 구역은 장식이 아니라 게임플레이다 — 검은 몬스터가 거기서 안 보인다.
//
// ★ 그래서 ambient는 프리셋 전부 같은 값이어야 한다. 프리셋마다 다르게 두면 LOW에서만
//   어두운 구역이 훤해져 몬스터가 보이고, 품질 설정이 난이도를 바꾸게 된다(원칙 3 위반).
//   실측으로 확인한 실패 사례: ambient를 1.18/1.10으로 두자 어두운 구역이 LOW 90 / HIGH 75가
//   되어 명암 대비가 1.35배 대 1.83배로 갈렸다.
// 광원이 적은 프리셋의 보정은 panelRange/panelPower로 한다 — 이 둘은 "밝은 구역"에만
// 영향을 주므로 어두운 구역의 밝기를 건드리지 않는다.
// panelRange는 감쇠 "모양"을 정한다 — 프리셋마다 다르면 복도 중간 구간의 밝기가 갈린다
// (실측: range 8.8 대 7.2에서 중간 구간이 88 대 46). 모양은 통일하고, 광원 개수가 적은
// 프리셋은 panelPower로만 보정한다.
const AMBIENT=0.78, PRANGE=7.2;
export const QUALITY_PRESETS={
  LOW:   {label:'LOW',  prCap:1.0,scale:0.6,panelLights:2,texSize:128,aniso:1,aa:false,matType:'phong',   panelInterval:0.20,mmInterval:8,panning:'equalpower',targetFps:30,ambient:AMBIENT,panelRange:PRANGE,panelPower:1.42},
  MEDIUM:{label:'MED',  prCap:1.5,scale:0.8,panelLights:3,texSize:256,aniso:1,aa:false,matType:'phong',   panelInterval:0.15,mmInterval:6,panning:'HRTF',      targetFps:55,ambient:AMBIENT,panelRange:PRANGE,panelPower:1.15},
  HIGH:  {label:'HIGH', prCap:2.0,scale:1.0,panelLights:4,texSize:256,aniso:4,aa:true, matType:'standard',panelInterval:0.12,mmInterval:4,panning:'HRTF',      targetFps:55,ambient:AMBIENT,panelRange:PRANGE,panelPower:1.00},
  ULTRA: {label:'ULTRA',prCap:3.0,scale:1.0,panelLights:6,texSize:512,aniso:0,aa:true, matType:'standard',panelInterval:0.10,mmInterval:4,panning:'HRTF',      targetFps:60,ambient:AMBIENT,panelRange:PRANGE,panelPower:1.00},
};
export const QKEY='de_quality';
export const isMobile=/iPhone|iPad|Android/i.test(navigator.userAgent);

// iOS Safari는 deviceMemory를 노출하지 않고 hardwareConcurrency도 대부분 4로 보고한다.
// 따라서 모바일에서 `cores<=4`를 LOW 조건으로 쓰면 최신 아이폰까지 전부 LOW로 떨어진다.
// 모바일은 확실히 낮은 신호(코어 2개 이하 또는 메모리 2GB 이하)일 때만 LOW로 보낸다.
export function detectQuality(){
  const cores=navigator.hardwareConcurrency||4;
  const mem=navigator.deviceMemory;                    // 미지원이면 undefined
  if(isMobile) return (cores<=2||mem<=2)?'LOW':'MEDIUM';
  return (cores<=4||(mem!==undefined&&mem<=4))?'MEDIUM':'HIGH';
}
export function loadQualityName(){
  let n=null;
  try{n=localStorage.getItem(QKEY);}catch(_){}
  return QUALITY_PRESETS[n]?n:detectQuality();
}
export const QNAME=loadQualityName();
export const Q=QUALITY_PRESETS[QNAME];

