export type MessagingUserProfile = {
  firstName: string;
  lastName: string;
  ppsn?: string | null;
  id: string;
  preferredLanguage: string;
  phone?: string | null;
  email: string;
};

export enum AvailableTransports {
  EMAIL = "email",
  LIFE_EVENT = "lifeEvent",
}

export const ALL_TRANSPORTS = [
  AvailableTransports.EMAIL,
  AvailableTransports.LIFE_EVENT,
];

// LifeEvent is mandatory
export const SELECTABLE_TRANSPORTS = [AvailableTransports.EMAIL];
