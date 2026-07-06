// Randomized greeting phrases + verse sublines for the Home page (from the mockup).
export const GREETINGS = [
  'Welcome back', 'Good to see you', 'Grace and peace', 'Back to the Word', 'The Word awaits', 'Ready to dig in',
];
export const SUBLINES = [
  '“Your word is a lamp to my feet.” — Psalm 119:105',
  '“Taste and see that the Lord is good.” — Psalm 34:8',
  '“Your word is a lamp to my feet.” — Psalm 119:105',
  'A little every day.',
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function randomGreeting() { return pick(GREETINGS); }
export function randomSubline() { return pick(SUBLINES); }
