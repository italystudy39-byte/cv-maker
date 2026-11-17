const NBSP = " ";

/**
 * DESIGN 3.3: «ёлочки», em dash with spaces, no-break space after one-letter words and before a dash.
 * Applied to generated text before it lands in the document.
 */
export function typograph(input: string): string {
  let s = input;
  // Straight quotes → «ёлочки» (inner „лапки“ are rare in resumes, so one level is enough).
  s = s.replace(/(^|[\s(\[{])"(?=\S)/g, "$1«").replace(/"/g, "»");
  // Hyphen or en dash between spaces → em dash bound to the previous word.
  s = s.replace(/[  ]+[-–—][  ]+/g, `${NBSP}— `);
  // One-letter prepositions and conjunctions stick to the next word.
  // Run twice: the regex can't see overlapping matches like "и в".
  for (let i = 0; i < 2; i++) s = s.replace(/(^|[\s«(])([абвикосуяАБВИКОСУЯ])[ ](?=\S)/g, `$1$2${NBSP}`);
  // Numbers stay with their units and with "№".
  s = s.replace(/(\d)[ ](%|₽|руб|млн|млрд|тыс|чел|ч\b|мин\b|дн)/g, `$1${NBSP}$2`);
  s = s.replace(/№[ ]/g, `№${NBSP}`);
  return s;
}
