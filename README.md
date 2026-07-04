# notlar.im

[Buğra Canata](https://canata.dev)'nın kişisel blogu. Yazılım, amatör telsiz, bisiklet ve karşıma çıkan başka şeyler üzerine kısa notlar. Türkçe kökte, İngilizce [`/en/`](https://notlar.im/en) altında.

## Yığın

- [Astro 5](https://astro.build) + içerik koleksiyonları (MDX) + Tailwind v4
- [Pagefind](https://pagefind.app) araması (⌘K)
- Cloudflare Workers üzerinde: statik sayfalar + D1/R2 destekli [kitaplık](https://notlar.im/kitaplik) (ev kütüphanesi kataloğu, ISBN tarayıcılı `/admin`)
- RSS: [`/rss.xml`](https://notlar.im/rss.xml) (TR) · [`/en/rss.xml`](https://notlar.im/en/rss.xml) (EN)

## Geliştirme

```sh
pnpm install
pnpm dev          # http://localhost:4321
pnpm build        # astro check + build + pagefind
pnpm run deploy   # build + wrangler deploy ("pnpm deploy" değil!)
```

Ayrıntılar için [`CLAUDE.md`](CLAUDE.md).

Eski Docusaurus sitesinin geçmişi [`docusaurus-arsiv`](https://github.com/bcanata/notlar.im/tree/docusaurus-arsiv) dalında.
