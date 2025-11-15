# Pull Request

## Description

<!-- Describe your changes in detail -->

## Type of Change

- [ ] Bugfix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Refactoring (code changes without functionality changes)
- [ ] Documentation update
- [ ] CI/CD changes
- [ ] Dependency update

## Related Issues

<!-- Link to related issues using #issue_number -->

Closes #
Relates to #

## Checklist - Code Changes

- [ ] My code follows the project's coding style
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] My changes generate no new warnings or errors
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published

## Checklist - Documentation (if applicable)

### Mise à jour obligatoire

- [ ] README.md updated if public API changed
- [ ] CHANGELOG.md updated with description of changes
- [ ] API docs updated (`docs/API.md`) if function signatures changed
- [ ] User guides updated (`docs/USER-GUIDE.md`) if UX/UI changed

### Qualité documentation

- [ ] All internal links work (tested locally)
- [ ] Version numbers consistent with package.json
- [ ] No TODO/FIXME in active docs (outside archive/)
- [ ] Front-matter `lastReviewed` updated if applicable
- [ ] Screenshots/images added if necessary and optimized (< 100KB)
- [ ] Code examples tested and functional

### Linting

- [ ] `npm run lint` passes without errors
- [ ] `npm run lint:docs` passes without errors (if doc changes)
- [ ] Markdownlint shows no critical errors

### Archive

- [ ] Obsolete files moved to `docs/_archive/YYYY-MM/`
- [ ] Archive README updated if new files archived

## Tests

- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Browser tests pass (if web UI changes)
- [ ] Tests pass locally (`npm test`)
- [ ] CI passes

## Screenshots/Videos

<!-- Add screenshots or screen recordings for UI changes -->

## Additional Notes

<!-- Any additional information, context, or concerns -->

## Deployment Notes

<!-- Special deployment instructions, database migrations, etc. -->

---

**By submitting this PR, I confirm that:**

- [ ] My contribution is made under the Apache 2.0 license
- [ ] I have read and followed the [CONTRIBUTING.md](../CONTRIBUTING.md) guidelines
