# Content staging

`pnpm content:generate --chapter <id>` creates a structured, non-publishing candidate envelope here.
`pnpm content:diff --chapter <id>` compares candidate counts with the validated production chapter.

Runtime code never reads this directory. A candidate stays `human-review-required`; moving content into
the production catalog requires the same schema, referential-integrity, CEFR, lexical morphology,
duplicate and content tests as hand-authored content.
