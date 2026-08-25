import type { KnownProfileDataDetails } from "~/schemas/profiles/model.js";

const templateProfile: KnownProfileDataDetails = {
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@example.com",
  phone: "+353 1234567",
  address: "123 Main Street",
  city: "Dublin",
  dateOfBirth: "1990-01-01",
  ppsn: "1234567T",
  preferredLanguage: "en",
};

const headers = {
  firstName: "firstName",
  lastName: "lastName",
  email: "email",
  phone: "phone",
  address: "address",
  city: "city",
  dateOfBirth: "dateOfBirth",
  ppsn: "ppsn",
  preferredLanguage: "preferredLanguage",
};

export const getProfileTemplate = (): Buffer => {
  const csvContent = [
    Object.values(headers).join(","),
    Object.values(templateProfile).join(","),
  ].join("\n");

  return Buffer.from(csvContent, "utf-8");
};
