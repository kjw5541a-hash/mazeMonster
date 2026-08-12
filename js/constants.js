// 게임 밸런스·치수 상수. 품질 설정으로 바뀌면 안 되는 값들이다.
// ── CONSTANTS ──
export const CELL=2.0,WALL_H=2.6;
// 미로 크기는 레벨마다 커진다. 재귀 백트래킹은 홀수 크기를 전제하므로 증가폭도 짝수여야 한다
// (25 → 29 → 33 → 37 → 41). MW/MH가 상수가 아니게 되었으므로 배열은 최대 크기로 잡는다.
export const MAZE_MIN=25,MAZE_MAX=41,MAZE_STEP=4;
export const mazeSizeFor=lv=>Math.min(MAZE_MAX,MAZE_MIN+(lv-1)*MAZE_STEP);
export const PLAYER_R=0.32,PLAYER_SPD=4.5,TURN_SPD=2.6,ACCEL=16,FRIC=11;
// 1층/2층 구조 — 마릿수는 층별로 다르다. 1층=스테이지 번호, 2층=스테이지+1(크롤러 1마리 고정 포함).
export const FLOOR_MON_COUNT=(stage,floor)=>floor===1?stage:stage+1;
export const FLOOR_CRAWLER_COUNT=(stage,floor)=>floor===1?0:1;
export const MON_BASE_SPD=2.2,MON_SPD_INC=0.12;
export const MON_SIGHT_R=8,MON_HEAR_R=4,MON_KILL_R=0.7;
export const KEY_PICK_R=0.75;   // 열쇠 획득 반경
// 발각 직후의 돌진 — 이 세 값이 "달려든다"는 체감을 좌우한다. 난이도에 직결되므로
// 사용자가 직접 플레이하며 조정할 값이다. 임의로 올리지 말 것.
export const CHARGE_TIME=1.5,CHARGE_BOOST=1.35;
export const SNARL_MIN=1.1,SNARL_VAR=0.9;   // 추격 중 으르렁 간격(초)
