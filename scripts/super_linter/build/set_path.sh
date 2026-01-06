#!/usr/bin/env bash
set -euo pipefail

curl -fsSL "https://github.com/AikidoSec/safe-chain/releases/download/$(cat .safe-chain-version)/install-safe-chain.sh" | sh -s -- --ci
bun install
tag_name="$(yq '.jobs.build.steps[-1].uses' .github/workflows/super-linter.yml | sed -e 's;/slim@.*;:slim;g')"
tag_version="$(yq '.jobs.build.steps[-1].uses | line_comment' .github/workflows/super-linter.yml)"
PATH="$(docker run --rm --entrypoint '' "ghcr.io/${tag_name}-${tag_version}" /bin/sh -c 'echo $PATH')"
echo "PATH=/github/workspace/node_modules/.bin:${PATH}" >>"$GITHUB_ENV"
