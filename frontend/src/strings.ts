// Every visible word lives here. `en` must have exactly the keys of `bn` (checked by the type below).
const bn = {
  appTitle: "স্কুল ভর্তি",
  studentIdLabel: "শিক্ষার্থীর 17 অঙ্কের জন্ম নিবন্ধন নম্বর",
  studentIdInvalid: "শুধু 17টি অঙ্ক দিন, কোনো অক্ষর বা চিহ্ন নয়।",
  studentIdNeeded: "আবেদন করতে আগে উপরে জন্ম নিবন্ধন নম্বর দিন।",
  viewApplicant: "অভিভাবক",
  viewAdmin: "অ্যাডমিন",
  langSwitch: "EN",
  langSwitchLabel: "Switch to English",

  myApplications: "আমার আবেদন",
  myApplicationsEmpty: "এখনো কোনো আবেদন নেই। নিচের তালিকা থেকে শ্রেণি বেছে আবেদন করুন।",
  classList: "শ্রেণির তালিকা",
  classListEmpty: "কোনো শ্রেণি এখনো খোলা হয়নি।",
  classListEmptyAdmin: "কোনো শ্রেণি এখনো খোলা হয়নি। উপরের ফর্ম থেকে প্রথম শ্রেণিটি তৈরি করুন।",
  createClass: "শ্রেণি তৈরি",
  loadFailed: "তথ্য আনা যায়নি। প্রতি 3 সেকেন্ডে আবার চেষ্টা হচ্ছে।",

  colClass: "শ্রেণি",
  colTotal: "মোট",
  colHeld: "সংরক্ষিত",
  colConfirmed: "নিশ্চিত",
  colAvailable: "খালি",
  seatMap: "আসন বিন্যাস",
  seatMapTooLarge: "আসন অনেক বেশি, বিন্যাস দেখানো হচ্ছে না।",
  full: "আসন নেই",

  apply: "আবেদন করুন",
  pay: "ভর্তি ফি দিন",
  cancel: "বাতিল",
  cancelSure: "নিশ্চিত?",
  yes: "হ্যাঁ",
  no: "না",
  timeLeft: "সময় বাকি",
  expiresAt: "মেয়াদ শেষ",

  statusHELD: "সংরক্ষিত",
  statusCONFIRMED: "নিশ্চিত",
  statusEXPIRED: "মেয়াদ উত্তীর্ণ",
  statusCANCELLED: "বাতিল",

  formClass: "শ্রেণি",
  formClassPick: "বেছে নিন",
  formClassNumber: "শ্রেণি {n}",
  formShift: "শিফট",
  formShiftMorning: "প্রভাতি",
  formShiftDay: "দিবা",
  formSeats: "মোট আসন",
  formSubmit: "শ্রেণি তৈরি করুন",
  formNeedClass: "একটি শ্রেণি বেছে নিন।",
  formNeedShift: "একটি শিফট বেছে নিন।",
  formNeedSeats: "আসন সংখ্যা 1 বা তার বেশি পূর্ণ সংখ্যা হতে হবে।",

  okHeld: "আসন সংরক্ষিত হয়েছে। সময় শেষের আগে ভর্তি ফি দিন।",
  okConfirmed: "ভর্তি নিশ্চিত হয়েছে।",
  okCancelled: "আবেদন বাতিল হয়েছে।",
  okClassCreated: "শ্রেণি তৈরি হয়েছে।",

  errOffline: "সার্ভারের সাথে সংযোগ নেই। সংযোগ ফিরলে তথ্য নিজে থেকেই হালনাগাদ হবে।",
  errBusy: "সার্ভার এখন ব্যস্ত, একটু পরে আবার চেষ্টা করুন।",
  errFull: "দুঃখিত, এই শ্রেণিতে আর আসন খালি নেই।",
  errDuplicate: "এই শ্রেণিতে আপনার একটি চলমান আবেদন আছে।",
  errExpired: "আবেদনের সময় শেষ হয়ে গেছে।",
  errNotActive: "এই আবেদনটি আর চালু নেই।",
  errNotYours: "এই আবেদনটি অন্য শিক্ষার্থীর।",
  errNotFound: "শ্রেণি বা আবেদনটি পাওয়া যায়নি।",
  errInvalid: "দেওয়া তথ্য সঠিক নয়।",
  errUnknown: "কিছু একটা ভুল হয়েছে, আবার চেষ্টা করুন।",
  dismiss: "বন্ধ করুন",
};

export type StringKey = keyof typeof bn;

const en: Record<StringKey, string> = {
  appTitle: "School admission",
  studentIdLabel: "Student's 17-digit birth registration number",
  studentIdInvalid: "Enter exactly 17 digits, no letters or symbols.",
  studentIdNeeded: "Enter the birth registration number above before applying.",
  viewApplicant: "Parent",
  viewAdmin: "Admin",
  langSwitch: "বাংলা",
  langSwitchLabel: "বাংলায় দেখুন",

  myApplications: "My applications",
  myApplicationsEmpty: "No applications yet. Pick a class from the list below to apply.",
  classList: "Classes",
  classListEmpty: "No class is open yet.",
  classListEmptyAdmin: "No class is open yet. Create the first one with the form above.",
  createClass: "Create class",
  loadFailed: "Couldn't load the data. Retrying every 3 seconds.",

  colClass: "Class",
  colTotal: "Total",
  colHeld: "Held",
  colConfirmed: "Confirmed",
  colAvailable: "Available",
  seatMap: "Seat map",
  seatMapTooLarge: "Too many seats to draw the map.",
  full: "Full",

  apply: "Apply",
  pay: "Pay admission fee",
  cancel: "Cancel",
  cancelSure: "Sure?",
  yes: "Yes",
  no: "No",
  timeLeft: "Time left",
  expiresAt: "Expires",

  statusHELD: "Held",
  statusCONFIRMED: "Confirmed",
  statusEXPIRED: "Expired",
  statusCANCELLED: "Cancelled",

  formClass: "Class",
  formClassPick: "Choose",
  formClassNumber: "Class {n}",
  formShift: "Shift",
  formShiftMorning: "Morning",
  formShiftDay: "Day",
  formSeats: "Total seats",
  formSubmit: "Create class",
  formNeedClass: "Choose a class.",
  formNeedShift: "Choose a shift.",
  formNeedSeats: "Seats must be a whole number, 1 or more.",

  okHeld: "Seat held. Pay the admission fee before the time runs out.",
  okConfirmed: "Admission confirmed.",
  okCancelled: "Application cancelled.",
  okClassCreated: "Class created.",

  errOffline: "Can't reach the server. The page updates on its own when the connection is back.",
  errBusy: "The server is busy. Please try again in a moment.",
  errFull: "Sorry, this class has no seats left.",
  errDuplicate: "You already have an active application in this class.",
  errExpired: "This application's time has run out.",
  errNotActive: "This application is no longer active.",
  errNotYours: "This application belongs to another student.",
  errNotFound: "Class or application not found.",
  errInvalid: "Some of the details are not valid.",
  errUnknown: "Something went wrong. Please try again.",
  dismiss: "Dismiss",
};

export type Lang = "bn" | "en";
export const strings: Record<Lang, Record<StringKey, string>> = { bn, en };

// Never throws: falls back to Bangla, then to the key, so a gap shows a word instead of breaking the page.
export function translate(lang: Lang, key: StringKey, vars?: Record<string, string | number>): string {
  let text = strings[lang][key] ?? strings.bn[key] ?? key;
  for (const [k, v] of Object.entries(vars ?? {})) text = text.replace(`{${k}}`, String(v));
  return text;
}
