/**
 * Tag URL helpers. Turkish tags often contain spaces, accented characters,
 * and the letters ğ ç ş ı İ Ş Ç Ö Ü — none of which are URL-safe. Slugify
 * once here so both link emission and tag-page lookup agree on encoding.
 */
const TURKISH_MAP: Record<string, string> = {
    ç: 'c', Ç: 'c',
    ğ: 'g', Ğ: 'g',
    ı: 'i', İ: 'i',
    ö: 'o', Ö: 'o',
    ş: 's', Ş: 's',
    ü: 'u', Ü: 'u',
};

export function tagSlug(tag: string): string {
    return tag
        .toLocaleLowerCase('tr')
        .split('')
        .map((ch) => TURKISH_MAP[ch] ?? ch)
        .join('')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}
