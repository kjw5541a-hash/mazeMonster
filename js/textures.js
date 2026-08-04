import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

// ── BACKROOMS TEXTURES ──
// 모든 좌표·크기·반복 횟수는 256px 기준으로 작성한 뒤 s=size/256 을 곱한다.
// 그냥 캔버스 크기만 바꾸면 128에서는 무늬가 듬성듬성해지고, 256까지 채우도록 쓴 좌표가
// 캔버스 밖으로 넘어가 타일링 이음새에 빈 영역이 드러난다.
export function finishTex(t,rep,aniso){
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.anisotropy=aniso;
  if(rep)t.repeat.set(rep,rep);
  return t;
}

// 얼룩 하나. 타일링 경계에서 반쪽만 그려지면 이음새가 드러나므로,
// 가장자리에 걸치면 반대편에도 같이 그려 넘어가게 한다.
function blob(ctx,x,y,r,color,w,h){
  const draw=(bx,by)=>{
    const g=ctx.createRadialGradient(bx,by,0,bx,by,r);
    g.addColorStop(0,color);g.addColorStop(1,'transparent');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(bx,by,r,0,Math.PI*2);ctx.fill();
  };
  draw(x,y);
  if(x<r)draw(x+w,y); else if(x>w-r)draw(x-w,y);
  if(y<r)draw(x,y+h); else if(y>h-r)draw(x,y-h);
}

// 겨자색 벽지 — 백룸의 얼굴. 무늬는 "무늬"로 읽히면 안 되고 질감으로만 남아야 한다.
// 대비를 올리면 복도마다 같은 무늬가 반복되는 게 눈에 띄어 싸구려로 보인다.
export function makeWallpaper(size,aniso){
  const w=size,h=size,s=size/256;
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const ctx=c.getContext('2d');

  ctx.fillStyle='#bdae66';ctx.fillRect(0,0,w,h);

  // 은은한 세로 스트라이프
  for(let x=0;x<w;x+=16*s){
    ctx.fillStyle='rgba(255,248,214,0.05)';
    ctx.fillRect(x,0,8*s,h);
  }

  // 반복 마름모 무늬 — 32px 격자, 홀수 줄은 반 칸 밀어 엇갈리게
  const step=32*s;
  for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){
    const ox=(((y/step)|0)%2)?step/2:0;
    ctx.save();ctx.translate(x+ox,y+step/2);ctx.rotate(Math.PI/4);
    ctx.fillStyle='rgba(122,106,50,0.15)';
    ctx.fillRect(-3.5*s,-3.5*s,7*s,7*s);
    ctx.restore();
  }

  // 벽지 이음매 — 폭 1m(=128px)마다 한 줄
  ctx.fillStyle='rgba(96,84,38,0.30)';
  ctx.fillRect(0,0,Math.max(1,1.5*s),h);
  ctx.fillRect(128*s,0,Math.max(1,1.5*s),h);

  // 아래쪽 때. 캔버스 아래가 벽 아래다 (CanvasTexture는 flipY=true라 위아래가 그대로 대응)
  const gr=ctx.createLinearGradient(0,h*0.62,0,h);
  gr.addColorStop(0,'transparent');gr.addColorStop(1,'rgba(58,48,22,0.52)');
  ctx.fillStyle=gr;ctx.fillRect(0,h*0.62,w,h*0.38);

  // 물 얼룩 — 아래쪽에 몰리게
  const stains=Math.max(4,Math.round(9*s*s));
  for(let i=0;i<stains;i++)
    blob(ctx,Math.random()*w,h*0.35+Math.random()*h*0.65,(10+Math.random()*26)*s,
         'rgba(86,66,26,0.28)',w,h);

  // 미세 그레인
  const grain=Math.max(220,Math.round(900*s*s));
  for(let i=0;i<grain;i++){
    ctx.fillStyle=Math.random()<.5?'rgba(255,250,220,0.07)':'rgba(70,60,26,0.07)';
    ctx.fillRect(Math.random()*w,Math.random()*h,Math.max(1,s),Math.max(1,s));
  }
  return finishTex(new THREE.CanvasTexture(c),1,aniso);
}

// 축축한 겨자색 카펫 — 격자나 줄눈이 없어야 한다. 선이 보이면 사무실이 아니라 타일 바닥이 된다.
export function makeCarpet(size,aniso){
  const w=size,h=size,s=size/256;
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const ctx=c.getContext('2d');

  ctx.fillStyle='#6f6334';ctx.fillRect(0,0,w,h);

  // 습기 얼룩 — 섬유보다 먼저 깔아야 섬유가 위에 남는다
  const damp=Math.max(6,Math.round(22*s*s));
  for(let i=0;i<damp;i++)
    blob(ctx,Math.random()*w,Math.random()*h,(14+Math.random()*34)*s,
         Math.random()<.5?'rgba(48,42,20,0.34)':'rgba(126,114,62,0.22)',w,h);

  // 섬유 — 짧은 선을 촘촘히. 방향을 조금씩 흔들어야 결이 생긴다
  const fib=Math.max(600,Math.round(2200*s*s));
  for(let i=0;i<fib;i++){
    const x=Math.random()*w,y=Math.random()*h;
    const v=Math.floor(Math.random()*46-20);
    ctx.fillStyle=`rgba(${111+v},${99+v},${52+v},0.55)`;
    ctx.fillRect(x,y,Math.max(1,(1+Math.random()*2)*s),Math.max(1,(2+Math.random()*3)*s));
  }
  return finishTex(new THREE.CanvasTexture(c),3,aniso);
}

// 흰 텍스 천장 — 백룸에서는 천장이 조연이 아니라 주연이다.
// 3×3 격자(칸당 CELL=2m이므로 타일 한 장이 약 0.67m — 실제 아코스틱 타일 규격과 비슷)
export function makeDropCeiling(size,aniso){
  const w=size,h=size,s=size/256;
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const ctx=c.getContext('2d');

  ctx.fillStyle='#cfcbb8';ctx.fillRect(0,0,w,h);

  const n=3,tile=w/n;
  for(let ty=0;ty<n;ty++)for(let tx=0;tx<n;tx++){
    // 타일마다 살짝 다른 색 — 다 똑같으면 인쇄물처럼 보인다
    const v=Math.floor(Math.random()*14-7);
    ctx.fillStyle=`rgb(${203+v},${199+v},${181+v})`;
    ctx.fillRect(tx*tile,ty*tile,tile,tile);
    // 물 샌 자국이 있는 타일
    if(Math.random()<.22)
      blob(ctx,(tx+.2+Math.random()*.6)*tile,(ty+.2+Math.random()*.6)*tile,
           tile*(.18+Math.random()*.22),'rgba(150,128,72,0.42)',w,h);
  }

  // 아코스틱 타일 미세 구멍
  const holes=Math.max(300,Math.round(1400*s*s));
  for(let i=0;i<holes;i++){
    ctx.fillStyle='rgba(120,116,100,0.30)';
    ctx.fillRect(Math.random()*w,Math.random()*h,Math.max(1,s),Math.max(1,s));
  }

  // T바 격자 — 어두운 홈 + 위쪽 하이라이트
  const lw=Math.max(1,2.5*s);
  for(let i=0;i<=n;i++){
    const p=i*tile;
    ctx.fillStyle='rgba(96,92,78,0.72)';
    ctx.fillRect(p-lw/2,0,lw,h);
    ctx.fillRect(0,p-lw/2,w,lw);
    ctx.fillStyle='rgba(240,238,226,0.55)';
    ctx.fillRect(p-lw/2,0,Math.max(1,.8*s),h);
    ctx.fillRect(0,p-lw/2,w,Math.max(1,.8*s));
  }
  return finishTex(new THREE.CanvasTexture(c),1,aniso);
}
