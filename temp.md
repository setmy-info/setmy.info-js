# SUPERSEDED — kept for history only

This was the pre-planning scratch table this repo was built from. The
maintained, corrected version of this table now lives in **ADR-0045**
(`setmy-info.github.io`,
`src/site/markdown/it/architecture/decisions/adr-0045-software-build-lifecycles.md`),
whose npm column was updated to reflect what is actually implemented here.
This file is NOT updated anymore — read ADR-0045 and
`requirements-rules.md` instead. Differences you may notice (e.g. the npm
column showing scripts that were later renamed or added) are exactly why
this copy should not be trusted.

https://setmy-info.github.io/src/site/markdown/it/architecture/decisions/adr-0045-software-build-lifecycles.html

| Group      | Phase / Lifecycle     | Maven                                  | Node.js (npm)                      | Python (venv + pip)                                                 | Elixir (mix)                           | CMake / Make                 |
| ---------- | --------------------- | -------------------------------------- | ---------------------------------- | ------------------------------------------------------------------- | -------------------------------------- | ---------------------------- |
| Workspace  | Bootstrap             | `mvn dependency:go-offline`            | `npm ci`                           | `python -m venv .venv && python -m pip install -r requirements.txt` | `mix deps.get`                         | `make bootstrap`             |
| Workspace  | Clean                 | `mvn clean`                            | `npm run clean`                    | `python scripts/clean.py`                                           | `mix clean`                            | `make clean`                 |
| Validation | Validate              | `mvn validate`                         | `npm run validate`                 | `python scripts/validate.py`                                        | `mix validate` _(custom)_              | `make validate`              |
| Validation | Format                | `mvn spotless:apply`                   | `npm run format`                   | `python -m black .`                                                 | `mix format`                           | `make format`                |
| Validation | Lint                  | `mvn checkstyle:check`                 | `npm run lint`                     | `python -m ruff check .`                                            | `mix credo`                            | `make lint`                  |
| Build      | Compile               | `mvn compile`                          | `npm run build`                    | `python -m compileall src` _(optional)_                             | `mix compile`                          | `cmake --build build`        |
| Test       | Unit Test             | `mvn test`                             | `npm test`                         | `python -m pytest`                                                  | `mix test`                             | `ctest`                      |
| Test       | Pre Integration Test  | `mvn pre-integration-test`             | `npm run pre-integration-test`     | `python scripts/pre_integration_test.py`                            | `mix pre-integration-test` _(custom)_  | `make pre-integration-test`  |
| Test       | Integration Test      | `mvn integration-test`                 | `npm run integration-test`         | `python -m pytest -m integration`                                   | `mix integration-test` _(custom)_      | `make integration-test`      |
| Test       | Post Integration Test | `mvn post-integration-test`            | `npm run post-integration-test`    | `python scripts/post_integration_test.py`                           | `mix post-integration-test` _(custom)_ | `make post-integration-test` |
| Test       | Pre E2E Test          | `mvn -Pe2e pre-integration-test`       | `npm run pre-e2e-test`             | `python scripts/pre_e2e_test.py`                                    | `mix pre-e2e-test` _(custom)_          | `make pre-e2e-test`          |
| Test       | E2E Test              | `mvn -Pe2e integration-test`           | `npm run e2e-test`                 | `python -m pytest -m e2e`                                           | `mix e2e-test` _(custom)_              | `make e2e-test`              |
| Test       | Post E2E Test         | `mvn -Pe2e post-integration-test`      | `npm run post-e2e-test`            | `python scripts/post_e2e_test.py`                                   | `mix post-e2e-test` _(custom)_         | `make post-e2e-test`         |
| Quality    | Coverage              | `mvn jacoco:report`                    | `npm run coverage`                 | `python -m coverage run -m pytest`                                  | `mix coveralls`                        | `make coverage`              |
| Quality    | Security              | `mvn org.owasp:dependency-check:check` | `npm audit`                        | `python -m pip_audit`                                               | `mix deps.audit` _(custom)_            | `make security`              |
| Quality    | Verify                | `mvn verify`                           | `npm run verify`                   | `python scripts/verify.py`                                          | `mix verify` _(custom)_                | `make verify`                |
| Package    | Package               | `mvn package`                          | `npm pack`                         | `python -m build`                                                   | `mix archive.build`                    | `cpack`                      |
| Package    | SBOM                  | `mvn cyclonedx:makeAggregateBom`       | `npm run sbom`                     | `cyclonedx-py`                                                      | `mix sbom` _(custom)_                  | `make sbom`                  |
| Package    | Sign                  | `mvn gpg:sign`                         | `npm run sign`                     | `gpg --detach-sign dist/*`                                          | `mix sign` _(custom)_                  | `make sign`                  |
| Publish    | Install               | `mvn install`                          | `npm run install-local` _(custom)_ | `python -m pip install dist/*.whl`                                  | `mix archive.install`                  | `make install`               |
| Publish    | Publish               | `mvn deploy`                           | `npm publish`                      | `python -m twine upload dist/*`                                     | `mix hex.publish`                      | `make publish`               |
| Deploy     | Deploy                | `mvn cargo:deploy` _(example)_         | `npm run deploy`                   | `python scripts/deploy.py`                                          | `mix deploy` _(custom)_                | `make deploy`                |
