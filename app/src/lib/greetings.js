// Randomized greeting phrases + verse sublines for the Home page. Greetings read as "{phrase}, {name}".
export const GREETINGS = [
  'Welcome back', 'Good to see you', 'Grace and peace', 'Back to the Word', 'The Word awaits',
  'Ready to dig in', 'Peace be with you', 'Grace to you', 'Come and see', 'Draw near',
  'Settle in', 'Glad you’re here', 'The lamp is lit', 'Let’s open the Word', 'Good to have you',
  'Welcome home', 'Time in the Word', 'The scroll is open',
];
export const SUBLINES = [
  '“Your word is a lamp to my feet.” — Psalm 119:105',
  '“Taste and see that the Lord is good.” — Psalm 34:8',
  '“The word of God is living and active.” — Hebrews 4:12',
  '“Your words were found, and I ate them.” — Jeremiah 15:16',
  '“The word of our God endures forever.” — Isaiah 40:8',
  '“I have hidden your word in my heart.” — Psalm 119:11',
  '“Man shall not live by bread alone…” — Matthew 4:4',
  '“Let the word of Christ dwell in you richly.” — Colossians 3:16',
  '“Oh how I love your law!” — Psalm 119:97',
  '“In the beginning was the Word.” — John 1:1',
  '“This book of the law shall not depart…” — Joshua 1:8',
  'A little every day.',
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function randomGreeting() { return pick(GREETINGS); }
export function randomSubline() { return pick(SUBLINES); }
