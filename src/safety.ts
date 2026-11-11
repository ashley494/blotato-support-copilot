// Safety screen: runs FIRST, before any diagnosis. If a ticket mentions any of these, no reply is drafted
// for sending. It goes straight to a person, whatever else it says.
//
// Why (third hostile review, 2026-11-11): a customer who said they wanted to kill themselves, a customer
// whose account was hacked, a GDPR deletion request and a pasted password all got an automatic
// "here's your fix" reply, because the keyword rules spotted a technical word in the same message.
// A support agent never answers these with a canned fix.

export interface SafetyFlag {
  id: "self-harm" | "security-incident" | "legal" | "privacy-request" | "credential-shared" | "policy-abuse" | "wants-a-person" | "harm-to-others";
  reason: string;
}

const SCREENS: Array<[SafetyFlag["id"], RegExp, string]> = [
  ["self-harm", /\b(kill (myself|me)|end (my life|it all)|suicid\w*|self[- ]harm|hurt myself|don'?t want to (be here|live|go on)|want to die|no reason to live|(saying|this is (my|a)) goodbye|won'?t be (around|here) (much longer|anymore)|can'?t (go on|do this anymore))\b/i,
    "Mentions self-harm or a goodbye. A person responds, with care, right away."],
  ["security-incident", /\b(hack(ed|er|ers)?|stol(e|en)|compromis\w*|breach\w*|unauthori[sz]ed (posts?|access|logins?|use)|someone (else )?(is |has been )?(using|posting|logged)|phish\w*|(key|password|login|credentials?|token) (has |was |got )?leak(ed)?|leaked (my|our|the) (api )?(key|password|login|credentials?|token)|revoke (access|their|his|her)|still (has|have|using) (my|our|the) (api )?(login|password|key|account))\b/i,
    "A possible security incident (stolen or leaked key, hacked account, unauthorized use). A person secures the account."],
  ["legal", /\b(lawyer|attorney|legal action|lawsuit|sue|suing|subpoena|cease and desist|(in|to|take (you|it|this) to) court|chargeback|dispute (with|through) (my|the) (bank|card)|filed a dispute|embargo\w*|seized|fbi|police|law enforcement)\b/i,
    "Legal, chargeback or law-enforcement language. A person handles it."],
  ["privacy-request", /\b(gdpr|ccpa|dsgvo|delete (all )?(my|our) (personal )?(data|account|information)|close my account|erase my|data (deletion|export) request|right to be forgotten|l[öo]schen sie|meine daten|supprimer mes donn[ée]es|borrar mis datos)\b/i,
    "A privacy or account-closure request. A person handles it."],
  ["credential-shared", /(here(?:'s| is) my (password|login|api key|key)|my password is|password\s*[:=]|api[_ -]?key\s*[:=]\s*\S{8,}|\bsk-[a-z0-9_-]{10,})/i,
    "The customer shared a password or key. A person tells them to change it and removes it from the ticket."],
  ["policy-abuse", /\b(fake accounts?|\d{2,} (new |fake |burner )(instagram|tiktok|facebook|x|twitter) accounts|bot accounts|sock ?puppets?|(get around|bypass|evade) (the |their |tiktok'?s? |instagram'?s? )?(ownership|verification|ban|rules|checks?|platform)|without (asking|permission)|repost(ing)? (other|another) (creators?|people)|(another|other) creator'?s?|someone else'?s (video|content|post|reel)s?|spam(ming)? (people|accounts|dms|messages|comments)|mass[- ]?(post|dm|message) to \d+)\b/i,
    "Possible platform-policy abuse (fake accounts, someone else's content, getting around platform checks). A person reviews it."],
  ["wants-a-person", /\b((speak|talk) (to|with) (a |an )?(human|person|someone|supervisor|manager)|(want|need|get me) (a |your |the )?(manager|supervisor|real person|human)|(manager|someone) (to )?(call|phone)|(phone|call) (me|them|us|the family)|escalate this|real person)\b/i,
    "Asks for a person or a call. A person takes it."],
  ["harm-to-others", /\b(my (child|kid|son|daughter) (posted|used|got into|is being|was)|a minor|minors|underage|harass\w*|threat(s|ened|ening)?|stalk\w*|abus(e|ed|ive|ing)|inappropriate (content|posts?|photos?|images?|pictures?|messages?|comments?|videos?))\b/i,
    "Mentions a child, harassment, threats or abuse. A person handles it."],
];

export function safetyScreen(text: string): SafetyFlag[] {
  const t = text.slice(0, 64_000); // whole ticket (round 5: a GDPR request after character 4000 was missed)
  return SCREENS.filter(([, re]) => re.test(t)).map(([id, , reason]) => ({ id, reason }));
}

export const SAFETY_REPLY =
  "Thanks for reaching out. I want to make sure this gets the right attention, so I'm passing it to a member of our team now, and they'll reply to you here personally. If you shared a password or API key in this message, please change it in your settings as soon as you can.";

// Replies are written in English. A ticket in another language goes to a person instead of getting an
// English reply (round 5: a Spanish ticket got an English answer). Non-English = mostly another alphabet,
// or more common Spanish/French/German/Portuguese/Italian words than English ones.
const EN = new Set("the a an and or but i my me we our you your it is are was were be been to of in on for with at from this that have has had do does did not no can will would should how what when why where which who just up out all one get got".split(" "));
const OTHER = new Set("de la que el los las mi mis es por para con una y se del al lo como pero est pas je une des du et les mon ma mes pour avec das der die und ist nicht ich mein meine ein eine mit für auf não uma com é meu minha il di che non sono per gli".split(" "));
export function looksEnglish(text: string): boolean {
  const t = text.slice(0, 4000);
  const other = (t.match(/[\u0400-\u04ff\u0600-\u06ff\u0590-\u05ff\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/g) ?? []).length;
  const latin = (t.match(/[a-z]/gi) ?? []).length;
  if (other > latin) return false;
  const words = t.toLowerCase().match(/[a-zà-ÿ']+/g) ?? [];
  const en = words.filter((w) => EN.has(w)).length;
  const foreign = words.filter((w) => OTHER.has(w)).length;
  return !(foreign >= 2 && foreign > en);
}
