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
  const [memo, setMemo] = useState('');

  useEffect(() => {
    if (!p.open) return;
    const b = p.block;
    setShip(b?.ship ?? '');
    setName(b?.block ?? '');
    setTa(b ? String(b.ta) : '');
    setFa(b ? String(b.fa) : '');
    setMemo(b?.memo ?? '');
  }, [p.open, p.block]);

  const taN = parseNum(ta);
  const faN = parseNum(fa);
  const ready = ship.trim() !== '' && name.trim() !== '' && taN != null && faN != null;
  const odd = taN != null && faN != null && !blockAnglesLookRight(taN, faN);

  const save = async () => {
    if (!ready) return;
    const now = Date.now();
    const b: Block = {
      id: p.block?.id ?? newId(),
      ship: ship.trim(),
      block: name.trim().toUpperCase(),
      ta: taN!,
      fa: faN!,
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
      <p class="sub">설계값을 넣으면 정상 각도를 계산해드려요</p>
      <div class="two-col">
        <Field label="호선">
          <TextInput value={ship} onInput={setShip} placeholder="예: 1234" autoFocus={!p.block} />
        </Field>
        <Field label="블록">
          <TextInput value={name} onInput={setName} placeholder="예: A11P" />
        </Field>
      </div>
      <div class="two-col">
        <Field label="T.A 횡단각">
          <NumInput value={ta} onInput={setTa} placeholder="0.000" unit="°" />
        </Field>
        <Field label="F.A FRAME각">
          <NumInput value={fa} onInput={setFa} placeholder="0.000" unit="°" />
        </Field>
      </div>
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

  const save = async () => {
    if (!ready) return;
    const c: Cap = {
      id: p.cap?.id ?? newId(),
      blockId: p.blockId,
      no: no.trim(),
      delta: dN!,
      dir,
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
        <NumInput value={delta} onInput={setDelta} placeholder="0" unit="°" />
      </Field>
      <Field label="돌아간 방향">
        <Seg<Dir>
          value={dir}
          onChange={setDir}
          options={[
            { v: 1, label: '선수 쪽' },
            { v: -1, label: '선미 쪽' },
          ]}
        />
      </Field>
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
