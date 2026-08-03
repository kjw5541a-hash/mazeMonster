// 미로 생성과 경로 탐색.
// BFS/LOS는 mazeGrid·MW·MH를 인자로 받는다 — 이 상태는 매 레벨 바뀌고 main이 소유하므로,
// 모듈이 따로 들고 있으면 동기화가 어긋날 수 있다.
import { MAZE_MAX } from './constants.js';

// ── MAZE GENERATOR (loop maze) ──
export function generateMaze(W,H){
  const g=Array.from({length:H},()=>new Array(W).fill(0));
  const sh=a=>{for(let i=a.length-1;i>0;i--){const j=0|Math.random()*(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
  function carve(x,y){
    g[y][x]=1;
    for(const[dx,dy]of sh([[0,-2],[0,2],[-2,0],[2,0]])){
      const nx=x+dx,ny=y+dy;
      if(ny>=0&&ny<H&&nx>=0&&nx<W&&g[ny][nx]===0){g[y+dy/2][x+dx/2]=1;carve(nx,ny);}
    }
  }
  carve(1,1);   // (1,1)에서 시작하면 홀수 좌표 칸이 모두 뚫린다
  // Add loops: remove 18% of interior walls that border 2+ paths
  const walls=[];
  for(let r=1;r<H-1;r++)for(let c=1;c<W-1;c++)if(g[r][c]===0)walls.push([c,r]);
  sh(walls);
  const rem=Math.floor(walls.length*0.18);
  for(let i=0;i<rem;i++){
    const[c,r]=walls[i];
    const n=[[0,-1],[0,1],[-1,0],[1,0]].filter(([dc,dr])=>g[r+dr]&&g[r+dr][c+dc]===1).length;
    if(n>=2)g[r][c]=1;
  }
  return g;
}

// ── BFS ──
// BFS용 버퍼를 전역에서 1회만 할당하고 재사용 — 매 호출마다 GC 압박 유발하던 재할당 제거
const _bfsVis=new Uint8Array(MAZE_MAX*MAZE_MAX);
const _bfsPar=new Int16Array(MAZE_MAX*MAZE_MAX);
const _bfsQx=new Int16Array(MAZE_MAX*MAZE_MAX); // 큐를 배열 push/shift 대신 순환 버퍼로 처리 (shift()의 O(n) 비용 제거)
const _bfsQz=new Int16Array(MAZE_MAX*MAZE_MAX);
const _bfsDist=new Int16Array(MAZE_MAX*MAZE_MAX);

// 시작 칸에서 모든 길 칸까지의 실제 이동 거리(칸 수). 시작·출구·몬스터 배치에 쓴다.
// 직선거리로 재면 벽 때문에 실제로는 코앞인 지점이 멀어 보인다.
export function bfsDistances(g,MW,MH,sx,sz){
  _bfsDist.fill(-1);
  const idx=(x,z)=>z*MW+x;
  let qHead=0,qTail=0;
  _bfsQx[qTail]=sx;_bfsQz[qTail]=sz;qTail++;
  _bfsDist[idx(sx,sz)]=0;
  while(qHead<qTail){
    const cx=_bfsQx[qHead],cz=_bfsQz[qHead];qHead++;
    const d=_bfsDist[idx(cx,cz)];
    for(const[dx,dz]of[[0,-1],[0,1],[-1,0],[1,0]]){
      const nx=cx+dx,nz=cz+dz;
      if(nx<0||nz<0||nx>=MW||nz>=MH||g[nz][nx]===0)continue;
      if(_bfsDist[idx(nx,nz)]!==-1)continue;
      _bfsDist[idx(nx,nz)]=d+1;
      _bfsQx[qTail]=nx;_bfsQz[qTail]=nz;qTail++;
    }
  }
  return _bfsDist;
}

export function bfsNext(g,MW,MH,sx,sz,tx,tz){
  if(sx===tx&&sz===tz)return null;
  if(!Number.isFinite(sx)||!Number.isFinite(sz)||!Number.isFinite(tx)||!Number.isFinite(tz))return null;
  if(sx<0||sz<0||sx>=MW||sz>=MH||tx<0||tz<0||tx>=MW||tz>=MH)return null;
  if(g[sz][sx]===0||g[tz][tx]===0)return null;

  _bfsVis.fill(0); _bfsPar.fill(-1);
  const idx=(x,z)=>z*MW+x;
  const startIdx=idx(sx,sz);
  let qHead=0, qTail=0;
  _bfsQx[qTail]=sx; _bfsQz[qTail]=sz; qTail++;
  _bfsVis[startIdx]=1;
  let found=false;
  outer:while(qHead<qTail){
    const cx=_bfsQx[qHead], cz=_bfsQz[qHead]; qHead++;
    for(const[dx,dz]of[[0,-1],[0,1],[-1,0],[1,0]]){
      const nx=cx+dx,nz=cz+dz;
      if(nx<0||nz<0||nx>=MW||nz>=MH||g[nz][nx]===0||_bfsVis[idx(nx,nz)])continue;
      _bfsVis[idx(nx,nz)]=1;_bfsPar[idx(nx,nz)]=idx(cx,cz);
      if(nx===tx&&nz===tz){found=true;break outer;}
      _bfsQx[qTail]=nx; _bfsQz[qTail]=nz; qTail++;
    }
  }
  if(!found)return null;

  let cur=idx(tx,tz),prev=cur,guard=MW*MH+2;
  while(cur!==startIdx&&_bfsPar[cur]!==-1&&guard-->0){prev=cur;cur=_bfsPar[cur];}
  if(cur!==startIdx&&_bfsPar[cur]===-1)return null;
  const nx=prev%MW, nz=Math.floor(prev/MW);
  if(!Number.isFinite(nx)||!Number.isFinite(nz))return null;
  return[nx,nz];
}

// ── LOS ──
export function hasLOS(g,MW,MH,ax,az,bx,bz){
  const dx=bx-ax,dz=bz-az,dist=Math.max(Math.abs(dx),Math.abs(dz));
  if(dist===0)return true;
  const steps=Math.ceil(dist*6),sx=dx/steps,sz=dz/steps;
  let cx=ax,cz=az;
  for(let i=0;i<steps;i++){
    cx+=sx;cz+=sz;
    const igx=Math.round(cx),igz=Math.round(cz);
    if(igx===bx&&igz===bz)return true;
    if(igx<0||igz<0||igx>=MW||igz>=MH||g[igz][igx]===0)return false;
  }
  return true;
}

