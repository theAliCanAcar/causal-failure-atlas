# Causal Failure Atlas

Rank likely upstream causes from recorded events and dependencies.

Standalone ES module. No npm install required. Works in **Node.js 20+** and modern browsers (serve over HTTP for browser demos).

## Included files

This repository vendors local dependencies needed by the module:

- `causal-failure-atlas.js` (main)
- `change-impact-mapper.js`

## Install / import

Copy the files into your project, or clone this repository:

```js
import { createFailureAtlas } from './causal-failure-atlas.js';
// Use case: identify the configuration edit behind a downstream checkout failure.
const config = { currency: 'USD' };
const atlas = createFailureAtlas({ runId: 'checkout', dependencies: { 'checkout-test': ['config.json'] } });
delete config.currency;
atlas.record({ id: 'edit', type: 'edit', time: 1, outcome: 'changed', artifacts: ['config.json'] });
const passed = typeof config.currency === 'string';
atlas.record({ id: 'check', type: 'check', time: 2, outcome: passed ? 'pass' : 'fail', artifacts: ['checkout-test'], errorType: 'missing-currency' });
console.log(atlas.diagnose('check'));
console.log(atlas.toJSONL());
```

## Use cases

### 1. Trace a broken check to an earlier edit

- **Scenario:** A report fails after an earlier configuration artifact changed.
- **Outcome:** Rank recorded upstream events and expose evidence links for targeted investigation.

### 2. Distinguish symptoms from likely causes

- **Scenario:** The last error occurs several steps after the initial fault.
- **Outcome:** Inspect parent relationships and artifact dependencies; report candidates rather than claiming proven causality.

## Exports

- `createFailureAtlas`
- `parseTrace`

## Notes

- Keep API keys and secrets out of this module and out of browser storage.
- Treat verification callbacks, ledger writers, and permission checks as trusted application code.
- This library is intentional local reliability plumbing, not a claim of cryptographic attestation unless stated in the source comments.

## License

MIT
