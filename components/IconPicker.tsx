"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Palette } from "@/lib/tokens";
import { t, useLang } from "@/lib/i18n";
import { IconBtn } from "./ui";

type IconMeta = { n: string; p: number; t: string };

const FONT = '24px "Material Symbols Rounded"';
/** module-level so validation survives re-mounts of the panel */
let cache: IconMeta[] | null = null;
const glyphOk = new Map<string, boolean>();

/** Candidates measured per pass. A real Material Symbols glyph is exactly 1em
 *  wide; a name with no glyph falls back to text and measures wider. Icon names
 *  can be as short as "tv"/"4k", so we compare against a known-good reference
 *  glyph rather than a width threshold. */
const BATCH = 400;
const SHOWN = 240;

/** The icons a game screen reaches for first, offered ahead of the whole font: battle,
 *  adventure, the things a player carries, wears and tames, and the people met on the
 *  way. The picker hides any name its font has no glyph for, so the list may be longer
 *  than what is finally drawn. The keywords are what a search can find them by, in any
 *  of the four languages. */
const GAME_ICONS: { n: string; k: string }[] = [
  // ---- equipment: weapons, armour, and what a hero wears ----
  { n: "swords", k: "weapon sword blade battle 武器 剣 刀 战斗 무기" },
  { n: "sports_martial_arts", k: "weapon fist attack punch 武器 格闘 拳 攻击 무술" },
  { n: "hardware", k: "hammer tool weapon ハンマー 工具 锤子 망치" },
  { n: "construction", k: "tools hammer build 工具 建造 도구" },
  { n: "handyman", k: "wrench tool repair レンチ 工具 扳手 수리" },
  { n: "shield", k: "armour armor defense guard 盾 鎧 防具 防御 방패 갑옷" },
  { n: "shield_moon", k: "armour magic shield 盾 魔法 防具 방패" },
  { n: "security", k: "shield guard 盾 防御 守卫 방어" },
  { n: "verified_user", k: "armour badge guard 防具 徽章 방어" },
  { n: "sports_motorsports", k: "helmet head gear ヘルメット 兜 头盔 헬멧" },
  { n: "back_hand", k: "glove gauntlet hand 手袋 手套 拳 장갑" },
  { n: "pan_tool", k: "glove hand grab 手袋 手 장갑" },
  { n: "front_hand", k: "glove hand 手袋 手套 장갑" },
  { n: "clean_hands", k: "glove hand 手袋 手 장갑" },
  { n: "hiking", k: "boots shoes walking 靴 歩く 靴子 부츠" },
  { n: "snowshoeing", k: "boots shoes snow 靴 雪靴 靴子 부츠" },
  { n: "directions_walk", k: "boots walking feet 靴 足 靴子 걷기" },
  { n: "footprint", k: "boots feet track 足跡 脚印 발자국" },
  { n: "diamond", k: "ring gem jewel treasure 指輪 宝石 戒指 보석 반지" },
  { n: "toll", k: "ring coin token 指輪 コイン 戒指 반지" },
  { n: "workspace_premium", k: "medal amulet achievement 勲章 徽章 勋章 훈장" },
  // ---- items: what the bag holds ----
  { n: "science", k: "potion flask elixir ポーション 薬 試薬 药水 물약" },
  { n: "healing", k: "potion heal hp 回復 ポーション 治疗 药水 회복" },
  { n: "medication", k: "potion pill item 薬 ポーション 药 药水 약" },
  { n: "vaccines", k: "potion syringe item 注射 药 药水 주사" },
  { n: "sanitizer", k: "potion bottle item 瓶 药水 병" },
  { n: "backpack", k: "inventory bag 持ち物 リュック 背包 가방" },
  { n: "inventory_2", k: "box chest storage 箱 アイテム 物品 상자" },
  { n: "category", k: "items grid storage アイテム 分类 物品 아이템" },
  { n: "luggage", k: "chest case storage トランク 箱子 가방" },
  { n: "work", k: "case chest briefcase ケース 箱子 서류 가방" },
  { n: "key", k: "key unlock door 鍵 钥匙 열쇠" },
  { n: "lock", k: "locked chest 錠 锁 잠금" },
  { n: "description", k: "scroll document quest 巻物 スクロール 卷轴 문서" },
  { n: "article", k: "scroll note document 巻物 文书 卷轴 문서" },
  { n: "book_2", k: "book tome scroll 本 書 书 책" },
  { n: "auto_stories", k: "book story tome 本 物語 书 책" },
  { n: "menu_book", k: "book recipe tome 本 书 책" },
  { n: "egg", k: "pet hatch item 卵 蛋 알" },
  { n: "bug_report", k: "monster insect enemy 虫 怪物 昆虫 벌레" },
  { n: "raven", k: "bird pet monster 鳥 カラス 乌鸦 새" },
  { n: "flutter_dash", k: "bird pet 鳥 宠物 새" },
  { n: "pets", k: "pet dog cat companion ペット 宠物 펫" },
  { n: "cruelty_free", k: "rabbit pet companion うさぎ 兔子 토끼" },
  { n: "savings", k: "gold coin bank 金貨 コイン 金币 금화" },
  { n: "paid", k: "gold coin money 金貨 コイン 金币 골드" },
  { n: "attach_money", k: "coin money gold コイン 金币 돈" },
  { n: "currency_exchange", k: "trade gold exchange 両替 交易 환전" },
  { n: "storefront", k: "shop store ショップ 商店 商城 상점" },
  { n: "shopping_bag", k: "buy purchase shop 購入 购买 구매" },
  { n: "sell", k: "trade price shop 売却 出售 판매" },
  { n: "style", k: "card deck カード 卡牌 카드" },
  { n: "playing_cards", k: "card game deck トランプ 纸牌 카드" },
  { n: "casino", k: "dice gamble ダイス 骰子 주사위" },
  // ---- skills and spells ----
  { n: "bolt", k: "skill magic lightning スキル 魔法 雷 技能 闪电 스킬" },
  { n: "electric_bolt", k: "skill lightning magic スキル 雷 技能 闪电 번개" },
  { n: "local_fire_department", k: "skill fire damage スキル 炎 火 技能 火焰 불" },
  { n: "whatshot", k: "skill fire flame スキル 炎 技能 火焰 불꽃" },
  { n: "ac_unit", k: "skill ice freeze スキル 氷 冰 技能 얼음" },
  { n: "water_drop", k: "skill water heal スキル 水 技能 물" },
  { n: "air", k: "skill wind スキル 風 风 技能 바람" },
  { n: "eco", k: "skill nature leaf スキル 自然 技能 자연" },
  { n: "blur_on", k: "skill aura magic スキル 魔法 技能 오라" },
  { n: "flare", k: "skill light holy スキル 光 技能 빛" },
  { n: "psychology", k: "skill mind wisdom スキル 知恵 技能 지혜" },
  { n: "star", k: "skill favourite rank スキル 星 技能 별" },
  { n: "rocket_launch", k: "skill dash launch スキル 突進 技能 대시" },
  { n: "speed", k: "skill haste speed スキル 速度 技能 속도" },
  { n: "timer", k: "skill cooldown time スキル クールダウン 冷却 시간" },
  { n: "visibility", k: "skill stealth sight スキル 視界 技能 시야" },
  { n: "favorite", k: "hp heart life ハート 体力 心 하트" },
  // ---- quests, places, people ----
  { n: "assignment", k: "quest mission task クエスト 任务 임무" },
  { n: "checklist", k: "quests list tasks クエスト一覧 任务列表 퀘스트" },
  { n: "flag", k: "goal objective flag 目標 旗帜 목표" },
  { n: "explore", k: "adventure compass 冒険 探索 모험" },
  { n: "map", k: "map world area マップ 地图 지도" },
  { n: "castle", k: "dungeon fortress 城 ダンジョン 城堡 성" },
  { n: "forest", k: "nature woods 森 森林 숲" },
  { n: "sailing", k: "sea voyage ship 海 航海 바다" },
  { n: "sports_esports", k: "game console play ゲーム 游戏 게임" },
  { n: "military_tech", k: "medal rank honour 勲章 军衔 훈장" },
  { n: "trophy", k: "trophy win cup トロフィー 奖杯 트로피" },
  { n: "face", k: "character hero avatar キャラクター 人物 캐릭터" },
  { n: "face_6", k: "character portrait avatar 顔 角色 얼굴" },
  { n: "person", k: "player character hero プレイヤー 玩家 플레이어" },
  { n: "groups", k: "party team guild パーティ 队伍 파티" },
  { n: "person_add", k: "recruit friend party 仲間 招募 친구" },
];
const GAME_NAMES = GAME_ICONS.map((g) => g.n);

export function IconPicker({
  value,
  onChange,
  onClose,
  palette,
}: {
  value: string | null;
  onChange: (icon: string | null) => void;
  onClose: () => void;
  palette: Palette;
}) {
  const lang = useLang();
  const [icons, setIcons] = useState<IconMeta[] | null>(cache);
  const [q, setQ] = useState("");
  const [fontReady, setFontReady] = useState(false);
  /* bumped after each measuring pass; the visible list depends on it because
   * glyphOk is a plain map, not React state */
  const [tick, bump] = useState(0);

  const refEl = useRef<HTMLSpanElement>(null);
  const probeEls = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Dismiss the picker without clearing the editor's selection.
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", key, true);
    return () => document.removeEventListener("keydown", key, true);
  }, [onClose]);

  useEffect(() => {
    if (cache) return;
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/material-symbols.json`)
      .then((r) => r.json())
      .then((d: IconMeta[]) => {
        cache = d;
        setIcons(d);
      })
      .catch(() => setIcons([]));
  }, []);

  useEffect(() => {
    let alive = true;
    const done = () => alive && setFontReady(true);
    if (document.fonts.check(FONT)) {
      done();
      return;
    }
    document.fonts.load(FONT, "search").then(done, done);
    return () => {
      alive = false;
    };
  }, []);

  const candidates = useMemo(() => {
    if (!icons) return [];
    const s = q.trim().toLowerCase().replace(/\s+/g, "_");
    if (!s) {
      /* the game set leads the list, then the rest of the font */
      const byName = new Map(icons.map((i) => [i.n, i]));
      const led = GAME_NAMES.map((n) => byName.get(n)).filter((i): i is IconMeta => !!i);
      const rest = icons.filter((i) => !GAME_NAMES.includes(i.n));
      return [...led, ...rest].slice(0, BATCH);
    }
    /* a game icon answers to its own keywords as well as to its name */
    const asked = q.trim().toLowerCase();
    const game = GAME_ICONS.filter((g) => g.k.includes(asked) || g.n.includes(s)).map((g) => g.n);
    const raw = q.trim().toLowerCase();
    const starts: IconMeta[] = [];
    const rest: IconMeta[] = [];
    for (const i of icons) {
      if (i.n.startsWith(s)) starts.push(i);
      else if (i.n.includes(s) || i.t.includes(raw)) rest.push(i);
      if (starts.length + rest.length >= BATCH * 2) break;
    }
    const led = game
      .map((n) => icons.find((i) => i.n === n))
      .filter((i): i is IconMeta => !!i);
    return [...led, ...starts.filter((i) => !game.includes(i.n)), ...rest.filter((i) => !game.includes(i.n) && !starts.includes(i))].slice(0, BATCH);
  }, [icons, q]);

  const unknown = useMemo(() => candidates.filter((c) => !glyphOk.has(c.n)), [candidates]);

  useLayoutEffect(() => {
    if (!fontReady || unknown.length === 0) return;
    const ref = refEl.current?.getBoundingClientRect().width ?? 0;
    if (ref <= 0) return;
    let learned = false;
    for (const c of unknown) {
      const el = probeEls.current.get(c.n);
      if (!el) continue;
      const w = el.getBoundingClientRect().width;
      glyphOk.set(c.n, Math.abs(w - ref) < 0.75);
      learned = true;
    }
    if (learned) bump((v) => v + 1);
  }, [fontReady, unknown]);

  const visible = useMemo(
    () => candidates.filter((c) => glyphOk.get(c.n) === true).slice(0, SHOWN),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candidates, fontReady, tick],
  );

  const loading = !icons || !fontReady;

  return (
    <div>
      {/* Hidden probes need intrinsic text widths to distinguish missing glyphs. */}
      <div
        aria-hidden
        style={{ position: "fixed", left: -99999, top: 0, visibility: "hidden", pointerEvents: "none" }}
      >
        <span ref={refEl} className="msr" style={{ fontSize: 24, width: "auto" }}>
          search
        </span>
        {unknown.map((c) => (
          <span
            key={c.n}
            ref={(el) => {
              if (el) probeEls.current.set(c.n, el);
              else probeEls.current.delete(c.n);
            }}
            className="msr"
            style={{ fontSize: 24, width: "auto" }}
          >
            {c.n}
          </span>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <span
            className="msr"
            style={{ position: "absolute", left: 12, top: 10, fontSize: 20, color: palette.outline }}
          >
            search
          </span>
          <input
            aria-label={t("searchIcons", lang)}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={icons ? t("searchIcons", lang) : "…"}
            style={{
              width: "100%",
              height: 40,
              paddingLeft: 40,
              paddingRight: 12,
              borderRadius: 20,
              border: "none",
              background: palette.surfaceContainerHigh,
              color: palette.onSurface,
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>
        <IconBtn icon="close" p={palette} size={40} onClick={onClose} title={t("close", lang)} />
      </div>

      <div
        className="no-scrollbar"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(42px, 1fr))",
          gap: 4,
          height: 244,
          overflowY: "auto",
          overflowX: "hidden",
          padding: 6,
          borderRadius: 16,
          background: palette.surfaceContainerLow,
          alignContent: "start",
        }}
      >
        {visible.map((i) => (
          <button
            key={i.n}
            title={i.n}
            aria-label={i.n}
            aria-pressed={value === i.n}
            onClick={() => onChange(i.n)}
            style={{
              aspectRatio: "1",
              minWidth: 0,
              display: "grid",
              placeItems: "center",
              borderRadius: 12,
              border: "none",
              background: value === i.n ? palette.primary : "transparent",
              color: value === i.n ? palette.onPrimary : palette.onSurfaceVariant,
              cursor: "pointer",
            }}
          >
            <span className="msr" style={{ fontSize: 22 }}>
              {i.n}
            </span>
          </button>
        ))}
        {!loading && visible.length === 0 && (
          <div style={{ gridColumn: "1 / -1", padding: 16, fontSize: 13, color: palette.outline }}>
            <span className="msr" style={{ fontSize: 24 }}>search_off</span>
          </div>
        )}
        {loading && (
          <div style={{ gridColumn: "1 / -1", padding: 16, fontSize: 13, color: palette.outline }}>
            <span className="msr" style={{ fontSize: 24 }}>hourglass_top</span>
          </div>
        )}
      </div>
    </div>
  );
}
