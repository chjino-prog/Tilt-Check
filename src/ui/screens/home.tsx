// 홈 : 블록 목록 (호선별 묶음 + 검색)
import { useEffect, useMemo, useState } from 'preact/hooks';
import { effectiveAngles } from '../../calc/basis';
import { fmt } from '../../calc/judge';
import { listAllCaps, listBlocks, type Block } from '../../db/store';
import { go } from '../router';
import { BrandBar, Cta, Empty, Headline } from '../components/ui';
import { ICap, IChevron, ISearch } from '../icons';
import { BlockSheet } from './edit-sheets';

/** 목록 한 줄 : 계산에 쓰는 T.A · F.A (현물이면 표시) */
function angleText(b: Block): string {
  const e = effectiveAngles(b);
  if (!e) return 'T.A · F.A 미입력';
  return `T.A ${fmt(e.taDesign ?? e.ta, 2)}° · F.A ${fmt(e.fa, 2)}°${e.basis === 'ref' ? ' (현물)' : ''}`; // 목록은 도면에 적힌 값 그대로
}

export function HomeScreen() {
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [capCount, setCapCount] = useState<Map<string, number>>(new Map());
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);

  const load = async () => {
    const [bs, caps] = await Promise.all([listBlocks(), listAllCaps()]);
    const m = new Map<string, number>();
    caps.forEach((c) => m.set(c.blockId, (m.get(c.blockId) ?? 0) + 1));
    setCapCount(m);
    setBlocks(bs);
  };
  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(() => {
    if (!blocks) return [];
    const key = q.trim().toUpperCase();
    const hit = blocks.filter((b) => !key || b.ship.toUpperCase().includes(key) || b.block.toUpperCase().includes(key) || b.memo.toUpperCase().includes(key));
    const by = new Map<string, Block[]>();
    hit.forEach((b) => by.set(b.ship, [...(by.get(b.ship) ?? []), b]));
    return [...by.entries()]
      .map(([ship, list]) => ({
        ship,
        list: list.sort((a, b) => a.block.localeCompare(b.block, 'ko', { numeric: true })),
        last: Math.max(...list.map((b) => b.updatedAt)),
      }))
      .sort((a, b) => b.last - a.last);
  }, [blocks, q]);

  const empty = blocks != null && blocks.length === 0;

  return (
    <div class={'screen with-tab with-tab-cta'}>
      <BrandBar />
      <Headline title={<>어느 블록의<br />지주캡을 잴까요?</>} />
      {empty ? (
        <Empty icon={ICap} title="아직 등록한 블록이 없어요" sub="블록의 T.A · F.A 를 넣으면 지주캡 정상 각도를 계산해드려요" />
      ) : (
        <>
          {(blocks?.length ?? 0) > 4 && (
            <div class="search">
              <ISearch />
              <input class="input" type="search" placeholder="호선 · 블록 찾기" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
            </div>
          )}
          {groups.map((g) => (
            <div style={{ marginBottom: '12px' }}>
              <div class="section-title">
                <span>{g.ship} 호선</span>
                <span>{g.list.length}</span>
              </div>
              <div class="list">
                {g.list.map((b) => (
                  <button class="row" onClick={() => go('/block/' + b.id)}>
                    <div class="lead blue">
                      <ICap />
                    </div>
                    <div class="body">
                      <div class="t1">{b.block}</div>
                      <div class="t2 num">
                        {angleText(b)} · 캡 {capCount.get(b.id) ?? 0}개
                      </div>
                    </div>
                    <div class="tail">
                      <span class="chev">
                        <IChevron />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {blocks && groups.length === 0 && <div class="note center">‘{q}’ 에 맞는 블록이 없어요</div>}
        </>
      )}
      <Cta>
        <button class="btn" onClick={() => setAdding(true)}>
          블록 추가
        </button>
      </Cta>
      <BlockSheet
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={(b) => {
          setAdding(false);
          go('/block/' + b.id);
        }}
      />
    </div>
  );
}
