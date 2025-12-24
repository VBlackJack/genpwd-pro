# Development Backlog

## Quality Improvements (Non-Critical)

### [R-003] JSDoc Type Annotations - MEDIUM PRIORITY

**Status**: Deferred to future sprint
**Effort**: Medium (2-3 hours)
**Risk**: None
**Impact**: Developer Experience

**Description**:
Add comprehensive JSDoc type annotations to modules currently missing them:
- `ui/events.js` - Internal functions undocumented
- `ui/placement.js` - Complex API without types
- `utils/toast.js` - Missing JSDoc
- `utils/clipboard.js` - Missing JSDoc
- `utils/theme.js` - Missing JSDoc

**Current Status**:
- ✅ Core modules (`generators.js`, `helpers.js`) already have comprehensive JSDoc
- ⚠️ UI modules partially documented
- ❌ Utility modules mostly undocumented

**Benefits**:
- Better IDE autocompletion
- Reduced type errors
- Improved onboarding for new developers
- Self-documenting code

**Example** (from `ui/placement.js`):
```javascript
/**
 * @typedef {Object} PlacementState
 * @property {Array<{percent: number, index: number}>} digits - Digit positions
 * @property {Array<{percent: number, index: number}>} specials - Special char positions
 * @property {'visual'|'positions'|'random'} mode - Placement mode
 */

/**
 * Initialize visual placement system
 * @returns {PlacementAPI} API object with onUpdate method
 */
export function initVisualPlacement() {
  // ...
}
```

**Next Steps**:
1. Prioritize high-traffic modules (placement, events, dom)
2. Add `@typedef` for complex objects
3. Document all exported functions
4. Add `@param` and `@returns` tags

---

### [R-004] Edge Case Regression Tests - MEDIUM PRIORITY

**Status**: Deferred to future sprint
**Effort**: High (1 day)
**Risk**: None
**Impact**: Quality Assurance

**Description**:
Expand test suite with edge case scenarios not currently covered.

**Missing Test Scenarios**:

1. **Placement Edge Cases**:
   - Duplicate positions: `[50, 50, 50]`
   - Positions out of range: `[-10, 150]`
   - Empty positions array: `[]`
   - Single position: `[50]`

2. **Dictionary Edge Cases**:
   - Unicode characters (emoji, accents)
   - Very long words (>12 chars)
   - Empty dictionary
   - Corrupted JSON

3. **Entropy Edge Cases**:
   - Zero length password
   - Maximum length (>64 chars)
   - Multilingual passphrases
   - Special-only passwords

4. **Generator Edge Cases**:
   - Empty customSpecials string
   - All blocks same case
   - Negative digit/special counts
   - Extreme quantity (>100)

**Current Test Coverage**:
- ✅ 17/17 core functionality tests passing
- ✅ Happy path scenarios covered
- ⚠️ Edge cases not systematically tested
- ❌ Error handling not comprehensively tested

**Proposed Test Structure**:
```javascript
// tools/test-suite-edge-cases.js
export const edgeCaseTests = [
  {
    name: 'Placement - Duplicate positions',
    run: async () => {
      setDigitPositions([25, 25, 25]);
      const result = generateSyllables({ digits: 3, length: 20 });
      // Verify all 3 digits inserted correctly
      const digitPositions = extractDigitPositions(result.value);
      assert(digitPositions.length === 3);
      assert(digitPositions.every(p => p >= 4 && p <= 6)); // ~25%
    }
  },
  {
    name: 'Dictionary - Unicode handling',
    run: async () => {
      const dict = ['café', 'naïve', '日本語', '🔐'];
      const result = await generatePassphrase({ wordList: dict });
      // Verify unicode preserved correctly
      assert(result.value.match(/café|naïve|日本語|🔐/));
    }
  },
  // ... more tests
];
```

**Next Steps**:
1. Create `tools/test-suite-edge-cases.js`
2. Implement top 20 critical edge cases
3. Integrate into `npm test` workflow
4. Add to CI/CD pipeline

---

## Implementation Timeline

| Item | Priority | Effort | Earliest Start | Dependencies |
|------|----------|--------|----------------|--------------|
| R-003 JSDoc | Medium | 2-3h | Sprint N+1 | None |
| R-004 Tests | Medium | 1 day | Sprint N+1 | None |

## Notes

- Both items are **non-blocking** for production deployment
- Current code quality is excellent (9.5/10 score)
- These improvements target **developer experience** and **long-term maintainability**
- Can be implemented incrementally over multiple sprints

---

**Last Updated**: 2025-12-24
**Next Review**: Sprint Planning N+1
