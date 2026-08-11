/**
 * The catalog has no editorial-validated video URLs (MVP-DEFINITION.md §9: licensing/attribution
 * must be checked before adding real video content, not done yet). Rather than invent or guess a
 * specific YouTube video URL, this builds a clearly-labeled external search link instead — the
 * person picks whichever real result they trust, Trainer never claims to have vetted one.
 */
export function youtubeSearchUrl(exerciseName: string, variantName: string): string {
  const query = `${exerciseName} ${variantName} técnica`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}
