// 블록 · 지주캡 등록/수정 바텀시트
import { useEffect, useState } from 'preact/hooks';
import { blockAnglesLookRight, type Dir } from '../../calc/angle';
import { parseNum } from '../../calc/judge';
import { newId, saveBlock, saveCap, type Block, type Cap } from '../../db/store';
import { Field, NumInput, Seg, Sheet, TextInput, toast } from '../components/ui';

export function BlockSheet(p: { open: boolean; block?: Block | null; onClose: () => void; onSaved: (b: Block) => void }) {
  const [ship, setShip] = useState('');
  const [name, setName] = useState('');
  const [ta, setTa] = useState('');
  const [fa, setFa] = useState('');
  const [faDir, setFaDir] = useState<Dir | null>(null);
  const [memo, setMemo] = useState('');

  useEffect(() => {
    if (!p.open) return;
    const b = p.block;
    setShip(b?.ship ?? '');
    setName(b?.block ?? '');
    setTa(b?.ta != null ? String(b.ta) : '');
    setFa(b?.fa != null ? String(Math.abs(b.fa)) : '');
    setFaDir(b?.faDir ?? null);
    setMemo(b?.memo ?? '');
  }, [p.open, p.block]);

  const taRaw = parseNum(ta);
  const taN = taRaw == null ? null : Math.abs(taRaw); // 크기만 받는다
  const faRaw = parseNum(fa);
  const faN = faRaw == null ? null : Math.abs(faRaw); // 도면은 크기 + 방향, 부호는 받지 않는다
  // T.A · F.A 는 선택 — 모르면 둘 다 비우고 현물에서 잰다. 하나만 넣는 건 막는다.
  const half = (taN == null) !== (faN == null);
  const needDir = faN != null && faN > 0;
  const ready = ship.trim() !== '' && name.trim() !== '' && !half && (!needDir || faDir != null);
  const odd = taN != null && faN != null && !blockAnglesLookRight(taN, faN);

  const save = async () => {
    if (!ready) return;
    const now = Date.now();
    const b: Block = {
      ...p.block, // 현물값 · 계산 기준은 그대로 둔다
      id: p.block?.id ?? newId(),
      ship: ship.trim(),
      block: name.trim().toUpperCase(),
      ta: taN,
      fa: faN,
      faDir: faDir ?? undefined,
      memo: memo.trim(),
      createdAt: p.block?.createdAt ?? now,
      updatedAt: now,
    };
    await saveBlock(b);
    toast(p.block ? '블록을 고쳤어요' : '블록을 추가했어요');
    p.onSaved(b);
  };

  return (
    <Sheet open={p.open} onClose={p.onClose}>
      <h2>{p.block ? '블록 수정' : '블록 추가'}</h2>
      <p class="sub">도면값을 모르면 비워 두고, 현물에서 재도 돼요</p>
      <div class="two-col">
        <Field label="호선">
          <TextInput value={ship} onInput={setShip} placeholder="예: 1234" autoFocus={!p.block} />
        </Field>
        <Field label="블록">
          <TextInput value={name} onInput={setName} placeholder="예: A11P" />
        </Field>
      </div>
      <Field label="T.A TRANSVERSE ANGLE · 선택">
        <NumInput value={ta} onInput={(v) => setTa(v.replace(/[-−]/g, ''))} placeholder="모르면 비워두세요" unit="°" />
      </Field>
      <Field label="F.A FRAME ANGLE · 선택">
        <NumInput value={fa} onInput={(v) => setFa(v.replace(/[-−]/g, ''))} placeholder="모르면 비워두세요" unit="°" />
      </Field>
      {faN != null && (
        <Field label="F.A 방향 · FRAME 이 누운 쪽" hint="도면 'F.A 선미로 3.2°' = FRAME 이 선미 쪽으로 3.2° 누움">
          <Seg<Dir>
            value={faDir}
            onChange={setFaDir}
            options={[
              { v: 1, label: '선수 쪽' },
              { v: -1, label: '선미 쪽' },
            ]}
          />
        </Field>
      )}
      {half && <div class="warn-text">T.A · F.A 는 둘 다 넣거나 둘 다 비워주세요.</div>}
      {needDir && faDir == null && <div class="warn-text">FRAME 이 누운 쪽(선수 / 선미)을 골라주세요.</div>}
      {odd && <div class="warn-text">보통은 0 &lt; F.A ≤ T.A &lt; 90° 예요. T.A · F.A 정의가 맞는지 확인해주세요.</div>}
      <Field label="메모 (선택)">
        <TextInput value={memo} onInput={setMemo} placeholder="위치 · 특이사항" />
      </Field>
      <div class="actions">
        <button class="btn grey" onClick={p.onClose}>
          닫기
        </button>
        <button class="btn" disabled={!ready} onClick={save}>
          {p.block ? '저장' : '추가'}
        </button>
      </div>
    </Sheet>
  );
}

export function CapSheet(p: { open: boolean; blockId: string; cap?: Cap | null; onClose: () => void; onSaved: (c: Cap) => void }) {
  const [no, setNo] = useState('');
  const [delta, setDelta] = useState('');
  const [dir, setDir] = useState<Dir>(1);

  useEffect(() => {
    if (!p.open) return;
    setNo(p.cap?.no ?? '');
    setDelta(p.cap ? String(p.cap.delta) : '');
    setDir(p.cap?.dir ?? 1);
  }, [p.open, p.cap]);

  const dN = parseNum(delta);
  const ready = no.trim() !== '' && dN != null && dN >= 0 && dN < 90;
  const zero = dN != null && Math.abs(dN) < 1e-9;

  const save = async () => {
    if (!ready) return;
    const c: Cap = {
      id: p.cap?.id ?? newId(),
      blockId: p.blockId,
      no: no.trim(),
      delta: dN!,
      dir: zero ? 1 : dir, // δ 0 캡은 돌아간 방향이 뜻이 없다 — 늘 선수로 둔다
      createdAt: p.cap?.createdAt ?? Date.now(),
    };
    await saveCap(c);
    toast(p.cap ? '지주캡을 고쳤어요' : '지주캡을 추가했어요');
    p.onSaved(c);
  };

  return (
    <Sheet open={p.open} onClose={p.onClose}>
      <h2>{p.cap ? '지주캡 수정' : '지주캡 추가'}</h2>
      <p class="sub">도면의 캡 취부각도를 넣어주세요</p>
      <Field label="캡 No">
        <TextInput value={no} onInput={setNo} placeholder="예: 1" autoFocus={!p.cap} />
      </Field>
      <Field label="δ 캡 취부각도" hint="WEB 이 FRAME 기준으로 돌아간 각도예요. 안 돌아갔으면 0">
        <NumInput value={delta} onInput={(v) => setDelta(v.replace(/[-−]/g, ''))} placeholder="0" unit="°" />
      </Field>
      {!zero && (
      <Field label="돌아간 방향" hint="도면에 적힌 그대로 (예: 캡 선미로 7°)">
        <Seg<Dir>
          value={dir}
          onChange={setDir}
          options={[
            { v: 1, label: '선수 쪽' },
            { v: -1, label: '선미 쪽' },
          ]}
        />
      </Field>
      )}
      <div class="actions">
        <button class="btn grey" onClick={p.onClose}>
          닫기
        </button>
        <button class="btn" disabled={!ready} onClick={save}>
          {p.cap ? '저장' : '추가'}
        </button>
      </div>
    </Sheet>
  );
}
