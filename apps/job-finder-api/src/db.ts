import { createDb } from "@repo/db";
import * as auth from "@repo/db/auth";
import * as jobFinder from "@repo/db/job-finder";

export const db = createDb({ ...auth, ...jobFinder });
