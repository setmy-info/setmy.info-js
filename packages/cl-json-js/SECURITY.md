# Security

Security notes for `cl-json-js`: what the runtime protects against, what it does not, and how browsers limit loading
JSON-CL resources.

## Reporting a vulnerability

Please report security issues privately to Imre Tabur, <imre.tabur@mail.ee>, not in a public issue. Include the
version, a minimal payload that shows the problem, and the browser it was seen in.

## A payload is code

A JSON-CL payload is a program: it defines functions, changes state and builds the page. Treat it like JavaScript:

- **Load payloads only from sources you trust**, normally your own backend. Never evaluate a payload that a user (or a
  third party) wrote or could change.
- **User data belongs in the state, not in the payload.** Pass it as the `state` / `scope` argument (or the
  `data-state` / `data-state-src` of a script tag) and read it with `["cl:getf", "path"]`; a string in the state is
  always rendered as text.
- **Serve payloads over HTTPS**, from the page's own origin, so they cannot be changed on the way.

## What the runtime protects against

Even from a trusted payload, the runtime refuses the usual ways to inject script into the page:

- **No HTML parsing.** Elements are created one by one with `document.createElement`, text with
  `document.createTextNode` - never `innerHTML` or HTML strings. A string like `"<img src=x onerror=alert(1)>"` is
  shown as text.
- **No `<script>` elements.** A `:script` tag is refused with an error.
- **No dangerous URLs.** `javascript:`, `vbscript:` and non-image `data:` URLs are dropped from `href`, `src`,
  `action`, `formaction`, `xlink:href`, `poster`, `cite`, `background` and `ping`.
- **No `srcdoc`.** The attribute is dropped.
- **No string event handlers.** `:onclick "alert(1)"` is refused; event attributes accept only functions made by the
  interpreter (`cl:lambda`, `cl:function`).
- **No calling arbitrary JavaScript.** `cl:funcall`, `cl:apply`, `cl:mapcar`, event handlers and the other
  higher-order functions call only interpreter-made functions - lambdas, `cl:defun`, builtins and the host functions
  you register through the `functions` option. A JavaScript function reachable through the data (`window.eval`, a
  function in your state, ...) cannot be called.
- **No prototype pollution.** Variable paths refuse `__proto__`, `prototype` and `constructor`.
- **Data writes only.** `cl:setf`, `cl:incf`, ... write data: never into DOM nodes (`innerHTML`, ...) or `window`.

What it does **not** do:

- It does not limit what a payload computes or how long it runs - an endless loop in a payload hangs the page, as an
  endless loop in JavaScript would.
- Host functions you register (`functions: { "app:save": ... }`) run with full JavaScript rights: validate their
  arguments as you would for any input.
- `:style` values and other attributes are set as given: a payload can still change how the page looks.

A [Content Security Policy](https://developer.mozilla.org/docs/Web/HTTP/CSP) works together with the runtime: it
needs no `unsafe-eval` and no `unsafe-inline` for the payloads themselves (they are data, not scripts).

## Loading resources and the `file://` rule

`<script type="application/cl+json" src="pages/cart.json">` and `ClJson.include(target, "pages/cart.json")` load the
JSON with `fetch()`. Opened over HTTP(S) - as from a backend - this always works for the page's own origin.

A page opened **straight from disk** (`file:///.../index.html`) may not read other files by default:

```text
pages/fizzbuzz.json: NetworkError when attempting to fetch resource.
```

This is the browser protecting you, not an error in the page or the library. If any HTML file you open from disk -
an e-mail attachment, a download - could read other local files with JavaScript, it could read your documents or
keys and send them away. So browsers isolate every `file://` page:

- **Firefox**: `security.fileuri.strict_origin_policy = true` (the default) - `fetch()` and `XMLHttpRequest` to any
  other file are refused.
- **Chrome / Edge**: file access from `file://` pages is refused unless started with
  `--allow-file-access-from-files`.

`<script src>` and `<link href>` are not affected because the browser runs or applies those files itself and never
hands their content to the page. A JSON resource is only useful when the page reads it, and reading is what is
refused.

When loading fails, the reason is written into the target element as text and its `data-cl-json-error` attribute is
set, so the page shows why instead of staying empty.

### What to do instead

1. **Serve the folder over HTTP** - what a backend does, and the recommended way:

    ```sh
    npm run server -w @setmy-info/cl-json-js     # http://127.0.0.1:48241/
    python3 -m http.server -d web 8000           # from packages/cl-json-js: http://127.0.0.1:8000/
    ```

2. **Allow file reading in the browser - for local development only.** Firefox: `about:config`,
   `security.fileuri.strict_origin_policy = false`; Chrome: start it with `--allow-file-access-from-files`. This
   lowers the protection for **every** local HTML file you open: use a separate development profile, never your
   everyday one, and switch it back when done.

3. **Inline payloads** - the JSON as the content of `<script type="application/cl+json">` - need no file and work from
   disk as they are.

## The development server

`src/server.js` (`npm run server`) serves the `web/` folder, read-only, for development and the e2e tests:

- It listens on **all interfaces** by default, so a Selenium Grid on another machine can reach it: anyone on your
  network can then read `web/`. Use `HOST=127.0.0.1 npm run server -w @setmy-info/cl-json-js` to keep it on your own
  machine.
- It serves only files under `web/` (paths leaving it answer 404), sends no CORS headers, and is not meant for
  production: put the payloads behind your real backend there.

## End-to-end tests

The Selenium e2e tests open the page from `file://` with both settings of `security.fileuri.strict_origin_policy`.
Note that geckodriver's Firefox profile turns that protection **off** by default - a page that loads from disk under
Selenium can still fail in a normal Firefox. The tests set the preference explicitly for that reason.
