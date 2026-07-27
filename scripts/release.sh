#!/bin/sh
# Tag and push in one step. A tag that sits around unpushed is one `git fetch --tags`
# from being deleted, because this repo sets fetch.pruneTags.
set -e

VERSION=$(npm pkg get version | tr -d '"')
TAG="v$VERSION"

if [ -n "$(git status --porcelain)" ]; then
  echo "release: working tree is dirty, commit or stash first" >&2
  exit 1
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  echo "release: on '$BRANCH', not main" >&2
  exit 1
fi

git fetch --no-tags --quiet origin main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "release: HEAD is not origin/main, pull or push first" >&2
  exit 1
fi

if git rev-parse -q --verify "refs/tags/$TAG" > /dev/null; then
  echo "release: $TAG already exists locally" >&2
  exit 1
fi

echo "release: tagging $TAG at $(git rev-parse --short HEAD) and pushing"
git tag -a "$TAG" -m "$TAG"
git push origin "$TAG"
