# DUNGEON ESCAPE — 프로젝트 컨텍스트

3D 미로 탈출 호러 게임. 브라우저에서 동작하는 PWA.
배경은 **백룸(Backrooms)** — 겨자색 벽지, 축축한 카펫, 형광등이 늘어선 텍스 천장.
바닐라 JS + Three.js r128, **빌드 도구 없이** 네이티브 ES 모듈로 구성.

- 저장소: `mazeMonster`
- 배포: GitHub Pages (`.github/workflows/deploy.yml` — main push 시 자동 배포)
- 개발 환경: **주 개발 기기가 아이폰**. 데스크톱 IDE를 쓸 수 없는 경우가 많음.

---

## 파일 구조

```
index.html          HTML + CSS + 메인 스크립트 (약 1,140줄)
js/constants.js     밸런스·치수 상수
js/quality.js       품질 프리셋·자동 감지
js/maze.js          미로 생성 + BFS/LOS
js/textures.js      캔버스 텍스처 생성
js/audio.js         공간 오디오 전체
manifest.json       PWA 매니페스트
js/save.js          진행 저장 (localStorage)
sw.js               Service Worker (캐시명 dungeon-escape-v20)
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

- `panelData[]` — 모든 천장등의 위치를 데이터로만 보관
- `panelLightPool[]` — 실제 `PointLight`는 `MAX_PANEL_LIGHTS`(프리셋이 결정, 2~6)개만 존재
- `updatePanelLights()` — `Q.panelInterval`마다 플레이어에게 가장 가까운 천장등 위치로 풀을 재배치

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

출구 광원도 이 방식으로 거리 기반 제어하고 있습니다.
(몬스터 눈 광원 풀은 개체가 눈 없는 검은 실루엣이 되면서 사라졌습니다.)

### 3. 추정으로 최적화하지 말 것

초기 진단에서 draw call 1,192개를 근거로 지오메트리 병합을 최우선 과제로 제시했으나,
실측 결과 프러스텀 컬링이 이미 대부분을 걸러내어 **실제 draw call은 7개**였습니다.
병합 작업을 먼저 했다면 효과가 거의 없는 곳에 시간을 쓸 뻔했습니다.

**성능 작업 전에는 반드시 화면 좌상단 계측 오버레이로 실측하십시오.**

> ⚠️ **단, 이 "draw call 7개"는 25×25 기준이었습니다.** 미로를 41×41로 키우자
> 같은 조건에서 **draw call이 494개**가 되어 결론이 뒤집혔습니다(→ 5번 항목).
> 실측 결과에는 항상 **어떤 조건에서 쟀는지**를 같이 적어 두십시오.

### 4. 기타 성능 관련 기존 처리 (되돌리지 말 것)

| 항목 | 현재 상태 | 이유 |
|---|---|---|
| `shadowMap` | 비활성 | 모바일에서 비용 과다 |
| `antialias` | 프리셋이 결정 | HIGH/ULTRA만 on |
| `pixelRatio` | 프리셋 상한 × `renderScale` | fill rate 절감 |
| BFS 버퍼 | 전역 재사용 (`_bfsVis` 등) | 매 호출 재할당 시 GC 스터터 |
| BFS 큐 | 순환 버퍼 (`_bfsQx/_bfsQz`) | `Array.shift()`의 O(n) 제거 |
| 미니맵 지형 | 오프스크린 캔버스 + **증분 갱신** | 새로 밝혀진 칸만 덧그림(`_mmNew`). 전체 재생성은 41×41에서 1,681칸을 걸을 때마다 훑음 |
| 시야 계산 | 이동·회전 시에만 | `_lastVisGx/_lastVisGz/_lastVisYaw` |
| `cachedPortal` 등 | 참조 캐싱 | 매 프레임 `worldObjs.find()` 금지 |

### 5. 지오메트리는 "청크 단위"로 병합할 것

41×41에서 칸마다 Mesh를 만들면 씬 객체 3,023개 / draw call 494개가 됩니다.
그렇다고 **전부 한 덩어리로 합치면 절두체 컬링이 통째로 죽어** 미로 전체가 매 프레임
그려집니다(TRIS 0.1k → 17.9k). `CHUNK`(현재 6)칸 단위로 나눠 합쳐야 둘 다 잡힙니다.

실측 (41×41, 동일 시드·동일 경로 40샘플):

| 청크 | 씬 객체 | DRAW | TRIS |
|---|---|---|---|
| 없음 | 3,023 | 494 | 7.7k |
| 4칸 | 654 | 124 | 10.2k |
| **6칸 (현재)** | **394** | **80** | **12.0k** |
| 12칸 | 229 | 46 | 17.7k |

r128의 `BufferGeometryUtils`는 `examples/` 쪽이라 코어 모듈에 없습니다. CDN 의존을
늘리지 않으려고 `mergeParts()`로 직접 합칩니다. `position`/`normal`/`uv`를 가진 인덱스
지오메트리면 종류가 달라도 됩니다. 부수 효과로 **레벨 로딩이 빨라졌습니다**
(Mesh 수천 개 생성 31~128ms → 병합 10~17ms).

던전 시절에는 횃불 불꽃(`torchFlames`)만 매 프레임 `scale`이 흔들려 병합할 수 없었습니다.
백룸의 천장 형광판은 크기가 변하지 않아 **전부 병합됩니다** — 병합 불가 객체가 하나도 없습니다.
(실측: 41×41에서 씬 객체 394 → 303, DRAW 80 → 48, TRIS 12.0k → 6.8k)

> ⚠️ **SwiftShader 벤치마크는 병합을 과소평가합니다.** 위 표를 잰 헤드리스 환경은
> GPU 없이 CPU로 래스터화하므로 삼각형 증가가 실제보다 훨씬 크게 손해로 잡힙니다.
> 병합 직후 이 환경의 FPS는 59 → 12로 떨어져 개악처럼 보였습니다.
> **실기기(아이폰) 실측 결과 HIGH 프리셋에서 41×41이 59~60fps로 상한을 유지합니다.**
> 삼각형 1만 개는 GPU에게 사실상 공짜이고, 줄어든 draw call·객체 수만 이득으로 남습니다.
> 앞으로도 지오메트리 양이 걸린 판단은 **반드시 실기기 수치로 확정하십시오.**

---

## 모듈 구성

**빌드 도구는 여전히 없습니다.** 브라우저 네이티브 ES 모듈이라 `<script type="module">`이
그대로 `./js/*.js`를 불러옵니다.

분리 기준은 **공유 가변 상태가 없는 것부터**입니다. `MW`/`MH`/`mazeGrid`/`P`처럼 매 레벨
바뀌고 여러 곳이 함께 읽는 상태는 **`index.html`(main)이 소유**합니다.
ES 모듈은 `import`한 바인딩에 대입할 수 없어서, 이런 상태를 모듈로 옮기면 전부
객체 프로퍼티나 setter로 바꾸는 대규모 재작성이 필요합니다. 테스트가 없는 상태에서
그 작업은 위험 대비 이득이 없습니다.

그래서 `maze.js`의 BFS/LOS는 **`(grid, MW, MH, ...)`를 인자로 받습니다.**
`textures.js`는 `anisotropy`를, `audio.js`의 리스너 동기화는 플레이어 좌표를 인자로 받습니다.

> 몬스터·월드 빌드·게임 루프는 공유 상태 의존이 커서 main에 남겼습니다.
> 더 쪼개려면 상태 소유 구조부터 바꿔야 합니다.

**파일을 추가하면 `sw.js`의 `ASSETS` 목록에 반드시 넣으십시오.** 빠지면 오프라인에서 깨집니다.

> **분리할 때 반드시 확인할 것** — 옮긴 코드가 쓰던 변수를 main이 계속 참조하는지.
> `_lastHeartbeat`(심장박동 박자)가 `audio.js`로 딸려 갔는데 게임 루프가 여전히 참조해
> `ReferenceError`가 났습니다. **몬스터가 7칸 안에 들어와야 실행되는 코드라
> 대부분의 테스트를 통과했고, 6회 중 1회꼴로만 재현됐습니다.**
> 분리 후에는 각 모듈의 최상위 선언 이름을 모아, main이 import도 재선언도 하지 않은 채
> 참조하는 것이 있는지 **정적으로 전수 검사**하십시오.

---

## 백룸 — 빛이 반전된 세계

던전에서 백룸으로 바꾼 것은 색칠이 아니라 **조명 구조의 반전**입니다.
이 차이를 모르고 값을 만지면 금방 던전으로 되돌아갑니다.

| | 던전 (이전) | 백룸 (현재) |
|---|---|---|
| 기본값 | **어둠**, 횃불이 예외적으로 밝힘 | **밝음**, 천장등 없는 구역이 예외적으로 어두움 |
| 밝기의 주역 | 횃불 `PointLight` | `AmbientLight` |
| `ambient` 역할 | 횃불 사이를 메우는 보정값 | **어두운 구역의 밝기를 단독 결정** |
| 안개 색 | 검푸른 `0x080a10` | 어두운 올리브 `0x272415` |
| 병합 불가 객체 | 횃불 불꽃 (scale 흔들림) | **없음** |

**안개를 노란색으로 만들지 마십시오.** 백룸의 노란 인상은 근경의 벽지가 만듭니다.
안개를 밝게 하면 천장등이 하나도 없는 복도에서 원경이 오히려 환해져 어둠이 성립하지 않습니다.
참고 사진들에서도 원경은 전부 어둠에 잠겨 있습니다.

### 어두운 구역 — `isDarkZone(col, row)`

천장등이 죽은 구획입니다. **칸 단위로 무작위하면 얼룩덜룩해질 뿐**이라
`DARK_BLOCK`(5칸) 덩어리로 묶어 "복도 하나가 통째로 어둡다"가 되게 합니다.
`level`을 해시에 섞어 레벨마다 배치가 달라지되 같은 레벨 안에서는 결정적입니다.
25×25에서 길 칸의 약 17%가 어두운 구역이 됩니다.

**어두운 구역은 장식이 아니라 게임플레이입니다** — 검은 몬스터가 거기서 보이지 않습니다.
밝은 곳에서는 멀리서부터 실루엣이 보여 압박을 주고, 어두운 곳에서는 발소리·으르렁만
남습니다. 공들여 맞춰 둔 3D 오디오가 여기서 유일한 정보가 됩니다.

### 천장이 emissive를 갖는 이유

천장등이 천장과 거의 같은 평면에 있어 입사각이 스치듯 들어갑니다(N·L≈0).
그래서 조명을 사실상 못 받아 천장이 어둡게 나옵니다. 물리적으로는 맞지만 참고 사진의
흰 천장이 안 나옵니다. `mCeil`에만 `emissive`를 줘서 해결합니다 — 광원을 늘리지 않는 축입니다.

단, **어두운 구역에는 `mCeilDark`(emissive 없음)를 씁니다.** 같은 재질을 쓰면 천장등이
하나도 없는 복도인데 천장만 하얗게 빛나 어둠이 통째로 무너집니다.
재질만 나누면 되고 병합 구조도 광원 개수도 그대로입니다.

---

## 핵심 시스템

### 미로 생성 — `generateMaze(W, H)`
Recursive Backtracking으로 완전 미로 생성 후, **내부 벽의 18%를 추가 제거**하여 루프를 만듭니다.
따라서 탈출 경로가 여러 갈래입니다.

**크기는 레벨마다 커집니다** — `mazeSizeFor(lv)` = 25 → 29 → 33 → 37 → **41 상한**.
재귀 백트래킹은 홀수 크기를 전제하므로 `MAZE_STEP`도 **반드시 짝수**여야 합니다.

`MW`/`MH`는 상수가 아니라 `let`입니다. BFS 버퍼는 `MAZE_MAX²`로 잡아 두고
현재 `MW`로 인덱싱합니다(`z*MW+x`). **버퍼를 `MW*MH`로 잡으면 레벨이 오를 때 넘칩니다.**

### 시작·출구 배치 — `pickStartAndExit()`

둘 다 무작위입니다. 다만 **직선거리로 고르면 안 됩니다** — 벽 하나를 사이에 두고
붙어 있을 수 있습니다. `bfsDistances()`로 실제 이동 거리를 구한 뒤,
가장 먼 지점의 **75% 이상** 떨어진 칸 중에서 출구를 뽑습니다.
실측상 시작–출구 거리가 30~76칸으로 나옵니다.

몬스터도 같은 거리 맵을 재사용해 `max(8, MW*0.35)`칸 밖에만 스폰합니다.
시작하자마자 눈앞에 있으면 손쓸 도리가 없습니다.

시작 시 플레이어는 **뚫린 쪽을 바라봅니다**. 전방 벡터가 `(-sin, -cos)`이므로
`yaw = atan2(-dx, -dz)`입니다.

### 몬스터 AI — `class Monster`
3단계 FSM으로 동작합니다.

| 상태 | 전이 조건 | 행동 |
|---|---|---|
| `patrol` | 초기 상태 | 랜덤 목표로 BFS 이동 (1.2초마다 재계산) |
| `chase` | 시야(8칸 LOS) 또는 청각(4칸, 달릴 때만) 감지 | BFS 추적, 0.45초마다 재계산, 속도 증가 |
| `search` | 시야 상실 | 마지막 목격 지점 이동 후 반경 3칸 배회 (8~12초) |

레벨당 마리 수 `min(level, 4)`, 레벨마다 속도 +12%. 접촉 시 즉사(`MON_KILL_R = 0.7`).

**발각 순간** — `onSpotted()`가 `playShriek()`(높고 날카로운 비명)을 울리고
`CHARGE_TIME`(1.5초) 동안 속도에 `CHARGE_BOOST`(×1.35)를 곱해 달려듭니다.
추격이 이어지는 동안에는 `SNARL_MIN`~`+SNARL_VAR` 간격으로 `playGrowl()`을 반복합니다
(18칸 밖은 소리가 뭉치므로 생략).

> `CHARGE_TIME` / `CHARGE_BOOST` / `SNARL_*`는 **난이도와 체감에 직결되는 값**입니다.
> 사용자가 직접 플레이하며 조정할 값이므로 임의로 올리지 마십시오.

### 몬스터 외형 — 관절 리그

몸통·머리·팔(2단)·다리를 `THREE.Group` 회전축에 매단 구조입니다.
`jointLimb()`이 축 Group을 만들고 메시를 길이의 절반만큼 내려 답니다 —
이렇게 해야 Group을 돌렸을 때 **메시 중앙이 아니라 관절을 중심으로** 회전합니다.

지오메트리·재질은 모듈 레벨에서 1회만 만들어 모든 몬스터가 공유합니다.

**임팩트는 실루엣이 아니라 움직임에서 나옵니다.** `chase`일 때 어깨 진폭을 0.30 → 1.25로,
속도를 3.6 → 9.5로 올리고 팔꿈치·어깨Z에 다른 주기의 사인파를 섞어 허우적거리게 만듭니다.
정적인 형태만 다듬는 것보다 이쪽이 훨씬 효과가 큽니다.
길어진 팔다리에 이 애니메이션이 얹히면서 효과가 더 커졌습니다 — **리그와 애니메이션은
백룸 전환에서 손대지 않았습니다.** 바꾼 것은 재질과 치수뿐입니다.

**빌보드 평면은 쓰지 마십시오.** 한때 캔버스로 그린 전신 텍스처를 평면 1장에 붙여
카메라 쪽으로 돌렸는데, 팔을 휘저을 수 없고 항상 플레이어를 쳐다봐서 진행 방향 단서가
사라집니다. (`THREE.Sprite`는 더 나쁩니다 — r128의 `SpriteMaterial`은 광원의 영향을
아예 받지 않습니다.)

회전은 `this.facing`(진행 방향)으로 목표를 두고 매 프레임 보간합니다.
각도차를 `-π~π`로 감지 않으면 경계에서 한 바퀴 헛돕니다.

### 몬스터 재질 — `MeshBasicMaterial` 순수 검정

**`mkMat()`을 쓰지 않는 유일한 예외입니다.** `mkMat`은 `roughness`/`metalness`를
셰이딩 파라미터로 옮기는 팩토리인데, 여기서는 셰이딩 자체가 없어야 하므로 옮길 것이 없습니다.

`MeshBasicMaterial`은 조명 계산을 통째로 건너뜁니다. 그래서

- 어떤 밝기에서도 **순수한 검정 실루엣이 보장**됩니다
- Phong/Standard보다 **쌉니다**
- 눈 발광이 필요 없어져 `monLightPool`을 통째로 삭제했습니다 (광원 5/6/9/11 → **4/5/6/8**)

`fog`는 그대로 적용됩니다. 멀어질수록 안개색에 잠겨 대비가 약해지는데, 이게 거리감을
만들고 참고 사진의 원경 실루엣과도 맞습니다.

### 밝기에 따른 몬스터 가시성 (실측)

검은 실루엣은 배경 밝기에 따라 완전히 다르게 보입니다. 이건 버그가 아니라 **설계**입니다.

| 구역 | 배경 밝기 | 몬스터가 차지하는 뚜렷한 화소 |
|---|---|---|
| 밝은 복도 | 114 | **32.2%** |
| 중간 | 33 | 34.0% |
| 어두운 구역 | 22 | **0.83%** |

어두운 구역에서는 사실상 보이지 않습니다(39배 차이). 배경이 22일 때 안개가 몬스터를
비슷한 값으로 들어올려 서로 묻히기 때문입니다. 밝은 곳에서는 멀리서부터 보여 압박을 주고,
어두운 곳에서는 **발소리·으르렁·심장박동만** 남습니다.

> **몬스터 가시성을 실측할 때 반드시 통제할 것 세 가지.** 세 번 다 틀린 값을 얻었습니다.
> 1. **`#danger` 비네트를 숨길 것** — 몬스터가 가까우면 화면 전체가 붉게 물들어
>    "몬스터 있음/없음" 두 프레임의 차이를 통째로 오염시킵니다.
> 2. **몬스터 속도를 0으로 고정할 것** — 안 그러면 AI가 대기 시간 동안 카메라 쪽으로
>    걸어와, 어두운 구역에서 오히려 화면을 가득 채웁니다(측정값이 뒤집힘).
> 3. **두 프레임의 차이가 `group.visible` 하나뿐이게 할 것** — 위치·상태를 양쪽에서
>    똑같이 세팅하십시오.

### 최종 접근 — 격자 이동의 사각을 메우는 코드

**이 코드를 제거하면 눈앞에 두고도 죽지 않는 버그가 되살아납니다.**

BFS는 칸 중심에서 칸 중심으로만 이동합니다. 몬스터가 플레이어의 칸에 도착하면
`bfsNext()`가 (시작==목표) `null`을 반환해 **거기서 멈춥니다.** 그런데 플레이어는
칸 안 아무 데나 설 수 있어(벽 충돌 여유 `PLAYER_R=0.32` 때문에 칸 중심에서
최대 **0.96칸**) 즉사 판정 `MON_KILL_R=0.7`에 닿지 않는 사각이 생깁니다.

실측 재현: 플레이어를 칸 구석(중심에서 0.93칸)에 두고 몬스터를 같은 칸 중심에
세우면, 추격 상태인데도 **거리가 0.933에서 5초간 멈춘 채 죽지 않았습니다.**

그래서 `chase` + 시야 확보 + 거리 `CELL*1.2` 이내이면 격자를 버리고 플레이어의
**실제 좌표**로 직접 향합니다. 시야 조건이 있어 벽을 뚫지 않습니다
(추격 349프레임 동안 몬스터가 벽 칸에 들어간 경우 0회).

직접 접근 중에도 `gx`/`gz`를 따라 갱신하되 **길 칸일 때만** 옮깁니다.
벽 칸에서 `bfsNext()`가 출발하면 경로를 찾지 못합니다.

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
| 발각 비명 | **3D 위치**, 녹음 음원 | `playShriek(x, z)` |
| 추격 중 으르렁 | **3D 위치** | `playGrowl(x, z)` |
| 형광등 버즈 | **3D 위치** | `panelBuzz(x, y, z)` |
| 심장박동 | 2D, 거리 비례 | `heartbeat(intensity)` |
| 열쇠 획득 | 2D | `playKeyPickup()` |
| 잠긴 문 | 2D | `playLocked()` |

### 거리감 — 멀면 작게, 가까우면 크게

3D 소리는 `PannerNode`의 `inverse` 거리 모델을 씁니다. **`rolloffFactor`가 거리감을
좌우합니다** — 값이 작으면 멀리서도 또렷이 들려 위치 판단이 안 됩니다.
현재 비명 1.9 / 으르렁 1.8 / 발소리 1.7이고, `refDistance`는 2 안팎입니다.

심장박동은 2D라 거리 모델이 없어 게인을 직접 계산합니다. **선형이 아니라 제곱**
(`.26 × intensity²`)입니다. 선형이면 6칸 거리에서도 또렷이 들려 긴장감이 평평해집니다.

출구의 저주파 험은 **의도적으로 제거**했습니다. 되살리지 마십시오.
그 대가로 출구를 소리로 찾을 수 없어졌고, 미니맵이 유일한 단서입니다.

### 발각 비명만 녹음 음원 (`SHRIEK_MP3`)

유일한 외부 음원입니다. **base64 data URI로 index.html에 심어** 뒀습니다 —
단일 HTML 파일 구성이 유지되고, `sw.js` 캐시 목록·오프라인 동작·미리보기 빌드가
모두 손댈 필요 없이 그대로 굴러갑니다. mono 44.1kHz MP3 2종(1.45초 + 1.26초), 21KB.

**동시 재생 금지** — 몬스터가 최대 3마리라 각자 발각되면 비명이 겹쳐 뭉갭니다.
`_shriekBusyUntil`이 재생 종료 + `SHRIEK_GAP`까지 새 비명을 막습니다.
클립은 매번 무작위로 고르고 `playbackRate`도 ±6% 흔듭니다.

**MP3인 이유**: 원본은 AAC(m4a)였는데 iOS Safari는 되지만 오픈소스 Chromium 빌드에는
AAC 디코더가 없어 검증이 불가능합니다. MP3는 전 브라우저가 지원합니다.

`decodeAudioData`가 실패하면 `playShriekSynth()`(톱니 2개 합성)로 자동 폴백합니다.
**이 폴백을 제거하지 마십시오** — 코덱 지원은 브라우저마다 다릅니다.

디코드는 `unlockAudio()` 안에서 1회만 합니다. `AudioContext`가 사용자 제스처
안에서만 열리기 때문입니다.

> 음원을 교체할 때는 **반드시 앞뒤 무음을 잘라내고 피크를 1.0 아래로 내리십시오.**
> 원본은 4.3초에 비명이 두 번 들어 있고 피크가 1.329로 클리핑돼 있었습니다.
> ffmpeg에서 `afade`는 반드시 `atrim,asetpts=PTS-STARTPTS` **뒤에** 두십시오.
> 앞에 두면 자르기 전 원본 타임라인 기준으로 페이드가 걸려 소리 중간이 잘립니다.

**iOS 주의**: `AudioContext`는 사용자 제스처 안에서 `resume()`해야 소리가 납니다.
시작/재시도/다음레벨 버튼에 `unlockAudio()`가 연결되어 있습니다.

구형 Safari 대응으로 `positionX` (AudioParam) / `setPosition()` 양쪽 폴백이 있습니다. 유지하십시오.

### Fog of War 미니맵
`visited[][]` 2차원 배열에 탐험 여부 기록.
전방 **2칸 · 시야각 120°(±60°)** 안에서 LOS가 통하는 칸만 밝힙니다.
몬스터는 해당 칸이 탐험된 경우에만 미니맵에 표시됩니다.

### 조작 — 좌측 이동 / 우측 시선

모바일 1인칭 게임의 표준 배치입니다. 화면을 좌우 절반으로 나눈 **보이지 않는 터치 영역** 2개.

| 영역 | 역할 |
|---|---|
| `#touchL` (좌측 절반) | 플로팅 아날로그 스틱 — 누른 자리에 생기고 떼면 사라짐 |
| `#touchR` (우측 절반) | 좌우 문질러 시선 회전 (감도 `0.011`) |
| 키보드 | WASD / 화살표 |

**`jFwd`는 전진이 -1**입니다(게임 루프에서 `-jFwd`로 반전). `dSide`는 우횡이동이 +1.
스틱은 이 둘에 **소수값**을 넣습니다 — 이동 계산식이 그대로 비례 속도를 만들어 주므로
계산식은 손댈 필요가 없습니다.

**살살 밀면 잠입이 됩니다.** 몬스터의 청각 감지는 `P.spd >= 1.5`가 조건인데,
스틱을 1/3 이하로 밀면 속도가 그 아래로 유지됩니다(12px → 0.59).

**원형 클램프를 제거하지 마십시오.** 없으면 대각선 입력이 `√2`배 빨라집니다.
십자키 시절 전진+횡이동을 동시에 누르면 4.50이 아니라 **6.36**이 나오던 버그가
이 클램프로 해결됐습니다.

`touchcancel`도 반드시 `touchend`와 같이 처리해야 합니다 — 놓치면 손을 뗐는데
계속 걸어갑니다.

**⚠️ `#touchL`은 성능 패널 아래에서 시작해야 합니다.** `#perfToggle`(z-index 31)이
좌측 상단을 차지하고 있어, 영역이 겹치면 스틱 대신 패널이 토글됩니다.
세로는 `top:272px`, 가로는 `top:178px`(미디어쿼리)로 맞춰 뒀습니다.

### 가로모드

`@media (max-height:520px)`로 처리합니다. 세로 기준으로 짜인 고정 크기(성능 패널,
미니맵 110px, HUD)가 390px 높이를 다 잡아먹기 때문입니다.

> **과거 버그**: `#controls`의 z-index가 `#perfToggle`(31)보다 낮아, 화면이 짧은
> 가로모드에서 성능 패널의 투명 터치판이 십자키를 덮어 **버튼 입력이 통째로 먹히지
> 않았습니다.** `elementFromPoint`로 확인하면 전진 버튼 자리에서 `perfToggle`이
> 잡혔습니다. 조작 UI를 추가할 때는 항상 두 방향 모두에서 히트테스트를 확인하십시오.

### 노치 — `viewport-fit=cover` + 안전 영역 여백

**`viewport-fit=cover`를 빼지 마십시오.** 이게 없으면 노치가 있는 아이폰에서 iOS가
**뷰포트를 안전 영역 안으로 줄여버리고**, 남는 자리에 배경색(`#080a10`)이 그대로
드러납니다. 가로모드에서 위·좌·우에 검은 띠가 생기고 HUD가 잘렸습니다.
`apple-mobile-web-app-capable`이 켜져 있어 상단까지 생깁니다.

화면은 끝까지 그리되, UI만 `:root`의 `--sat/--sal/--sar/--sab` 변수로 안쪽에 둡니다.
`env(safe-area-inset-*, 0px)`이라 미지원 브라우저에서는 0으로 떨어집니다.

터치 영역(`#touchL`/`#touchR`)은 일부러 화면 끝까지 둡니다 — 노치 안쪽은 애초에
손가락이 닿지 않으므로 여백을 줄 이유가 없고, 영역은 넓을수록 좋습니다.

> 헤드리스 브라우저에는 `env()` 값이 없어 **실기기 확인이 필요합니다.**
> 검증할 때는 `:root` 변수를 직접 덮어써 노치를 흉내낼 수 있습니다.

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
| `panelLights` | 2 | 3 | 4 | 6 |
| **총 광원 수** (ambient + 천장등 + 출구) | **4** | **5** | **6** | **8** |
| `texSize` | 128 | 256 | 256 | 512 |
| `aniso` (0=최대) | 1 | 1 | 4 | 0 |
| `aa` | ✗ | ✗ | ✓ | ✓ |
| `matType` | phong | phong | standard | standard |
| `ambient` | **0.78 (전 프리셋 동일)** | ← | ← | ← |
| `panelRange` | **7.2 (전 프리셋 동일)** | ← | ← | ← |
| `panelPower` | 1.42 | 1.15 | 1.00 | 1.00 |
| `panelInterval` | 0.20s | 0.15s | 0.12s | 0.10s |
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
벽이 세그먼트 1개짜리 `BoxGeometry`(정점 8개)라, 천장등 `PointLight`의 감쇠가 정점에서만
계산되어 빛이 사각 얼룩으로 뭉개집니다. 이 게임은 천장등이 만드는 빛웅덩이가 분위기의
핵심이라 치명적입니다.
`MeshPhongMaterial`은 픽셀 단위 조명을 유지하면서 Standard의 PBR 연산(BRDF)만 걷어냅니다.

재질은 `mkMat()` 팩토리를 통해서만 생성하십시오. `roughness`/`metalness`를
`shininess`/`specular`로 근사해 넘깁니다. **`new THREE.MeshStandardMaterial()` 직접 호출 금지.**

### 텍스처 — 크기 파라미터화 필수

`makeWallpaper/makeCarpet/makeDropCeiling(size)`의 모든 좌표·크기·반복 횟수는 **256px 기준으로 작성한 뒤
`s = size/256`을 곱합니다.** 캔버스 크기만 바꾸면 128에서는 벽돌이 2×4개만 나오고,
바닥 타일 좌표(256까지 채움)가 캔버스 밖으로 넘어가 타일링 이음새에 빈 영역이 드러납니다.
텍스처에 무언가 추가할 때 이 규칙을 지키십시오. 마무리는 `finishTex()`가 담당합니다(wrap + anisotropy).

### 밝기 보정 — 광원을 늘리지 않고 조절하는 축

광원이 적은 프리셋은 천장등 사이 구간이 어두워집니다. 이때 `panelLights`를 늘리면
1번 규칙에 정면으로 위배되므로, 대신 아래 세 값을 씁니다. **셋 다 픽셀당 광원 순회
횟수를 바꾸지 않아 사실상 공짜입니다.**

| 값 | 무엇을 정하나 | 프리셋별로 달라도 되나 |
|---|---|---|
| `ambient` | **어두운 구역의 밝기** (천장등이 없으니 이것뿐) | **안 됨 — 전 프리셋 동일** |
| `panelRange` | 감쇠 "모양" (`PointLight.distance`) | **안 됨 — 전 프리셋 동일** |
| `panelPower` | 천장등 세기 배수 | 됨. 광원 개수 차이를 여기서 보정 |

**앞의 둘을 프리셋별로 다르게 두면 안 되는 이유**는 백룸에서 어두운 구역이 장식이 아니라
**게임플레이**이기 때문입니다 — 검은 몬스터가 거기서 보이지 않습니다. 품질 설정이
어두운 구역의 밝기를 바꾸면 곧 난이도를 바꾸는 것이고, 설계 원칙 3번 위반입니다.

실측으로 두 번 확인했습니다.

| 시도 | 어두운 구역 (LOW / HIGH) | 결과 |
|---|---|---|
| `ambient` 1.18 / 1.10 | 90 / 75 | 명암비가 1.35배 대 1.83배로 갈림 |
| `panelRange` 8.8 / 7.2 | 복도 중간 88 / 46 | 넓은 range가 벽을 뚫고 어두운 구역까지 밝힘 |
| **현재 (둘 다 통일)** | **29.5 / 30.4** | 프리셋 간 편차 소멸 |

> ⚠️ **`shadowMap`이 꺼져 있어 `PointLight`는 벽을 그대로 통과합니다.**
> 그래서 `panelRange`(7.2 = 3.6칸)가 `DARK_BLOCK`(5칸)과 비슷하면 어두운 구역 가장자리가
> 이웃 구역 빛으로 밝아집니다. 어두운 구역 크기를 줄이려면 range부터 같이 줄여야 합니다.

**밝기 실측 기준값** (시드 고정 미로, 화면 평균 휘도):

| 위치 | 값 |
|---|---|
| 천장등 바로 아래 | 144~151 |
| 복도 중간 | 40~43 |
| 어두운 구역 깊은 곳 | **29~31 (프리셋 무관)** |

과거 던전에서 `ambient 4.6 / torchRange 10 / torchPower 1.3`을 한꺼번에 올렸다가
평균 밝기가 34 → 69로 2배가 되어 분위기가 날아간 적이 있습니다. **밝기는 반드시
한 번에 하나씩 바꾸고 매번 실측하십시오.**

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

### 프리셋을 올린다고 항상 좋아지지 않습니다

적응형은 **FPS만 보고 `renderScale`을 내립니다.** 더 무거운 프리셋을 고르면 그 대가로
해상도가 깎여, 실효 픽셀 밀도가 오히려 낮아질 수 있습니다.

아이폰 실측 예:

| | prCap | × renderScale | **실효 배율** | FPS |
|---|---|---|---|---|
| HIGH | 2.0 | ×1.00 | **2.0** | 59~60 |
| ULTRA | 3.0 | **×0.50** (하한) | **1.5** | 53~60 |

ULTRA는 광원이 11개라 절반 해상도로도 60을 못 지키고, 결과적으로 **HIGH보다 흐리고
불안정**합니다. `품질` 행의 배율이 하한(0.5)에 붙어 있으면 그 프리셋은 그 기기에
과합니다 — 한 단계 내리는 것이 화질·프레임 모두에 이득입니다.

### 검증 방법

계측 오버레이 하단에 `품질 <프리셋> ×<renderScale>` 행이 추가되어 있습니다.
`renderScale`이 프리셋 기본값보다 낮으면 노란색으로 표시됩니다(적응형이 하향한 상태).
**1회 탭(기록 초기화)은 `renderScale`도 프리셋 기본값으로 되돌립니다** — 프리셋별 실측 조건을
맞추기 위한 것입니다. 프리셋을 바꿔가며 측정할 때는 항상 1회 탭 후 시작하십시오.

---

## 진행 저장 — `js/save.js`

`localStorage['de_progress']`에 `{bestLevel, totalEscapes, resumeLevel}`를 남깁니다.

`resumeLevel`이 핵심입니다. 이게 있어야 **승리·사망 화면에서 품질을 바꿔도**(= 리로드)
진행이 날아가지 않습니다. 그래서 품질 선택 UI가 타이틀 외 두 화면에도 붙어 있습니다.

- `markLevel(lv)` — 레벨 진입 시. `resumeLevel` 갱신 + `bestLevel` 최고치 유지
- `markEscape(nextLevel)` — 탈출 시. **`resumeLevel`을 다음 레벨로 올립니다.**
  이걸 빼먹으면 승리 화면에서 리로드했을 때 방금 깬 레벨을 다시 하게 됩니다
- `resetRun()` — "처음부터". 평생 기록은 남기고 `resumeLevel`만 1로

저장 형식이 손상돼도 게임이 죽지 않도록 필드별로 `Number.isFinite` 검사 후 받습니다.

---

## 열쇠와 잠긴 문

**출구 자체가 문입니다.** 미로 중간에 문을 세우지 않습니다 — 그러면 열쇠가 문 뒤에
갇혀 클리어 불가능한 판이 나올 수 있고, 이를 막으려면 배치 때마다 도달 가능성 검사를
돌려야 합니다. 출구를 잠그면 미로 전체가 **언제나** 도달 가능하므로 그 검사가 통째로 사라집니다.

| 상태 | 출구 | 바닥 링 | 출구 광원 | 미니맵 |
|---|---|---|---|---|
| 열쇠 없음 | 문 슬래브 + 자물쇠 (`doorGroup`) | 호박색 | 호박색 | 호박색 |
| 열쇠 있음 | 회전하는 초록 포탈 (`cachedPortal`) | 초록 | 초록 | 초록 |

전환은 `applyKeyState()` 한 곳에서만 합니다. **광원 개수는 바뀌지 않습니다** —
`cachedExitLight`는 하나 그대로 두고 `color`만 바꿉니다(최우선 규칙 1·2번).
문과 자물쇠, 열쇠는 전부 emissive 재질이라 새 광원을 만들지 않습니다.

문은 `exitPos`의 **뚫린 이웃 쪽을 향해 고정**합니다. 돌아가게 하면 우스꽝스럽습니다.

열쇠는 시작 지점 기준 BFS 거리가 **최대치의 45% 이상**인 칸 중 무작위(출구 칸 제외).
획득 반경은 `KEY_PICK_R = 0.75`.

> ⚠️ **`keyPos`는 `buildWorld()`보다 먼저 정해야 합니다.**
> `buildWorld()`가 `keyPos`를 읽어 열쇠 메시를 놓습니다. 처음에 키 배치 코드를
> `buildWorld()` 뒤에 뒀더니 메시가 **직전 레벨의 열쇠 칸**(첫 판은 초기값 `(1,1)`)에
> 놓였습니다. 획득 판정은 `keyPos`를 직접 보므로 **상태 전이 테스트는 전부 통과했고**,
> 화면에만 열쇠가 없었습니다. 로직 검증만으로는 못 잡습니다 —
> **메시의 월드 좌표를 실제로 찍어 보십시오.**

---

## 다음 작업 후보 (우선순위)

| 순위 | 작업 | 비고 |
|---|---|---|
| 중간 | 게임플레이 확장 | 스태미나·달리기, 은신, 층 개념, 몬스터 종류 분화 |
| 낮음 | ~~열쇠·잠긴 문~~ | 완료 |
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
