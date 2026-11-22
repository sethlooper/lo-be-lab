# Lo/Be Lab — Publications PDF Archive

This directory holds PDF copies of working papers, conference talks, and
other publications produced by Lo/Be Lab.

## Filename convention

```
YYYYMMDD_FirstAuthor[-etal]_TitleKeyword_Venue.pdf
```

Inspired by the MIT Senseable City Lab's archive naming. Optimized for:
- **Chronological sorting** — date-first means `ls` orders newest-or-oldest
  cleanly without metadata.
- **Quick author scan** — lead author surname is immediately readable.
- **Short keywords** — title is compressed to one or two memorable words,
  not a full sentence.
- **Venue identification** — short acronym tells you where the paper
  appeared (or "LoBeLab" for in-house working papers).

## Components

| Slot | Format | Example |
|------|--------|---------|
| Date | YYYYMMDD | 20260515 |
| Author | LastName *or* LastName-etal (3+ authors) | Looper, Looper-etal |
| Title keyword | One or two memorable words, no spaces | NarrativeByDesign, DartWorld, Synapse |
| Venue | Short acronym or institution shortname | LoBeLab, DartmouthCCD, JLearningSci, AERA |

Separator: single underscore. No spaces, no special characters except
the hyphen in `-etal`.

## Examples

```
20260515_Looper_ArchitectureOfBecoming_LoBeLab.pdf
20260901_Looper-etal_DartWorld_LoBeLab.pdf
20261101_Looper_Synapse_LoBeLab.pdf
20270215_Looper-etal_CareerDesignLab_LoBeLab.pdf
20270501_Looper-etal_NarrativeByDesign_LoBeLab.pdf
20270615_Looper_Threshold_LoBeLab.pdf
```

For papers submitted to external venues, replace `LoBeLab` with the
venue's short acronym. Examples (hypothetical):

```
20271001_Looper-etal_DartWorld_JLearningSci.pdf
20280215_Looper_Synapse_HCI-Edu.pdf
20280601_Looper-etal_NarrativeByDesign_AERA.pdf
```

## Where each PDF is referenced

Each file in this directory is referenced from `/publications/index.html`
in the corresponding `<article class="paper-card">` block. The card's
`[pdf]` link should point to the file with the relative path
`pdf/<FILENAME>.pdf`.

When adding a new PDF:
1. Save it here with the convention above.
2. Open `/publications/index.html`.
3. Find the matching `paper-card` (or add a new one).
4. Update the `[draft]` marker in the paper title to a real
   `<a href="pdf/FILENAME.pdf">[pdf]</a>` link.
5. Move any links that go in `paper-links` into the visible link row.
