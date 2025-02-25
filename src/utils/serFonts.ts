import { registerFont } from 'canvas';
import * as path from 'path';

// Corrected font path
const fontPath = path.join(
  process.cwd(),
  'fonts',
  'Action-Man',
  'Action-Man.ttf',
);

console.log(fontPath);

// Register the font with the name "ActionMan"
registerFont(fontPath, { family: 'ActionMan' });

export const actionman = {
  style: {
    fontFamily: 'ActionMan',
  },
};
