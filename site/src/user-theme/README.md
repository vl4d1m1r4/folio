# User-theme overrides

Place `.njk` files here to shadow the corresponding partials in `src/_includes/partials/`.

Example: create `nav.njk` here to replace the default navigation.

All files in this directory (except this README and `.gitkeep`) are ignored by git,
so your customizations won't accidentally be committed to the template repo.

## Available partials you can override

| File | Purpose |
|---|---|
| `nav.njk` | Top navigation bar |
| `footer.njk` | Footer |
| `cta-band.njk` | Call-to-action section above footer |
| `article-card.njk` | Article card in listings |
