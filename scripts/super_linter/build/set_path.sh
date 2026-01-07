#!/usr/bin/env bash
set -euo pipefail

bun safe-chain-verify
bun install
tag_name="$(yq '.jobs.build.steps[-1].uses' .github/workflows/super-linter.yml | sed -e 's;/slim@.*;:slim;g')"
tag_version="$(yq '.jobs.build.steps[-1].uses | line_comment' .github/workflows/super-linter.yml)"
docker_path="$(docker run --rm --entrypoint '' "ghcr.io/${tag_name}-${tag_version}" /bin/sh -c 'echo $PATH')"
docker_path_sanitized="$(printf '%s' "$docker_path" | tr -d '\r\n' | tr -c 'A-Za-z0-9_:/.-' ':')"
PATH="$docker_path_sanitized"
printf 'PATH=/github/workspace/node_modules/.bin:%s\n' "$PATH" >>"$GITHUB_ENV"
