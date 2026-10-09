<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the Stirix interface dark-first with semantic graphite/emerald tokens, Sora headings, and Manrope body text so new screens remain brand-consistent.
- The Forrásaink page shows a fixed, hand-maintained source list; do not build editable source-manager UIs unless the user asks again.
- Serve brand logos from real files in `public` (never asset pointers) so external deployments don't depend on Lovable asset routing; BrandLogo picks by language and theme: HU shows `/hirx-logo.png` (dark theme) / `/hirx-logo-dark.png` (light theme), RO shows `/stirix-logo.png` / `/stirix-logo-dark.png`; favicon is the X mark.
