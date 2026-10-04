# Common Lisp in cl-json-js

`cl-json-js` evaluates a small, practical subset of Common Lisp written as JSON: lists are JSON arrays, symbols are
strings with a package prefix (`"cl:car"`, `"app:save"`), keywords are strings with a colon (`":div"`). This document
lists what is supported, what is not, and what to add next - in the order that keeps the core small.

Footprint today: about 25 KB minified, **about 9 KB gzipped**, no dependencies. That is the budget to defend: the
guiding rule below is to grow the language with Lisp itself (macros), not with more JavaScript.

## 1. Supported

### Data and evaluation

| JSON                                 | Common Lisp                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| `["cl:car", x]`                      | `(car x)` - a function call; `"cl:"` names are the standard library          |
| `["app:save", x]`                    | `(app:save x)` - a function from `cl:defun` or the host (`functions` option) |
| `[":div", {...}, ...]`               | CL-WHO `(:div ...)` - an HTML / SVG / MathML element                         |
| `"text"`, `42`                       | self-evaluating string and number                                            |
| `null`, `false`, `[]`, `"cl:nil"`    | `NIL` - the only false values; `0` and `""` are true                         |
| `true`, `"cl:t"`                     | `T`                                                                          |
| `["cl:getf", "user.name"]`           | reading a variable (also `cl:symbol-value`); a dotted path reads properties  |
| `[x, y, ...]` (no operator in front) | a list of the evaluated elements; rendered, a fragment of siblings           |
| `{"key": ...}`                       | self-evaluating data; right after a tag, the element's attributes            |

### Special forms and macros

`quote`, `function`, `progn`, `if`, `when`, `unless`, `cond`, `case` (with `otherwise` / `t`), `and`, `or`, `let`,
`let*`, `dolist`, `dotimes`, `lambda` (`&optional` with defaults, `&rest`), `defun`, `defvar`, `setq`, `setf`
(variable paths and `getf` places), `incf`, `decf`, `push`, `getf`, `symbol-value`, `assoc`.

**Scopes:** `let`, `let*`, `dolist`, `dotimes` and lambdas bind in a new scope layer (chained with `Object.create`), so
inner bindings shadow and never leak. `setq` / `setf` assign the nearest binding; an unbound name is set in the
global state. `setf` also takes `getf` places, as in CL: `["cl:setf", ["cl:getf", ["cl:getf", "todo"], ":done"], true]`
sets a plist entry (appending it when missing) or an object property.

### Functions

- **Numbers:** `+ - * / 1+ 1- mod rem abs min max floor ceiling round truncate sqrt expt random`
- **Comparison:** `= /= < > <= >= eq eql equal string= string-equal string< string>`
- **Predicates:** `not null zerop plusp minusp evenp oddp numberp integerp stringp keywordp listp consp atom functionp`
- **Lists and sequences:** `list list* cons length first car second third rest cdr last nth nthcdr elt append reverse
subseq member find find-if position count remove remove-if remove-if-not every some mapcar reduce sort`
- **Strings:** `string string-upcase string-downcase string-capitalize string-trim parse-integer princ-to-string
prin1-to-string concatenate`
- **Hash tables:** `gethash` (on JSON objects)
- **Functions:** `funcall apply identity`
- **Output and errors:** `format` (destination `nil` returns the string, `t` logs it), `print`, `error`, and CL-WHO's
  `str` (the printed arguments, NIL as nothing)

### `format` directives

`~a ~s ~d ~b ~o ~x ~f ~$ ~p ~% ~& ~~ ~*`, iteration `~{ ~}` with `~^`, `~:{` and `~@{`, conditionals `~[ ~; ~]`,
`~:[ ~; ~]`, `~@[ ~]`, the `:` / `@` modifiers of `~d` and `~p`, numeric prefix parameters (`~5d`, `~,2f`), and
tilde-newline.

## 2. Not supported

### Not there at all

- **Macros:** no `defmacro`, `macroexpand`, backquote (`` ` `` `,` `,@`) or `gensym`. Every form above is built in.
- **Lambda lists:** no `&key`, `&body`, `&aux`, supplied-p parameters, destructuring (`destructuring-bind`).
- **Local functions:** no `flet`, `labels`, `macrolet`, `symbol-macrolet`.
- **Non-local control:** no `block` / `return-from` / `return`, `tagbody` / `go`, `catch` / `throw`,
  `unwind-protect`.
- **Conditions:** `error` throws, but there is no `handler-case`, `handler-bind`, `ignore-errors`, restarts or
  `define-condition`.
- **Multiple values:** no `values`, `multiple-value-bind`, `nth-value`.
- **Iteration:** no `loop`, `do`, `do*`, `mapc`, `mapcan`, `maplist`.
- **Data types:** no conses (lists are JavaScript arrays - no dotted pairs, `rplaca` / `rplacd`, shared tails), no
  characters (one-letter strings instead), no arrays / vectors (`aref`, `make-array`), no `defstruct`, no CLOS
  (`defclass`, `defgeneric`, `defmethod`), no `make-hash-table` / `remhash` / `maphash`.
- **Symbols and packages:** symbols are plain strings - no `intern`, `symbol-name`, property lists on symbols,
  `defpackage` / `in-package`.
- **Numbers:** JavaScript doubles only - no bignums, ratios (`(/ 1 3)` is `0.333...`), complex numbers or exact
  integer division beyond 2^53.
- **The rest of the system:** no reader (payloads are JSON, not S-expression text; no `#'`, `#(`, `'`), no `eval`,
  `compile`, `load`, streams or file I/O (`format t` writes to the console), no `the` / `declare` / type checks, no
  dynamic (special) variables - `let` binds lexically only.

### Supported, but different from Common Lisp

- `dolist` and `dotimes` **return the list of their body values** (so a loop can produce children); with a result form
  they return it, as in CL.
- Bodies (`progn`, `when`, `let`, ...) return their **last value**, as in CL - to emit several siblings, return a list:
  `["cl:when", c, [[":p", "a"], [":p", "b"]]]`.
- An **unbound variable reads as `NIL`** instead of signalling an error; so does a missing property in a path.
- Variables are read only with `cl:getf` / `cl:symbol-value` - a bare string is always text.
- `getf` with one argument reads a dotted **path** (`"user.name"`); `setf`, `incf`, `push` take paths as places.
- Function **arity is lenient**, as in JavaScript: missing arguments are `NIL`, extra ones are ignored.
- `eq` and `eql` are the same comparison; `case` and `getf` compare keywords with or without the leading colon
  (`":admin"` matches `"admin"`).
- `defvar` stores a **copy** of its value, so state changes never edit the payload's own literals.
- Only `NIL` is false - but `false` and `[]` from JSON are `NIL` too.

## 3. To implement, in order

Each step uses the ones before it. The first two make the language extensible from Lisp itself; most later items are
then a few lines of JSON-CL macros instead of JavaScript - the footprint grows slowly, and a page pays only for what
it loads.

1. **Backquote** - `["cl:quasiquote", form]` with `["cl:unquote", x]` and `["cl:unquote-splicing", xs]` inside. Pure
   data templating: the precondition for writing readable macros. Small: one recursive copy.
2. **`defmacro`, `macroexpand-1`, `macroexpand`, `gensym`** - a macro is a lambda over unevaluated forms whose result
   is evaluated in its place; macros live in the same per-interpreter namespace as `cl:defun` (`"app:unless-empty"`).
   Expand once and cache per form object, so re-renders do not pay twice.
3. **`&body`, `&key` (with defaults and supplied-p) and `destructuring-bind`** - one shared lambda-list parser for
   functions and macros. Needed by almost every macro and by the `:key` / `:test` arguments of step 9.
4. **`block` / `return-from` / `return`** - the one non-local exit everything else needs (`loop`, `dolist` early exit,
   `return` from a function). A thrown marker object, caught by its block.
5. **`flet` / `labels`** - local functions; small, given lambdas and scopes.
6. **`unwind-protect`, `handler-case`, `ignore-errors`** - a minimal condition system on top of JavaScript
   `try` / `catch`: a condition is the thrown `ClJsonError` (or a host error), its type checked by name. No restarts.
7. **Generalized places: `define-setf-expander` light / `defsetf`** - then `setf` / `incf` / `push` on `nth`, `car`,
   `gethash`, `getf` and user accessors via one place protocol; `pop`, `pushnew`, `rotatef` follow as macros.
8. **A standard prelude written in JSON-CL** - re-express derived forms as macros over the primitives: `when`,
   `unless`, `cond`, `case`, `dolist`, `dotimes`, `incf`, `decf`, `push`, plus new ones: `prog1`, `do`, `do*`,
   `ecase`, `typecase`. Keep a form in JavaScript only where the macro version is larger or measurably slower.
   Ship the prelude as one small JSON file, loaded once.
9. **Sequences with `&key :key :test :from-end`** - `mapc`, `mapcan`, `remove-duplicates`, `count-if`,
   `position-if`, `assoc-if`, `find`/`position`/`remove` with `:key`, `search`, `copy-list`; written in the prelude
   where possible.
10. **A `loop` subset** - as a macro: `for x in`, `for i from ... to / below ... by`, `collect`, `append`, `sum`,
    `count`, `when` / `unless`, `while` / `until`, `finally`, `return`. The common 90 %; no full ANSI `loop`.
11. **Multiple values** - `values`, `multiple-value-bind`, `nth-value`, as a tagged array (single value by default).
12. **Hash tables** - `make-hash-table`, `remhash`, `maphash`, `hash-table-count`, over JavaScript `Map` (keys
    compared `eql` / `equal`).
13. **`format` extras** - `~(` `~)` case conversion, `~r` (radix and English numbers), `~e`, `~g`, `~t`, `~<` justify
    only if asked for.
14. **CL-WHO conveniences** - `fmt` and `esc` as aliases, `htm` for completeness. Small.

**Kept out on purpose** - too large for the footprint or of no use in a browser page: CLOS, `defstruct` beyond a
plist-backed macro, packages, the reader, `eval` / `compile`, streams and file I/O, bignums and ratios, `tagbody` /
`go`, restarts, tail-call optimization, full ANSI `loop`. Each can be revisited if a real page needs it.

## Rules for growing it

- **Macros before primitives.** A new feature is a JSON-CL macro unless it cannot be one.
- **Measure.** Track the gzipped bundle (`gzip -9 -c dist/cl-json.min.js | wc -c`, ~9 KB today); a step that adds more
  than about 1 KB gzipped needs a reason.
- **Opt-in.** Large libraries (the `loop` subset, hash tables) can be separate prelude files a page includes only when
  it uses them.
- **Same safety rules.** Macros produce forms that go through the same evaluator - no new way to reach JavaScript
  (see [SECURITY.md](SECURITY.md)).
