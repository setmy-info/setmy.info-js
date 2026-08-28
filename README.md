# setmy.info-js

npm workspaces monorepo: `packages/a`, `packages/b` (TypeScript), `packages/c`, `packages/d`.

## Scripts

    ./build.sh                  # every step below, in order
    ./clean.sh                  # npm run clean + remove node_modules
    ./release.sh                # ./build.sh + npm publish --dry-run

## Root commands

    npm ci
    npm run clean
    npm run format
    npm run format:check
    npm run lint
    npm run typecheck
    npm run validate            # format:check + lint + typecheck
    npm run build
    npm test
    npm run integration-test
    npm run e2e-test
    npm run coverage
    npm run audit
    npm run docs
    npm run release             # npm publish --workspaces

## Single module

    npm run build -w @demo/module-a
    npm test -w @demo/module-a
    npm run integration-test -w @demo/module-a
    npm run e2e-test -w @demo/module-a
    npm run coverage -w @demo/module-a
    npm run docs -w @demo/module-a
    npm run server -w @demo/module-a    # http://127.0.0.1:43131

## Module scripts

    clean build:node build:node:min build:web build server
    test integration-test e2e-test coverage
    format lint docs
    typecheck                   # @demo/module-b only

## Ports

    @demo/module-a    server 43131    e2e 43132
    @demo/module-b    server 43231    e2e 43232
    @demo/module-c    server 43331    e2e 43332
    @demo/module-d    server 43431    e2e 43432
