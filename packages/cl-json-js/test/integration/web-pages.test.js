// Integration tier: the real files of web/ read from disk - every
// pages/<name>.json resource and the payloads of index.html - evaluated by the
// public API into a DOM (the unit tier's fake DOM; the browser is the e2e
// tier's job).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { mount } from "../../src/index.js";
import { FakeDocument, html } from "../unit/fake-dom.js";

const WEB = new URL("../../web/", import.meta.url);
const INDEX = fs.readFileSync(new URL("index.html", WEB), "utf8");
const PAGES = fs
    .readdirSync(new URL("pages/", WEB))
    .filter((file) => file.endsWith(".json"))
    .sort();

function payloadOf(file) {
    return JSON.parse(fs.readFileSync(new URL(`pages/${file}`, WEB), "utf8"));
}

function mountPage(name) {
    const document = new FakeDocument();
    const target = document.createElement("div");
    document.body.appendChild(target);
    const view = mount(target, payloadOf(`${name}.json`), {}, { document });
    return { target, view };
}

function button(target, label) {
    const found = target
        .querySelectorAll("button")
        .find((element) => element.textContent === label);
    assert.ok(found, `button ${label}`);
    return found;
}

test("index.html loads every pages/*.json resource into its own element", () => {
    const tags = [
        ...INDEX.matchAll(
            /<div id="(\w+)"><\/div>\s*<script\s+type="application\/cl\+json"\s+src="pages\/(\w+)\.json"\s+data-target="(\w+)"\s*><\/script>/g,
        ),
    ];
    for (const [, div, , target] of tags) {
        assert.equal(div, target);
    }
    const calls = [
        ...INDEX.matchAll(/ClJson\.include\("(\w+)", "pages\/(\w+)\.json"\)/g),
    ];
    for (const [, target] of calls) {
        assert.match(INDEX, new RegExp(`<div id="${target}"></div>`));
    }
    assert.deepEqual(
        [...tags, ...calls].map((match) => `${match[2]}.json`).sort(),
        PAGES,
    );
});

test("the inline payload of index.html is valid JSON-CL", () => {
    const inline = /data-target="inline">([\s\S]*?)<\/script>/.exec(INDEX)[1];
    const document = new FakeDocument();
    const target = document.createElement("div");
    mount(target, JSON.parse(inline), {}, { document });
    assert.match(target.textContent, /clicked 0 times$/);
});

test("home: the reference payload, and the score buttons", () => {
    const { target } = mountPage("home");
    assert.match(
        html(target),
        /<h3>Welcome back, Ann<\/h3><div class="badge-vip"/,
    );
    button(target, "Score - 50").dispatch("click");
    assert.match(html(target), /badge-standard/);
});

test("fizzbuzz: labels and the +15 button", () => {
    const { target } = mountPage("fizzbuzz");
    const cells = () => target.querySelectorAll("span");
    assert.equal(cells().length, 30);
    assert.deepEqual(
        cells()
            .slice(0, 15)
            .map((cell) => cell.textContent),
        [
            "1",
            "2",
            "Fizz",
            "4",
            "Buzz",
            "Fizz",
            "7",
            "8",
            "Fizz",
            "Buzz",
            "11",
            "Fizz",
            "13",
            "14",
            "FizzBuzz",
        ],
    );
    assert.equal(cells()[14].getAttribute("class"), "cell fizzbuzz");
    button(target, "+ 15").dispatch("click");
    assert.equal(cells().length, 45);
});

test("cart: totals and free shipping; the payload stays untouched", () => {
    const { target, view } = mountPage("cart");
    const summary = () => target.querySelector("p").textContent;
    assert.equal(
        summary(),
        "Subtotal 28.50 € · Shipping 4.90 € · Total 33.40 €",
    );
    button(target, "+").dispatch("click");
    button(target, "+").dispatch("click");
    assert.equal(view.state.items[0].qty, 3);
    assert.equal(summary(), "Subtotal 53.50 € · Shipping free · Total 53.50 €");
    assert.equal(mountPage("cart").view.state.items[0].qty, 1);
});

test("todos: add, toggle, filter, clear", () => {
    const { target, view } = mountPage("todos");
    const input = target.querySelector("#todo-draft");
    input.value = "Test it";
    input.dispatch("input");
    target.querySelector("#todo-draft").dispatch("keydown", { key: "Enter" });
    assert.equal(view.state.todos.length, 4);
    assert.match(target.textContent, /3 items left/);
    button(target, "Clear done").dispatch("click");
    assert.deepEqual(
        view.state.todos.map((todo) => todo[1]),
        ["Write a JSON-CL payload", "Ship it", "Test it"],
    );
});

test("chart: SVG bars against the target", () => {
    const { target } = mountPage("chart");
    const rects = target.querySelectorAll("rect");
    assert.equal(rects.length, 6);
    assert.equal(rects[0].namespaceURI, "http://www.w3.org/2000/svg");
    assert.match(
        target.querySelector("p").textContent,
        /\(4 of 6 months on target\)/,
    );
    button(target, "+ 5").dispatch("click");
    assert.match(
        target.querySelector("p").textContent,
        /\(2 of 6 months on target\)/,
    );
});
