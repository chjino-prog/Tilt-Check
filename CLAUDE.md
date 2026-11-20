# TILT CHECK

지주캡(메인) · 일반 부재(추가 기능) 각도 측정 PWA. 작업지시서 원본 : `작업지시서_지주캡각도앱.md` (저장소에는 안 올림).

## 꼭 지킬 것
- 저장소 · 코드에 회사 데이터(호선번호 · 블록값) 금지. 예시값은 `src/calc/angle.test.ts` 에만.
- 외부 전송 기능 금지. 데이터는 기기 안(IndexedDB · localStorage)에만.
- 계산식 · 기호 정의는 작업지시서 2 · 3장 그대로. 선수 = +1, 선미 = −1. 계산을 고치면 `npm test` 전부 통과 확인.
- 화면은 토스 느낌 : 화면마다 주 버튼 하나(하단 고정), 질문형 큰 제목, '~해요' 말투, 설명은 시트로.

## 사용 환경
- 폰 브라우저(안드로이드 크롬 · 아이폰 사파리), https 필수(GitHub Pages). 회사 PC 에는 아무것도 설치하지 않음.
- 개발 : 집 PC, Node + Vite + Preact + TypeScript, 시험 Vitest.

## 구조
- `src/calc/angle.ts` 순수 계산 · `basis.ts` 계산 기준(도면/현물 T.A · F.A) · `judge.ts` 판정/표시 · `csv.ts` 내보내기
- `src/sensor/tilt.ts` 센서 → 각도 (EMA + 1초 평균, 안정 판정, |g| 검사, 영점 · 부호)
- `src/db/store.ts` IndexedDB (blocks · caps · records) · `src/settings.ts` 설정(localStorage)
- `src/ui/screens/*` 화면 (`ref.tsx` = 현물 기준 재기) · `src/ui/components/*` 공통 조각 · `src/styles.css` 디자인 토큰
- `public/sw.js` 오프라인 (빌드 때 파일 목록 자동 주입) · `tools/make_icons.py` 아이콘

## 필요할 때 읽을 문서
| 문서 | 내용 |
|---|---|
| `docs/사용설명서.md` | 사용법 · 설정 · 바뀐 점 |
| `docs/배포.md` | GitHub 저장소 · Pages 배포 · 버전 |
