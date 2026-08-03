// 진행 저장 — localStorage.
// 평생 기록(최고 레벨·누적 탈출)과, 현재 진행 중인 레벨을 함께 남긴다.
// 후자가 있어야 사망·승리 화면에서 품질을 바꿔도(= 페이지 리로드) 진행이 날아가지 않는다.
const KEY='de_progress';
const EMPTY={bestLevel:1,totalEscapes:0,resumeLevel:1};

export let progress={...EMPTY};

export function loadProgress(){
  try{
    const raw=localStorage.getItem(KEY);
    if(raw){
      const p=JSON.parse(raw);
      // 저장 형식이 바뀌었거나 손상돼도 게임이 죽지 않도록 필드별로 걸러 받는다
      progress={
        bestLevel:    Number.isFinite(p.bestLevel)    ? p.bestLevel    : 1,
        totalEscapes: Number.isFinite(p.totalEscapes) ? p.totalEscapes : 0,
        resumeLevel:  Number.isFinite(p.resumeLevel)  ? p.resumeLevel  : 1,
      };
    }
  }catch(_){ progress={...EMPTY}; }
  return progress;
}

export function saveProgress(){
  try{ localStorage.setItem(KEY,JSON.stringify(progress)); }catch(_){}
}

// 레벨에 진입할 때 — 이어하기 지점과 최고 기록을 갱신
export function markLevel(lv){
  progress.resumeLevel=lv;
  if(lv>progress.bestLevel) progress.bestLevel=lv;
  saveProgress();
}
// 탈출 성공 — 누적 횟수를 올리고, 이어할 지점을 다음 레벨로 옮긴다.
// 이걸 안 하면 승리 화면에서 품질을 바꿨을 때(=리로드) 방금 깬 레벨을 다시 하게 된다.
export function markEscape(nextLevel){
  progress.totalEscapes++;
  progress.resumeLevel=nextLevel;
  saveProgress();
}
// 처음부터 다시 — 평생 기록은 남기고 이어하기 지점만 초기화
export function resetRun(){
  progress.resumeLevel=1;
  saveProgress();
}
