# Fonts

The dashboard bundles **Familjen Grotesk** (SIL OFL) locally so it works fully offline over `file://`.

The 12 `*.woff2` files (weights 400/500/600/700 × latin / latin-ext / vietnamese subsets) ship inside the distributed zip. To re-fetch them from Google Fonts instead, run:

```sh
./fonts/fetch-fonts.sh
```

`css/fonts.css` declares the matching `@font-face` blocks with unicode-range splitting.
