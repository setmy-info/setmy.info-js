// web/index.html in a real Firefox through Selenium (scripts/pageHelper.js):
// every section is a pages/<name>.json resource the page loads, evaluates and
// puts into the DOM - by <script type="application/cl+json" src> or by
// ClJson.include(); the last one is the content of its script tag itself.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";

import * as pageHelper from "../../../../scripts/pageHelper.js";
import { testPageName } from "../../../../scripts/testPageName.js";

const pageName = testPageName(import.meta.url);

describe(`${pageName} page tests`, () => {
    before(async () => {
        pageHelper.pageName(pageName);
        await pageHelper.pageIsRendered();
    });

    after(async () => {
        await pageHelper.pageClose();
    });

    test("should load the page and check title", async () => {
        assert.equal(await pageHelper.getTitle(), "cl-json-js");
    });

    test("home: the reference payload", async () => {
        await pageHelper.waitForText("#home h3", "Welcome back, Ann");
        assert.deepEqual(await pageHelper.getTexts("#home .order-item"), [
            "Book $12.00",
            "Pen $2.50",
        ]);
        const vip = await pageHelper.elementIs("#home .badge-vip");
        assert.equal(vip.color, "rgb(161, 98, 7)");
        assert.equal(vip.fontWeight, "700");
        await pageHelper.clickButton("Score - 50", "#home");
        await pageHelper.waitForText("#home", "score 100");
        assert.equal(
            await pageHelper.getText("#home .badge-standard"),
            "Standard Account",
        );
    });

    test("fizzbuzz: cl:dotimes and cl:cond", async () => {
        await pageHelper.waitFor("#fizzbuzz .cell");
        assert.equal(await pageHelper.countOf("#fizzbuzz .cell"), 30);
        assert.deepEqual(
            (await pageHelper.getTexts("#fizzbuzz .cell")).slice(0, 15),
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
        const fizzbuzz = await pageHelper.elementIs("#fizzbuzz .fizzbuzz");
        assert.equal(fizzbuzz.backgroundColor, "rgb(187, 247, 208)");
        assert.equal(fizzbuzz.allStyles["text-align"], "center");
        await pageHelper.clickButton("+ 15", "#fizzbuzz");
        await pageHelper.waitForText("#fizzbuzz p strong", "45");
        assert.equal(await pageHelper.countOf("#fizzbuzz .cell"), 45);
    });

    test("cart: totals, free shipping, the muted row", async () => {
        await pageHelper.waitForText(
            "#cart .summary",
            "Subtotal 28.50 € · Shipping 4.90 € · Total 33.40 €",
        );
        // The row's inline style: decoration on the row, color inherited by its cells.
        const muted = await pageHelper.elementIs("#cart tr.muted");
        assert.equal(muted.allStyles["text-decoration-line"], "line-through");
        const cell = await pageHelper.elementIs("#cart tr.muted td");
        assert.equal(cell.color, "rgb(107, 114, 128)");
        await pageHelper.clickButton("+", "#cart tr:nth-child(2)");
        await pageHelper.waitForText(
            "#cart .summary",
            "Subtotal 41.00 € · Shipping free · Total 41.00 €",
        );
        assert.equal(await pageHelper.countOf("#cart .hint"), 0);
    });

    test("todos: typing keeps focus, Enter adds, filters", async () => {
        await pageHelper.typeInto("#todo-draft", "Run the e2e tier");
        assert.equal(
            await pageHelper.run("return document.activeElement.id;"),
            "todo-draft",
        );
        await pageHelper.typeInto("#todo-draft", ""); // Enter
        await pageHelper.waitForText("#todos .todos", "Run the e2e tier");
        await pageHelper.waitForText("#todos .footer", "3 items left");
        const done = await pageHelper.elementIs("#todos li.done");
        assert.equal(done.allStyles["text-decoration-line"], "line-through");
        await pageHelper.clickButton("Done", "#todos .footer");
        assert.deepEqual(await pageHelper.getTexts("#todos li"), [
            "Read prompt.md",
        ]);
        const selected = await pageHelper.elementIs("#todos .selected");
        assert.equal(selected.fontWeight, "700");
    });

    test("chart: SVG bars scaled and colored, +5 moves the target", async () => {
        await pageHelper.waitForText("#chart p", "(4 of 6 months on target)");
        const bars = await pageHelper.run(
            "return Array.prototype.map.call(document.querySelectorAll('#chart rect'), function (r) {" +
                " return { ns: r.namespaceURI, height: r.getAttribute('height'), fill: r.getAttribute('fill')," +
                " drawn: r.getBoundingClientRect().height }; });",
        );
        assert.ok(bars.every((bar) => bar.ns === "http://www.w3.org/2000/svg"));
        assert.deepEqual(
            bars.map((bar) => bar.height),
            ["69", "109", "40", "131", "86", "160"],
        );
        assert.deepEqual(
            bars.map((bar) => bar.fill),
            ["#dc2626", "#16a34a", "#dc2626", "#16a34a", "#16a34a", "#16a34a"],
        );
        // 28 is 4 x 7: the tallest bar is drawn 4 x the shortest.
        assert.ok(Math.abs(bars[5].drawn / bars[2].drawn - 4) < 0.05);
        await pageHelper.clickButton("+ 5", "#chart");
        await pageHelper.waitForText("#chart p", "(2 of 6 months on target)");
    });

    test("inline: the script tag's own content", async () => {
        await pageHelper.waitForText("#inline", "clicked 0 times");
        await pageHelper.clickButton("Click me", "#inline");
        await pageHelper.waitForText("#inline", "clicked 1 time");
    });
});

// The page opened straight from disk. Whether it may read its JSON files is
// the browser's decision: a desktop Firefox refuses by default
// (security.fileuri.strict_origin_policy), geckodriver's profile allows it.
// Needs the grid's browser on this machine, to see the file.
const FILE_URL = new URL("../../web/index.html", import.meta.url).href;

describe(
    `${pageName} page from file://`,
    { skip: !pageHelper.isLocalGrid() },
    () => {
        after(async () => {
            await pageHelper.pageClose();
        });

        test("where the browser allows reading files, every section renders", async () => {
            await pageHelper.pageIsRendered(FILE_URL, {
                preferences: { "security.fileuri.strict_origin_policy": false },
            });
            assert.equal(
                await pageHelper.run("return location.protocol;"),
                "file:",
            );
            await pageHelper.waitForText("#home h3", "Welcome back, Ann");
            await pageHelper.waitForText("#cart .summary", "Total 33.40 €");
            await pageHelper.waitForText(
                "#chart p",
                "(4 of 6 months on target)",
            );
            assert.equal(await pageHelper.countOf("#fizzbuzz .cell"), 30);
            await pageHelper.clickButton("+ 15", "#fizzbuzz");
            await pageHelper.waitForText("#fizzbuzz p strong", "45");
        });

        test("with a desktop Firefox's default, each target says why", async () => {
            await pageHelper.pageIsRendered(FILE_URL, {
                preferences: { "security.fileuri.strict_origin_policy": true },
            });
            for (const id of ["home", "fizzbuzz", "cart", "todos", "chart"]) {
                const text = await pageHelper.waitForText(
                    `#${id}`,
                    "serve it over HTTP",
                );
                assert.match(
                    text,
                    new RegExp(`^pages/${id}\\.json: NetworkError`),
                );
                assert.equal(
                    await pageHelper.getAttribute(
                        `#${id}`,
                        "data-cl-json-error",
                    ),
                    "",
                );
            }
            // The inline payload needs no file.
            await pageHelper.waitForText("#inline", "clicked 0 times");
        });
    },
);
