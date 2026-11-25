# TILT CHECK

지주캡(메인) · 일반 부재(추가 기능) 각도 측정 PWA. 작업지시서 원본 : `작업지시서_지주캡각도앱.md` (저장소에는 안 올림).

## 꼭 지킬 것
- 저장소 · 코드에 회사 데이터(호선번호 · 블록값) 금지. 예시값은 `src/calc/angle.test.ts` 에만.
- 외부 전송 기능 금지. 데이터는 기기 안(IndexedDB · localStorage)에만.
- 계산식은 작업지시서 2 · 3장 식 그대로. 선수 = +1, 선미 = −1. 계산을 고치면 `npm test` 전부 통과 확인.
- 1.6.0 부터 식에 **넣는 값**을 바꾼다 (2026-11-24 현장 분석, 식 전체는 `docs/계산식.md`) : 도면 δ 는 외판 면 위 각도 → 캡 자리 외판 기울기로 상판 δ 로 바꿔 계산하고 실제 δ · 회전오차 · dA · dB 는 외판 위 각도로 돌려준다 / 도면 T.A 는 회전각 → 경사 = asin(sin T.A · cos F.A) (현물 T.A 는 그대로) / 턴오버 후(잴 때 캡이 하늘을 봄)면 s 를 뒤집는다. 결과 → 기록 칸은 `calc/capcalc.ts` 한 곳에서.
- 1.7.0 부터 외판 보정은 정확식 tan δ외판 = tan δ상판 · cos θ, **판정은 A · B 현물 비교** (OK / 주의 / NG, `judge.ts capJudge`, 설정 '합격 허용오차' 기본 ±3°). 역산 회전각은 참고 — 넘으면 '주의' 만. 기록에 그때 허용오차를 남긴다.
- F.A 방향은 화면에서 'FRAME 이 누운 쪽'으로 말한다 (= LONGL. 라인의 낮은 끝, 저장값 faDir 그대로).
- 화면 · 기록은 부호를 받지 않는다 — 숫자 + 선수/선미. 부호 붙이는 규칙은 `src/calc/sign.ts` 한 곳에만 (s = 캡 방향 × F.A 방향 × (턴오버면 −1), F.A 방향 쪽 끝이 낮음, 도면 '돌아간 방향' = 캡 WEB 외판 쪽 끝이 가는 쪽). δ 0 캡은 늘 선수로 계산 (회전오차 + = 선수 쪽) · 외판 기울기도 안 씀.
- 방향 실수 막기 : 폰으로 높은 쪽을 잴 때는 '폰 머리 → 선수'를, FRAME 웹을 잴 때는 '선수를 보고 서기'를 지시하고 잴 때마다 확인받는다 (지난 값을 기억해 쓰지 않음).
- 폰 측정은 두 가지 : 선 재기(긴 축, 세워서 권장) · 판 기울기 재기(화면 축, 현물 F.A 의 FRAME 웹 전용 — 위아래 두 번 평균, 뒷면 보정). 결과는 A 로 캡 · F.A 방향을 점검(`dirSuspect`)해 의심되면 판정 보류, 높은 쪽이 판정을 가르는 캡(`highSensitive`)은 두 결과를 나란히 보여주고 'B 다시 재기'로만 고친다.
- 화면은 토스 느낌 : 화면마다 주 버튼 하나(하단 고정), 질문형 큰 제목, '~해요' 말투, 설명은 시트로.

## 사용 환경
- 폰 브라우저(안드로이드 크롬 · 아이폰 사파리), https 필수(GitHub Pages). 회사 PC 에는 아무것도 설치하지 않음.
- 개발 : 집 PC, Node + Vite + Preact + TypeScript, 시험 Vitest.

## 구조
- `src/calc/angle.ts` 순수 계산(외판 기울기 환산 · 도면 T.A 경사 포함) · `sign.ts` 선수/선미 → 부호 · 턴오버 · 외판 보정 감싸기 · `basis.ts` 계산 기준(도면/현물 T.A · F.A) · `capcalc.ts` 계산 → 기록 칸 · 지난 기록 다시 계산 · `judge.ts` 판정/표시 · `csv.ts` 내보내기 · `report.ts` 결재용 보고서 정리
- `src/sensor/tilt.ts` 센서 → 각도 (긴 축 angle · 화면 축 face, EMA + 1초 평균, 안정 판정, |g| 검사, 영점 · 뒷면 보정 · 부호)
- `src/db/store.ts` IndexedDB (blocks · caps · records) · `draft.ts` 측정 중간 저장(localStorage) · `src/settings.ts` 설정(localStorage)
- `src/ui/screens/*` 화면 (`ref.tsx` = 현물 기준 재기(FRAME 웹 / LONGL. 라인), `report.tsx` = A4 보고서 · 인쇄) · `src/ui/components/*` 공통 조각 · `src/styles.css` 디자인 토큰 · `src/report.css` 보고서 종이 · 인쇄
- `public/sw.js` 오프라인 (빌드 때 파일 목록 자동 주입) · `tools/make_icons.py` 아이콘 · `tools/make_cap_phone.py` 폰 대는 법 입체 그림 → `public/cap-phone.svg`
- 바텀시트 : 스크롤 잠금 · 폰 뒤로가기(맨 위 시트만 닫기)는 `src/ui/router.ts` 의 열린 시트 목록 하나로 처리

## 필요할 때 읽을 문서
| 문서 | 내용 |
|---|---|
| `docs/사용설명서.md` | 사용법 · 설정 · 바뀐 점 |
| `docs/계산식.md` | 지주캡 계산식 전체 (1.6.0 보정 포함) · 엑셀 식 · 시험값 |
| `docs/배포.md` | GitHub 저장소 · Pages 배포 · 버전 |
