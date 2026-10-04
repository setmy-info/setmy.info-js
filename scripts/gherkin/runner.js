/*
Executes Gherkin feature DTOs (see dto.js) as node:test e2e tests against
scripts/pageHelper.js - setmy-info-less's runner.cjs on this repo's runner.
One Scenario = one test; steps run sequentially in DTO order.
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import * as pageHelper from "../pageHelper.js";

const styles = () => pageHelper.data.computedStyles;

export const ACTIONS = {
    pageNameIs: (name) => pageHelper.pageName(name),
    pageIsRendered: () => pageHelper.pageIsRendered(),
    pageElementIdIs: (elementId) => pageHelper.elementIdIs(elementId),
    pageElementIs: (selector) => pageHelper.elementIs(selector),
    pageElementIdIsClicked: (elementId) => pageHelper.clickElementId(elementId),
    pageElementIsClicked: (selector) => pageHelper.clickElement(selector),
    pageButtonIsClicked: (label, scope) => pageHelper.clickButton(label, scope),
    pageTextIsTypedInto: (text, selector) =>
        pageHelper.typeInto(selector, text),
    pageEnterIsPressedIn: (selector) => pageHelper.typeInto(selector, ""),
    pageShouldHaveTitle: async (title) =>
        assert.equal(await pageHelper.getTitle(), title),
    // Content renders asynchronously: text steps wait, then compare exactly.
    pageElementTextShouldBe: async (selector, text) => {
        await pageHelper.waitForText(selector, text);
        assert.equal((await pageHelper.getText(selector)).trim(), text);
    },
    pageElementTextShouldContain: (selector, text) =>
        pageHelper.waitForText(selector, text),
    pageElementCountShouldBe: async (selector, count) =>
        assert.equal(await pageHelper.countOf(selector), count),
    pageElementAttributeShouldBe: async (selector, name, value) =>
        assert.equal(await pageHelper.getAttribute(selector, name), value),
    pageElementMarginShouldBe: (margin) =>
        assert.equal(styles().margin, margin),
    pageElementPaddingShouldBe: (padding) =>
        assert.equal(styles().padding, padding),
    pageElementFontFamilyShouldBe: (fontFamily) =>
        assert.equal(styles().fontFamily, fontFamily),
    pageElementFontSizeShouldBe: (fontSize) =>
        assert.equal(styles().fontSize, fontSize),
    pageElementFontWeightShouldBe: (fontWeight) =>
        assert.equal(styles().fontWeight, fontWeight),
    pageElementXShouldBe: (x) => assert.equal(styles().x, x),
    pageElementYShouldBe: (y) => assert.equal(styles().y, y),
    pageElementWidthShouldBe: (width) => assert.equal(styles().width, width),
    pageElementHeightShouldBe: (height) =>
        assert.equal(styles().height, height),
    pageElementTopShouldBe: (top) => assert.equal(styles().top, top),
    pageElementLeftShouldBe: (left) => assert.equal(styles().left, left),
    pageElementBackgroundColorShouldBe: (color) =>
        assert.equal(styles().backgroundColor, color),
    pageElementColorShouldBe: (color) => assert.equal(styles().color, color),
    pageElementStyleShouldBe: (propertyName, value) =>
        assert.equal(styles().allStyles[propertyName], value),
    pageIsClosed: () => pageHelper.pageClose(),
};

export function runFeature(featureDto) {
    describe(`Feature: ${featureDto.feature}`, () => {
        for (const scenarioDto of featureDto.scenarios) {
            test(`Scenario: ${scenarioDto.scenario}`, async () => {
                // Always release the Selenium session, even when a step failed -
                // a leaked grid session counts against the hub's max-session cap.
                // pageClose() is idempotent.
                try {
                    for (const step of scenarioDto.steps) {
                        try {
                            await ACTIONS[step.action](...step.args);
                        } catch (error) {
                            error.message = `${step.keyword} ${step.text}\n${error.message}`;
                            throw error;
                        }
                    }
                } finally {
                    await pageHelper.pageClose();
                }
            });
        }
    });
}
