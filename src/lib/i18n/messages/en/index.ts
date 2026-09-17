import type { Dictionary } from "../../config";

import { admin } from "./admin";
import { analytics } from "./analytics";
import { auth } from "./auth";
import { billing } from "./billing";
import { businesses } from "./businesses";
import { common } from "./common";
import { dashboard } from "./dashboard";
import { errors } from "./errors";
import { findings } from "./findings";
import { legal } from "./legal";
import { marketing } from "./marketing";
import { messages } from "./messages";
import { nav } from "./nav";
import { onboarding } from "./onboarding";
import { opportunities } from "./opportunities";
import { pipeline } from "./pipeline";
import { reports } from "./reports";
import { scans } from "./scans";
import { services } from "./services";
import { settings } from "./settings";
import { templates } from "./templates";

export const en: Dictionary = {
  common,
  nav,
  auth,
  onboarding,
  dashboard,
  scans,
  businesses,
  opportunities,
  pipeline,
  messages,
  templates,
  analytics,
  settings,
  billing,
  admin,
  reports,
  legal,
  errors,
  findings,
  services,
  marketing,
};
