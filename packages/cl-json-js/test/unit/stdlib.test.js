import test from "node:test";
import assert from "node:assert/strict";

import { evalCL, formatString, prin1, princ } from "../../src/index.js";

const L = (...items) => ["cl:quote", items];
const F = (name) => ["cl:function", name];

test("builtins", () => {
    const cases = [
        [["cl:+", 1, 2, 3], 6],
        [["cl:+"], 0],
        [["cl:-", 5], -5],
        [["cl:-", 10, 3, 2], 5],
        [["cl:*", 2, 3], 6],
        [["cl:/", 2], 0.5],
        [["cl:/", 12, 2, 3], 2],
        [["cl:1+", 1], 2],
        [["cl:1-", 1], 0],
        [["cl:mod", -1, 5], 4],
        [["cl:rem", -1, 5], -1],
        [["cl:abs", -3], 3],
        [["cl:min", 3, 1], 1],
        [["cl:max", 3, 1], 3],
        [["cl:floor", 7, 2], 3],
        [["cl:ceiling", 7, 2], 4],
        [["cl:round", 2.6], 3],
        [["cl:truncate", -2.6], -2],
        [["cl:sqrt", 9], 3],
        [["cl:expt", 2, 10], 1024],
        [["cl:=", 1, 1, 1], true],
        [["cl:=", 1, 2], false],
        [["cl:/=", 1, 2, 3], true],
        [["cl:/=", 1, 2, 1], false],
        [["cl:<", 1, 2, 3], true],
        [["cl:>", 3, 2, 2], false],
        [["cl:<=", 1, 1], true],
        [["cl:>=", 2, 1], true],
        [["cl:eq", "a", "a"], true],
        [["cl:eql", null, false], true],
        [["cl:equal", L(1, [2]), L(1, [2])], true],
        [["cl:equal", L(1), L(2)], false],
        [["cl:equal", null, L()], true],
        [["cl:string=", ":abc", "abc"], true],
        [["cl:string-equal", "ABC", "abc"], true],
        [["cl:string<", "a", "b"], true],
        [["cl:string>", "a", "b"], false],
        [["cl:not", 0], false],
        [["cl:null", L()], true],
        [["cl:zerop", 0], true],
        [["cl:plusp", 1], true],
        [["cl:minusp", 1], false],
        [["cl:evenp", 2], true],
        [["cl:oddp", -3], true],
        [["cl:numberp", "1"], false],
        [["cl:integerp", 1.5], false],
        [["cl:stringp", "s"], true],
        [["cl:keywordp", ":k"], true],
        [["cl:listp", null], true],
        [["cl:consp", L()], false],
        [["cl:atom", 1], true],
        [["cl:functionp", F("cl:car")], true],
        [["cl:every", F("cl:numberp"), L(1, 2)], true],
        [["cl:some", F("cl:stringp"), L(1, "x")], true],
        [["cl:some", F("cl:stringp"), L(1)], null],
        [
            ["cl:list", 1, 2],
            [1, 2],
        ],
        [
            ["cl:list*", 1, L(2, 3)],
            [1, 2, 3],
        ],
        [
            ["cl:cons", 1, L(2)],
            [1, 2],
        ],
        [["cl:length", L(1, 2)], 2],
        [["cl:length", "abc"], 3],
        [["cl:first", L(1, 2)], 1],
        [["cl:car", null], null],
        [["cl:second", L(1, 2)], 2],
        [["cl:third", L(1, 2)], null],
        [["cl:rest", L(1, 2)], [2]],
        [["cl:cdr", L(1)], []],
        [["cl:last", L(1, 2)], [2]],
        [["cl:nth", 1, L("a", "b")], "b"],
        [["cl:nthcdr", 1, L("a", "b")], ["b"]],
        [["cl:elt", L("a", "b"), 0], "a"],
        [["cl:elt", "abc", 2], "c"],
        [
            ["cl:append", L(1), null, L(2)],
            [1, 2],
        ],
        [
            ["cl:reverse", L(1, 2)],
            [2, 1],
        ],
        [["cl:reverse", "ab"], "ba"],
        [
            ["cl:subseq", L(1, 2, 3), 1],
            [2, 3],
        ],
        [["cl:subseq", "hello", 1, 3], "el"],
        [
            ["cl:member", 2, L(1, 2, 3)],
            [2, 3],
        ],
        [["cl:member", 9, L(1)], null],
        [["cl:find", 2, L(1, 2)], 2],
        [["cl:find", 3, L(1, 2)], null],
        [["cl:find-if", F("cl:evenp"), L(1, 2)], 2],
        [["cl:position", "b", L("a", "b")], 1],
        [["cl:position", "z", L("a")], null],
        [["cl:count", 1, L(1, 2, 1)], 2],
        [["cl:remove", 1, L(1, 2, 1)], [2]],
        [
            ["cl:remove-if", F("cl:evenp"), L(1, 2, 3)],
            [1, 3],
        ],
        [["cl:remove-if-not", F("cl:evenp"), L(1, 2, 3)], [2]],
        [
            ["cl:mapcar", F("cl:+"), L(1, 2, 3), L(10, 20)],
            [11, 22],
        ],
        [["cl:reduce", F("cl:+"), L(1, 2, 3)], 6],
        [["cl:reduce", F("cl:+"), L(), 5], 5],
        [["cl:reduce", F("cl:+"), L()], 0],
        [
            ["cl:sort", L(3, 1, 2, 1), F("cl:<")],
            [1, 1, 2, 3],
        ],
        [["cl:gethash", ":a", { a: 1 }], 1],
        [["cl:gethash", "toString", {}], null],
        [["cl:gethash", "a", null], null],
        [["cl:string", ":kw"], "kw"],
        [["cl:string", 12], "12"],
        [["cl:string-upcase", "ab"], "AB"],
        [["cl:string-downcase", "AB"], "ab"],
        [["cl:string-capitalize", "hELLO wORLD"], "Hello World"],
        [["cl:string-trim", " ", "  hi  "], "hi"],
        [["cl:string-trim", L("x", "y"), "xyhix"], "hi"],
        [["cl:parse-integer", " 42 "], 42],
        [["cl:princ-to-string", L(1, "a")], "(1 a)"],
        [["cl:prin1-to-string", 'a"b'], '"a\\"b"'],
        [["cl:concatenate", "string", "a", L("b", "c"), 1], "abc1"],
        [
            ["cl:concatenate", "cl:list", L(1), L(2)],
            [1, 2],
        ],
        [["cl:concatenate", ":list", L(1), null], [1]],
        [["cl:concatenate", "cl:string", "a", "b"], "ab"],
        [["cl:str", "a", null, 1, false, "b"], "a1b"],
        [["cl:funcall", F("cl:+"), 1, 2], 3],
        [["cl:apply", F("cl:+"), 1, L(2, 3)], 6],
        [["cl:identity", 7], 7],
        [["cl:format", null, "~a", 1], "1"],
    ];
    for (const [form, expected] of cases) {
        assert.deepEqual(evalCL(form), expected, JSON.stringify(form));
    }
    const random = evalCL(["cl:random", 10]);
    assert.ok(Number.isInteger(random) && random >= 0 && random < 10);
    assert.ok(evalCL(["cl:random", 1.5]) < 1.5);
});

test("builtin errors", () => {
    assert.throws(() => evalCL(["cl:+", 1, "2"]), /not a number/);
    assert.throws(() => evalCL(["cl:<", 1, "2"]), /not a number/);
    assert.throws(() => evalCL(["cl:/", 1, 0]), /division by zero/);
    assert.throws(() => evalCL(["cl:/", 0]), /division by zero/);
    for (const op of [
        "cl:mod",
        "cl:rem",
        "cl:floor",
        "cl:ceiling",
        "cl:round",
        "cl:truncate",
    ]) {
        assert.throws(() => evalCL([op, "7", 2]), /not a number/, op);
        assert.throws(() => evalCL([op, 7, 0]), /division by zero/, op);
    }
    for (const op of [
        "cl:abs",
        "cl:sqrt",
        "cl:random",
        "cl:zerop",
        "cl:plusp",
        "cl:minusp",
        "cl:evenp",
        "cl:oddp",
    ]) {
        assert.throws(() => evalCL([op, null]), /not a number: NIL/, op);
    }
    assert.throws(() => evalCL(["cl:expt", 2, "x"]), /not a number/);
    assert.throws(() => evalCL(["cl:car", 5]), /not a list/);
    assert.throws(() => evalCL(["cl:parse-integer", "x"]), /not an integer/);
    assert.throws(() => evalCL(["cl:error", "Boom ~a", 1]), /Boom 1/);
});

test("format t and print write to the console", (t) => {
    const log = t.mock.method(console, "log", () => {});
    assert.equal(evalCL(["cl:format", true, "hi ~a", 1]), null);
    assert.equal(evalCL(["cl:print", "x"]), "x");
    assert.deepEqual(
        log.mock.calls.map((call) => call.arguments[0]),
        ["hi 1", '"x"'],
    );
});

test("princ and prin1", () => {
    assert.equal(princ(null), "NIL");
    assert.equal(princ(true), "T");
    assert.equal(princ([]), "NIL");
    assert.equal(
        princ(() => 1),
        "#<FUNCTION>",
    );
    assert.equal(princ({ nodeType: 1 }), "#<DOM-NODE>");
    assert.equal(princ({ a: 1 }), '{"a":1}');
    const circular = {};
    circular.self = circular;
    assert.equal(princ(circular), "#<OBJECT>");
    assert.equal(prin1(["a", 1]), '("a" 1)');
});

test("format directives", () => {
    const cases = [
        ["Hello ~a", ["World"], "Hello World"],
        ["~A|~5a|~5@a", ["x", "ab", "ab"], "x|ab   |   ab"],
        ["~s ~s", ["str", null], '"str" NIL'],
        ["~d ~:d ~@d ~5d", [3.7, 1234567, 5, 42], "3 1,234,567 +5    42"],
        ["~d", ["n/a"], "n/a"],
        ["~b ~o ~x", [5, 8, 255], "101 10 ff"],
        ["~f ~,2f ~6,1f", [1.5, 3.14159, 2], "1.5 3.14    2.0"],
        ["~$ ~3$ ~2,,6$", [2, 1, 3], "2.00 1.000   3.00"],
        ["~a item~:p, ~a pon~:@p", [1, 2], "1 item, 2 ponies"],
        ["~a cat~:p", [1], "1 cat"],
        ["a~%b~2%c", [], "a\nb\n\nc"],
        ["~&a~&~&b", [], "a\nb"],
        ["~~ ~3~", [], "~ ~~~"],
        ["~a ~* ~a ~:* ~a", [1, 2, 3], "1  3  3"],
        ["~{~a~^, ~}", [[1, 2, 3]], "1, 2, 3"],
        ["~{~a=~a~^ ~}", [["a", 1, "b", 2]], "a=1 b=2"],
        [
            "~:{<~a ~a>~}",
            [
                [
                    ["a", 1],
                    ["b", 2],
                ],
            ],
            "<a 1><b 2>",
        ],
        ["~@{~a~^-~}", [1, 2, 3], "1-2-3"],
        ["~{~}", [[1]], ""],
        ["~:[no~;yes~] ~:[no~;yes~]", [true, null], "yes no"],
        ["~[zero~;one~;two~]|~1[a~;b~]|~[x~]", [2, 5], "two|b|"],
        ["~[a~;b~:;many~] ~[a~;b~:;many~]", [1, 7], "b many"],
        ["~,2f ~$", ["n/a", null], "n/a NIL"],
        ["~@[<~a>~]~@[<~a>~]", [null, "x"], "<x>"],
        ["one ~\n      two", [], "one two"],
    ];
    for (const [control, args, expected] of cases) {
        assert.equal(formatString(control, args), expected, control);
    }
});

test("format errors", () => {
    assert.throws(() => formatString(1, []), /control must be a string/);
    assert.throws(() => formatString("~a", []), /not enough arguments/);
    assert.throws(() => formatString("~q", []), /unknown directive/);
    assert.throws(() => formatString("~{~a", [[]]), /unterminated ~\{/);
    assert.throws(() => formatString("~[a", [0]), /unterminated ~\[/);
    assert.throws(() => formatString("~{~a~}", [1]), /needs a list/);
    assert.throws(() => formatString("tail ~", []), /bad directive/);
});
