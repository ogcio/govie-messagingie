export const PROFILE_IMPORT_EVENT_CATEGORY = "Profile Import";
export const PROFILE_IMPORT_EVENT_ACTIONS = {
  IMPORT_PROFILES_READ_FILE: {
    category: "Profile Import Uploaded File",
    name: "Number of profiles extracted from uploaded file",
    action: "Import Profiles Read File",
  },
  IMPORT_PROFILES_PROCESS_PROFILES: {
    category: "Profile Import Processed",
    name: "Number of profiles processed",
    action: "Import Profiles Process Profiles",
  },
  IMPORT_PROFILES_COMPLETED: {
    category: "Profile Import Completed",
    name: "Completed profile import",
    action: "Import Profiles Completed",
  },
  IMPORT_PROFILES_WEBHOOK: {
    category: "Profile Import Webhook",
    name: "Number of profiles imported from webhook",
    action: "Import Profiles Webhook",
  },
};
