# Detailed performance tests

Run `pnpm test:performance` from the repository root. This runs the domain and
IndexedDB suite, builds the production application, checks the bundle budgets, and
runs the browser suite. Chromium must be installed (`pnpm exec playwright install chromium`).

For an existing production build:

```sh
pnpm test:performance:domain
pnpm test:performance:browser
```

If another local test server uses port 4173, set `FRITZ_TEST_PORT` to a free port.
`FRITZ_TEST_OUTPUT_DIR` isolates the regular end-to-end suite's artifacts and login
state; the performance suite keeps its own login state under its report directory.
For example: `FRITZ_TEST_PORT=4187 FRITZ_TEST_OUTPUT_DIR=artifacts/e2e-isolated pnpm test:e2e:run`.

For a short local check, use `pnpm test:performance:quick`. It runs the same domain
scenarios at the smallest scale; it does not replace the full suite. A custom report
path is supported, for example:

```sh
pnpm test:performance:domain --report artifacts/performance/comparison.json
```

The earlier `pnpm performance:check` remains available. It checks an additional
100,000-review fixture whose timestamps all fall on the same historical day.

## Data and isolation

The domain suite uses 100, 1,000 and 10,000 words, two card directions per word, and
1,000, 10,000 and 100,000 reviews respectively. Data includes:

- New cards, scheduled cards due for review and cards due in the future.
- Multiple word types and 20 tags, with Czech meanings and German forms.
- Correct, incorrect, disputed and cram reviews.
- Older history plus 100–1,000 recent evidence records. Dates are relative to the
  recorded run date, so the 31-day startup window continues to be exercised.
- One frequently reviewed word holding 10% of the entire review history.
- Materialized review statistics and skill states generated through the normal
  database import path.

Every scale uses a fresh in-memory `fake-indexeddb` database in Node. Fixtures and
correctness assertions are outside operation timings. Each operation warms up once,
then records seven samples by default. Database operations use three or five samples;
backup export and the stateful reward purchase use one sample without warmup.
Samples and scales run sequentially. Do not run another build, benchmark or browser
test concurrently when collecting comparison results.

The largest backup is exported before measured review writes: it already contains
the supported maximum of 100,000 reviews. Benchmark writes then exercise incremental
updates and replay without mistaking the backup's deliberate size limit for a
performance failure. All account, vocabulary and learning data is synthetic.

## Domain and database coverage

There are 25 measurements at each of the three scales (75 total):

| Operation                            |  p95 budget | Additional assertions                                                                                             |
| ------------------------------------ | ----------: | ----------------------------------------------------------------------------------------------------------------- |
| Startup snapshot                     |    4,000 ms | All notes/cards, at most 2,000 reviews, exact recent evidence and aggregate counts; no full review/evidence reads |
| Library index                        |      100 ms | Includes every word                                                                                               |
| Library search                       |       50 ms | Finds a word beyond the first page                                                                                |
| Library sorting, four modes          | 100 ms each | Full result set, no duplicate IDs                                                                                 |
| Due queue and filtered due queue     | 100 ms each | Due dates, daily new-card limit, uniqueness and tag/source filters                                                |
| Choice options                       |      100 ms | Four distinct options including the target                                                                        |
| Matching and adaptive exercise       | 150 ms each | Valid exercise and available modality                                                                             |
| Daily lesson, 5/10/20 minutes        | 200 ms each | Bounded lesson, distinct review words                                                                             |
| Course path                          |       50 ms | Every visible chapter                                                                                             |
| Progress summary                     |      150 ms | XP agrees with materialized statistics                                                                            |
| Complete backup export               |   10,000 ms | No truncated words, reviews or evidence                                                                           |
| Last five reviews of a frequent word |      100 ms | Exact newest records, at most five cursor advances                                                                |
| Review commit                        |      250 ms | Stored once, no full history/card/note reads                                                                      |
| Idempotent review replay             |      150 ms | Reuses the original operation and leaves statistics unchanged                                                     |
| Settings save                        |      100 ms | Updated setting returned                                                                                          |
| Vocabulary edit                      |      100 ms | Updated meaning; no full note/card reads                                                                          |
| Duplicate import of 100 words        |      500 ms | Every duplicate recognized, nothing inserted                                                                      |
| Reward purchase                      |      100 ms | No full review/card reads                                                                                         |

The limits allow headroom for shared CI machines. Structural assertions are also
enforced: faster hardware cannot hide a full-history scan or loss of records.
Failures set a nonzero exit code; timing and assertion failures are preserved in
the JSON report, and subsequent measurements still run when possible.

`tests/performance-regressions.test.ts` adds ordinary correctness tests for bounded
history (including `NaN` and infinite limits), migration from database v8 to v9,
concurrent duplicate renames, preserved card schedules, import reads, full-library
search, index immutability, language changes, edited words and due-date edge cases.
These tests are included in `pnpm test` and do not assert wall-clock times.

## Browser coverage

Six production Chromium tests cover 1,000 and 10,000 words with twice as many reviews:
three scenarios run on desktop and on a Pixel 7 viewport with 4× CPU slowdown.
The full cold-load and interaction scenario runs at both data sizes. The third
scenario checks pagination, editing, repeated client-side navigation and accessibility
at 10,000 words.

Each browser context has an isolated IndexedDB database and a temporary test server
account. Fixtures are installed through native browser IndexedDB after account
binding. Service workers are blocked and HTTP caching is disabled for cold-load
measurements. Offline installation and caching remain covered by the existing
resilience tests.

The overall test timeout is five minutes to allow large IndexedDB fixtures to be
seeded on slower machines. Setup time is excluded from the UI timings below.

The browser suite records:

- Navigation-to-visible-results time, including two animation frames after the
  expected UI appears; budget 5 seconds desktop / 15 seconds with slowed CPU.
- Search, clearing search, four sort modes and tag filtering; each interaction has
  a 500 ms desktop / 1,500 ms slowed-CPU budget.
- A maximum of 50 rendered word cards and fewer than 5,000 HTML elements.
- Largest Contentful Paint, cumulative layout shift using session windows, long
  tasks, and supported Event Timing interaction entries.
- Per-resource URL paths, initiator types, load durations and transferred/decoded
  bytes for inspection of the request waterfall.
- DOM counts across repeated client-side navigation and JavaScript heap samples
  after garbage collection. These samples help investigation; they do not prove
  the absence of memory leaks.
- Page changes, focus placement, filter reset, editing a word beyond the first
  page, persistence feedback, and an axe WCAG check with pagination present.

Browser interaction durations include Playwright actionability checks and the
rendered result. They are laboratory timings, not field INP. LCP can describe the
early application shell, so the separate results-ready measurement is essential.
The mobile profile simulates viewport and CPU; it does not reproduce a physical
phone or a slow mobile network. No live AI provider is used.

## Reports and comparison

- `artifacts/performance/domain.json`: runtime/CPU/timezone, fixture sizes and build
  times, every raw sample, nearest-rank p50/p95/max, limits, pass/fail, assertion
  errors, heap deltas and final RSS/heap usage.
- `artifacts/performance/browser/results.json`: Playwright report with attached
  JSON for cold loads, interactions, navigation and heap measurements.
- `artifacts/performance/browser/traces/`: failure traces and screenshots. Vocabulary
  screenshots from successful runs are embedded in the JSON report attachments.

Copy reports to another filename before rerunning a comparison: default reports
are overwritten, and Playwright clears its output directory. Use identical Node,
Chromium, fixture scale, hardware and CPU settings for before/after comparisons.
The small sample counts describe a local run; they are not a statistical guarantee.
`fake-indexeddb` timing and memory behavior differ from native browser IndexedDB,
especially for cursor-heavy workloads. Compare them within the same environment.

CI runs both detailed suites after the regular quality and legacy performance checks,
and uploads `artifacts/performance/` even when a performance assertion fails.
