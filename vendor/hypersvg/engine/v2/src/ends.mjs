// The story's endings, for the player and the checker alike (no imports).
// The story's endings (3.9, D31.4): story.ends when it is given; else every scene with no way out (no link leaves it,
// and no shell link leaves every scene). links: the story's links and the chapters' (each with from).
export function endsOf(story, links = story?.links || [], shellId = null) {
  if (Array.isArray(story?.ends)) return story.ends;
  if (story?.endless === true) return [];
  const ids = Object.keys(story?.scenes || {});
  if (shellId && links.some(l => l?.from === shellId)) return [];
  return ids.filter(id => !links.some(l => l?.from === id));
}
