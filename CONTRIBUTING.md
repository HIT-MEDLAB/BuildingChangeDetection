# Contributing Guide

This document defines how we work together on this project. Following these conventions ensures that the codebase stays clean, reviewable, and maintainable — skills that transfer directly to any professional development team.

## Table of Contents

- [Branching Strategy](#branching-strategy)
- [Commit Message Conventions](#commit-message-conventions)
- [Pull Request Process](#pull-request-process)
- [Definition of Done](#definition-of-done)
- [Code Style](#code-style)
- [What NOT to Do](#what-not-to-do)

---

## Branching Strategy

We use a simplified **Git Flow** model. This is an industry standard used by teams at companies large and small, because it separates stable code from work-in-progress.

### Branch types

| Branch             | Purpose                                   | Who merges here       |
|--------------------|-------------------------------------------|-----------------------|
| `main`             | Production-ready releases only            | Supervisor            |
| `dev`              | Integration branch — latest working code  | Via approved PR       |
| `feature/<name>`   | Individual work branches                  | Developer (you)       |

### Rules

- **`main` is protected.** No one pushes directly to `main`. Code reaches `main` only through a reviewed merge from `dev`.
- **`dev` is the integration branch.** All feature branches are created from `dev` and merged back into `dev` via pull request.
- **Feature branches are yours.** Create them freely, push often, and open a PR when ready.

### Branch naming

Use descriptive, kebab-case names with a prefix:

```
feature/auth-jwt          ← New feature
feature/upload-component  ← New feature
fix/sidebar-active-state  ← Bug fix
refactor/db-pool-config   ← Code restructuring
docs/api-upload-spec      ← Documentation only
```

**Why?** Consistent naming makes it easy to scan the branch list and understand what everyone is working on. The prefix tells you the nature of the change before you even look at the code.

### Workflow example

```bash
# 1. Make sure you're on dev and up to date
git checkout dev
git pull origin dev

# 2. Create your feature branch
git checkout -b feature/auth-jwt

# 3. Work, commit often (see commit conventions below)
git add src/routes/auth.js
git commit -m "feat: add login endpoint with JWT generation"

# 4. Push your branch
git push -u origin feature/auth-jwt

# 5. Open a Pull Request on GitHub: feature/auth-jwt → dev
```

---

## Commit Message Conventions

We follow **Conventional Commits** — a widely adopted standard (used by Angular, Vue.js, and many open-source projects). This makes the git history readable and eventually enables automated changelogs.

### Format

```
<type>: <short description>
```

### Types

| Type       | When to use                                           | Example                                    |
|------------|-------------------------------------------------------|--------------------------------------------|
| `feat`     | Adding new functionality                              | `feat: add JWT login endpoint`             |
| `fix`      | Fixing a bug                                          | `fix: correct image preview aspect ratio`  |
| `docs`     | Documentation changes only                            | `docs: update API spec for upload`         |
| `refactor` | Code change that neither fixes a bug nor adds a feature | `refactor: extract DB pool into config`  |
| `chore`    | Maintenance (dependencies, configs, tooling)          | `chore: bump express to 4.19`             |
| `style`    | Formatting, whitespace (no logic change)              | `style: fix indentation in auth route`     |

### Rules

1. **Use the imperative mood** — "add", not "added" or "adds". Think of it as completing the sentence: "This commit will _add JWT login endpoint_."
2. **Keep the first line under 72 characters.** If you need more detail, add a blank line and then a longer description.
3. **One logical change per commit.** Don't mix a bug fix with a new feature in the same commit.

**Why?** When something breaks, `git log --oneline` becomes your detective tool. Clear commit messages let you pinpoint exactly when and why a change was introduced.

---

## Pull Request Process

Pull requests (PRs) are where code review happens. Code review is not about catching mistakes — it's about sharing knowledge, maintaining consistency, and learning from each other.

### Steps

1. **Open a PR** from your `feature/*` branch to `dev`.
2. **Fill out the PR template** (title, description, what to test).
3. **Request a review** from your teammate (the other student).
4. **Address review comments** — push new commits to the same branch.
5. **Once approved**, the PR is **squash-merged** into `dev`.

### Review responsibilities

| Reviewer          | Reviews what                                                    |
|-------------------|-----------------------------------------------------------------|
| Peer (teammate)   | All PRs — code quality, correctness, readability                |
| Supervisor        | Architectural PRs — anything touching multiple modules or core design decisions |

### What to look for in a review

- Does the code do what the PR description says?
- Are there any obvious bugs or edge cases?
- Is the code readable without excessive comments?
- Does it follow our conventions (naming, structure, commit messages)?
- Are there any security concerns (exposed secrets, SQL injection, etc.)?

**Why squash merge?** Squash merging combines all your branch commits into a single commit on `dev`. This keeps the `dev` history clean — each commit represents one complete feature or fix, not 15 "WIP" commits.

---

## Definition of Done

A task is **done** when ALL of the following are true:

- [ ] Code works locally on the developer's machine
- [ ] No console errors or warnings in the browser / server terminal
- [ ] README updated if any user-facing behavior changed
- [ ] API spec (`docs/api-spec.md`) updated if a new endpoint was added or changed
- [ ] Pull request opened, reviewed by peer, and approved
- [ ] Branch squash-merged into `dev`

**Why?** A shared "Definition of Done" prevents the "it works on my machine" problem and ensures that documentation stays in sync with code. In professional teams, this is often part of the team's working agreement.

---

## Code Style

Consistent style makes code easier to read and reduces noise in diffs (no one wants to review a PR that's 90% whitespace changes).

### Frontend & Backend (JavaScript)

- Use **Prettier** with default settings for automatic formatting.
- A `.prettierrc` configuration file will be added later — for now, use the defaults.
- Run Prettier before committing: `npx prettier --write .`

### ML Service (Python)

- Follow **PEP 8** — the standard Python style guide.
- Use meaningful variable names (not `x`, `df2`, `tmp`).
- Use a linter like `flake8` or your IDE's built-in Python linter.

### General

- Use descriptive names: `inspectionResults` not `res`, `uploadImage` not `doIt`.
- Keep functions short — if a function is over 40 lines, consider splitting it.
- Use `const` by default in JavaScript; use `let` only when reassignment is needed. Never use `var`.

---

## What NOT to Do

These are common mistakes that cause real problems in team projects. Each rule exists because someone, somewhere, learned it the hard way.

| Rule                                      | Why                                                                 |
|-------------------------------------------|---------------------------------------------------------------------|
| No direct commits to `main` or `dev`      | Bypasses code review; can introduce bugs that affect everyone       |
| No force-pushing to shared branches       | Rewrites history that others have already pulled; causes conflicts  |
| No committing `.env` files                | Contains secrets (passwords, API keys) that must never be in git    |
| No committing `node_modules/`             | Thousands of files that can be regenerated with `npm install`       |
| No committing model weights (`.pth`, etc.)| Binary files that bloat the repo and can be hundreds of MB          |
| No `console.log` in production code       | Clutters the browser console; may leak sensitive data               |
| No commented-out code in PRs              | If code isn't needed, delete it — git remembers everything          |

---

> **Remember:** The PRD and Initiation Document are your source of truth for *what* to build. This guide tells you *how* to build it. When in doubt, ask your teammate first, then the supervisor.
