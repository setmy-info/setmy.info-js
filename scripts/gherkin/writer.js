/*
Serializes Gherkin feature DTOs (see dto.js) back into .feature text, so the
DTOs held in the e2e tests can be used as Gherkin test cases later.
*/

const PHASE = { Given: 0, When: 1, Then: 2 };

export function toGherkin(featureDto) {
    const lines = [`Feature: ${featureDto.feature}`];
    for (const scenarioDto of featureDto.scenarios) {
        lines.push("", `    Scenario: ${scenarioDto.scenario}`);
        // A step keyword is emitted only when it advances the Given -> When ->
        // Then phase; every other step continues the current phase as "And".
        let phase = -1;
        for (const step of scenarioDto.steps) {
            const stepPhase = PHASE[step.keyword];
            const keyword = stepPhase > phase ? step.keyword : "And";
            phase = Math.max(phase, stepPhase);
            lines.push(`        ${keyword} ${step.text}`);
        }
    }
    return lines.join("\n") + "\n";
}
