import { httpErrors } from "@fastify/sensible";
import Polyglot from "node-polyglot";
import type { AvailableLanguages } from "../types/schemaDefinitions.js";

type Translations = {
  en: {
    secureMessageSubject: string;
    secureMessageHtml: string;
    secureMessageText: string;
    secureMessageExcerpt: string;
    smsText: string;
  };
  ga: {
    secureMessageSubject: string;
    secureMessageHtml: string;
    secureMessageText: string;
    secureMessageExcerpt: string;
    smsText: string;
  };
};

type TranslationKey<T extends keyof Translations> = keyof Translations[T];

const translations: Translations = {
  en: {
    secureMessageSubject:
      "You have received a new secure message from %{enOrganizationName}",
    secureMessageHtml: `
      <p>Dear %{publicName},</p>
      <p>A new message has been sent to your MessagingIE account from %{enOrganizationName}. Please log in to your MessagingIE account at <a href="%{showMessageUrl}">https://messaging.services.gov.ie</a> to view your message.</p>
      <p>Best regards,<br>MessagingIE</p>
      <p>This email and any files transmitted with it are confidential and intended solely for the use of the individual or entity to whom they are addressed. If you have received this email in error, please notify MessagingIE support at <a href="https://profile.services.gov.ie/en/contact-support">https://profile.services.gov.ie/en/contact-support</a></p>

      <hr>
      
      <p>A %{publicName}, a chara,</p>
      <p>Tá teachtaireacht nua seolta chuig do chuntas MessagingIE ó %{gaOrganizationName}. Logáil isteach le do thoil i do chuntas MessagingIE ag <a href="%{showMessageUrl}">https://messaging.services.gov.ie</a> chun do theachtaireacht a fheiceáil.<p>
      <p>Le dea-mhéin,<br>MessagingIE</p>
      <p>Tá an ríomhphost seo agus aon chomhaid a tharchuirtear leis faoi rún agus le haghaidh úsáid an duine aonair nó an eintitis ar a bhfuil siad dírithe. Má fuair tú an ríomhphost seo trí thimpiste cuir in iúl do thacaíocht MessagingIE ag <a href="https://profile.services.gov.ie/ga/contact-support">https://profile.services.gov.ie/ga/contact-support</a></p>
    `,
    secureMessageText: `Dear %{publicName},
      A new message has been sent to your MessagingIE account from %{enOrganizationName}. Please log in to your MessagingIE account at %{showMessageUrl} to view your message.

      Best regards,
      MessagingIE
      
      This email and any files transmitted with it are confidential and intended solely for the use of the individual or entity to whom they are addressed. If you have received this email in error, please notify MessagingIE support at https://profile.services.gov.ie/en/contact-support

      --------------------------------------------------------------
      
      A %{publicName}, a chara,
      Tá teachtaireacht nua seolta chuig do chuntas MessagingIE ó %{gaOrganizationName}. Logáil isteach le do thoil i do chuntas MessagingIE ag %{showMessageUrl} chun do theachtaireacht a fheiceáil.

      Le dea-mhéin,
      MessagingIE

      Tá an ríomhphost seo agus aon chomhaid a tharchuirtear leis faoi rún agus le haghaidh úsáid an duine aonair nó an eintitis ar a bhfuil siad dírithe. Má fuair tú an ríomhphost seo trí thimpiste cuir in iúl do thacaíocht MessagingIE ag https://profile.services.gov.ie/ga/contact-support
`,
    secureMessageExcerpt:
      "You have received a new secure message from %{enOrganizationName}",
    smsText:
      "%{enOrganizationName} has sent a message to your MessagingIE account. Sheol %{gaOrganizationName} teachtaireacht chuig do chuntas MessagingIE.",
  },
  ga: {
    secureMessageSubject:
      "Tá teachtaireacht shlán nua faighte agat ó %{gaOrganizationName}",
    secureMessageHtml: `
      <p>A %{publicName}, a chara,</p>
      <p>Tá teachtaireacht nua seolta chuig do chuntas MessagingIE ó %{gaOrganizationName}. Logáil isteach le do thoil i do chuntas MessagingIE ag <a href="%{showMessageUrl}">https://messaging.services.gov.ie</a> chun do theachtaireacht a fheiceáil.<p>
      <p>Le dea-mhéin,<br>MessagingIE</p>
      <p>Tá an ríomhphost seo agus aon chomhaid a tharchuirtear leis faoi rún agus le haghaidh úsáid an duine aonair nó an eintitis ar a bhfuil siad dírithe. Má fuair tú an ríomhphost seo trí thimpiste cuir in iúl do thacaíocht MessagingIE ag <a href="https://profile.services.gov.ie/ga/contact-support">https://profile.services.gov.ie/ga/contact-support</a></p>

      <hr>
      
      <p>Dear %{publicName},</p>
      <p>A new message has been sent to your MessagingIE account from %{enOrganizationName}. Please log in to your MessagingIE account at <a href="%{showMessageUrl}">https://messaging.services.gov.ie</a> to view your message.</p>
      <p>Best regards,<br>MessagingIE</p>
      <p>This email and any files transmitted with it are confidential and intended solely for the use of the individual or entity to whom they are addressed. If you have received this email in error, please notify MessagingIE support at <a href="https://profile.services.gov.ie/en/contact-support">https://profile.services.gov.ie/en/contact-support</a></p>
    `,
    secureMessageText: `A %{publicName}, a chara,
      Tá teachtaireacht nua seolta chuig do chuntas MessagingIE ó %{gaOrganizationName}. Logáil isteach le do thoil i do chuntas MessagingIE ag %{showMessageUrl} chun do theachtaireacht a fheiceáil.

      Le dea-mhéin,
      MessagingIE

      Tá an ríomhphost seo agus aon chomhaid a tharchuirtear leis faoi rún agus le haghaidh úsáid an duine aonair nó an eintitis ar a bhfuil siad dírithe. Má fuair tú an ríomhphost seo trí thimpiste cuir in iúl do thacaíocht MessagingIE ag https://profile.services.gov.ie/ga/contact-support

      --------------------------------------------------------------
      
      Dear %{publicName},
      A new message has been sent to your MessagingIE account from %{enOrganizationName}. Please log in to your MessagingIE account at %{showMessageUrl} to view your message.

      Best regards,
      MessagingIE
      
      This email and any files transmitted with it are confidential and intended solely for the use of the individual or entity to whom they are addressed. If you have received this email in error, please notify MessagingIE support at https://profile.services.gov.ie/en/contact-support
`,
    secureMessageExcerpt:
      "Tá teachtaireacht shlán nua faighte agat ó %{gaOrganizationName}",
    smsText:
      "%{enOrganizationName} has sent a message to your MessagingIE account. Sheol %{gaOrganizationName} teachtaireacht chuig do chuntas MessagingIE.",
  },
};

export interface I18n {
  translate: <T extends keyof Translations>(
    language: T,
    translationName: TranslationKey<T>,
    variables?: Record<string, string>,
  ) => string;
}

declare module "fastify" {
  export interface FastifyInstance {
    i18n: I18n;
  }
}

function getDefaultPolyglots(): Record<AvailableLanguages, Polyglot> {
  return {
    en: new Polyglot({ phrases: translations.en }),
    ga: new Polyglot({ phrases: translations.ga }),
  };
}

export class Translator implements I18n {
  private readonly polyglots: Record<AvailableLanguages, Polyglot>;
  constructor(inputPolyglots?: Record<AvailableLanguages, Polyglot>) {
    this.polyglots = inputPolyglots ?? getDefaultPolyglots();
  }
  translate<T extends keyof Translations>(
    language: T,
    translationName: TranslationKey<T>,
    variables: Record<string, string> = {},
  ): string {
    const polyglot = this.polyglots[language];
    if (!polyglot) {
      throw httpErrors.badRequest(`Unsupported language: ${language}`);
    }
    return polyglot.t(translationName as string, variables);
  }
}
