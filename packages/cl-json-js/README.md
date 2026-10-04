# cl-json-js

Common Lisp in JSON, rendered to the DOM. A server (Elixir, Java, Lisp, ...) sends user interface structure _and_
logic as **Common Lisp S-expressions encoded as JSON arrays**, with HTML written in **CL-WHO** style; the browser
parses the JSON and this small interpreter evaluates it straight into DOM nodes - `document.createElement` and
`createTextNode` only, never HTML strings or `innerHTML`. A lightweight server-driven UI (SDUI) runtime; the browser
library and its builds have no dependencies (the module's running instance, like every module of this repository,
reads its configuration through `@setmy-info/commons`).

```json
[
    ":div",
    [":class", "pwa-card", ":id", "user-widget"],
    [":h1", ["cl:format", null, "Welcome back, ~a", ["cl:getf", "user.name"]]],
    [
        "cl:if",
        ["cl:>", ["cl:getf", "user.score"], 100],
        [":div", [":class", "badge-vip"], "VIP Member"],
        [":div", [":class", "badge-standard"], "Standard Account"]
    ],
    [
        ":ul",
        [":class", "order-list"],
        [
            "cl:dolist",
            ["order", ["cl:getf", "orders"]],
            [":li", ["cl:getf", "order.title"], " ", ["cl:format", null, "$~,2f", ["cl:getf", "order.price"]]]
        ]
    ]
]
```

License: **AGPL-3.0-only or commercial** (dual-licensed) - see [License](#license).

## Use it

### Classic `<script>` tag

`dist/cl-json.min.js` (built by `npm run build`, also served by unpkg / jsDelivr as the package's default file) puts
the API on the global `ClJson` and mounts every `<script type="application/cl+json">` payload when the page is
parsed. The builds target ES2020 browsers (Chrome 80, Firefox 74, Safari 13.1 and later):

```html
<div id="app"></div>
<script type="application/json" id="app-state">
    { "user": { "name": "Ann" }, "count": 0 }
</script>
<script type="application/cl+json" data-target="#app" data-state="app-state">
    [
        ":p",
        ["cl:format", null, "Hello ~a", ["cl:getf", "user.name"]],
        [":button", { "on-click": ["cl:lambda", [], ["cl:incf", "count"]] }, "+"],
        ["cl:getf", "count"]
    ]
</script>
<script src="https://unpkg.com/@setmy-info/cl-json-js"></script>
```

A payload is the content of the tag or, with `src`, a JSON resource - a backend's response or a file next to the
page - loaded, evaluated and put into the target element:

```html
<div id="cart"></div>
<script type="application/cl+json" src="pages/cart.json" data-target="cart"></script>
```

The same by hand, into any existing element (or its id):

```js
const view = await ClJson.include("cart", "pages/cart.json"); // optional state and options follow
```

If loading or evaluating fails, the reason is written into the target as text (and its `data-cl-json-error`
attribute is set); the page's other payloads are still mounted. A page opened straight from disk (`file://`) is not allowed to read files by default - unlike
`<script src>` and `<link href>`, whose content the browser uses itself and never hands to the page; serve it over
HTTP (or, for local work only, allow it: Firefox `security.fileuri.strict_origin_policy = false`, Chrome
`--allow-file-access-from-files`).

| Attribute        | What                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src`            | the JSON resource; without it, the tag's content is the payload                                                        |
| `data-target`    | where to render: an element id (`app`) or a CSS selector (`#app`, `.slot`); default: a new `<div>` right after the tag |
| `data-state`     | id of a `<script type="application/json">` with the initial state                                                      |
| `data-state-src` | a JSON resource with the initial state                                                                                 |

A payload can also carry its own initial state with `cl:defvar`, which binds a variable only while it is unbound -
so state changed by clicks survives the re-renders:

```json
["cl:progn", ["cl:defvar", "count", 0], [":button", { "on-click": ["cl:lambda", [], ["cl:incf", "count"]] }, "+"]]
```

Add `data-autorun="false"` to the library's `<script>` to mount by hand - `mount` takes an element or its id:

```js
const view = ClJson.mount("app", await ClJson.load("pages/home.json"), { user });
await ClJson.renderScripts(document); // the <script type="application/cl+json"> tags, as autorun does
```

### Bundlers, Angular, any ES module build

```sh
npm install @setmy-info/cl-json-js
```

The package is plain ES modules with TypeScript declarations (`src/index.d.ts`), so Angular CLI, Vite, webpack and
esbuild bundle and tree-shake it like any other dependency:

```ts
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { mount, type Form, type MountHandle } from "@setmy-info/cl-json-js";

@Component({ selector: "app-sdui", standalone: true, template: "<div #host></div>" })
export class SduiComponent implements AfterViewInit, OnDestroy {
    @ViewChild("host", { static: true }) host!: ElementRef<HTMLElement>;
    private http = inject(HttpClient);
    private view?: MountHandle;

    ngAfterViewInit(): void {
        this.http.get<Form>("/api/ui/home").subscribe((ast) => {
            this.view = mount(
                this.host.nativeElement,
                ast,
                { user: { name: "Ann" } },
                {
                    functions: { "app:navigate": (url: string) => location.assign(url) },
                },
            );
        });
    }

    ngOnDestroy(): void {
        this.view?.unmount();
    }
}
```

`dist/cl-json.esm.min.js` (export `./esm`) is the same API as one minified ES module, for `<script type="module">`
and import maps without a bundler; `./browser` is the classic script-tag build (it sets the global `ClJson` and
autoruns), not a module.

### API

| Function                                  | What                                                                                                                                                                                                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `evalCL(ast, scope?, options?)`           | evaluates a form; elements come back as DOM nodes, everything else as its value                                                                                                                                                                       |
| `render(ast, scope?, options?)`           | evaluates into one `Node` (several nodes or text: a `DocumentFragment`)                                                                                                                                                                               |
| `mount(target, ast, state?, options?)`    | renders into `target` (an element or its id) and stays live; returns `{ state, refresh, update, replace, unmount }`                                                                                                                                   |
| `createInterpreter(options?)`             | an interpreter with its own function namespace: `{ evalCL, render, mount, defun }`                                                                                                                                                                    |
| `renderScripts(root?, options?)`          | mounts every `<script type="application/cl+json">` under `root`, inline or `src`; a Promise of the views (what the script-tag build runs). Every payload is attempted; a failure is written into its target and the Promise rejects once all are done |
| `include(target, url, state?, options?)`  | loads a JSON-CL resource and renders it into an element or its id (what `src` does); errors are written into it                                                                                                                                       |
| `load(url, options?)`                     | loads and parses a JSON resource                                                                                                                                                                                                                      |
| `formatString(control, args)`             | Common Lisp `format nil`                                                                                                                                                                                                                              |
| `ClJsonError`, `isTrue`, `princ`, `prin1` | the error type, Lisp truthiness and the printers                                                                                                                                                                                                      |

Options: `document` (default `globalThis.document`; pass one to run outside the browser) and `functions`, host
functions by qualified name (`{ "app:save": (data) => ... }`) that payloads call as `["app:save", ...]`.

**Live views.** An event handler (`:on-click`, `:on-input`, ... with a `cl:lambda`) that changes state with `cl:setq`,
`cl:setf`, `cl:incf`, `cl:decf` or `cl:push` re-renders the mounted view; `update({...})` and `update(state => ...)`
do the same from JavaScript, `replace(ast)` swaps in a new payload from the server. A re-render rebuilds the view (no
virtual DOM - it stays small); the focused field (by `id`) keeps focus and caret. A payload that fails to evaluate
leaves the previous view in place; a handler that fails after changing state still re-renders, so the view never
shows stale state. The state should be plain data (what JSON gives): `cl:setf` and friends write into plain
objects and arrays only.

## The language

A payload is Common Lisp written as JSON: `["cl:if", test, then, else]`, `["cl:getf", "user.name"]` to read a
variable, `"text"` is always text, and `null` / `false` / `[]` are NIL. What of Common Lisp is supported, what is not
and the ordered plan for the rest are in [COMMON-LISP.md](COMMON-LISP.md); this section covers only the HTML side.

### HTML (CL-WHO)

Tags are keywords: `":div"`, `":h1"`, `":my-widget"`, any HTML element; `":svg"` and `":math"` switch their subtree to
the SVG / MathML namespace (`":foreignObject"` back to HTML). Attributes come in three spellings:

```json
[":a", [":href", "/home", ":class", "nav"], "Home"]
[":a", {"href": "/home", "class": "nav"}, "Home"]
[":a", ":href", "/home", ":class", "nav", "Home"]
```

The list form is told apart from a child element by its first name: a list starting with a known tag (`":p"`,
`":title"`, `":span"`, ...) or a custom element name (`":my-widget"`) is a child. When an attribute shares its name
with a tag (`title`, `style`, `span`, `label`, `form`, `data`, `cite`, `slot`, `summary`), use the object or the
inline spelling, or put another attribute first.

Attribute values are evaluated: NIL / `false` leaves the attribute out, T / `true` is a boolean attribute, a list is
joined with spaces (`:class ["btn", ["cl:when", ["cl:getf", "active"], "active"]]`), `:style` takes an object
(`{"color": "red"}`). `:on-<event>` / `:on<event>` attaches a `cl:lambda` (or `["cl:function", "app:fn"]`) as event
listener; it receives the DOM event (`["cl:getf", "e.target.value"]`). Every attribute whose name starts with `on` is
taken as an event attribute, so a string there is refused.

## Security

The payload is code, so it should come from your server, but the runtime is a sandbox for what it renders:

- no HTML parsing: text is always a text node, elements are created one by one;
- `<script>` elements are refused, `srcdoc` dropped, `javascript:` / `vbscript:` / non-image `data:` URLs dropped from
  `href`, `src`, `action`, `formaction`, `data`, `xlink:href`, ... (an SVG `data:` image only in `<img>` / `<image>`);
- event attributes accept only functions made by the interpreter - never strings like `"alert(1)"`;
- `cl:funcall`, `cl:mapcar`, ... call only interpreter-made functions (lambdas, `cl:defun`, builtins, the
  `functions` option): a JavaScript function reachable through the data (`window.eval`, ...) cannot be called;
- paths refuse `__proto__`, `prototype` and `constructor`; `cl:setf` writes plain data only (JSON objects and
  arrays) - never DOM nodes, `window` or other host objects such as `location`, storage or styles.

More - trusting payloads, what is not protected, the `file://` rule of browsers, the development server - in
[SECURITY.md](SECURITY.md).

## Development

The module has the shape of every module of the repository (see the repository README): `src/index.js` (the library,
pure - no dependencies, what the browser builds bundle), `src/config.js` (its configuration through
`@setmy-info/commons`, from the bundled `resources/application.yaml` and its `-ci` / `-live` profile files) and
`src/server.js` (the running instance: `node:http` serving `web/`).

```sh
npm test                                   # from the repository root: every package's unit tier
npm run build -w @setmy-info/cl-json-js     # dist/{index,config,server}.js (Node) + dist/cl-json.min.js (IIFE, global ClJson)
                                           # + dist/cl-json.esm.min.js, and the script-tag build again as web/dist/cl-json.min.js
npm run server -w @setmy-info/cl-json-js    # src/server.js serves web/ - http://127.0.0.1:48241/
```

The instance's port is `smi.server.port` of `resources/application.yaml` (`48241`), its host `smi.server.host` -
`0.0.0.0`, every interface, so a browser on a remote Selenium Grid node can reach the pages; the `live` profile keeps
it on `127.0.0.1`. As with every module, `SMI_PROFILES`, `SMI_SERVER_PORT=8080` / `SMI_SERVER_HOST=127.0.0.1` and
`--smi-server-port 8080` override it (`@setmy-info/commons`).

`web/index.html` is a plain HTML page: home (the reference payload), FizzBuzz, a shopping cart and a todo list as
`<script type="application/cl+json" src="pages/<name>.json">` tags, an SVG chart loaded with `ClJson.include()`, and
one inline payload. Each JSON file is loaded, evaluated and put into its element.

`web/pages/*.json` and `*.cl.json` files are excluded from Prettier, to keep their Lisp-style layout.

Tests, the repository's three tiers (`node --test`, run from the repository root):

| Tier        | Where               | What                                                                                                                     |
| ----------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| unit        | `test/unit/`        | the interpreter, `cl:format`, the builtins, `renderScripts`, against a minimal fake DOM - no jsdom                       |
| integration | `test/integration/` | the bundled configuration and its profiles (`config.test.js`); every real file of `web/` evaluated (`web-pages.test.js`) |
| e2e         | `test/e2e/`         | the running instance over HTTP (`server.test.js`), and `index.html` in a real Firefox via Selenium                       |

The browser specs follow the setmy.info e2e standard (see the repository README, "Tests"): `scripts/pageHelper.js`
against an external Selenium Grid, `index.e2e.js` and its Gherkin twin `index.gherkin.e2e.js`. They assert computed
values (colors, text decoration, sizes, SVG attributes) as well as text, and open the page from `file://` too when
the grid's browser runs on this machine: with file reading allowed it renders, with a desktop Firefox's default each
target shows why it can not.

```sh
npm run pre-e2e-test && npm run e2e-test; npm run post-e2e-test     # starts/stops the instances (scripts/servers.js)
```

## License

Copyright (c) 2026 Imre Tabur.

Dual-licensed - choose either:

- **GNU Affero General Public License v3.0 only** ([LICENSE-AGPL-3.0.txt](LICENSE-AGPL-3.0.txt)). A web application
  that ships this library to its users must offer them its Corresponding Source.
- **Commercial license** for proprietary and closed-source use - see [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md).

SPDX: `AGPL-3.0-only OR LicenseRef-cl-json-js-Commercial`. This package only; the rest of the repository is MIT.
