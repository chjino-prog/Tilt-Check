// 지주캡 계측 보고서 — A4 한 장(결재용). 화면에서는 폭에 맞춰 줄여 보여 주고, 인쇄 · PDF 저장은 인쇄 창으로.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { BASIS_DIFF_OK, buildReport, hhmm, reportFileName, shortDate, spanText, type Report, type ReportRow } from '../../calc/report';
import { dirName, leanText } from '../../calc/sign';
import { fmt } from '../../calc/judge';
import { getBlock, listCaps, listRecordsByBlock } from '../../db/store';
import { useSettings } from '../../settings';
import { Cta, Empty, Sheet, TopBar } from '../components/ui';
import { ITabRecord, IWarn } from '../icons';
import '../../report.css';

const f2 = (v: number | null | undefined) => fmt(v == null ? v : Math.abs(v), 2);

/** 인쇄 창 열기 — 저장되는 PDF 이름이 문서 제목을 따르므로 잠깐 바꿔 둔다 */
function printReport(fileName: string) {
  const old = document.title;
  document.title = fileName;
  const restore = () => {
    document.title = old;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
  setTimeout(restore, 1500); // afterprint 가 오지 않는 브라우저 대비
}

export function ReportScreen(p: { blockId: string }) {
  const s = useSettings();
  const [rep, setRep] = useState<Report | null | undefined>(undefined);
  const [pdfHelp, setPdfHelp] = useState(false);
  const [now] = useState(Date.now());

  useEffect(() => {
    Promise.all([getBlock(p.blockId), listCaps(p.blockId), listRecordsByBlock(p.blockId)]).then(([b, caps, recs]) =>
      setRep(b ? buildReport(b, caps, recs, s) : null),
    );
  }, [p.blockId, s.rotTol, s.aResidTol]);

  const fileName = rep ? reportFileName(rep, now) : 'TILTCHECK';

  return (
    <div class="screen">
      <TopBar title="보고서" backTo={'/records/' + p.blockId} />
      {rep === null && <Empty icon={ITabRecord} title="블록을 찾을 수 없어요" />}
      {rep && rep.measured === 0 && <Empty icon={ITabRecord} title="아직 잰 지주캡이 없어요" sub="지주캡을 재고 기록을 저장하면 보고서를 만들 수 있어요" />}
      {rep && rep.measured > 0 && (
        <>
          <ReportPreview rep={rep} printedAt={now} />
          <Cta>
            <button class="btn grey" onClick={() => setPdfHelp(true)}>
              PDF 저장
            </button>
            <button class="btn" onClick={() => printReport(fileName)}>
              인쇄
            </button>
          </Cta>
          <Sheet open={pdfHelp} onClose={() => setPdfHelp(false)}>
            <h2>PDF 로 저장해요</h2>
            <p class="sub">인쇄 창이 열리면 프린터 대신 'PDF로 저장'을 고르세요.</p>
            <div class="kv-group">
              <div class="kv">
                <span class="k">안드로이드</span>
                <span class="v">프린터 › PDF로 저장 › 다운로드</span>
              </div>
              <div class="kv">
                <span class="k">아이폰</span>
                <span class="v">공유 › 파일에 저장</span>
              </div>
            </div>
            <p class="note num">파일 이름 : {fileName}.pdf</p>
            <div class="actions mt16">
              <button
                class="btn"
                onClick={() => {
                  setPdfHelp(false);
                  setTimeout(() => printReport(fileName), 250); // 시트가 닫힌 뒤 열기
                }}
              >
                인쇄 창 열기
              </button>
            </div>
          </Sheet>
        </>
      )}
    </div>
  );
}

/** 화면 폭에 맞춰 A4 를 줄여 보여 준다 (인쇄할 때는 원래 크기) */
function ReportPreview(p: { rep: Report; printedAt: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [z, setZ] = useState(1);
  const [over, setOver] = useState(false);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setZ(Math.min(1, el.clientWidth / 794));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div class="rpt-preview">
      {over && (
        <div class="banner" style={{ marginBottom: '12px' }}>
          <IWarn />
          <div>
            <b>캡이 많아 표 아래가 잘려요</b>
            <span class="muted">한 장에는 캡 30개 정도까지 들어가요. 잘린 캡은 CSV 로 확인해 주세요</span>
          </div>
        </div>
      )}
      <div class="rpt-scale" ref={wrap} style={{ height: `${1119 * z}px` }}>
        <ReportSheet rep={p.rep} printedAt={p.printedAt} zoom={z} onOverflow={setOver} />
      </div>
    </div>
  );
}

/** 캡이 많아 넘치면 한 단계씩 촘촘하게 (0 보통 → 1 줄 간격 → 2 그림 작게 → 3 표 두 줄 → 4 그림 뺌)
 *  그래도 넘치면 over = true (화면에만 알림) */
function useFitLevel(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const [lv, setLv] = useState(0);
  const [over, setOver] = useState(false);
  useLayoutEffect(() => setLv(0), [dep]);
  useEffect(() => {
    // 글꼴이 늦게 들어오면 글자 폭이 바뀌므로 처음부터 다시 맞춘다
    document.fonts?.ready.then(() => setLv(0));
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const o = el.scrollHeight > el.clientHeight + 1;
    if (o && lv < 4) setLv(lv + 1);
    else if (o !== over) setOver(o);
  });
  return [ref, lv, over] as const;
}

function ReportSheet(p: { rep: Report; printedAt: number; zoom: number; onOverflow: (o: boolean) => void }) {
  const r = p.rep;
  const [ref, lv, over] = useFitLevel(r);
  useEffect(() => p.onOverflow(over), [over]);
  const span = spanText(r.from, r.to);
  const used = r.basis;
  const tolText = r.tol == null ? '허용 회전오차 미정' : `허용 ±${fmt(r.tol, 2)}° 초과`;

  return (
    <div class={'rpt-sheet' + (lv >= 1 ? ' tight' : '') + (lv >= 3 ? ' two' : '') + (lv === 2 || lv === 3 ? ' figs-s' : '') + (lv >= 4 ? ' figs-none' : '')} ref={ref} style={{ zoom: p.zoom }}>
      <div class="rpt-hdr">
        <span class="rpt-tag">정도 검사 · 계측 결과</span>
        <h1 class="rpt-title">지주캡 각도 계측 보고서</h1>
      </div>
      <table class="rpt-info">
        <tbody>
          <tr>
            <th>호선</th>
            <td class="big">{r.ship}</td>
            <th>블록</th>
            <td class="big">{r.block}</td>
            <th>측정일</th>
            <td>
              {span.day} <span class="rpt-sub">{span.time}</span>
            </td>
            <th>측정자</th>
            <td class="blank" />
          </tr>
        </tbody>
      </table>

      <div class="rpt-hero">
        <div>
          <span class="k">측정 캡</span>
          <span class="v">
            {r.measured}
            <small>{r.measured < r.caps ? ` / ${r.caps}개` : '개'}</small>
          </span>
          {r.measured < r.caps && <span class="s warn">미측정 {r.caps - r.measured}개</span>}
        </div>
        <div>
          <span class="k">OK</span>
          <span class="v ok">
            {r.ok}
            <small>개</small>
          </span>
          {r.undecided > 0 && <span class="s">판정 보류 {r.undecided}개</span>}
        </div>
        <div class={r.ng > 0 ? 'bad' : ''}>
          <span class="k">NG · {tolText}</span>
          <span class={'v' + (r.ng > 0 ? ' ng' : '')}>
            {r.tol == null ? '—' : r.ng}
            {r.tol != null && <small>개</small>}
          </span>
        </div>
        <div class="worst">
          <span class="k">가장 큰 회전오차</span>
          {r.worst ? (
            <>
              <span class={'v' + (r.worst.verdict === 'NG' ? ' ng' : '')}>
                {r.worst.capNo} · {f2(r.worst.rotErr)}°
              </span>
              <span class="s">{r.worst.rotText}</span>
            </>
          ) : (
            <span class="v">—</span>
          )}
        </div>
      </div>

      <Band n={1} title="기준값 확인 — T.A · F.A" right="도면값과 현물(기준 부재를 폰으로 잰 값)을 나란히" />
      <table class="rpt-basis">
        <thead>
          <tr>
            <th />
            <th class={used === 'design' ? 'used' : ''}>도면{used === 'design' ? ' · 계산에 씀' : ''}</th>
            <th class={used === 'ref' ? 'used' : ''}>현물 (폰){used === 'ref' ? ' · 계산에 씀' : ''}</th>
            <th>차이</th>
            <th>확인</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="lab ta">T.A</td>
            <td class={used === 'design' ? 'used' : ''}>
              <span class="num-b">{r.design ? fmt(r.design.ta, 2) + '°' : '—'}</span>
              {r.design?.slope != null && Math.abs(r.design.slope - r.design.ta) >= 0.005 && <small>경사 {fmt(r.design.slope, 2)}°</small>}
            </td>
            <td class={used === 'ref' ? 'used' : ''}>
              <span class="num-b">{r.ref ? fmt(r.ref.ta, 2) + '°' : '—'}</span>
            </td>
            <td class="m">{r.taDiff == null ? '' : fmt(r.taDiff, 2) + '°'}</td>
            <td>{r.taDiff != null && <Mark kind={r.taDiff <= BASIS_DIFF_OK ? 'ok' : 'warn'} />}</td>
          </tr>
          <tr>
            <td class="lab fa">F.A</td>
            <td class={used === 'design' ? 'used' : ''}>
              <span class="num-b">{r.design ? fmt(r.design.fa, 2) + '°' : '—'}</span>
              {r.design && <small>{r.design.faDir ? leanText(r.design.faDir) : '방향 없음'}</small>}
            </td>
            <td class={used === 'ref' ? 'used' : ''}>
              <span class="num-b">{r.ref ? fmt(r.ref.fa, 2) + '°' : '—'}</span>
              {r.ref && <small>{r.ref.faDir ? leanText(r.ref.faDir) : '방향 없음'}</small>}
            </td>
            <td class="m">
              {r.faDiff == null ? '' : fmt(r.faDiff, 2) + '°'}
              {r.faDirSame != null && (r.faDirSame ? ' · 방향 같음' : ' · 방향 반대')}
            </td>
            <td>{r.faDiff != null && <Mark kind={r.faDirSame === false ? 'bad' : r.faDiff <= BASIS_DIFF_OK ? 'ok' : 'warn'} />}</td>
          </tr>
        </tbody>
      </table>
      <Checks rep={r} />

      <Band n={2} title="측정 방향" right="B : 폰 머리 → 선수, 높은 쪽 기록 · A : 숫자만" />
      <div class="rpt-figs">
        <Fig cls="ts-ta" kind="ta" label="TS · A (T/A)" desc="④ 주판 · ①과 평행" />
        <Fig cls="ts-fa" kind="fa" label="TS · B (F/A)" desc="④ 주판 · ②③과 평행" />
        <Fig cls="psa-ta" kind="ta" label="PSA · A (T/A)" desc="③ 주판 · ①②와 평행" />
        <Fig cls="psa-fa" kind="fa" label="PSA · B (F/A)" desc="③ 주판 · ④⑤와 평행" />
      </div>

      <Band n={3} title="캡별 결과" right="회전오차 = B 실측으로 역산한 실제 δ − 도면 δ (외판 위 각도)" />
      {lv < 3 ? (
        <table class="rpt-res">
          <thead>
            <tr>
              <th class="l">캡</th>
              <th>도면 δ</th>
              <th>B 정상 → 실측 (높은 쪽)</th>
              <th>A 정상 → 실측</th>
              <th class="l">회전오차</th>
              <th>판정</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.map((x) => (
              <ResRow row={x} />
            ))}
          </tbody>
        </table>
      ) : (
        // 캡이 아주 많으면 두 줄로 나눠 B 실측 · 회전오차 · 판정만
        <div class="rpt-res2">
          {[r.rows.slice(0, Math.ceil(r.rows.length / 2)), r.rows.slice(Math.ceil(r.rows.length / 2))].map((half) => (
            <table class="rpt-res">
              <thead>
                <tr>
                  <th class="l">캡</th>
                  <th>도면 δ</th>
                  <th>B 실측</th>
                  <th class="l">회전오차</th>
                  <th>판정</th>
                </tr>
              </thead>
              <tbody>
                {half.map((x) => (
                  <ResRow row={x} compact />
                ))}
              </tbody>
            </table>
          ))}
        </div>
      )}
      <div class="rpt-memo">비고</div>
      <div class="rpt-foot">
        <span>
          TILT CHECK {__APP_VERSION__} · 각도는 폰 센서 측정값 (디지털 수평계와 다를 수 있음)
          {r.skippedLegacy > 0 && ` · 1.2.0 전 기록 ${r.skippedLegacy}건 뺌`}
        </span>
        <span>
          출력 {shortDate(p.printedAt)} {hhmm(p.printedAt)}
        </span>
      </div>
    </div>
  );
}

function Band(p: { n: number; title: string; right: string }) {
  return (
    <div class="rpt-band">
      <span class="n">{p.n}</span>
      {p.title}
      <span class="r">{p.right}</span>
    </div>
  );
}

function Mark(p: { kind: 'ok' | 'warn' | 'bad' }) {
  // 글꼴마다 ✓ 기호가 없을 수 있어 그림으로 그린다
  const d = p.kind === 'ok' ? 'M6 12.5l4 4L18 8' : p.kind === 'warn' ? 'M12 6.5v7M12 17.2v.3' : 'M7.5 7.5l9 9M16.5 7.5l-9 9';
  return (
    <span class={'rpt-mark ' + p.kind} aria-label={p.kind === 'ok' ? '확인' : p.kind === 'warn' ? '주의' : '틀림'}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d={d} />
      </svg>
    </span>
  );
}

/** 기준값을 제대로 넣었는지 — A 일치 · 방향 점검 · 같은 방향 쏠림 */
function Checks(p: { rep: Report }) {
  const r = p.rep;
  const lines: { kind: 'ok' | 'warn' | 'bad'; text: string }[] = [];
  const faLow = r.rows.find((x) => x.measured) && (r.basis === 'ref' ? r.ref?.faDir : r.design?.faDir);
  const faNote = faLow ? ` (F.A ${dirName(faLow)} 블록 = FRAME 이 ${leanText(faLow)})` : '';
  if (r.dirWarnCaps.length) {
    lines.push({ kind: 'bad', text: `${r.dirWarnCaps.join(', ')} : 각도 A 가 반대 방향 정상값에 더 맞아요 — 캡 방향 · F.A 방향 확인 전까지 판정 보류` });
  } else if (r.aOk === true) {
    lines.push({ kind: 'ok', text: `각도 A 실측이 정상값과 모두 ${fmt(r.aMaxDiff, 2)}° 안 — T.A · 캡 방향 · F.A 방향을 바르게 넣었어요.${faNote}` });
  } else if (r.aOk === false) {
    lines.push({ kind: 'warn', text: `각도 A 가 정상값과 최대 ${fmt(r.aMaxDiff, 2)}° 달라요 — T.A · 측정 위치 확인 필요${faNote}` });
  }
  if (r.sameSign.warn) {
    lines.push({ kind: 'warn', text: `모든 캡이 ${r.sameSign.sign > 0 ? '선수' : '선미'} 쪽으로 돌았어요 — 블록 세팅 · 마킹 기준 확인 필요` });
  }
  if (r.noShellCaps.length) {
    lines.push({ kind: 'warn', text: `${r.noShellCaps.join(', ')} : 캡 자리 외판 기울기 없이 계산 — 서 있는 외판이면 회전오차가 크게 틀릴 수 있어요` });
  }
  if (r.turned) {
    lines.push({ kind: 'ok', text: '턴오버 후 확인 — 지주캡이 하늘을 보는 자세로 캡 방향을 계산했어요' });
  }
  return (
    <>
      {lines.map((l) => (
        <div class={'rpt-note ' + l.kind}>
          <Mark kind={l.kind} />
          <span>{l.text}</span>
        </div>
      ))}
    </>
  );
}

function Fig(p: { cls: string; kind: 'ta' | 'fa'; label: string; desc: string }) {
  return (
    <div class={'rpt-fig ' + p.kind}>
      <div class="img">
        <div
          class={'crop ' + p.cls}
          role="img"
          aria-label={p.label + ' 측정 방향 그림'}
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}cap-guide.webp)` }}
        />
      </div>
      <div class="cap">
        <b>{p.label}</b>
        <span>{p.desc}</span>
      </div>
    </div>
  );
}

function ResRow(p: { row: ReportRow; compact?: boolean }) {
  const x = p.row;
  const c = !!p.compact;
  const dTxt = Math.abs(x.delta) < 1e-9 ? '0°' : `${fmt(x.delta, 0)}° ${dirName(x.capDir)}${x.shell != null ? ` · 외판 ${fmt(x.shell, 0)}°` : ''}`;
  if (!x.measured) {
    return (
      <tr class="none">
        <td class="capno">{x.capNo}</td>
        <td>{dTxt}</td>
        <td colSpan={c ? 2 : 3} class="l rpt-sub">
          미측정
        </td>
        <td>
          <span class="rpt-pill none">—</span>
        </td>
      </tr>
    );
  }
  const v = x.verdict;
  const cls = v === 'OK' ? 'ok' : v === 'NG' ? 'ng' : 'none';
  const vText = v === 'OK' || v === 'NG' ? v : v === '기준미정' ? '미정' : '보류';
  // '선수 쪽으로 0.74° 덜 돌아감' → '선수 쪽으로 덜 돌아감' (좁으면 '선수 쪽 덜')
  let rest = x.rotText?.replace(/ [\d.]+°/, '') ?? '';
  if (c) rest = rest.replace('으로', '').replace(' 돌아감', '');
  const high = x.highB ? dirName(x.highB) + '↑' : '수평';
  return (
    <tr class={cls === 'ng' ? 'isng' : x.dirWarn ? 'iswarn' : ''}>
      <td class="capno">{x.capNo}</td>
      <td>{dTxt}</td>
      <td>
        <span class="val">{c ? `${f2(x.measB)}°` : `${f2(x.normalB)} → ${f2(x.measB)}°`}</span> <span class="rpt-sub s">{high}</span>
      </td>
      {!c && (
        <td>
          <span class="val">
            {f2(x.normalA)} → {f2(x.measA)}°
          </span>
        </td>
      )}
      <td class="l nowrap">
        {x.rotErr == null ? (
          <span class="rpt-sub">{x.rotText}</span>
        ) : (
          <>
            <span class={'rot' + (cls === 'ng' ? ' ng' : '')}>{f2(x.rotErr)}°</span> <span class="rpt-sub s">{x.dirWarn ? '방향 확인' : rest}</span>
          </>
        )}
      </td>
      <td>
        <span class={'rpt-pill ' + cls}>{vText}</span>
      </td>
    </tr>
  );
}
