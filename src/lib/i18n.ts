/**
 * Bilingual (tr/en) UI string dictionary + helpers.
 *
 * Pages declare their `lang` and pass it to <Page>. Components call
 * `t(lang, 'key')` to fetch the matching string. New strings: add to BOTH
 * `tr` and `en` blocks below — TypeScript will refuse mismatched keys.
 */

export type Lang = 'tr' | 'en';

export const LANGS: Lang[] = ['tr', 'en'];
export const DEFAULT_LANG: Lang = 'tr';

const DICT = {
    tr: {
        site_title: 'notlar.im',
        site_tagline:
            "Buğra Canata'nın kişisel notları. Yazılım, amatör telsiz, bisiklet ve karşıma çıkan başka şeyler.",
        nav_posts: 'Yazılar',
        nav_videos: 'Videolar',
        nav_about: 'Ben Kimim?',
        nav_rss: 'RSS',

        home_tagline:
            'Yazılım, amatör telsiz, bisiklet ve karşıma çıkan diğer şeyler üzerine kısa notlar. Buğra Canata.',
        home_kicker: 'Buğra Canata',
        home_hero:
            'Yazılım, amatör telsiz, bisiklet ve karşıma çıkan diğer şeyler üzerine kısa notlar.',

        meta_updated: 'güncellendi',
        meta_note: 'not',
        toc_title: 'İçindekiler',
        meta_ai_long: 'Yapay zekâ ile üretildi',
        meta_ai_short: 'YZ',

        pagination_prev: '← Daha yeni',
        pagination_next: 'Daha eski →',
        pagination_summary: 'Sayfa {current} / {total}',

        videos_title: 'Videolar',
        videos_intro:
            '{channel} kanalındaki {total} videonun {start}–{end}. aralığı.',
        videos_refresh_note: 'Her dağıtımda yenilenir.',

        about_label: 'Hakkında',
        tag_label: 'Etiket',
        tag_count: '{n} gönderi',

        translation_missing:
            'Bu yazının {targetLang} sürümü henüz mevcut değil.',
        switch_to_english: 'English',
        switch_to_turkish: 'Türkçe',

        footer_links: 'Bağlantılar',
        footer_built_with: 'Astro & Cloudflare Workers',

        date_locale: 'tr-TR',

        nav_search: 'Ara',
        nav_tags: 'Etiketler',
        nav_books: 'Kitaplık',
        nav_reviews: 'Mekanlar',

        books_title: 'Kitaplık',
        books_tagline:
            'Çalışma odamdaki kitaplar. Kapaklar Open Library üzerinden, geri kalan bilgiler kendi kataloğumdan.',
        books_count: '{n} kitap',
        books_search_placeholder: 'Başlık veya yazara göre ara…',
        books_no_results: 'Eşleşen kitap bulunamadı.',
        books_back: '← Kitaplık',
        book_publisher: 'Yayınevi',
        book_year: 'Yıl',
        book_pages: 'Sayfa',
        book_isbn: 'ISBN',
        book_status: 'Durum',
        book_added: 'Eklendi',
        book_openlibrary: "Open Library'de gör",
        book_location: 'Konum',
        book_rating: 'Puan',
        book_lent: 'Ödünçte',
        book_copies: '{n} kopya',
        read_okunmadi: 'Okunmadı',
        read_okunuyor: 'Okunuyor',
        read_okundu: 'Okundu',

        reviews_title: 'Mekanlar',
        reviews_tagline:
            "Google Haritalar'da Yerel Rehber olarak yazdığım mekan yorumları. Haritada gezinebilir ya da listede arayabilirsiniz.",
        reviews_count: '{n} yorum',
        reviews_search_placeholder: 'Mekana göre ara…',
        reviews_no_results: 'Eşleşen yorum bulunamadı.',
        reviews_map_label: 'Haritada gör',
        reviews_view: "Google Haritalar'da aç",
        reviews_map_empty: 'Haritada gösterilecek konum yok.',

        search_title: 'Ara',
        search_placeholder: 'notlar.im içinde ara…',
        search_zero_results: 'Sonuç bulunamadı.',
        search_kbd_hint: 'Klavyeden ⌘K veya Ctrl+K ile her sayfada açılır.',
        search_open: 'Aramayı aç',
        search_close: 'Kapat',

        reading_time: '~{minutes} dk okuma',

        prev_post: 'Daha yeni yazı',
        next_post: 'Daha eski yazı',
        related_posts: 'Benzer yazılar',
        copy_code: 'Kopyala',
        copied_code: 'Kopyalandı',

        tags_index_title: 'Etiketler',
        tags_index_tagline:
            'Bütün etiketler, en çok kullanılandan en aza doğru.',

        not_found_title: 'Sayfa bulunamadı',
        not_found_body:
            'Aradığınız sayfa yok ya da taşındı. Aramayı deneyebilir veya ana sayfaya dönebilirsiniz.',
        not_found_home: 'Ana sayfaya dön',

        theme_label: 'Tema',
        theme_auto: 'Otomatik',
        theme_light: 'Açık',
        theme_dark: 'Koyu',
    },
    en: {
        site_title: 'notlar.im',
        site_tagline:
            "Buğra Canata's personal notes. Software, amateur radio, cycling and whatever else.",
        nav_posts: 'Posts',
        nav_videos: 'Videos',
        nav_about: 'About',
        nav_rss: 'RSS',

        home_tagline:
            'Short notes on software, amateur radio, cycling, and other things that catch my eye. Buğra Canata.',
        home_kicker: 'Buğra Canata',
        home_hero:
            'Short notes on software, amateur radio, cycling, and other things that catch my eye.',

        meta_updated: 'updated',
        meta_note: 'note',
        toc_title: 'Contents',
        meta_ai_long: 'Produced with AI assistance',
        meta_ai_short: 'AI',

        pagination_prev: '← Newer',
        pagination_next: 'Older →',
        pagination_summary: 'Page {current} of {total}',

        videos_title: 'Videos',
        videos_intro:
            'Showing {start}–{end} of {total} videos from {channel}.',
        videos_refresh_note: 'Refreshed on each deploy.',

        about_label: 'About',
        tag_label: 'Tag',
        tag_count: '{n} posts',

        translation_missing:
            'A {targetLang} version of this post is not available yet.',
        switch_to_english: 'English',
        switch_to_turkish: 'Türkçe',

        footer_links: 'Links',
        footer_built_with: 'Astro & Cloudflare Workers',

        date_locale: 'en-GB',

        nav_search: 'Search',
        nav_tags: 'Tags',
        nav_books: 'Library',
        nav_reviews: 'Places',

        books_title: 'Library',
        books_tagline:
            'The books in my study. Covers via Open Library; the rest from my own catalogue.',
        books_count: '{n} books',
        books_search_placeholder: 'Search by title or author…',
        books_no_results: 'No matching books.',
        books_back: '← Library',
        book_publisher: 'Publisher',
        book_year: 'Year',
        book_pages: 'Pages',
        book_isbn: 'ISBN',
        book_status: 'Status',
        book_added: 'Added',
        book_openlibrary: 'View on Open Library',
        book_location: 'Location',
        book_rating: 'Rating',
        book_lent: 'On loan',
        book_copies: '{n} copies',
        read_okunmadi: 'Unread',
        read_okunuyor: 'Reading',
        read_okundu: 'Read',

        reviews_title: 'Places',
        reviews_tagline:
            "Place reviews I've written as a Google Maps Local Guide. Pan the map, or search the list.",
        reviews_count: '{n} reviews',
        reviews_search_placeholder: 'Search by place…',
        reviews_no_results: 'No matching reviews.',
        reviews_map_label: 'Show on map',
        reviews_view: 'View on Google Maps',
        reviews_map_empty: 'No locations to show on the map.',

        search_title: 'Search',
        search_placeholder: 'Search notlar.im…',
        search_zero_results: 'No results found.',
        search_kbd_hint: 'Press ⌘K or Ctrl+K on any page.',
        search_open: 'Open search',
        search_close: 'Close',

        reading_time: '~{minutes} min read',

        prev_post: 'Newer post',
        next_post: 'Older post',
        related_posts: 'Related posts',
        copy_code: 'Copy',
        copied_code: 'Copied',

        tags_index_title: 'Tags',
        tags_index_tagline: 'All tags, most-used first.',

        not_found_title: 'Page not found',
        not_found_body:
            "The page you're looking for doesn't exist or has moved. Try searching, or head back to the home page.",
        not_found_home: 'Back to home',

        theme_label: 'Theme',
        theme_auto: 'Auto',
        theme_light: 'Light',
        theme_dark: 'Dark',
    },
} as const satisfies Record<Lang, Record<string, string>>;

type DictKey = keyof (typeof DICT)['tr'];

export function t(lang: Lang, key: DictKey, vars?: Record<string, string | number>): string {
    let s: string = DICT[lang][key] ?? DICT[DEFAULT_LANG][key];
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            s = s.replaceAll(`{${k}}`, String(v));
        }
    }
    return s;
}

/**
 * Strip the leading "/en" segment from a pathname if present. Useful for
 * generating the "switch to TR" link from an English page URL.
 */
export function stripLangPrefix(pathname: string): string {
    return pathname.replace(/^\/en(\/|$)/, '/');
}

/** Add the "/en" prefix to a default-locale pathname. */
export function withLangPrefix(pathname: string, lang: Lang): string {
    if (lang === DEFAULT_LANG) return stripLangPrefix(pathname);
    const stripped = stripLangPrefix(pathname);
    return `/en${stripped === '/' ? '' : stripped}`.replace(/\/+$/, '') || '/en';
}

/** Display name for a language. */
export function langName(lang: Lang): string {
    return lang === 'tr' ? 'Türkçe' : 'English';
}
