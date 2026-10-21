---
name: review-next
description: One round of the sequential commit-review pass. Reviews the next commit in .plan with /review-commit, fixes clear-cut findings in the review/fixes worktree, has a fresh subagent validate the fixes, commits them there and updates .plan. Built to run unattended under /loop.
---

# Review next

One round per invocation: exactly one commit from `.plan`, then stop. "Stop the loop" or "end the loop" below means: under `/loop`, call `ScheduleWakeup` with `stop: true`; otherwise just stop.

## Paths

- Plan: `.plan` in the main checkout (gitignored, never committed)
- Worktree: `C:/Users/kyled/dev/web-dev/crosswoven-fixes` on branch `review/fixes`. All edits, checks and commits happen here, never in the main checkout; other sessions work there

## Rules

- Commit only on `review/fixes`, one commit per reviewed commit. Never commit to main, merge, rebase main, or push
- Commits are authored by the user alone: no `Co-Authored-By` or other Claude attribution
- Fix only clear-cut findings: bugs, type weaknesses, stale or narrating comments, config that does not do what it claims, standards violations with one obvious fix. Anything needing a design or product call goes in `.plan` as an open question. When in doubt, park it
- Fix in the style of the surrounding code and `docs/CODING_STANDARDS.md`. No changes beyond the findings

## Round

### 1. Pick the commit

Read `.plan`. The commit under `## Next` is this round's. If `## Next` and `## To review` are both empty, report that the pass is done and end the loop.

### 2. Sync the worktree

In the worktree: `git status --porcelain` must be empty. If not, stop the loop and report what is there; a previous round failed mid-way.

If main has moved, `git rebase main`. On conflict, `git rebase --abort`, stop the loop and report. Run `npm run check` (run `npm ci` first if `package.json` changed). If it fails before any fix, stop the loop and report; fixes must not be judged against a red baseline.

### 3. Review

Run `/review-commit <sha>`. Its `At HEAD` lines check the main checkout, not the worktree, so re-check each finding against the worktree before acting. Also fold in any notes on that commit's `.plan` entry.

Sort each finding into:

- **gone**: fixed or code removed at worktree HEAD
- **fix**: still present and clear-cut
- **park**: still present but needs the user's call

### 4. Fix

Make the **fix** findings in the worktree, then run `npm run check` there until it passes. If a fix cannot pass check without a design call, revert it and park it.

### 5. Validate

Spawn a fresh `general-purpose` agent. Do not pass your reasoning; give it only:

- The worktree path and the reviewed commit's sha
- The **fix** findings verbatim from the review
- The instruction: "Read `AGENTS.md` and `docs/CODING_STANDARDS.md`. Run `git diff` in the worktree. For each finding, say whether the change resolves it fully, partly or not at all. Then hunt for anything the change breaks or makes worse, with file and line. Run `npm run check`. Do not edit anything. Be adversarial; no praise."

For each finding it says is not fully resolved, or each regression it reports with evidence, fix once more and re-validate with a new agent. Anything still failing after that: revert it and park it with the validator's objection.

### 6. Commit

If anything changed, commit in the worktree in the repo's style: imperative subject ending `from the <short-sha> review`, body of a few plain lines on what changed and why. Example: `Harden the validator and shipped-levels check from the c589d43 review`.

### 7. Update the plan

Move the commit to `## Reviewed` as `- [x] N. <sha> <subject> - <verdict>`, with indented notes:

- `Fixed in <fix-sha>: <one line per fix>`, or `Nothing to fix`
- `Open for the user:` one line per parked finding: the problem, the options, and your recommendation
- Leave out findings that were gone

Then move the first `## To review` entry, with its notes, under `## Next`.

### 8. Report

Two or three lines: the commit, what was fixed, what was parked. Write no em dashes.
