# cl-json-js

Common Lisp in JSON, rendered to the DOM. A server (Elixir, Java, Lisp, ...) sends user interface structure _and_
logic as **Common Lisp S-expressions encoded as JSON arrays**, with HTML written in **CL-WHO** style; the browser
parses the JSON and this small interpreter evaluates it straight into DOM nodes - `document.createElement` and
`createTextNode` only, never HTML strings or `innerHTML`. A lightweight server-driven UI (SDUI) runtime with no
dependencies.

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
parsed:

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
attribute is set). A page opened straight from disk (`file://`) is not allowed to read files by default - unlike
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
and import maps without a bundler.

### API

| Function                                  | What                                                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `evalCL(ast, scope?, options?)`           | evaluates a form; elements come back as DOM nodes, everything else as its value                                                           |
| `render(ast, scope?, options?)`           | evaluates into one `Node` (several nodes or text: a `DocumentFragment`)                                                                   |
| `mount(target, ast, state?, options?)`    | renders into `target` (an element or its id) and stays live; returns `{ state, refresh, update, replace, unmount }`                       |
| `createInterpreter(options?)`             | an interpreter with its own function namespace: `{ evalCL, render, mount, defun }`                                                        |
| `renderScripts(root?, options?)`          | mounts every `<script type="application/cl+json">` under `root`, inline or `src`; a Promise of the views (what the script-tag build runs) |
| `include(target, url, state?, options?)`  | loads a JSON-CL resource and renders it into an element or its id (what `src` does); errors are written into it                           |
| `load(url, options?)`                     | loads and parses a JSON resource                                                                                                          |
| `formatString(control, args)`             | Common Lisp `format nil`                                                                                                                  |
| `ClJsonError`, `isTrue`, `princ`, `prin1` | the error type, Lisp truthiness and the printers                                                                                          |

Options: `document` (default `globalThis.document`; pass one to run outside the browser) and `functions`, host
functions by qualified name (`{ "app:save": (data) => ... }`) that payloads call as `["app:save", ...]`.

**Live views.** An event handler (`:on-click`, `:on-input`, ... with a `cl:lambda`) that changes state with `cl:setq`,
`cl:setf`, `cl:incf`, `cl:decf` or `cl:push` re-renders the mounted view; `update({...})` and `update(state => ...)`
do the same from JavaScript, `replace(ast)` swaps in a new payload from the server. A re-render rebuilds the view (no
virtual DOM - it stays small); the focused field (by `id`) keeps focus and caret. A payload that fails to evaluate
leaves the previous view in place.

## The language

### Evaluation rules

| JSON form                         | Meaning                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| `[":tag", attributes?, child...]` | an HTML / SVG / MathML element (CL-WHO); children are evaluated and appended         |
| `["cl:name", arg...]`             | a Common Lisp special form or function                                               |
| `["pkg:name", arg...]`            | a function from `cl:defun` or the `functions` option                                 |
| `[other, ...]`                    | a list - every element is evaluated; rendered, a list is a fragment                  |
| `"text"`, `42`                    | self-evaluating; a string is **always text**, never a variable                       |
| `null`, `false`, `[]`             | NIL. Everything else is true, `0` and `""` included, as in Lisp                      |
| `true`, `"cl:t"` / `"cl:nil"`     | T and NIL                                                                            |
| `{"key": ...}`                    | self-evaluating data; right after a tag, the element's attributes (values evaluated) |

Variables are read with `["cl:getf", "path.to.value"]` (also `cl:symbol-value`, and `cl:assoc` with one argument):
a dotted path, the first name looked up through the lexical scopes, the rest as properties (`"orders.0.title"`). An
unbound name or a missing property is NIL.

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
listener; it receives the DOM event (`["cl:getf", "e.target.value"]`).

### Special forms

`cl:quote`, `cl:function`, `cl:progn`, `cl:if`, `cl:when`, `cl:unless`, `cl:cond`, `cl:case` (keys compared with
keyword colons ignored; `"cl:otherwise"` / `true` default), `cl:and`, `cl:or`, `cl:let`, `cl:let*`, `cl:dolist`,
`cl:dotimes`, `cl:lambda` (`&optional`, `&rest`), `cl:defun`, `cl:defvar`, `cl:setq`, `cl:setf`, `cl:incf`, `cl:decf`, `cl:push`,
`cl:getf`, `cl:symbol-value`, `cl:assoc`.

```json
[
    "cl:let",
    [
        [
            "total",
            ["cl:reduce", ["cl:function", "cl:+"], ["cl:mapcar", ["cl:function", "app:price"], ["cl:getf", "orders"]]]
        ]
    ],
    [
        "cl:cond",
        [
            ["cl:zerop", ["cl:getf", "total"]],
            [":p", "Nothing yet"]
        ],
        [true, [":p", ["cl:format", null, "Total: ~,2f", ["cl:getf", "total"]]]]
    ]
]
```

`cl:let`, `cl:dolist`, `cl:dotimes` and lambdas bind in a new scope layer chained with `Object.create`, so inner
bindings shadow and never leak; `cl:setq` / `cl:setf` assign the nearest binding (unbound names: the state).
`cl:setf` also takes getf places, as in CL: `["cl:setf", ["cl:getf", ["cl:getf", "todo"], ":done"], true]` sets a
plist entry (appending it when missing) or an object property.

**Where this differs from Common Lisp**, on purpose: `cl:dolist` and `cl:dotimes` _return the list of body values_ so
they can produce children (with a result form they return it, as in CL); bodies of `cl:when`, `cl:let`, ... return
their last value as in CL, so emit several siblings as a list: `["cl:when", c, [[":p", "a"], [":p", "b"]]]`; function
arity is lenient (an event handler may ignore the event); symbols are namespaced strings (`"cl:car"`, `"app:save"`),
variables are only read with `cl:getf`.

### Functions

Arithmetic `+ - * / 1+ 1- mod rem abs min max floor ceiling round truncate sqrt expt random`; comparison
`= /= < > <= >= eq eql equal string= string-equal string< string>`; predicates `not null zerop plusp minusp evenp
oddp numberp integerp stringp keywordp listp consp atom functionp every some`; lists `list list* cons length first
car second third rest cdr last nth nthcdr elt append reverse subseq member find find-if position count remove
remove-if remove-if-not mapcar reduce sort`; data `gethash`; strings `string string-upcase string-downcase
string-capitalize string-trim parse-integer princ-to-string prin1-to-string concatenate format str`; control
`funcall apply identity error print`. All prefixed `cl:`.

`cl:format` supports `~a ~s ~d ~b ~o ~x ~f ~$ ~p ~% ~& ~~ ~*`, `~{...~}` iteration (`~^`, `~:{`, `~@{`),
conditionals `~[...~;...~]`, `~:[false~;true~]`, `~@[...~]` and numeric prefix parameters (`~5d`, `~,2f`, `~:d`).
Destination `null` returns the string, `true` logs it. `cl:str` is CL-WHO's `str`: the printed arguments, NIL as
nothing.

## Security

The payload is code, so it should come from your server, but the runtime is a sandbox for what it renders:

- no HTML parsing: text is always a text node, elements are created one by one;
- `<script>` elements are refused, `srcdoc` dropped, `javascript:` / `vbscript:` / non-image `data:` URLs dropped from
  `href`, `src`, `action`, `formaction`, `xlink:href`, ...;
- event attributes accept only functions made by the interpreter - never strings like `"alert(1)"`;
- `cl:funcall`, `cl:mapcar`, ... call only interpreter-made functions (lambdas, `cl:defun`, builtins, the
  `functions` option): a JavaScript function reachable through the data (`window.eval`, ...) cannot be called;
- paths refuse `__proto__`, `prototype` and `constructor`; `cl:setf` writes data only, never DOM nodes or `window`.

More - trusting payloads, what is not protected, the `file://` rule of browsers, the development server - in
[SECURITY.md](SECURITY.md).

## Development

```sh
npm test                                   # from the repository root: every package's unit tier
npm run build -w @setmy-info/cl-json-js     # dist/cl-json.min.js (IIFE, global ClJson) + dist/cl-json.esm.min.js
```

`web/index.html` is a plain HTML page: home (the reference payload), FizzBuzz, a shopping cart and a todo list as
`<script type="application/cl+json" src="pages/<name>.json">` tags, an SVG chart loaded with `ClJson.include()`, and
one inline payload. Each JSON file is loaded, evaluated and put into its element.

```sh
npm run build -w @setmy-info/cl-json-js     # also copies the script-tag build to web/dist/
npm run server -w @setmy-info/cl-json-js    # src/server.js serves web/ - http://127.0.0.1:48241/
```

`web/pages/*.json` and `*.cl.json` files are excluded from Prettier, to keep their Lisp-style layout.

Tests, the repository's three tiers (`node --test`, run from the repository root):

| Tier        | Where               | What                                                                                               |
| ----------- | ------------------- | -------------------------------------------------------------------------------------------------- |
| unit        | `test/unit/`        | the interpreter, `cl:format`, the builtins, `renderScripts`, against a minimal fake DOM - no jsdom |
| integration | `test/integration/` | every real file of `web/` read from disk and evaluated: `pages/*.json`, the inline payload         |
| e2e         | `test/e2e/`         | the running instance over HTTP (`server.test.js`), and `index.html` in a real Firefox via Selenium |

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
