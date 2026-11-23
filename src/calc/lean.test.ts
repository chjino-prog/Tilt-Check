import { describe, expect, it } from 'vitest';
import { refFromMeasure } from './basis';
import { leanFromFace, leanOfLonglHigh, longlHighOfLean } from './sign';

// 숫자는 시험용으로 지어낸 값 (회사 데이터 아님)
const D = Math.PI / 180;
type V = [number, number, number];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: V): V => {
  const n = Math.hypot(...a);
  return [a[0] / n, a[1] / n, a[2] / n];
};

/**
 * 땅 좌표 : x = 선수 쪽 수평, z = 위. FRAME 면의 법선 = LONGL.(선수 방향) uX.
 * 사람이 facing 쪽을 바라보고 서서, 눈앞 웹 면에 폰 뒷면을 붙이면 화면은 사람 쪽(−facing)을 본다.
 */
function phoneFace(uX: V, facing: 1 | -1): number {
  const screen = unit(dot(uX, [facing, 0, 0]) > 0 ? [-uX[0], -uX[1], -uX[2]] : uX); // 사람 쪽을 보는 면
  return Math.asin(dot(screen, [0, 0, 1])) / D;
}

describe('FRAME 누운 쪽', () => {
  it('누운 쪽 = LONGL. 낮은 끝 = 높은 쪽의 반대', () => {
    expect(longlHighOfLean(1)).toBe(-1);
    expect(leanOfLonglHigh(-1)).toBe(1);
  });

  for (const fa of [2, 9, 13]) {
    for (const bowLow of [true, false]) {
      const lean = bowLow ? 1 : -1; // LONGL. 선수 끝이 낮으면 선수로 누움
      // T.A 로 굴린 자세까지 섞어도 같아야 한다
      const uX = unit([Math.cos(fa * D), 0.3, (bowLow ? -1 : 1) * Math.sin(fa * D) * Math.hypot(Math.cos(fa * D), 0.3) / Math.cos(fa * D)]);
      for (const facing of [1, -1] as const) {
        it(`F.A ${fa}° · ${lean > 0 ? '선수' : '선미'}로 누움 · ${facing > 0 ? '선수' : '선미'}를 보고 잼`, () => {
          const face = phoneFace(uX, facing);
          expect(Math.abs(face)).toBeCloseTo(Math.asin(Math.abs(uX[2])) / D, 6); // 판이 누운 각 = LONGL. 기울기
          expect(leanFromFace(face, facing)).toBe(lean);
          // 저장 : LONGL. 높은 쪽으로 넘기면 현물 F.A 방향 = 누운 쪽
          expect(refFromMeasure(30, Math.abs(face), longlHighOfLean(lean)).refFaDir).toBe(lean);
        });
      }
    }
  }

  it('거의 수직이면 방향 없음', () => {
    expect(leanFromFace(0.001, 1)).toBeNull();
  });
});
