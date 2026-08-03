import { Q } from './quality.js';

// ── AUDIO (3D 공간 오디오) ──
let actx=null, masterGain=null, audioReady=false;

export function getAC(){
  if(!actx){
    actx=new(window.AudioContext||window.webkitAudioContext)();
    masterGain=actx.createGain();
    masterGain.gain.value=0.9;
    masterGain.connect(actx.destination);
  }
  return actx;
}

// iOS는 사용자 제스처 안에서 resume()해야 소리가 납니다
export function unlockAudio(){
  try{
    const c=getAC();
    if(c.state==='suspended') c.resume();
    audioReady=true;
    loadShriek();   // 비명 음원 디코드 (1회)
  }catch(_){}
}

// 리스너(=플레이어 귀)를 카메라 위치/방향에 동기화
export function updateAudioListener(px,pz,yaw){
  if(!actx) return;
  const l=actx.listener;
  const fx=-Math.sin(yaw), fz=-Math.cos(yaw);
  try{
    if(l.positionX){
      // 최신 브라우저: AudioParam 방식
      l.positionX.value=px; l.positionY.value=1.22; l.positionZ.value=pz;
      l.forwardX.value=fx;   l.forwardY.value=0;    l.forwardZ.value=fz;
      l.upX.value=0;         l.upY.value=1;         l.upZ.value=0;
    }else{
      // 구형 API 폴백 (iOS Safari 일부 버전)
      l.setPosition(px,1.22,pz);
      l.setOrientation(fx,0,fz, 0,1,0);
    }
  }catch(_){}
}

// 3D 위치를 가진 출력 노드 생성
export function makePanner(x,y,z,refDist,maxDist,rolloff){
  const c=getAC();
  const p=c.createPanner();
  p.panningModel=Q.panning;     // HRTF=머리전달함수(방향감 우수) / LOW는 equalpower로 CPU 절감
  p.distanceModel='inverse';
  p.refDistance=refDist||1.8;
  p.maxDistance=maxDist||28;
  p.rolloffFactor=rolloff||1.5;
  try{
    if(p.positionX){p.positionX.value=x;p.positionY.value=y;p.positionZ.value=z;}
    else p.setPosition(x,y,z);
  }catch(_){}
  p.connect(masterGain);
  return p;
}

// 노이즈 버스트 버퍼 (발소리용) — 미리 만들어두고 재사용
let _noiseBuf=null;
export function getNoiseBuf(){
  const c=getAC();
  if(!_noiseBuf){
    const len=Math.floor(c.sampleRate*0.09);
    _noiseBuf=c.createBuffer(1,len,c.sampleRate);
    const d=_noiseBuf.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.exp(-i/(len*0.26));
  }
  return _noiseBuf;
}

// 플레이어 발소리 — 자기 발이므로 위치 없이 그대로 (2D)
export function footstep(){
  try{
    const c=getAC();
    const src=c.createBufferSource();src.buffer=getNoiseBuf();
    src.playbackRate.value=0.9+Math.random()*0.25;
    const g=c.createGain();g.gain.value=.06;
    const f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=150+Math.random()*80;
    src.connect(f);f.connect(g);g.connect(masterGain);src.start();
  }catch(_){}
}

// 몬스터 발소리 — 3D 위치 지정 (묵직하게)
export function monsterStep(x,z){
  try{
    const c=getAC();
    const src=c.createBufferSource();src.buffer=getNoiseBuf();
    src.playbackRate.value=0.5+Math.random()*0.15;   // 낮게 = 무거운 발소리
    const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=320+Math.random()*120;
    const g=c.createGain();g.gain.value=.5;
    const p=makePanner(x,0.4,z, 1.8, 26, 1.7);   // 거리에 따라 확실히 줄어들게
    src.connect(f);f.connect(g);g.connect(p);
    src.start();
    src.onended=()=>{try{p.disconnect();g.disconnect();f.disconnect();}catch(_){}};
  }catch(_){}
}

// 으르렁 — 몬스터 위치에서 발생
export function playGrowl(x,z){
  try{
    const c=getAC();
    const o=c.createOscillator();o.type='sawtooth';
    o.frequency.setValueAtTime(58+Math.random()*18,c.currentTime);
    o.frequency.exponentialRampToValueAtTime(38,c.currentTime+.75);
    const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=220;
    const g=c.createGain();
    g.gain.setValueAtTime(.55,c.currentTime);
    g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.85);
    const dest = (x!==undefined) ? makePanner(x,1.0,z, 2.2, 34, 1.8) : masterGain;
    o.connect(f);f.connect(g);g.connect(dest);
    o.start();o.stop(c.currentTime+.85);
    o.onended=()=>{try{if(dest!==masterGain)dest.disconnect();g.disconnect();f.disconnect();}catch(_){}};
  }catch(_){}
}

// 횃불 탁탁거리는 소리 — 가장 가까운 횃불에서 가끔
export function torchCrackle(x,y,z){
  try{
    const c=getAC();
    const src=c.createBufferSource();src.buffer=getNoiseBuf();
    src.playbackRate.value=1.8+Math.random()*1.2;
    const f=c.createBiquadFilter();f.type='highpass';f.frequency.value=1800;
    const g=c.createGain();g.gain.value=.28;
    const p=makePanner(x,y,z, 1.2, 12, 2.2);
    src.connect(f);f.connect(g);g.connect(p);
    src.start();
    src.onended=()=>{try{p.disconnect();g.disconnect();f.disconnect();}catch(_){}};
  }catch(_){}
}


// 발각 순간의 비명 — 녹음 음원 2종(mono 44.1kHz MP3)을 base64로 심어 둔다.
// 외부 파일로 두지 않는 이유: 이 프로젝트는 단일 HTML 파일 구성을 유지하고,
// sw.js 캐시 목록·오프라인 동작·미리보기 빌드가 모두 그대로 굴러가기 때문이다.
const SHRIEK_GAIN=0.50;   // 재생 게인 — 체감 음량을 여기서 조절
const SHRIEK_GAP =0.45;   // 비명이 끝난 뒤 다음 비명까지 최소 간격(초)
const SHRIEK_MP3=[
'data:audio/mpeg;base64,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VVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7UsTqAwwIlQoMZYnBQA3ZTPYmgVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//tSxKGDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=',
'data:audio/mpeg;base64,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'];
let _shriekBufs=[],_shriekTried=false;
// 몬스터가 최대 3마리라 각자 발각되면 비명이 겹쳐 뭉갠다. 하나가 끝날 때까지 막는다.
let _shriekBusyUntil=0;

// AudioContext는 사용자 제스처 안에서만 열리므로 unlockAudio() 시점에 한 번 디코드한다
export function loadShriek(){
  if(_shriekTried) return;
  _shriekTried=true;
  try{
    const c=getAC();
    SHRIEK_MP3.forEach((uri,idx)=>{
      const bin=atob(uri.slice(uri.indexOf(',')+1));
      const arr=new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
      c.decodeAudioData(arr.buffer,
        b=>{_shriekBufs.push(b);},
        e=>{console.warn('[SHRIEK] '+idx+' 디코드 실패 — 합성음으로 대체',e);});
    });
  }catch(e){console.warn('[SHRIEK] 로드 실패 — 합성음으로 대체',e);}
}

export function playShriek(x,z){
  try{
    const c=getAC();
    if(c.currentTime<_shriekBusyUntil) return;      // 이미 다른 개체가 울고 있다
    if(!_shriekBufs.length){
      _shriekBusyUntil=c.currentTime+0.65+SHRIEK_GAP;
      return playShriekSynth(x,z);                  // 디코드 실패/미완료 시 폴백
    }
    const buf=_shriekBufs[(Math.random()*_shriekBufs.length)|0];
    const rate=0.94+Math.random()*0.12;             // 매번 미묘하게 다르게
    _shriekBusyUntil=c.currentTime+buf.duration/rate+SHRIEK_GAP;
    const src=c.createBufferSource();src.buffer=buf;
    src.playbackRate.value=rate;
    const g=c.createGain();g.gain.value=SHRIEK_GAIN;
    const p=makePanner(x,1.3,z, 2.2, 40, 1.9);      // 멀면 확실히 작아지도록 rolloff를 세게
    src.connect(g);g.connect(p);
    src.start();
    src.onended=()=>{try{p.disconnect();g.disconnect();}catch(_){}};
  }catch(_){}
}

// 합성 폴백 — 톱니 2개를 완전5도로 겹쳐 위에서 아래로 훑어내린다
export function playShriekSynth(x,z){
  try{
    const c=getAC();
    const t0=c.currentTime;
    const g=c.createGain();
    g.gain.setValueAtTime(0,t0);
    g.gain.linearRampToValueAtTime(.42,t0+.03);
    g.gain.exponentialRampToValueAtTime(.001,t0+.62);
    const f=c.createBiquadFilter();f.type='bandpass';f.Q.value=2.2;
    f.frequency.setValueAtTime(1500,t0);
    f.frequency.exponentialRampToValueAtTime(420,t0+.6);
    const oscs=[[820,1],[1230,.55]].map(([fr,vol])=>{
      const o=c.createOscillator();o.type='sawtooth';
      o.frequency.setValueAtTime(fr,t0);
      o.frequency.exponentialRampToValueAtTime(fr*.32,t0+.6);
      const og=c.createGain();og.gain.value=vol;
      o.connect(og);og.connect(f);
      o.start(t0);o.stop(t0+.65);
      return o;
    });
    const dest=makePanner(x,1.3,z, 3.0, 45, 1.0);
    f.connect(g);g.connect(dest);
    oscs[0].onended=()=>{try{dest.disconnect();g.disconnect();f.disconnect();}catch(_){}};
  }catch(_){}
}

// 심장박동 — 몬스터가 아주 가까울 때 (2D, 플레이어 자신의 것)
let _lastHeartbeat=0;
export function heartbeat(intensity){
  try{
    const c=getAC();
    const o=c.createOscillator();o.type='sine';
    o.frequency.setValueAtTime(62,c.currentTime);
    o.frequency.exponentialRampToValueAtTime(34,c.currentTime+.16);
    const g=c.createGain();
    g.gain.setValueAtTime(0,c.currentTime);
    // 선형이면 멀리서도 또렷이 들린다. 제곱 곡선을 써서 멀 때는 거의 안 들리고
    // 가까워질수록 급격히 커지게 한다 (거리 7칸=0, 1칸=1).
    g.gain.linearRampToValueAtTime(.26*intensity*intensity,c.currentTime+.03);
    g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.22);
    o.connect(g);g.connect(masterGain);
    o.start();o.stop(c.currentTime+.24);
  }catch(_){}
}

export function playDeath(){
  try{const c=getAC();
    [80,60,45].forEach((fr,i)=>{const o=c.createOscillator();o.type='sawtooth';o.frequency.value=fr;
      const g=c.createGain();g.gain.setValueAtTime(0,c.currentTime+i*.15);
      g.gain.linearRampToValueAtTime(.22,c.currentTime+i*.15+.08);
      g.gain.exponentialRampToValueAtTime(.001,c.currentTime+i*.15+.6);
      o.connect(g);g.connect(masterGain);o.start(c.currentTime+i*.15);o.stop(c.currentTime+i*.15+.7);});}catch(_){}
}
export function playEscape(){
  try{const c=getAC();
    [0,7,12,16].forEach((s,i)=>{const o=c.createOscillator();o.type='sine';o.frequency.value=330*Math.pow(2,s/12);
      const g=c.createGain();g.gain.setValueAtTime(0,c.currentTime+i*.1);
      g.gain.linearRampToValueAtTime(.16,c.currentTime+i*.1+.05);
      g.gain.exponentialRampToValueAtTime(.001,c.currentTime+i*.1+.5);
      o.connect(g);g.connect(masterGain);o.start(c.currentTime+i*.1);o.stop(c.currentTime+i*.1+.5);});}catch(_){}
}

