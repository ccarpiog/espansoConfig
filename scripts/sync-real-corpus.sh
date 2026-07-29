#!/usr/bin/env bash
#
# Copy the local espanso configuration into the gitignored real corpus.
#
#     ./scripts/sync-real-corpus.sh [source-espanso-dir]
#
# ---------------------------------------------------------------------------
# PRIVACY — read this before changing anything below
# ---------------------------------------------------------------------------
# This repository is PUBLIC and the live config contains personal templates.
# The destination directory is gitignored via an explicit rule in .gitignore.
# This script re-verifies that rule with `git check-ignore` on every run and
# REFUSES to copy anything if the check fails. That refusal is the whole point:
# a broken ignore rule must stop the copy, not merely warn about it.
#
# The committed corpus is tests/corpus/synthetic/. Nothing copied here is ever
# committed, quoted in a document, or pasted into a report.

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dest="${repo_root}/crates/espansoconfig-core/tests/corpus/real"

# Probe order mirrors `espansoconfig_core::discovery::resolve_config_dir`.
if [[ $# -ge 1 ]]; then
  source_dir="$1"
elif [[ -n "${XDG_CONFIG_HOME:-}" && -d "${XDG_CONFIG_HOME}/espanso" ]]; then
  source_dir="${XDG_CONFIG_HOME}/espanso"
else
  source_dir="${HOME}/Library/Application Support/espanso"
fi

if [[ ! -d "${source_dir}" ]]; then
  printf 'No espanso configuration found at: %s\n' "${source_dir}" >&2
  printf 'Pass an explicit path if yours lives elsewhere.\n' >&2
  printf 'This is not fatal: real-corpus tests skip when the corpus is absent.\n' >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Gate 1: the destination must be ignored BEFORE anything is copied.
# `git check-ignore` needs a path, not necessarily an existing file, so this
# runs safely even on a clean tree.
# ---------------------------------------------------------------------------
probe="${dest}/match/__ignore-probe.yml"
if ! ignore_rule="$(git -C "${repo_root}" check-ignore -v "${probe}" 2>/dev/null)"; then
  cat >&2 <<'EOF'
REFUSING TO COPY.

The real-corpus directory is not gitignored, so copying the live espanso
configuration into it would stage personal data for a PUBLIC repository.

Restore this line in .gitignore and re-run:

    crates/espansoconfig-core/tests/corpus/real/
EOF
  exit 2
fi
printf 'Ignore rule verified: %s\n' "${ignore_rule}"

# ---------------------------------------------------------------------------
# Copy. Only config/ and match/ — never runtime state, never the app's backups.
# ---------------------------------------------------------------------------
rm -rf "${dest}/config" "${dest}/match"
mkdir -p "${dest}"

copied_any=0
for sub in config match; do
  if [[ -d "${source_dir}/${sub}" ]]; then
    cp -R "${source_dir}/${sub}" "${dest}/${sub}"
    copied_any=1
  fi
done

if [[ "${copied_any}" -eq 0 ]]; then
  printf 'Found %s but it contains neither config/ nor match/.\n' "${source_dir}" >&2
  exit 1
fi

file_count=$(find "${dest}" -type f \( -name '*.yml' -o -name '*.yaml' \) | wc -l | tr -d ' ')

# ---------------------------------------------------------------------------
# Gate 2: prove after the fact that git cannot see any of it. File COUNTS and
# PATHS are safe to print; file contents are not, and are never printed.
# ---------------------------------------------------------------------------
if leaked="$(git -C "${repo_root}" status --porcelain -- "${dest}")" && [[ -n "${leaked}" ]]; then
  printf 'PRIVACY FAILURE: git can see files under %s\n' "${dest}" >&2
  printf '%s\n' "${leaked}" >&2
  printf 'Remove them and fix .gitignore before committing anything.\n' >&2
  exit 3
fi

printf 'Copied %s YAML files into %s\n' "${file_count}" "${dest}"
printf 'Verified: git status reports nothing under the real corpus.\n'
