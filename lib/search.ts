import { Frame, Group, Item, KIND_SPEC, isOverlayFrame, itemsOf, overlayLevelOfFrame } from "./tokens";
import { KIND_TEXT, Lang, overlayLevelText } from "./i18n";

/**
 * One row the layers search found: a page, or one part on one. `where` names the page a part lives
 * on, because a result list reaches across pages while the rows under it do not.
 */
export type LayerHit = {
  frameId: string;
  /** the part that matched, or null when the page itself is the hit */
  itemId: string | null;
  /** what the row reads: the name the author gave it, its own words, or its kind */
  label: string;
  /** the words the query was found in, so a row can show why it matched */
  detail: string;
  icon: string;
  kind: string;
  /** the page's name, for a part found on it */
  where: string;
};

/** How a row reads in the list: the name the author gave it, then its own text, then its kind's noun
 * in the language they are working in — the same order the layers panel itself uses. */
export const layerName = (it: Item, lang: Lang): string => {
  const spec = KIND_SPEC[it.kind] ?? KIND_SPEC.box;
  const noun = KIND_TEXT[lang][it.kind]?.noun ?? spec.label;
  return it.name?.trim() || it.label.trim() || noun;
};

/** Everything a row can be found by: the name the author gave it, the words it says, the words its
 * destinations say, and its kind — so "按钮" finds every button and "save" finds the one labelled
 * Save. The id is in there too, which is what an id out of a prompt or an agent reply needs. */
function haystack(it: Item, lang: Lang): string[] {
  const spec = KIND_SPEC[it.kind] ?? KIND_SPEC.box;
  const noun = KIND_TEXT[lang][it.kind]?.noun ?? spec.label;
  return [
    it.name ?? "",
    it.label,
    it.supporting ?? "",
    ...(it.tabs ?? []).map((tab) => tab.label),
    noun,
    it.kind,
    it.id,
  ];
}

/** The line under a part's row that explains the match, when it is not the row's own name. */
function detailOf(it: Item, lang: Lang, label: string): string {
  const noun = KIND_TEXT[lang][it.kind]?.noun ?? (KIND_SPEC[it.kind] ?? KIND_SPEC.box).label;
  const words = it.supporting?.trim() || it.label.trim();
  if (words && words !== label) return words;
  return noun;
}

const matches = (fields: string[], needle: string) => fields.some((f) => f.toLowerCase().includes(needle));

/**
 * The pages and parts whose name, words or kind contain the query, in document order: a search of
 * the layers panel, which is the only way to a row once a document has more pages than fit on
 * screen. An empty query finds nothing — the panel shows its own list until the author types.
 */
export function searchLayers(
  frames: Frame[],
  groups: Group[],
  frameIdOf: (groupId: string) => string | null,
  query: string,
  lang: Lang,
): LayerHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const out: LayerHit[] = [];
  const parts = (list: Group[], frameId: string, where: string) => {
    for (const it of itemsOf(list)) {
      if (!matches(haystack(it, lang), needle)) continue;
      const label = layerName(it, lang);
      out.push({
        frameId,
        itemId: it.id,
        label,
        detail: detailOf(it, lang, label),
        icon: it.icon ?? (KIND_SPEC[it.kind] ?? KIND_SPEC.box).paletteIcon,
        kind: it.kind,
        where,
      });
    }
  };
  for (const f of frames) {
    const pageName = f.name.trim() || (isOverlayFrame(f) ? overlayLevelText(overlayLevelOfFrame(f), lang) : "");
    if (matches([f.name, f.note ?? "", f.id], needle)) {
      out.push({
        frameId: f.id,
        itemId: null,
        label: pageName,
        detail: f.note?.trim() ?? "",
        icon: isOverlayFrame(f) ? "picture_in_picture_alt" : "crop_portrait",
        kind: "frame",
        where: "",
      });
    }
    parts(
      groups.filter((g) => frameIdOf(g.id) === f.id),
      f.id,
      pageName,
    );
  }
  /* parts the canvas draws but no page owns are findable too: they have rows in the panel, under
     their own heading, and a search that could not reach them would be a search that lies */
  parts(
    groups.filter((g) => frameIdOf(g.id) === null),
    "",
    "",
  );
  return out;
}
