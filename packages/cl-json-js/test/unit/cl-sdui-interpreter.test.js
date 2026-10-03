import test from "node:test";
import assert from "node:assert/strict";

import {
    ClJsonError,
    createInterpreter,
    evalCL,
    mount,
    render,
} from "../../src/index.js";
import { FakeDocument, html } from "./fake-dom.js";

function setup(functions) {
    const document = new FakeDocument();
    return { document, cl: createInterpreter({ document, functions }) };
}

const PAYLOAD = [
    ":div",
    [":class", "pwa-card", ":id", "user-widget"],
    [":h1", ["cl:format", null, "Welcome back, ~a", ["cl:getf", "user.name"]]],
    [
        "cl:if",
        ["cl:>", ["cl:getf", "user.score"], 100],
        [":div", [":class", "badge-vip"], "VIP Member"],
        [":div", [":class", "badge-standard"], "Standard Account"],
    ],
    [":h3", "Your Orders:"],
    [
        ":ul",
        [":class", "order-list"],
        [
            "cl:dolist",
            ["order", ["cl:getf", "orders"]],
            [
                ":li",
                [":class", "order-item"],
                [":span", [":class", "title"], ["cl:getf", "order.title"]],
                [
                    ":span",
                    [":class", "price"],
                    ["cl:format", null, "$~a", ["cl:getf", "order.price"]],
                ],
            ],
        ],
    ],
];

test("renders the reference payload of the specification", () => {
    const { cl } = setup();
    const node = cl.evalCL(PAYLOAD, {
        user: { name: "Ann", score: 150 },
        orders: [
            { title: "Book", price: 12 },
            { title: "Pen <b>", price: 2.5 },
        ],
    });
    assert.equal(
        html(node),
        '<div class="pwa-card" id="user-widget">' +
            "<h1>Welcome back, Ann</h1>" +
            '<div class="badge-vip">VIP Member</div>' +
            "<h3>Your Orders:</h3>" +
            '<ul class="order-list">' +
            '<li class="order-item"><span class="title">Book</span><span class="price">$12</span></li>' +
            '<li class="order-item"><span class="title">Pen &#60;b&#62;</span><span class="price">$2.5</span></li>' +
            "</ul></div>",
    );
});

test("takes the else branch and renders nothing for an empty list", () => {
    const { cl } = setup();
    const node = cl.evalCL(PAYLOAD, {
        user: { name: "Bob", score: 3 },
        orders: [],
    });
    assert.match(
        html(node),
        /<div class="badge-standard">Standard Account<\/div>/,
    );
    assert.match(html(node), /<ul class="order-list"><\/ul>/);
});

test("text is always a text node, never parsed markup", () => {
    const { cl } = setup();
    const node = cl.evalCL([":p", "<img src=x onerror=alert(1)>"]);
    assert.equal(node.childNodes.length, 1);
    assert.equal(node.firstChild.nodeType, 3);
});

test("elements without attributes take children directly", () => {
    const { cl } = setup();
    assert.equal(
        html(
            cl.evalCL([":div", [":h1", "Title"], [":p", "Paragraph content"]]),
        ),
        "<div><h1>Title</h1><p>Paragraph content</p></div>",
    );
});

test("attributes: list, object and inline CL-WHO forms", () => {
    const { cl } = setup();
    assert.equal(
        html(
            cl.evalCL([":a", { href: "/x", title: ["cl:getf", "t"] }, "x"], {
                t: "T",
            }),
        ),
        '<a href="/x" title="T">x</a>',
    );
    assert.equal(
        html(cl.evalCL([":a", ":href", "/x", ":class", "link", "x"])),
        '<a href="/x" class="link">x</a>',
    );
    assert.equal(
        html(cl.evalCL([":div", [":data-id", 7, ":aria-label", "seven"]])),
        '<div data-id="7" aria-label="seven"></div>',
    );
});

test("child lists starting with a tag or custom element are not attributes", () => {
    const { cl } = setup();
    assert.equal(html(cl.evalCL([":p", [":em", "x"]])), "<p><em>x</em></p>");
    assert.equal(
        html(cl.evalCL([":div", [":my-widget", "x"]])),
        "<div><my-widget>x</my-widget></div>",
    );
});

test("attribute values: booleans, NIL, class lists, style objects", () => {
    const { cl } = setup();
    const node = cl.evalCL([
        ":input",
        {
            disabled: true,
            hidden: null,
            checked: false,
            class: ["a", null, "b"],
            style: { color: "red", margin: null },
        },
    ]);
    assert.equal(
        html(node),
        '<input disabled="" class="a b" style="color: red"></input>',
    );
});

test("unsafe URLs, srcdoc and script tags are refused", () => {
    const { cl } = setup();
    const node = cl.evalCL([
        ":a",
        {
            href: " javascript:alert(1)",
            src: "data:text/html,<b>",
            srcdoc: "<b>",
            title: "ok",
        },
    ]);
    assert.equal(html(node), '<a title="ok"></a>');
    assert.equal(
        cl
            .evalCL([":img", { src: "data:image/png;base64,AA==" }])
            .getAttribute("src"),
        "data:image/png;base64,AA==",
    );
    assert.throws(() => cl.evalCL([":script", "alert(1)"]), ClJsonError);
    assert.throws(
        () => cl.evalCL([":div", { onclick: "alert(1)" }]),
        /needs a function/,
    );
    assert.throws(
        () => cl.evalCL([":div", { "bad name": 1 }]),
        /Illegal attribute/,
    );
    assert.throws(() => cl.evalCL([":di v"]), /Illegal tag name/);
});

test("SVG and MathML use their namespaces, foreignObject returns to HTML", () => {
    const { cl } = setup();
    const svg = cl.evalCL([
        ":svg",
        { viewBox: "0 0 10 10" },
        [":circle", { r: 5, "xlink:href": "#c" }],
        [":foreignObject", [":p", "x"]],
    ]);
    assert.equal(svg.namespaceURI, "http://www.w3.org/2000/svg");
    assert.equal(svg.childNodes[0].namespaceURI, "http://www.w3.org/2000/svg");
    assert.equal(
        svg.childNodes[0].attributeNamespaces.get("xlink:href"),
        "http://www.w3.org/1999/xlink",
    );
    assert.equal(
        svg.childNodes[1].childNodes[0].namespaceURI,
        "http://www.w3.org/1999/xhtml",
    );
    assert.equal(
        cl.evalCL([":math", [":mi", "x"]]).namespaceURI,
        "http://www.w3.org/1998/Math/MathML",
    );
});

test("lists render as fragments; NIL, T and functions render as nothing", () => {
    const { cl } = setup();
    assert.equal(
        html(
            cl.evalCL([":p", [[":b", "a"], " ", [":i", "b"]], null, true, 42]),
        ),
        "<p><b>a</b> <i>b</i>42</p>",
    );
    const fragment = cl.render(["Hello", " ", [":b", "you"]]);
    assert.equal(fragment.nodeType, 11);
    assert.equal(html(fragment), "Hello <b>you</b>");
    assert.equal(cl.render([":br"]).tagName, "br");
});

test("cl:let and cl:dolist bind in an isolated lexical layer", () => {
    const { cl } = setup();
    const scope = { x: "outer" };
    const value = cl.evalCL(
        [
            "cl:list",
            [
                "cl:let",
                [
                    ["x", "inner"],
                    ["y", ["cl:getf", "x"]],
                ],
                ["cl:list", ["cl:getf", "x"], ["cl:getf", "y"]],
            ],
            [
                "cl:let*",
                [
                    ["x", "a"],
                    ["y", ["cl:getf", "x"]],
                ],
                ["cl:getf", "y"],
            ],
            ["cl:dolist", ["x", ["cl:quote", [1, 2]]], ["cl:getf", "x"]],
            ["cl:getf", "x"],
        ],
        scope,
    );
    assert.deepEqual(value, [["inner", "outer"], "a", [1, 2], "outer"]);
    assert.deepEqual(Object.keys(scope), ["x"]);
});

test("control flow: cond, case, when, unless, and, or, dotimes", () => {
    const cases = [
        [["cl:cond", [false, "no"], [["cl:=", 1, 1], "yes"]], "yes"],
        [["cl:cond", [false, "no"], [7]], 7],
        [["cl:cond", [false, "no"]], null],
        [
            [
                "cl:case",
                "admin",
                [[":user", ":guest"], "u"],
                [":admin", "a"],
                ["cl:otherwise", "o"],
            ],
            "a",
        ],
        [["cl:case", "x", [":admin", "a"], [true, "o"]], "o"],
        [["cl:case", "x", [":admin", "a"]], null],
        [["cl:when", 0, "zero is true"], "zero is true"],
        [["cl:when", [], "empty list is NIL"], null],
        [["cl:unless", null, "a", "b"], "b"],
        [["cl:unless", true, "a"], null],
        [["cl:and", 1, 2], 2],
        [["cl:and", 1, false], false],
        [["cl:and", 1, null, 3], null],
        [["cl:and"], true],
        [["cl:or", null, "", 3], ""],
        [["cl:or", null, false], null],
        [["cl:if", "cl:nil", 1, 2], 2],
        [["cl:if", "cl:t", 1], 1],
        [["cl:if", false, 1], null],
        [
            ["cl:dotimes", ["i", 3], ["cl:*", ["cl:getf", "i"], 2]],
            [0, 2, 4],
        ],
        [["cl:dotimes", ["i", 2, ["cl:getf", "i"]], 1], 2],
        [["cl:dolist", ["x", null], 1], []],
        [["cl:dolist", ["x", ["cl:list", 1], "done"], 1], "done"],
        [["cl:progn", 1, 2], 2],
        [
            ["cl:quote", ["cl:+", 1]],
            ["cl:+", 1],
        ],
        [[], null],
    ];
    for (const [form, expected] of cases) {
        assert.deepEqual(evalCL(form), expected, JSON.stringify(form));
    }
});

test("cl:getf, cl:assoc and cl:symbol-value read paths, plists and alists", () => {
    const scope = { user: { name: "Ann", tags: ["a", "b"] } };
    const cases = [
        [["cl:getf", "user.name"], "Ann"],
        [["cl:getf", ":user.tags.1"], "b"],
        [["cl:getf", "user.missing.deeper"], null],
        [["cl:getf", "nobody"], null],
        [["cl:getf", "toString"], null],
        [["cl:getf", ["cl:quote", [":a", 1, ":b", 2]], ":b"], 2],
        [["cl:getf", ["cl:quote", [":a", 1]], ":z", "dflt"], "dflt"],
        [["cl:getf", ["cl:getf", "user"], ":name"], "Ann"],
        [["cl:getf", ["cl:getf", "user"], ":nope"], null],
        [["cl:getf", "x", ":nope"], null],
        [["cl:symbol-value", "user.name"], "Ann"],
        [["cl:assoc", "user.name"], "Ann"],
        [
            [
                "cl:assoc",
                ":b",
                [
                    "cl:quote",
                    [
                        ["a", 1],
                        ["b", 2],
                    ],
                ],
            ],
            ["b", 2],
        ],
        [["cl:assoc", "z", ["cl:quote", [["a", 1]]]], null],
        [["cl:assoc", "z", 1], null],
    ];
    for (const [form, expected] of cases) {
        assert.deepEqual(evalCL(form, scope), expected, JSON.stringify(form));
    }
    for (const path of ["user.__proto__", "constructor", "a..b"]) {
        assert.throws(() => evalCL(["cl:getf", path], scope), /illegal path/);
    }
    assert.throws(() => evalCL(["cl:getf", 1]), /not a variable path/);
});

test("lambda, funcall, defun and host functions", () => {
    const { cl } = setup({ "app:double": (n) => n * 2 });
    assert.equal(cl.evalCL(["app:double", 21]), 42);
    assert.equal(
        cl.evalCL([
            [
                "cl:lambda",
                ["a", "&optional", ["b", 10]],
                ["cl:+", ["cl:getf", "a"], ["cl:getf", "b"]],
            ],
            1,
        ]),
        11,
    );
    assert.deepEqual(
        cl.evalCL([
            "cl:funcall",
            [
                "cl:lambda",
                ["a", "&optional", "b", "&rest", "r"],
                ["cl:list", ["cl:getf", "b"], ["cl:getf", "r"]],
            ],
            1,
            2,
            3,
            4,
        ]),
        [2, [3, 4]],
    );
    cl.evalCL([
        "cl:defun",
        "my:greet",
        ["name"],
        ["cl:format", null, "Hi ~a!", ["cl:getf", "name"]],
    ]);
    assert.equal(cl.evalCL(["my:greet", "Ann"]), "Hi Ann!");
    assert.equal(
        cl.evalCL(["cl:funcall", ["cl:function", "my:greet"], "Bob"]),
        "Hi Bob!",
    );
    assert.deepEqual(
        cl.evalCL(["cl:mapcar", ["cl:function", "cl:1+"], ["cl:list", 1, 2]]),
        [2, 3],
    );
    assert.equal(
        cl.evalCL(["cl:funcall", ["cl:function", ["cl:lambda", [], 5]]]),
        5,
    );
    cl.defun("app:host", () => "host");
    assert.equal(cl.evalCL(["app:host"]), "host");
    assert.throws(() => cl.evalCL(["my:nothing"]), /Undefined function/);
    assert.throws(() => cl.evalCL(["cl:nothing"]), /Undefined operator/);
    assert.throws(
        () => cl.evalCL(["cl:function", "nope:x"]),
        /Undefined function/,
    );
    assert.throws(
        () => cl.evalCL(["cl:defun", "cl:car", [], 1]),
        /Illegal function name/,
    );
    assert.throws(() => cl.defun("plain", () => 1), /Illegal function name/);
    assert.throws(() => cl.defun("app:x", 1), /not a function/);
    assert.throws(
        () => cl.evalCL(["cl:lambda", "x"]),
        /parameters must be a list/,
    );
});

test("plain JavaScript functions found in scope cannot be called", () => {
    const { cl } = setup();
    const scope = { evil: () => "pwned", obj: { fn: () => "pwned" } };
    assert.throws(
        () => cl.evalCL(["cl:funcall", ["cl:getf", "evil"]], scope),
        /Not a function/,
    );
    assert.throws(
        () =>
            cl.evalCL(
                ["cl:mapcar", ["cl:getf", "obj.fn"], ["cl:list", 1]],
                scope,
            ),
        /Not a function/,
    );
    assert.throws(
        () =>
            cl.evalCL([":button", { "on-click": ["cl:getf", "evil"] }], scope),
        /needs a function/,
    );
});

test("setq, setf, incf, decf and push mutate the owning binding", () => {
    const state = { count: 1, user: { name: "Ann" }, items: null };
    const value = evalCL(
        [
            "cl:progn",
            ["cl:let", [["count", 100]], ["cl:setq", "count", 200]],
            ["cl:setf", "user.name", "Bob", "fresh", 1],
            ["cl:incf", "count"],
            ["cl:incf", "count", 10],
            ["cl:decf", "count"],
            ["cl:decf", "count", 2],
            ["cl:push", "a", "items"],
            ["cl:push", "b", "items"],
        ],
        state,
    );
    assert.deepEqual(value, ["b", "a"]);
    assert.deepEqual(state, {
        count: 9,
        user: { name: "Bob" },
        items: ["b", "a"],
        fresh: 1,
    });
    assert.throws(() => evalCL(["cl:setq", "a"]), /odd number/);
    assert.throws(() => evalCL(["cl:setf", "nobody.name", 1]), /no data place/);
    assert.throws(
        () => evalCL(["cl:let", [[1, 2]], 1]),
        /illegal variable name/,
    );
    assert.throws(() => evalCL(["cl:let", "x", 1]), /bindings must be a list/);
    assert.throws(() => evalCL(["cl:let", [3], 1]), /illegal variable name/);
    assert.deepEqual(
        evalCL([
            "cl:let",
            ["x", ["y"]],
            ["cl:list", ["cl:getf", "x"], ["cl:getf", "y"]],
        ]),
        [null, null],
    );
    assert.throws(() => evalCL(["cl:dolist", ["x"], 1]), /expected/);
    assert.throws(() => evalCL(["cl:dolist", ["x", 5], 1]), /not a list/);
    assert.throws(() => evalCL(["cl:dotimes", ["i", "a"], 1]), /not a number/);
    assert.throws(() => evalCL(["cl:cond", []]), /non-empty/);
    assert.throws(() => evalCL(["cl:case", 1, 2]), /non-empty/);
});

test("setf on getf places: plists, objects and variable paths", () => {
    const state = { todo: [":text", "a", ":done", false], user: {} };
    evalCL(
        [
            "cl:progn",
            ["cl:setf", ["cl:getf", ["cl:getf", "todo"], ":done"], true],
            ["cl:setf", ["cl:getf", ["cl:getf", "todo"], ":due"], "monday"],
            ["cl:setf", ["cl:getf", ["cl:getf", "user"], ":name"], "Ann"],
            ["cl:setf", ["cl:getf", "user.age"], 42],
        ],
        state,
    );
    assert.deepEqual(state, {
        todo: [":text", "a", ":done", true, ":due", "monday"],
        user: { name: "Ann", age: 42 },
    });
    assert.throws(
        () => evalCL(["cl:setf", ["cl:getf", 5, ":x"], 1]),
        /no data place/,
    );
    assert.throws(
        () =>
            evalCL(["cl:setf", ["cl:getf", ["cl:getf", "u"], "__proto__"], 1], {
                u: {},
            }),
        /no data place/,
    );
});

test("setf cannot write into DOM nodes", () => {
    const { document, cl } = setup();
    const node = document.createElement("div");
    assert.throws(
        () => cl.evalCL(["cl:setf", "el.innerHTML", "<b>"], { el: node }),
        /no data place/,
    );
});

test("mount re-renders after a handler changes state", () => {
    const { document } = setup();
    const target = document.createElement("div");
    document.body.appendChild(target);
    const view = mount(
        target,
        [
            ":div",
            [":span", { id: "count" }, ["cl:getf", "count"]],
            [
                ":button",
                {
                    id: "inc",
                    "on-click": ["cl:lambda", ["e"], ["cl:incf", "count"]],
                },
                "+",
            ],
            [":button", { id: "noop", onClick: ["cl:lambda", [], 1] }, "noop"],
        ],
        { count: 0 },
        { document },
    );
    const before = target.querySelector("#noop");
    before.dispatch("click");
    assert.equal(
        target.querySelector("#noop"),
        before,
        "no state change, no re-render",
    );
    target.querySelector("#inc").dispatch("click");
    target.querySelector("#inc").dispatch("click");
    assert.equal(target.querySelector("#count").textContent, "2");
    assert.equal(view.state.count, 2);

    view.update({ count: 10 });
    assert.equal(target.querySelector("#count").textContent, "10");
    view.update((state) => {
        state.count = 11;
    });
    assert.equal(target.querySelector("#count").textContent, "11");
    view.replace([":p", "replaced ", ["cl:getf", "count"]]);
    assert.equal(target.textContent, "replaced 11");
    view.unmount();
    assert.equal(target.childNodes.length, 0);
    assert.equal(view.refresh(), view);
    assert.equal(target.childNodes.length, 0);
    assert.throws(() => mount({}, [":p"], {}, { document }), /not a DOM node/);
});

test("mount keeps focus and caret in the field being edited", () => {
    const { document } = setup();
    const target = document.createElement("div");
    document.body.appendChild(target);
    mount(
        target,
        [
            ":input",
            {
                id: "name",
                value: ["cl:getf", "name"],
                "on-input": [
                    "cl:lambda",
                    ["e"],
                    ["cl:setf", "name", ["cl:getf", "e.target.value"]],
                ],
            },
        ],
        { name: "" },
        { document },
    );
    const input = target.querySelector("#name");
    input.focus();
    input.selectionStart = 2;
    input.selectionEnd = 2;
    input.value = "Al";
    input.dispatch("input");
    const replaced = target.querySelector("#name");
    assert.notEqual(replaced, input);
    assert.equal(replaced.getAttribute("value"), "Al");
    assert.equal(document.activeElement, replaced);
    assert.deepEqual(replaced.selection, [2, 2]);
});

test("a failed re-render leaves the previous view in place", () => {
    const { document } = setup();
    const target = document.createElement("div");
    const view = mount(target, [":p", "ok"], {}, { document });
    assert.throws(() => view.replace(["cl:nope"]), /Undefined operator/);
    assert.equal(target.textContent, "ok");
});

test("the module-level render uses the given document", () => {
    const document = new FakeDocument();
    assert.equal(html(render([":b", "x"], {}, { document })), "<b>x</b>");
    assert.throws(
        () => evalCL([":b"], {}, { document: null }),
        /No DOM document/,
    );
});
