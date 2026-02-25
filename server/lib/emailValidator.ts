/**
 * Email validation and temporary email detection
 */

// Common temporary/disposable email domains
const TEMP_EMAIL_DOMAINS = [
  // Popular temp mail services
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'maildrop.cc',
  'tempmail.com',
  'temp-mail.org',
  'throwaway.email',
  'getnada.com',
  'trashmail.com',
  'yopmail.com',
  'fakeinbox.com',
  'sharklasers.com',
  'guerrillamail.info',
  'grr.la',
  'guerrillamail.biz',
  'guerrillamail.de',
  'spam4.me',
  'mailnesia.com',
  'tempinbox.com',
  'dispostable.com',
  'throwawaymail.com',
  'mintemail.com',
  'mytemp.email',
  'mohmal.com',
  'emailondeck.com',
  'temp-mail.io',
  'tempmail.net',
  'getairmail.com',
  'anonbox.net',
  'anonymousemail.me',
  'burnermail.io',
  'disposablemail.com',
  'emailfake.com',
  'fakemail.net',
  'fakemailgenerator.com',
  'incognitomail.com',
  'jetable.org',
  'mailcatch.com',
  'mailtemp.info',
  'mintemail.com',
  'mytrashmail.com',
  'no-spam.ws',
  'nospam.ze.tc',
  'nospamfor.us',
  'nowmymail.com',
  'objectmail.com',
  'obobbo.com',
  'oneoffemail.com',
  'pookmail.com',
  'proxymail.eu',
  'rcpt.at',
  'recode.me',
  'recursor.net',
  'rtrtr.com',
  'safe-mail.net',
  'safetymail.info',
  'saynotospams.com',
  'selfdestructingmail.com',
  'sendspamhere.com',
  'shiftmail.com',
  'slaskpost.se',
  'sneakemail.com',
  'sogetthis.com',
  'soodonims.com',
  'spam.la',
  'spamavert.com',
  'spambob.com',
  'spambog.com',
  'spambox.us',
  'spamcannon.com',
  'spamcero.com',
  'spamcon.org',
  'spamcorptastic.com',
  'spamday.com',
  'spamex.com',
  'spamfree24.com',
  'spamgourmet.com',
  'spamhole.com',
  'spamify.com',
  'spaminator.de',
  'spamkill.info',
  'spaml.com',
  'spamobox.com',
  'spamslicer.com',
  'spamspot.com',
  'spamthis.co.uk',
  'spamtrail.com',
  'speed.1s.fr',
  'supergreatmail.com',
  'supermailer.jp',
  'suremail.info',
  'teleworm.us',
  'tempalias.com',
  'tempe-mail.com',
  'tempemail.biz',
  'tempemail.com',
  'tempemail.net',
  'tempinbox.co.uk',
  'tempmail.eu',
  'tempmailer.com',
  'tempmailer.de',
  'tempomail.fr',
  'temporarily.de',
  'temporarioemail.com.br',
  'temporaryemail.net',
  'temporaryemail.us',
  'temporaryforwarding.com',
  'temporaryinbox.com',
  'temporarymailaddress.com',
  'thanksnospam.info',
  'thankyou2010.com',
  'thisisnotmyrealemail.com',
  'throwawayemailaddress.com',
  'tilien.com',
  'tmailinator.com',
  'tradermail.info',
  'trash-mail.at',
  'trash-mail.com',
  'trash-mail.de',
  'trash2009.com',
  'trashdevil.com',
  'trashemail.de',
  'trashmail.at',
  'trashmail.de',
  'trashmail.me',
  'trashmail.net',
  'trashmail.org',
  'trashmail.ws',
  'trashmailer.com',
  'trashymail.com',
  'trashymail.net',
  'trbvm.com',
  'trillianpro.com',
  'twinmail.de',
  'tyldd.com',
  'uggsrock.com',
  'upliftnow.com',
  'uplipht.com',
  'venompen.com',
  'veryrealemail.com',
  'viditag.com',
  'viewcastmedia.com',
  'viewcastmedia.net',
  'viewcastmedia.org',
  'webm4il.info',
  'wegwerfadresse.de',
  'wegwerfemail.de',
  'wegwerfmail.de',
  'wegwerfmail.net',
  'wegwerfmail.org',
  'wetrainbayarea.com',
  'wetrainbayarea.org',
  'wh4f.org',
  'whyspam.me',
  'willselfdestruct.com',
  'winemaven.info',
  'wronghead.com',
  'wuzup.net',
  'wuzupmail.net',
  'www.e4ward.com',
  'www.mailinator.com',
  'wwwnew.eu',
  'xagloo.com',
  'xemaps.com',
  'xents.com',
  'xmaily.com',
  'xoxy.net',
  'yapped.net',
  'yopmail.fr',
  'yopmail.net',
  'yourdomain.com',
  'ypmail.webarnak.fr.eu.org',
  'yuurok.com',
  'zehnminuten.de',
  'zehnminutenmail.de',
  'zippymail.info',
  'zoaxe.com',
  'zoemail.org',
];

// Additional patterns to detect temp emails
const TEMP_EMAIL_PATTERNS = [
  /^.+@\d+mail\./i,
  /^.+@temp.+\./i,
  /^.+@trash.+\./i,
  /^.+@disposable.+\./i,
  /^.+@fake.+\./i,
  /^.+@spam.+\./i,
  /^.+@guerrilla.+\./i,
  /^.+@throwaway.+\./i,
  /^.+@burner.+\./i,
  /^.+@temporary.+\./i,
];

/**
 * Check if an email is from a temporary/disposable email service
 */
export function isTempEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailLower = email.toLowerCase().trim();
  const domain = emailLower.split('@')[1];

  if (!domain) {
    return false;
  }

  // Check against known temp email domains
  if (TEMP_EMAIL_DOMAINS.includes(domain)) {
    return true;
  }

  // Check against patterns
  for (const pattern of TEMP_EMAIL_PATTERNS) {
    if (pattern.test(emailLower)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate email and check if it's not a temp email
 */
export function isValidPermanentEmail(email: string): boolean {
  return isValidEmail(email) && !isTempEmail(email);
}

/**
 * Get a user-friendly error message for temp emails
 */
export function getTempEmailError(): string {
  return 'Temporary or disposable email addresses are not allowed. Please use a permanent email address.';
}
