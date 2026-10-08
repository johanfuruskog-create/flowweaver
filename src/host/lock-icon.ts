/**
 * Hänglåset — en genväg för ögat, aldrig en bärare av betydelse.
 *
 * Johan 18/9, i genomgången av ytan: *"Lägga till hänglås-ikon."* Den står
 * bredvid ordet och aldrig i stället för det (K3): en ikon som ensam skulle
 * säga *låst* är en ikon som säger ingenting för den som inte redan vet vad
 * den betyder, och ingenting alls för den som lyssnar på sidan.
 *
 * Här och inte i de två filer som ritar den. Brickan i editorns rad och raden
 * i guidelistan visar **samma** tillstånd, och två teckningar av samma sak
 * glider isär i det ögonblick någon rättar den ena.
 *
 * `currentColor` och `aria-hidden` sätts av den som monterar den: färgen ska
 * följa raden i båda temana, och namnet står redan i texten bredvid.
 */
export const LOCK_ICON =
  '<svg width="16" height="16" viewBox="0 0 20 20" focusable="false" aria-hidden="true">' +
  '<rect x="5" y="9.2" width="10" height="7.8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
  '<path d="M7 9.2V6.6a3 3 0 0 1 6 0v2.6" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
  "</svg>";
