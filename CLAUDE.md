# DUNGEON ESCAPE — 프로젝트 컨텍스트

3D 던전 탈출 호러 게임. 브라우저에서 동작하는 PWA.
바닐라 JS + Three.js r128, **빌드 도구 없이 단일 HTML 파일**로 구성.

- 저장소: `mazeMonster`
- 배포: GitHub Pages (`.github/workflows/deploy.yml` — main push 시 자동 배포)
- 개발 환경: **주 개발 기기가 아이폰**. 데스크톱 IDE를 쓸 수 없는 경우가 많음.

---

## 파일 구조

```
index.html          게임 전체 (약 1,300줄) — HTML + CSS + JS 단일 파일
manifest.json       PWA 매니페스트
sw.js               Service Worker (캐시명 dungeon-escape-v4)
icon-192.svg        아이콘
icon-512.svg        아이콘
README.md
.github/workflows/deploy.yml
```

---

## 0. 기본 작업 원칙 (모든 규칙에 앞서는 기준)

> Behavioral guidelines to reduce common LLM coding mistakes.
> Merge with project-specific instructions as needed.
>
> **Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

아래는 이 프로젝트뿐 아니라 모든 작업의 바탕이 되는 기준입니다.
이어지는 성능 규칙·품질 시스템 문서는 이 원칙 위에 얹히는 **프로젝트 고유 사항**입니다.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: *"Would a senior engineer say this is overcomplicated?"* If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

**The test:** Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently.
Weak criteria ("make it work") require constant clarification.

---

> **These guidelines are working if:** fewer unnecessary changes in diffs,
> fewer rewrites due to overcomplication, and clarifying questions come
> before implementation rather than after mistakes.

---

## ⚠️ 최우선 규칙 — 성능 관련 (반드시 지킬 것)

이 프로젝트는 **실측을 통해 병목을 규명한 이력**이 있습니다. 아래 규칙을 어기면 프레임이 무너집니다.

### 1. 동적 광원 개수를 늘리지 말 것

**이 프로젝트 최대의 성능 함정입니다.**

Three.js forward 렌더링은 **픽셀마다 모든 광원을 순회**합니다.
과거 횃불마다 `PointLight`를 붙여 광원이 64개가 되었고, 그 결과:

```
FPS 13 (76.3ms) / DRAW 7 / TRIS 0.1k / LIGHT 64
```

**삼각형 100개를 그리는 데 76ms**가 걸렸습니다. 지오메트리는 무관했고 광원이 단독 원인이었습니다.

현재는 **광원 풀링** 방식으로 해결되어 있습니다.

- `torchData[]` — 모든 횃불의 위치를 데이터로만 보관
- `torchLightPool[]` — 실제 `PointLight`는 `MAX_TORCH_LIGHTS`(프리셋이 결정, 2~6)개만 존재
- `updateTorchLights()` — `Q.torchInterval`마다 플레이어에게 가장 가까운 횃불 위치로 풀을 재배치
- `monLightPool[]` — 몬스터 눈 광원도 동일한 패턴. 개수는 부팅 시 `Q.monLights`로 고정하고
  `updateMonsterLights()`가 매 프레임 최근접 N마리에만 배치합니다. 몬스터마다 `PointLight`를
  붙이면 레벨이 오를수록(최대 3마리) 광원이 늘어납니다.

새 광원을 추가하려면 반드시 이 풀 구조를 재사용하십시오. 개별 `PointLight` 생성 금지.

**실측 근거** (SwiftShader 소프트웨어 렌더링, 동일 미로·동일 지점):

| 프리셋 | LIGHT | DRAW | TRIS | FPS |
|---|---|---|---|---|
| LOW | 5 | 7 | 0.1k | 60 |
| HIGH | 9 | 53 | 0.8k | 20 |
| ULTRA | 11 | 9 | 0.1k | 4 |

지오메트리 지표는 사실상 동일한데 FPS만 15배 차이가 납니다. 광원 개수가 단독 변수입니다.

### 2. 광원을 끌 때 `visible = false`를 쓰지 말 것

Three.js는 **보이는 광원 개수가 바뀌면 셰이더 프로그램을 재컴파일**합니다.
매 프레임 `visible`을 토글하면 hitching이 발생합니다.

```js
// 금지
light.visible = false;

// 올바름 — 개수는 고정, 세기만 0
light.intensity = 0;
light.position.set(0, -9999, 0);
```

몬스터 눈 광원과 출구 광원도 이 방식으로 거리 기반 제어하고 있습니다.

### 3. 추정으로 최적화하지 말 것

초기 진단에서 draw call 1,192개를 근거로 지오메트리 병합을 최우선 과제로 제시했으나,
실측 결과 프러스텀 컬링이 이미 대부분을 걸러내어 **실제 draw call은 7개**였습니다.
병합 작업을 먼저 했다면 효과가 거의 없는 곳에 시간을 쓸 뻔했습니다.

**성능 작업 전에는 반드시 화면 좌상단 계측 오버레이로 실측하십시오.**

### 4. 기타 성능 관련 기존 처리 (되돌리지 말 것)

| 항목 | 현재 상태 | 이유 |
|---|---|---|
| `shadowMap` | 비활성 | 모바일에서 비용 과다 |
| `antialias` | 프리셋이 결정 | HIGH/ULTRA만 on |
| `pixelRatio` | 프리셋 상한 × `renderScale` | fill rate 절감 |
| 미니맵 밝힘 칸 수 | `_visCount` 증분 유지 | `drawMM()`이 매번 625칸 세던 루프 제거 |
| BFS 버퍼 | 전역 재사용 (`_bfsVis` 등) | 매 호출 재할당 시 GC 스터터 |
| BFS 큐 | 순환 버퍼 (`_bfsQx/_bfsQz`) | `Array.shift()`의 O(n) 제거 |
| 미니맵 지형 | 오프스크린 캔버스 캐싱 | 매 프레임 625셀 순회 방지 |
| 시야 계산 | 이동·회전 시에만 | `_lastVisGx/_lastVisGz/_lastVisYaw` |
| `cachedPortal` 등 | 참조 캐싱 | 매 프레임 `worldObjs.find()` 금지 |

---

## 핵심 시스템

### 미로 생성 — `generateMaze(W, H)`
Recursive Backtracking으로 완전 미로 생성 후, **내부 벽의 18%를 추가 제거**하여 루프를 만듭니다.
따라서 탈출 경로가 여러 갈래입니다. 크기는 25×25 고정(`MW`, `MH`).

### 몬스터 AI — `class Monster`
3단계 FSM으로 동작합니다.

| 상태 | 전이 조건 | 행동 |
|---|---|---|
| `patrol` | 초기 상태 | 랜덤 목표로 BFS 이동 (1.2초마다 재계산) |
| `chase` | 시야(8칸 LOS) 또는 청각(4칸, 달릴 때만) 감지 | BFS 추적, 0.45초마다 재계산, 속도 증가 |
| `search` | 시야 상실 | 마지막 목격 지점 이동 후 반경 3칸 배회 (8~12초) |

레벨당 마리 수 `min(level, 3)`, 레벨마다 속도 +12%. 접촉 시 즉사(`MON_KILL_R = 0.7`).

### 몬스터 외형 — 관절 리그

몸통·머리·팔(2단)·다리를 `THREE.Group` 회전축에 매단 구조입니다.
`jointLimb()`이 축 Group을 만들고 메시를 길이의 절반만큼 내려 답니다 —
이렇게 해야 Group을 돌렸을 때 **메시 중앙이 아니라 관절을 중심으로** 회전합니다.

지오메트리·재질은 모듈 레벨에서 1회만 만들어 모든 몬스터가 공유합니다(눈 재질만 clone).

**임팩트는 실루엣이 아니라 움직임에서 나옵니다.** `chase`일 때 어깨 진폭을 0.30 → 1.25로,
속도를 3.6 → 9.5로 올리고 팔꿈치·어깨Z에 다른 주기의 사인파를 섞어 허우적거리게 만듭니다.
정적인 형태만 다듬는 것보다 이쪽이 훨씬 효과가 큽니다.

**빌보드 평면은 쓰지 마십시오.** 한때 캔버스로 그린 전신 텍스처를 평면 1장에 붙여
카메라 쪽으로 돌렸는데, 팔을 휘저을 수 없고 항상 플레이어를 쳐다봐서 진행 방향 단서가
사라집니다. (`THREE.Sprite`는 더 나쁩니다 — r128의 `SpriteMaterial`은 광원의 영향을
아예 받지 않아 어두운 복도에 몬스터만 환하게 떠 보입니다.)

머리는 **회전축 Group 안에 두개골·얼굴·눈을 형제로** 넣습니다. 두개골에 준 비균등
스케일(`.92,1.22,.92`)이 자식으로 상속되면 얼굴과 눈이 같이 일그러집니다.

눈은 두개골 표면보다 확실히 앞(`z=.155`)에 둬야 합니다. 머리가 z축으로 .92배 눌려
`x=±.055` 지점의 표면 z가 약 `.137`이라, 그보다 안쪽에 두면 파묻혀 보이지 않습니다.
`this.eyes[]`로 직접 참조하십시오 — `group.children[i]` 인덱스 접근은 메시 구성이
바뀔 때 조용히 깨집니다.

회전은 `this.facing`(진행 방향)으로 목표를 두고 매 프레임 보간합니다.
각도차를 `-π~π`로 감지 않으면 경계에서 한 바퀴 헛돕니다.

**과거 크래시 이력**: `searchPos`가 `null`인 채 `search` 상태에 진입해
`this.searchPos[0]` 접근에서 `TypeError` 발생. 현재는 `chase` 진입/유지 중
매 프레임 `searchPos`를 갱신하고, `search` 로직에서도 `null` 검사 후 `patrol` 복귀하도록 이중 방어됨.
**이 방어 코드를 제거하지 마십시오.**

`bfsNext()`도 NaN 유입과 무한 역추적을 막는 가드가 들어 있습니다. 동일하게 유지 필요.

### 공간 오디오 (Web Audio API)
`PannerNode` + HRTF 패닝 사용. 리스너는 매 프레임 카메라에 동기화(`updateAudioListener()`).

| 소리 | 방식 | 함수 |
|---|---|---|
| 플레이어 발소리 | 2D | `footstep()` |
| 몬스터 발소리 | **3D 위치** | `monsterStep(x, z)` |
| 으르렁 | **3D 위치** | `playGrowl(x, z)` |
| 횃불 탁탁 | **3D 위치** | `torchCrackle(x, y, z)` |
| 출구 험(루프) | **3D 위치** | `startExitHum()` / `stopExitHum()` |
| 심장박동 | 2D, 거리 비례 | `heartbeat(intensity)` |

**iOS 주의**: `AudioContext`는 사용자 제스처 안에서 `resume()`해야 소리가 납니다.
시작/재시도/다음레벨 버튼에 `unlockAudio()`가 연결되어 있습니다.

구형 Safari 대응으로 `positionX` (AudioParam) / `setPosition()` 양쪽 폴백이 있습니다. 유지하십시오.

### Fog of War 미니맵
`visited[][]` 2차원 배열에 탐험 여부 기록.
전방 **2칸 · 시야각 120°(±60°)** 안에서 LOS가 통하는 칸만 밝힙니다.
몬스터는 해당 칸이 탐험된 경우에만 미니맵에 표시됩니다.

### 조작
- 좌측 십자키(D-pad): 전진/후진(`jFwd`) + 좌우 횡이동(`dSide`)
  - `jFwd`는 **전진이 -1**입니다. 게임 루프에서 `-jFwd`로 반전해 사용.
- 우측 영역: 좌우 스와이프 회전 (감도 `0.011`)
- 키보드: WASD / 화살표

### 성능 계측 오버레이
좌상단에 FPS / 최저 / 평균 / DRAW / LIGHT / TRIS / OBJ / 품질 표시.
- 1회 탭 = 기록 초기화 (+ `renderScale`을 프리셋 기본값으로 복원)
- 3회 탭 = 표시·숨김

집계와 적응형 조절은 **패널을 숨겨도 계속 동작**합니다. `perfOn`은 DOM 갱신만 건너뜁니다.

`renderer.info.render`는 `render()` 시작 시 리셋되므로 **반드시 렌더 직후**에 읽어야 합니다.
FPS 계측에는 클램프 전 `rawDt`를 사용합니다(클램프된 `dt`는 저프레임을 실제보다 좋게 보이게 함).

### 에러 방어
- 전역 `error` / `unhandledrejection` 핸들러 → 콘솔에 상세 출력
- `animate()` 본문 전체가 `try-catch` → 예외가 나도 렌더 루프가 죽지 않음

> CDN 모듈은 크로스오리진이라 예외 시 브라우저가 `Script error.`로만 표시합니다.
> 위 핸들러가 없으면 원인 파악이 불가능하므로 제거하지 마십시오.

---

## 품질 설정 시스템 (구현 완료)

`QUALITY_PRESETS` — CONSTANTS 바로 뒤, THREE 셋업 이전에 정의됩니다.
텍스처·재질·renderer 생성이 모두 `Q`를 참조하므로 **위치를 뒤로 옮기면 안 됩니다.**

| 파라미터 | LOW | MEDIUM | HIGH | ULTRA |
|---|---|---|---|---|
| pixelRatio 상한 (`prCap`) | 1.0 | 1.5 | 2.0 | 3.0 |
| `renderScale` 기본값 | 0.6 | 0.8 | 1.0 | 1.0 |
| `torchLights` | 2 | 3 | 4 | 6 |
| `monLights` | 1 | 1 | 3 | 3 |
| **총 광원 수** | **5** | **6** | **9** | **11** |
| `texSize` | 128 | 256 | 256 | 512 |
| `aniso` (0=최대) | 1 | 1 | 4 | 0 |
| `aa` | ✗ | ✗ | ✓ | ✓ |
| `matType` | phong | phong | standard | standard |
| `ambient` | 3.6 | 3.4 | 3.2 | 3.2 |
| `torchRange` | 8.5 | 7.8 | 7.0 | 7.0 |
| `torchPower` | 1.10 | 1.05 | 1.00 | 1.00 |
| `torchInterval` | 0.20s | 0.15s | 0.12s | 0.10s |
| `mmInterval` | 8f | 6f | 4f | 4f |
| `panning` | equalpower | HRTF | HRTF | HRTF |
| `targetFps` (적응형) | 30 | 55 | 55 | 60 |

### 설계 원칙 3가지

**1. 프리셋은 부팅 시점 상수다.**
`antialias`는 WebGL 컨텍스트 생성 파라미터라 런타임 변경이 불가능하고, 텍스처·재질도 전면
재생성이 필요합니다. 그래서 프리셋 UI는 **타이틀 화면에만** 두고, 변경 시 `localStorage`에
저장하고 `location.reload()` 합니다. 타이틀에서는 잃을 진행 상황이 없고 SW 캐시 덕에
리로드가 즉시 끝납니다. dispose/rebuild 경로를 만들지 마십시오 — 코드량 대비 이득이 없습니다.

**2. 런타임에 움직이는 축은 `renderScale` 하나뿐이다.**
`setPixelRatio(min(devicePixelRatio, Q.prCap) × renderScale)` — 해상도만 바꾸므로 셰이더
재컴파일이 없습니다. 적응형 자동 조절(`adaptQuality()`)은 이 값만 건드립니다.
**자동 조절이 광원·재질·텍스처를 만지면 플레이 중 hitching이 발생합니다. 절대 금지.**
하향 3초 / 복구 10초의 히스테리시스로 경계 진동을 막습니다. 하한 `ADAPT_MIN = 0.5`.

**3. 게임 밸런스 값은 프리셋에 넣지 않는다.**
`fog` 밀도, `MON_SIGHT_R`, `MON_HEAR_R`, 몬스터 속도는 품질 설정으로 바뀌면 안 됩니다.
품질에 따라 난이도가 달라지는 것은 버그입니다.

### 재질 — Lambert가 아니라 Phong인 이유

r128의 `MeshLambertMaterial`은 **정점 단위(Gouraud) 조명**입니다.
벽이 세그먼트 1개짜리 `BoxGeometry`(정점 8개)라, 횃불 `PointLight`의 감쇠가 정점에서만
계산되어 빛이 사각 얼룩으로 뭉개집니다. 이 게임은 횃불 조명이 분위기의 핵심이라 치명적입니다.
`MeshPhongMaterial`은 픽셀 단위 조명을 유지하면서 Standard의 PBR 연산(BRDF)만 걷어냅니다.

재질은 `mkMat()` 팩토리를 통해서만 생성하십시오. `roughness`/`metalness`를
`shininess`/`specular`로 근사해 넘깁니다. **`new THREE.MeshStandardMaterial()` 직접 호출 금지.**

### 텍스처 — 크기 파라미터화 필수

`makeDungeonWall/Floor/Ceil(size)`의 모든 좌표·크기·반복 횟수는 **256px 기준으로 작성한 뒤
`s = size/256`을 곱합니다.** 캔버스 크기만 바꾸면 128에서는 벽돌이 2×4개만 나오고,
바닥 타일 좌표(256까지 채움)가 캔버스 밖으로 넘어가 타일링 이음새에 빈 영역이 드러납니다.
텍스처에 무언가 추가할 때 이 규칙을 지키십시오. 마무리는 `finishTex()`가 담당합니다(wrap + anisotropy).

### 밝기 보정 — 광원을 늘리지 않고 어두움을 해결하는 축

광원이 적은 프리셋은 횃불 사이 구간이 캄캄해집니다. 이때 `torchLights`를 늘리면
1번 규칙에 정면으로 위배되므로, 대신 아래 세 값을 씁니다. **셋 다 픽셀당 광원 순회
횟수를 바꾸지 않아 사실상 공짜입니다.**

| 값 | 성격 | 분위기 영향 |
|---|---|---|
| `torchRange` | `PointLight.distance` — 빛이 닿는 범위 | 가장 안전. 횃불 빛웅덩이가 넓어질 뿐 |
| `torchPower` | 깜빡임 세기 배수 | 안전. 대비가 오히려 살아남 |
| `ambient` | `AmbientLight` 세기 | **가장 위험.** 전체가 평평해져 호러 느낌이 죽음 |

조정할 때는 `ambient`를 마지막에, 가장 적게 건드리십시오.
과거에 `ambient 4.6 / torchRange 10 / torchPower 1.3`을 한꺼번에 넣었더니 배수가
곱해져 화면 평균 밝기가 34 → 69로 **2배**가 되어 분위기가 통째로 날아갔습니다.
현재 값은 34 → 46(+34%)입니다.

### 자동 감지

`detectQuality()` — `localStorage`에 저장값이 없을 때만 동작합니다.
모바일은 `hardwareConcurrency ≤ 2 || deviceMemory ≤ 2`이면 LOW, 아니면 MEDIUM.
데스크톱은 `≤ 4`이면 MEDIUM, 아니면 HIGH.

**⚠️ 모바일 임계값을 다시 올리지 마십시오.**
iOS Safari는 `deviceMemory`를 **아예 노출하지 않고**(`undefined`),
`hardwareConcurrency`도 대부분 **4로 보고**합니다. 처음에 모바일 LOW 조건을
`cores ≤ 4`로 뒀더니 최신 아이폰까지 전부 LOW로 떨어져 "너무 어둡다"는 문제가
발생했습니다. `deviceMemory`는 `undefined`와 실제 저사양을 구분해야 하므로
`||` 기본값으로 숫자를 채우지 말고 `mem !== undefined` 검사를 유지하십시오.

### 검증 방법

계측 오버레이 하단에 `품질 <프리셋> ×<renderScale>` 행이 추가되어 있습니다.
`renderScale`이 프리셋 기본값보다 낮으면 노란색으로 표시됩니다(적응형이 하향한 상태).
**1회 탭(기록 초기화)은 `renderScale`도 프리셋 기본값으로 되돌립니다** — 프리셋별 실측 조건을
맞추기 위한 것입니다. 프리셋을 바꿔가며 측정할 때는 항상 1회 탭 후 시작하십시오.

---

## 다음 작업 후보 (우선순위)

| 순위 | 작업 | 비고 |
|---|---|---|
| 높음 | **모듈 분리** | 단일 파일이 1,300줄. `maze.js` / `monster.js` / `render.js` / `audio.js` / `quality.js` 등으로 분리 |
| 중간 | 진행 저장 | 최고 기록, 누적 탈출 횟수. 이게 있어야 승리·사망 화면에서도 프리셋 변경(=reload)을 열어줄 수 있음 |
| 중간 | 게임플레이 확장 | 스태미나·달리기, 은신, 열쇠·잠긴 문, 층 개념, 몬스터 종류 분화 |
| 낮음 | ~~지오메트리 병합~~ | **실측상 불필요** (draw call 7~53). 씬 구조가 크게 바뀌면 재검토 |
| 낮음 | ~~재질 경량화~~ | 품질 프리셋에 포함되어 완료 (LOW/MEDIUM = Phong) |

---

## 작업 시 유의사항

1. **큰 변경 전에 방향을 먼저 상의할 것.** 코드부터 작성하지 말고 접근 방식을 제안하고 확인받으십시오.
2. **버그는 수정 전에 원인을 먼저 설명할 것.** 무엇이 왜 잘못되었는지 보고한 뒤 고치십시오.
3. 조작감·감도 관련 수치는 사용자가 직접 체감하며 조정합니다. 임의로 바꾸지 마십시오.
4. 성능 관련 변경 후에는 **계측 오버레이 수치로 검증**하십시오.
5. `sw.js`의 캐시명을 변경하면 기존 사용자에게 업데이트가 전파됩니다. 배포 시 버전을 올리십시오.

---

## 로컬 실행

`file://`로 열면 Service Worker와 오디오가 동작하지 않습니다.

```bash
python3 -m http.server 8000
```
