// The Gherkin DTO layer and its .feature writer - pure data, no browser.
import test from "node:test";
import assert from "node:assert/strict";

import {
    SENTENCES,
    feature,
    given,
    scenario,
    step,
    then,
    when,
} from "../../gherkin/dto.js";
import { toGherkin } from "../../gherkin/writer.js";

test("a step is a DTO with its Gherkin sentence", () => {
    assert.deepEqual(when.pageButtonIsClicked("+", "#content"), {
        keyword: "When",
        action: "pageButtonIsClicked",
        args: ["+", "#content"],
        text: 'page button "+" in "#content" is clicked',
    });
    assert.equal(
        then.pageElementCountShouldBe(".cell", 30).text,
        'page should have 30 elements ".cell"',
    );
    assert.throws(() => step("When", "noSuchStep"), /Unknown Gherkin step/);
});

test("every sentence has a step and every step a sentence", () => {
    const actions = [given, when, then].flatMap((steps) => Object.keys(steps));
    assert.deepEqual(actions.sort(), Object.keys(SENTENCES).sort());
});

test("toGherkin writes .feature text with And continuations", () => {
    const dto = feature(
        "cart page",
        scenario(
            "free shipping",
            given.pageNameIs("cart"),
            when.pageIsRendered(),
            when.pageButtonIsClicked("+", "#content tr:nth-child(2)"),
            then.pageElementTextShouldContain("#content .summary", "free"),
            then.pageIsClosed(),
        ),
    );
    assert.equal(
        toGherkin(dto),
        [
            "Feature: cart page",
            "",
            "    Scenario: free shipping",
            '        Given page name is "cart"',
            "        When page is rendered",
            '        And page button "+" in "#content tr:nth-child(2)" is clicked',
            '        Then page element "#content .summary" text should contain "free"',
            "        And page is closed",
            "",
        ].join("\n"),
    );
});
