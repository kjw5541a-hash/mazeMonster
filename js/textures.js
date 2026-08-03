import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

// ── DUNGEON TEXTURES ──
// 모든 좌표·크기·반복 횟수는 256px 기준으로 작성한 뒤 s=size/256 을 곱한다.
// 그냥 캔버스 크기만 바꾸면 128에서는 벽돌이 2×4개만 나오고, 바닥 타일 좌표(최대 256)가
// 캔버스 밖으로 넘어가 타일링 이음새에 빈 영역이 드러난다.
export function finishTex(t,rep,aniso){
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.anisotropy=aniso;
  if(rep)t.repeat.set(rep,rep);
  return t;
}

// 잘라낸 돌벽돌(cut stone) — 줄눈 + 이끼 얼룩 + 거친 표면
export function makeDungeonWall(size,aniso){
  const w=size,h=size,s=size/256,px=Math.max(1,s);
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const ctx=c.getContext('2d');

  // 기본 돌 색상 (청회색 계열)
  ctx.fillStyle='#2e3340';ctx.fillRect(0,0,w,h);

  // 벽돌 블록 패턴
  const bW=64*s,bH=32*s; // 벽돌 크기
  for(let row=0;row<Math.ceil(h/bH)+1;row++){
    const offset=(row%2)*bW/2;
    for(let col=-1;col<Math.ceil(w/bW)+1;col++){
      const x=col*bW+offset,y=row*bH;
      // 각 벽돌 색 미세 변화
      const v=Math.floor(Math.random()*18-9);
      const r=46+v,g=51+v,b=64+v;
      ctx.fillStyle=`rgb(${r},${g},${b})`;
      ctx.fillRect(x+px,y+px,bW-2*px,bH-2*px);
      // 벽돌 내부 음영 (입체감)
      ctx.fillStyle='rgba(0,0,0,0.18)';
      ctx.fillRect(x+px,y+bH-4*s,bW-2*px,Math.max(1,3*s));
      ctx.fillStyle='rgba(255,255,255,0.04)';
      ctx.fillRect(x+px,y+px,bW-2*px,Math.max(1,3*s));
    }
  }
  // 줄눈 (mortar lines) — 어두운 회색
  ctx.strokeStyle='#141820';ctx.lineWidth=Math.max(1,2*s);
  for(let row=0;row<Math.ceil(h/bH)+1;row++){
    const offset=(row%2)*bW/2;
    // 가로줄
    ctx.beginPath();ctx.moveTo(0,row*bH);ctx.lineTo(w,row*bH);ctx.stroke();
    // 세로줄
    for(let col=-1;col<Math.ceil(w/bW)+2;col++){
      ctx.beginPath();ctx.moveTo(col*bW+offset,row*bH);ctx.lineTo(col*bW+offset,(row+1)*bH);ctx.stroke();
    }
  }
  // 이끼/얼룩 (하단부 집중) — 개수는 면적에 비례
  const moss=Math.max(12,Math.round(60*s*s));
  for(let i=0;i<moss;i++){
    const x=Math.random()*w,y=h*0.4+Math.random()*h*0.6;
    const r2=(3+Math.random()*10)*s;
    const gr=ctx.createRadialGradient(x,y,0,x,y,r2);
    gr.addColorStop(0,'rgba(30,55,25,0.45)');gr.addColorStop(1,'transparent');
    ctx.fillStyle=gr;ctx.beginPath();ctx.arc(x,y,r2,0,Math.PI*2);ctx.fill();
  }
  // 습기 얼룩 (세로 방향)
  for(let i=0;i<8;i++){
    const x=Math.random()*w;
    ctx.fillStyle='rgba(10,15,30,0.22)';
    ctx.fillRect(x,Math.random()*h*0.5,(2+Math.random()*3)*s,h*0.4+Math.random()*h*0.3);
  }
  return finishTex(new THREE.CanvasTexture(c),1,aniso);
}

export function makeDungeonFloor(size,aniso){
  const w=size,h=size,s=size/256,px=Math.max(1,s);
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#1a1c22';ctx.fillRect(0,0,w,h);
  // 석판 패턴 (불규칙한 사각형) — 256px 기준 좌표에 s를 곱해 사용
  const tiles=[[0,0,48,48],[48,0,40,48],[88,0,56,48],[144,0,50,48],[194,0,62,48],
               [0,48,62,44],[62,48,44,44],[106,48,58,44],[164,48,48,44],[212,48,44,44]];
  for(const[tx0,ty0,tw0,th0] of tiles){
    const tx=tx0*s,ty=ty0*s,tw=tw0*s,th=th0*s;
    const v=Math.floor(Math.random()*12);
    ctx.fillStyle=`rgb(${32+v},${35+v},${44+v})`;
    ctx.fillRect(tx+px,ty+px,tw-2*px,th-2*px);
    ctx.fillStyle='rgba(0,0,0,0.3)';
    ctx.fillRect(tx+px,ty+th-3*s,tw-2*px,Math.max(1,2*s));
  }
  // 줄눈
  ctx.strokeStyle='#0e1016';ctx.lineWidth=Math.max(1,2*s);
  for(let x=0;x<w;x+=48*s){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  for(let y=0;y<h;y+=48*s){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  // 이끼/물때
  const moss=Math.max(8,Math.round(40*s*s));
  for(let i=0;i<moss;i++){
    const x=Math.random()*w,y=Math.random()*h,r=(2+Math.random()*7)*s;
    const gr=ctx.createRadialGradient(x,y,0,x,y,r);
    gr.addColorStop(0,'rgba(20,40,18,0.4)');gr.addColorStop(1,'transparent');
    ctx.fillStyle=gr;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }
  return finishTex(new THREE.CanvasTexture(c),3,aniso);
}

export function makeDungeonCeil(size,aniso){
  const w=size,h=size,s=size/256;
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#111318';ctx.fillRect(0,0,w,h);
  // 거친 돌 천장 — 불규칙 균열
  const blobs=Math.max(40,Math.round(200*s*s));
  for(let i=0;i<blobs;i++){
    const x=Math.random()*w,y=Math.random()*h,r=(1+Math.random()*6)*s;
    const gr=ctx.createRadialGradient(x,y,0,x,y,r);
    gr.addColorStop(0,'rgba(0,0,0,0.35)');gr.addColorStop(1,'transparent');
    ctx.fillStyle=gr;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }
  ctx.strokeStyle='rgba(0,0,0,0.25)';
  const cracks=Math.max(4,Math.round(14*s*s));
  for(let i=0;i<cracks;i++){
    ctx.lineWidth=(.5+Math.random()*1.2)*s;ctx.beginPath();
    let cx=Math.random()*w,cy=Math.random()*h;ctx.moveTo(cx,cy);
    for(let j=0;j<5;j++){cx+=(Math.random()*20-10)*s;cy+=(Math.random()*20-10)*s;ctx.lineTo(cx,cy);}
    ctx.stroke();
  }
  return finishTex(new THREE.CanvasTexture(c),0,aniso);
}

// 몬스터 살갗 — 붕대가 감긴 표면. 사지 메시에 타일링해 입히므로 세로로 반복 가능해야 한다.
// (전신을 한 장에 그린 이전 방식은 평면 빌보드 전용이라 관절 구조로 바꾸면서 폐기)
export function makeFleshTex(size,aniso){
  const s=size/256,w=size,h=size;
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const ctx=c.getContext('2d');
  const base=ctx.createLinearGradient(0,0,0,h);
  base.addColorStop(0,'#9c9484');base.addColorStop(.5,'#7e7869');base.addColorStop(1,'#8f8878');
  ctx.fillStyle=base;ctx.fillRect(0,0,w,h);
  // 붕대 — 비스듬히 감긴 띠. 위아래 끝을 맞춰야 이음새가 안 보인다
  const bands=Math.max(6,Math.round(14*s));
  for(let i=0;i<bands;i++){
    const y=i*(h/bands);
    ctx.fillStyle=`rgba(226,220,203,${.06+Math.random()*.16})`;
    ctx.fillRect(0,y,w,(h/bands)*(.35+Math.random()*.4));
    ctx.strokeStyle='rgba(48,42,36,0.28)';ctx.lineWidth=Math.max(1,1.4*s);
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y+2*s);ctx.stroke();
  }
  // 얼룩
  const spots=Math.max(10,Math.round(30*s*s));
  for(let i=0;i<spots;i++){
    const x=Math.random()*w,y=Math.random()*h,r=(4+Math.random()*12)*s;
    const gr=ctx.createRadialGradient(x,y,0,x,y,r);
    gr.addColorStop(0,'rgba(40,26,20,0.42)');gr.addColorStop(1,'transparent');
    ctx.fillStyle=gr;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }
  return finishTex(new THREE.CanvasTexture(c),1,aniso);
}

