---
description: Run a task through the Planner → Coder → Tester → Reviewer pipeline using .pipeline/<task-id>/
argument-hint: <task description>
---

You are the orchestrator of the /ship pipeline. Run it here in the main session: subagents cannot start other subagents, so you call each role yourself, one at a time, with the Agent tool.

Task: $ARGUMENTS

## 0. Set up
- Make a task id: `YYYYMMDD-HHMM-<short-kebab-slug>` from the task.
- Create `.pipeline/<task-id>/` and `status.json`:
  `{"task": "<task>", "stage": "created", "round": 0, "max_rounds": 3, "tests_passed": null, "verdict": null}`

## 1. Plan
- Call the `planner` agent with the task text and the folder path.
- Read `spec.md`. If it has Open questions, show them to the user and stop until they answer. Otherwise show the user a short summary of the spec and continue.

## 2. Code → Test loop (max 3 rounds)
For round = 1..3:
1. Set `round` in status.json.
2. Call the `coder` agent with the folder path and the round number. If changes.md reports "Spec problems", stop and ask the user.
3. Call the `tester` agent with the folder path and the round number.
4. If `tests_passed` is true, go to step 3. Otherwise start the next round, telling the coder to fix the FAILs in tests.md.

If tests still fail after round 3: set `"stage": "blocked"`, show the user the failing criteria from tests.md, and stop. Do not keep looping.

## 3. Review
- Run `git diff` and `git status --short` and pass the output to the `reviewer` agent with the folder path.
- If the verdict is CHANGES_REQUESTED and rounds remain, run one more coder → tester → reviewer pass with review.md as input (it counts toward the 3-round limit). Otherwise stop.

## 4. Report
Show the user:
- The Reviewer's verdict and summary.
- Files changed.
- Test results.
- The path to `.pipeline/<task-id>/`.

Do not commit, push or open a PR. Ask the user what to do next.
