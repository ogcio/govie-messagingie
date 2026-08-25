import type { SeederConsentStatements } from "~/migrations/consent-statements/seeder-consent-statement.js";

export const statements: SeederConsentStatements = {
  publish_date: new Date(Date.now() - 500).toISOString(),
  name: "MessagingIE Consent Statement",
  translations: {
    en: {
      description: `MessagingIE provides you with a safe and secure access to letters, documents, and messages from Public Sector Bodies (PSBs).
        Before you start using MessagingIE, we need your consent for the following:
        - To allow Public Sector Bodies to send messages to you where they are required or permitted to give information to you in writing
        - To notify you of new messages sent to you through MessagingIE
        Please note, messages sent to you through MessagingIE may contain personal data. In some cases, special categories of personal data.`,
      disclaimer: `If you Accept, you will be receiving secure communications from PSBs via MessagingIE.
          If you Decline, you will not receive any new messages, but you may still view previous messages already delivered. PSBs will no longer communicate with you through MessagingIE, but may contact you through other means.`,
      title: "Welcome to MessagingIE",
    },
    ga: {
      title: "Táimid ag fáilte duit le MessagingIE",
      description: `MessagingIE tusa a fháilte le teachtaireachtaí sa bhunachar sonraí (PSBs).
        Nuair a thógann tú teachtaireachtaí le MessagingIE, ní mór duit <b>córas</b> leis an teachtaireachtaí seo.        
        Chun teachtaireacht a sheoladh, ní mór duit teimpléad a chruthú ar dtús nó ceann a roghnú ón roghanna thíos. Mura bhfuil aon teimpléid cruthaithe, téigh chuig an gcuid <href>Teimpléidí Teachtaireachtaí</href> chun tús a chur leis.
        - Roghnaigh an cineál teachtaireachta atá uait a sheoladh,
        Please note, messages sent to you through MessagingIE may contain personal data. In some cases, special categories of personal data.`,
      disclaimer: `Má tá tú ag córas, beidh teachtaireachtaí a sheoladh le MessagingIE.
          Má tá tú ag córas, ní bheidh teachtaireachtaí a sheoladh le MessagingIE. Ní bheidh teachtaireachtaí a sheoladh le MessagingIE, ach beidh teachtaireachtaí a sheoladh leis an ríomhphost a phostáil ar do phróifíl.`,
    },
  },
};
