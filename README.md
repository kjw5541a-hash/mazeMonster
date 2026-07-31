# DUNGEON ESCAPE

3D 던전 탈출 호러 게임. 브라우저에서 바로 플레이하는 PWA.

몬스터를 피해 25×25 랜덤 미로를 탈출하세요.

## 플레이

**[▶ 플레이하기](https://USERNAME.github.io/dungeon-escape/)**

> 위 주소의 `USERNAME`을 본인 GitHub 아이디로 바꾸세요.

## 조작

| | 모바일 | 키보드 |
|---|---|---|
| 이동 | 왼쪽 십자키 (전후 + 좌우 횡이동) | W A S D |
| 회전 | 오른쪽 영역 좌우 스와이프 | ← → |

**이어폰 착용을 권장합니다.** 몬스터 발소리가 3D로 들려서 어느 방향에서 오는지 알 수 있습니다.

## 특징

- 매판 새로 생성되는 25×25 미로 (탈출 경로 여러 갈래)
- 시야·청각으로 플레이어를 추적하는 몬스터 AI
- HRTF 기반 3D 공간 오디오
- 탐험한 구역만 밝혀지는 미니맵
- 오프라인 플레이 지원 (PWA)

## 기술

바닐라 JavaScript + Three.js. 빌드 도구 없이 단일 HTML 파일로 동작합니다.

- **렌더링** Three.js r128
- **오디오** Web Audio API (PannerNode / HRTF)
- **경로탐색** BFS
- **미로 생성** Recursive Backtracking + 루프 생성

## 개발자 도구

화면 좌측 상단 성능 패널

- 1회 탭 — 기록 초기화
- 3회 탭 — 표시/숨김

## 로컬 실행

`file://`로 열면 Service Worker와 오디오가 동작하지 않습니다. 반드시 로컬 서버를 사용하세요.

```bash
python3 -m http.server 8000
# http://localhost:8000 접속
```

## 라이선스

MIT
