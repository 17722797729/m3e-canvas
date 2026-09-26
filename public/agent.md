# M3E Canvas: sketches from an AI agent (beta)

M3E Canvas (https://lnkiai.github.io/m3e-canvas/) is a browser editor for Material 3 Expressive screens. A design is one JSON document. You, the agent, write that document and hand it back; the person opens it on their canvas, refines it, and turns it into a prompt for a coding tool.

This format is in beta. Fields may be added; existing ones keep their meaning.

## What to deliver

**Reply with a share link.** If you cannot run code, reply with the JSON document itself in a code block; the person saves it as a `.json` file and opens it with **Open project**. Either way, **do not verify, decode, or round-trip your output**: the app checks the document when it opens and tells the person what is wrong, so your checks add nothing.

To make the link:

1. Save the document to a file, for example `design.json`. Do not inline it in a shell command; quoting breaks in PowerShell and long shells.
2. Run one of these on the file and reply with the printed link.

```js
// Node (link.mjs): node link.mjs design.json
import { readFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
const json = readFileSync(process.argv[2], "utf8");
console.log("https://lnkiai.github.io/m3e-canvas/#docz=" + deflateRawSync(json).toString("base64url"));
```

```python
# Python (link.py): python link.py design.json
import sys, zlib, base64
data = open(sys.argv[1], "rb").read()
c = zlib.compressobj(9, zlib.DEFLATED, -15)          # raw deflate, no header
raw = c.compress(data) + c.flush()
print("https://lnkiai.github.io/m3e-canvas/#docz=" + base64.urlsafe_b64encode(raw).decode().rstrip("="))
```

The link is long (a few thousand characters for a few screens). That is expected; it carries the whole design and nothing is stored anywhere. If you fetched this guide from a different address than `https://lnkiai.github.io/m3e-canvas/agent.md`, build the link on that address instead (the app lives next to its guide).

Keep the document under about 100 KB. An `image` part may carry `"src": "https://…"` pointing at a picture on the web; do not embed image data.

Rough placement is fine. The person presses **Tidy** and bars snap to the edges, neighbouring parts fuse into connected runs, and the rest stacks on 16dp margins. Spend your effort on the right parts, sensible labels, and the navigation between screens.

## The document

```jsonc
{
  "title": "Recipes",              // the app's name
  "brief": "Save and search recipes.",   // one or two sentences on what the app is for (optional)
  "frame": "phone",                // always "phone"
  "platform": "android",           // "android" (default) or "web"
  "paletteKey": "purple",          // "purple" | "blue" | "green" | "coral" | "amber" | "teal" | "mono"
  "theme": { "dark": false, "bothModes": true, "contrast": "standard", "shape": "rounded", "font": "roboto", "emphasized": false, "motion": "expressive" },
  "frames": [ /* screens */ ],
  "groups": [ /* parts, bottom layer first */ ]
}
```

`theme` is optional. `contrast`: `standard | medium | high`. `shape`: `square | rounded | full`. `font`: `roboto | robotoFlex | robotoSerif | system`. `motion`: `standard | expressive`. `bothModes: true` asks for light and dark; `dark` picks which one the canvas shows.

### Screens (`frames`)

A phone screen is **412 × 892**; a desktop screen is **1280 × 800** (set `w` and `h`). Place screens side by side on the canvas, 80 apart:

```json
{ "id": "home", "name": "Home", "x": 0, "y": 0, "note": "Lists the saved recipes." }
{ "id": "detail", "name": "Recipe", "x": 492, "y": 0 }
{ "id": "settings", "name": "Settings", "x": 984, "y": 0, "swipe": { "left": "home" } }
```

- `id`: any unique string. `name`: what the screen is called in the prompt.
- `note` (optional): what the screen is for, in a sentence. It goes into the prompt.
- `tabSide` (optional, tab rows): where the labels sit — `top` (default, the page below) or `bottom` for a `tabs` row, `left` (default, the page beside it) or `right` for a `sideTabs` row. The page always takes the other side, and the row's panels are laid out there.
- `sideRail` (optional, `sideTabs`): the share of the row's width its label column takes, as a percentage (10–50, default 32); the page takes the rest. With `tabSide: "right"` the column is on the right and the page on the left, and the ratio is read the same way.
- `rot` (optional, any part): how far the part is turned, in degrees (−180…180). The part turns about its own middle — its corners, its words and everything it holds go round with it — while the place it takes in the layout, and the rectangle the editor lines it up by, stay where they are. `{ "rot": -12 }` tilts a card; a label at `{ "rot": 90 }` reads down the side.
- `bg` (optional): background token, one of `surface | surfaceContainerLow | surfaceContainer | surfaceContainerHigh | surfaceContainerHighest | primaryContainer | secondaryContainer | tertiaryContainer | primary | inverseSurface`.
- `swipe` (optional): screens reached by swiping `left | right | up | down`.
- `place` (optional): where the body rows sit between the bars when the screen is tidied: `top` (default) | `center` | `bottom` | `spread`. Goes into the prompt too.
- `role` and `level` (optional): `"role": "overlay"` makes this a page popped *over* a screen instead of one you navigate to, and `"level"` is `popover | sheet | modal | fullscreen | system` — how much of the screen it takes and how it is dismissed. A bubble is an overlay at the `popover` level.
- `autoClose` (optional, overlays): seconds until the page closes itself, counted from it opening — a toast that needs no tap. `{ "role": "overlay", "level": "popover", "autoClose": 8 }`.

### Parts (`groups`)

Every part sits in a **group**. A group is one part, or a **connected run** of parts of one family drawn as a unit: buttons side by side (`"axis": "x"`), list items stacked (`"axis": "y"`). Coordinates are **canvas coordinates**, so add the screen's `x` and `y`. Later groups draw on top of earlier ones.

```json
{ "id": "g1", "x": 0, "y": 0, "axis": "x", "items": [ { "id": "bar", "kind": "topAppBar", "label": "Recipes", "icon": "menu", "icon2": "search", "variant": "filled" } ] }
{ "id": "g2", "x": 16, "y": 112, "axis": "y", "items": [
  { "id": "r1", "kind": "listItem", "label": "Tomato soup", "supporting": "30 min", "icon": "restaurant", "variant": "filled", "action": { "to": "detail", "transition": "slide" } },
  { "id": "r2", "kind": "listItem", "label": "Pancakes", "supporting": "20 min", "icon": "restaurant", "variant": "filled" }
] }
{ "id": "g3", "x": 340, "y": 716, "axis": "x", "items": [ { "id": "fab", "kind": "fab", "label": "", "icon": "add", "variant": "filled", "note": "Opens the new recipe form." } ] }
{ "id": "g4", "x": 0, "y": 788, "axis": "x", "items": [ { "id": "nav", "kind": "bottomNav", "label": "", "icon": null, "variant": "filled",
  "tabs": [ { "icon": "home", "label": "Home" }, { "icon": "search", "label": "Search" }, { "icon": "settings", "label": "Settings" } ],
  "selected": 0,
  "actions": { "tab:2": { "to": "settings", "transition": "fade" } } } ] }
```

Every item needs `id`, `kind`, `label` (may be `""`), `icon` (a Material Symbols name, or `null`) and `variant`. Use `"variant": "filled"` unless you want another look: `filled | tonal | elevated | outlined | text`.

A tab entry is `{ "icon": "home", "label": "Home" }` and may carry `"hideIcon": true` to put the icon away without losing it, and `"badge": "3"` (with `"hideBadge": true` to take it off again) for the count a game marks a destination with, drawn at its top trailing corner in the error colour. `icon` may be omitted on a `tabs` row and `label` may be `""` on a `toolbar`.

Which families connect: `button` with `button`, `iconButton` with `iconButton`, `chip` with `chip` (all `"axis": "x"`), `listItem` with `listItem` (`"axis": "y"`). Anything else is a group of one; `axis` is then irrelevant but required (`"x"`).

### Kinds and their fields

Sizes are in dp; `size` is the width unless noted. Content width inside the phone margins is **380**. Heights below are what the canvas draws when you omit them.

| kind | what it is | useful fields | default size |
|---|---|---|---|
| `topAppBar` | top app bar | `label` title, `icon` leading, `icon2` trailing, `actions` with keys `icon` / `icon2` | 412 × 88, at the top |
| `bottomNav` | navigation bar | `tabs` (3–5 of `{icon,label}`), `selected` index, `actions` with keys `tab:0`… | 412 × 104, at the bottom |
| `navRail` | navigation rail (desktop) | `tabs`, `selected`, `railExpanded` false / true for M3 Expressive collapsed / expanded, `railModal` for modal expansion, `size2` height | 96 collapsed / 220 expanded; omit both rail fields for the original 80-wide rail |
| `tabs` | tab row: the destinations across the top, their pages under the strip | `tabs` (any count; six or more scroll horizontally), `selected`; children are its panels, `panel: true`, one per tab in tab order | 412 × 48 |
| `sideTabs` | side tabs: the same destinations down the left, their pages beside them | `tabs`, `selected`, `panel: true` children exactly as `tabs`; the label column is 132dp of the width | 412 × 132 |
| `searchBar` | search bar | `label` placeholder, `icon2` trailing | 380 × 56 |
| `button` | button | `label`, `icon`, `variant`, `action`, `toggle`, `size` width (omit for text-sized; 380 fills the content width, 182 is half) | text-sized × 56 |
| `iconButton` | icon button | `icon`, `variant`, `action` | 48 × 48 |
| `fab` | FAB | `icon`, `size` 40 / 56 / 96 | 56 × 56, bottom-right |
| `extendedFab` | extended FAB | `label`, `icon` | text-sized × 56 |
| `splitButton` | split button | `label`, `icon` | text-sized × 56 |
| `fabMenu` | FAB menu, drawn open | `tabs` as its entries | 220 wide |
| `toolbar` | floating toolbar | `tabs` as icon buttons, `variant` `tonal` (standard) or `filled` (vibrant) | 64 tall |
| `chip` | chip | `label`, `icon`, `checked` | text-sized × 32 |
| `card` | card with image area, title, body | `label`, `supporting`, `icon`, `variant` `filled` (default) / `elevated` / `outlined`, `fill` background token, `size` width, `size2` height, `"noImage": true` to drop the image area, `src` an https picture for it, `action` | 380 × 223 |
| `listItem` | list item | `label`, `supporting`, `icon` leading, `icon2` trailing, or `"switch": true` for a trailing switch with `checked` as its state, `action` | 380 × 72 |
| `box` | plain container, or a scrolling viewport with `scroll` | `size` width, `size2` height, `fill` token, `radiusTop`, `radiusBottom`, `scroll` `"x"` / `"y"` / `"both"` for a container whose contents move, `scrollPos` `{x,y}` for where they start | 412 × 220 |
| `invGrid` | slot grid: a frame of inventory cells that scrolls up and down | `size` width, `size2` height, `cell` cell size 24–160 (56 default), `gridCols` cells across 1–12 (omit to fit the width), `gridRows` rows 1–30 (omit to fit the height; more rows than fit make the frame scroll), `checkboxes` to show a checkbox in every cell, `cellNames` to draw the item name under every cell that holds something (empty cells stay bare), `cellText` those words (omit for the 「物品名」/「Item name」/「アイテム名」 placeholder); the rows then lay out one name-height wider, so the text never touches the row below, `icon` drawn in a cell that is still empty, `fill` token for the frame, `scroll` `"y"` and `scrollPos` `{y}` as for a box, `children` the cells | 380 × 320 |
| `dialog` | dialog | `label` title, `supporting` body, `icon` | 312 × 220, centered |
| `snackbar` | snackbar | `label`, `supporting` action label | 344 × 48 |
| `textField` | text field | `label`, `supporting` helper, `icon`, `variant` `outlined / filled` | 380 × 56 |
| `select` | dropdown (exposed dropdown menu) | `label`, `tabs` the options as `{ "label" }`, `selected` index of the initial value (omit for none), `supporting` helper, `icon`, `variant` `outlined / filled` | 380 × 56 |
| `switch` | switch with label | `label`, `checked`, `size` width (omit for text-sized; 380 puts the label left and the switch right) | text-sized × 48 |
| `checkbox` | checkbox with label | `label`, `checked` | 40 tall |
| `radio` | radio button with label | `label`, `checked` | 40 tall |
| `slider` | slider | `value` 0–100, `max` to raise that ceiling (a count of things runs to 10000), `showValue` to draw the number over the handle, `unit: false` to drop its percent sign | 380 × 44 (64 with the number) |
| `stepper` | stepper: a minus, the number, a plus | `label`, `value` 0–100, `max` to raise that ceiling, stepped by one | 200 × 56 |
| `text` | a line of text | `label`, `size` font size (28 default), `bold`, `shows` the id of a slider / stepper / bar / row to read instead of its own words, `mix: true` to keep its own words and drop the value in where the label says `{v}` (without a token the value is appended) | |
| `image` | image | `size` square side, `src` an https URL (optional) | 200 × 200 |
| `camera` | camera preview placeholder | `size` width, `size2` height | 380 × 507 |
| `map` | map placeholder | `size` width, `size2` height | 380 × 285 |
| `divider` | divider | | 380 × 16 |
| `badge` | badge | `label` (empty for a dot) | |
| `loadingIndicator` | M3 Expressive loading indicator | `contained` | 48 × 48 |
| `linearProgress` | linear progress | `value` or omit for indeterminate, `wavy`, `trackThickness` 2 to 16 (omit for 4) | 380 × 24 |
| `progressBar` | progress bar | `size` width, `size2` height (4 to 64), `value` percent (always determinate, 60 by default), `fill` track colour (transparent when omitted), `label` drawn inside the bar | 380 × 10 |
| `circularProgress` | circular progress | `value` or omit, `wavy`, `trackThickness` 2 to 16, capped at a sixth of `size` | 48 × 48 |

A slot grid's `children` are its cells: one `box` per slot, each with `cellCol` / `cellRow` (its place on the board, 0-based) and, when `checkboxes` is on, `"checked": true` for a cell that starts ticked. A cell is a container like any other — put an icon button or any other part inside its own `children` — and the board lays its cells out itself, so a cell's own `x`, `y`, `size` and `size2` follow the frame, the cell size and the counts; do not set them by hand. Never write a board without its cells: give it one cell per `gridCols` × `gridRows` slot, in reading order.

For `navRail`, `railExpanded` is the initial state; the preview's menu button toggles it. With `railModal: true`, an expanded rail covers the content with a scrim while the body keeps a 96dp navigation slot. Otherwise, reserve the rail's current width beside the content. Keep `tabs`, `selected`, and `actions` on the same item in either state.
Modal presentation requires the rail to be the only item in its group. The editor collapses modal rails and switches them to standard presentation when they are grouped with other items, including imported mixed groups. Ungroup the rail before enabling modal presentation again. The editor controls are desktop-only.

Fields that any part may carry:

- `note`: what the part does, in your words. It goes into the prompt verbatim, so say what happens on tap, what is saved, what is validated.
- `action`: `{ "to": "<frame id>" | "back", "transition": "slide" | "slideLeft" | "slideUp" | "slideDown" | "fade" | "expand" | "none" }`, the screen a tap opens.
- `toggle` (buttons): `{ "icon": "favorite", "variant": "filled", "label": "Saved" }`, the look after a tap flips it on.
- `flow` (anything a tap can move on): the states the part goes through, drawn as a flow in the editor. Use it instead of `toggle` when the part has more than two states or changes something else on the way.

```json
"flow": {
  "looks": [
    { "id": "l2", "label": "领取", "icon": "redeem" },
    { "id": "l3", "label": "已领取", "icon": "check_circle", "disabled": true }
  ],
  "steps": [
    { "id": "s1", "from": ":start", "to": "l2", "trigger": { "kind": "tap" } },
    { "id": "s2", "from": "l2", "to": "l3", "trigger": { "kind": "tap" },
      "do": [ { "kind": "look", "target": "gift", "icon": "check_circle" } ] }
  ]
}
```

  - `looks` are the appearances the part can take. Each names only what it changes — `label`, `icon` (`null` for none), `color`, `variant`, `disabled`, `grow`, `hidden` — and every field it leaves out stays whatever the part itself is, so the author keeps editing one part rather than three copies.
  - `:start` is the part exactly as drawn. A step may go back to it.
  - A `look` action's `value` may carry `"valueOp": "add"` or `"sub"` with a step (for example `{ "kind": "look", "target": "<slider>", "value": 1, "valueOp": "add" }`): it walks the value the part is at instead of writing one. That is how a plus and a minus button drive a slider like a stepper — one step per tap, clamped to 0–100 — and a visitor's own drag afterwards still has the last word. Left out, `valueOp` means `"set"`.
  - A `look` action writes the properties it names onto the part `target` names (or onto the part the step belongs to when `target` is left out), and leaves every other property alone. It may carry `label`, `icon` (empty string for none), `color`, `fill`, `checkboxes` (a slot grid's bulk-tick mode), `checked`, `selected` (an index into `tabs`), `value` (0–100), `disabled`, `hidden` and `grow`. It changes how a part is drawn, never what it is: its kind, its id, its children and its own `flow` are not a step's to write, and nothing here moves a part or changes its size.
  - So a button outside a board switches its multi-select on and off, the way a game does it: give the button two looks and a tap step each way, one with `{ "kind": "look", "target": "<board>", "checkboxes": true }` and one with `false`. `"disabled": true`, `"hidden": true` and `"grow": true` work the same way for any part — that is how one button greys out, puts away or enlarges another.
  - A step may leave `to` out: the part then keeps the look it is in and the step only does what `do` says. That is what a button that just drives another part needs — a plus button stepping a slider stays where it is, so the same tap fires again on every press instead of walking off after one. A slider that should read its number out carries `"showValue": true` and draws the value over its handle; A tab row's children are its panels, in tab order and one per tab, each marked `"panel": true`: the panel is the room the tab in front shows — under the strip for `tabs`, beside the labels for `sideTabs` — so its `x`/`y`/`size`/`size2` belong to the row (the editor fits them as the row is resized) and its contents are that tab's page. `"unit": false` drops the percent sign from that number, and a text reading the value always gets the bare number. A slider or stepper that counts things carries `"max"` (`{ "max": 10000 }`), which is the ceiling its value, its drag, its ＋/− buttons and every number a rule adds all stop at. A text that carries both words and a live number sets `"mix": true` and writes `{v}` where the number belongs: `"label": "出售数量： {v} / 10000"`.
  - A part that is only good for a while carries `"autoClose": 259200` (seconds): after that many seconds on the preview's clock it puts itself away. A container takes its children with it — nothing inside it shows or answers a tap again — which is how an activity entry closes itself after three days; an overlay closes the way a tap outside it does, and counts from the moment it opens.
  - `steps` move the part between looks. `trigger` is `{ "kind": "tap" }` or `{ "kind": "after", "seconds": 30 }` (counted from the moment the part entered the look it is leaving). `do` is a list of what else the step does on the way: `goto`, `back`, `close` (puts away the overlay the part stands in — the top one only), `closeAll` (puts away every overlay the screen has open), or `look` (a change latched onto this part or, with `target`, another one). The list runs in order, so a step that opens the next dialog and closes the current one writes them close-first: `[{ "kind": "close" }, { "kind": "goto", "to": "<next>", "transition": "none" }]`.
  - Steps leaving the same look are tried in order, and the first one is the one taken. When none is there, the part does what `action` says, which is also what happens in a look no step leaves.


Icons are Material Symbols names (`home`, `search`, `add`, `favorite`, `settings`, `arrow_back`, `more_vert`, `edit`, `delete`, `share`, `restaurant`, `photo_camera`, …).

## Keep it simple

- Leave what the app does not need empty: `"icon": null`, no `icon2`, no `note`, no `supporting`. A top app bar with just a title is normal; not every bar needs a menu and a search icon, not every list row needs a trailing chevron.
- Do not add parts to fill space. A screen with a bar, a list and a FAB is complete.
- One idea per screen. If a screen needs a second scroll of parts, it is two screens.
- Prefer the plain variant (`"filled"`) and the default sizes; the person retunes the theme afterwards.
- Buttons: a main action on its own gets `"size": 380` (full content width); two side by side get `"size": 182` each in one connected group; a button next to text stays text-sized. Do not scatter small buttons around a screen.
- Cards: give one a `size2` only when it holds more than a headline and a line of body, and keep a stack of cards the same height. A list of similar rows is a `listItem` run, not a column of cards.

## A good sketch

- One `topAppBar` at the top of each screen, a `bottomNav` on the main screens with the same tabs everywhere, and `selected` set to the tab that screen belongs to.
- Real labels in the person's language, not lorem ipsum. Match the language of the request.
- A `note` only where the label does not already say what happens; a `note` on every screen.
- Navigation that closes: list rows open a detail screen, detail screens have a way back (`"to": "back"`), the FAB opens a form.
- Three to five screens is plenty. Leave polish to the person: they will tidy, retheme, and edit.

## Checklist before you reply

- Every `id` is unique; every `action.to` names a frame `id` or `back`.
- Every item has `id`, `kind`, `label`, `icon` (or `null`), `variant`.
- Group coordinates include the screen offset.
- You are replying with the link (or the JSON), not with a description of it.

## 方向轮盘 / 轮盘抽奖 (direction wheel, prize wheels)

- `kind: "joystick"` — 移动方向轮盘. `value` (0–360) is the direction, 0 = straight up,
  clockwise; `max` is 360. `joystickReturn: false` keeps the knob where the finger left it
  (default: it springs back to the middle).
- `kind: "wheel"` — 圆形轮盘抽奖, and `kind: "gridWheel"` — 方形轮盘抽奖. Both carry
  `prizes: [{ label, icon?, weight? }]`; the chance of a prize is its weight over the sum of
  all weights (a weight of 0 can never come up). `label` is the words of the button in the
  middle. In the preview a tap spins the wheel, the prizes highlight in turn, and a dialog
  names the prize it stopped on.
