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
// 총 광원 수 = ambient 1 + 횃불 N + 몬스터 눈 M + 출구 1
//   LOW 5 / MEDIUM 6 / HIGH 9 / ULTRA 11
// ambient / torchRange / torchPower는 광원 "개수"를 늘리지 않고 밝기를 보정하는 축이다.
// AmbientLight는 픽셀당 광원 순회에 들어가지 않고, PointLight의 distance·intensity는
// 순회 횟수를 바꾸지 않으므로 셋 다 사실상 공짜다. 광원이 적은 프리셋일수록 이 값을 올려
// 횃불 사이 구간이 캄캄해지는 것을 막는다.
export const QUALITY_PRESETS={
  LOW:   {label:'LOW',  prCap:1.0,scale:0.6,torchLights:2,monLights:1,texSize:128,aniso:1,aa:false,matType:'phong',   torchInterval:0.20,mmInterval:8,panning:'equalpower',targetFps:30,ambient:3.6,torchRange:8.5,torchPower:1.10},
  MEDIUM:{label:'MED',  prCap:1.5,scale:0.8,torchLights:3,monLights:1,texSize:256,aniso:1,aa:false,matType:'phong',   torchInterval:0.15,mmInterval:6,panning:'HRTF',      targetFps:55,ambient:3.4,torchRange:7.8, torchPower:1.05},
  HIGH:  {label:'HIGH', prCap:2.0,scale:1.0,torchLights:4,monLights:3,texSize:256,aniso:4,aa:true, matType:'standard',torchInterval:0.12,mmInterval:4,panning:'HRTF',      targetFps:55,ambient:3.2,torchRange:7.0, torchPower:1.00},
  ULTRA: {label:'ULTRA',prCap:3.0,scale:1.0,torchLights:6,monLights:3,texSize:512,aniso:0,aa:true, matType:'standard',torchInterval:0.10,mmInterval:4,panning:'HRTF',      targetFps:60,ambient:3.2,torchRange:7.0, torchPower:1.00},
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

