import { GeneratedPanels } from './types';

export function parseBadJSON(jsonLikeString: string): GeneratedPanels {
  try {
    return JSON.parse(jsonLikeString) as GeneratedPanels;
  } catch (err) {
    console.error(err);
    const regex =
      /\{\s*"panel":\s*(\d+),\s*"instructions"\s*:\s*"([^"]+)",\s*"speech"\s*:\s*"([^"]+)",\s*"caption":\s*"([^"]*)"\s*\}/gs;

    const results = [];
    let match;

    while ((match = regex.exec(jsonLikeString)) !== null) {
      const json = {
        panel: Number(match[1]),
        instructions: match[2],
        speech: match[3],
        caption: match[4],
      };
      results.push(json);
    }

    return results as GeneratedPanels;
  }
}
