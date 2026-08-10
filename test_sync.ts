import { db } from "./packages/db/src/client";
import { syncVisitEvent } from "./packages/db/src/visits";
import { getVisitorByQrToken } from "./packages/db/src/visitors";
import { exhibitors } from "./packages/db/src/schema";

async function run() {
  try {
    const visitor = await getVisitorByQrToken(db, "W7jbqIY6owSg_sX3m2arDFKkcMznxPTO");
    console.log("Visitor:", visitor);
    
    const exhibitor = await db.select().from(exhibitors).limit(1);
    console.log("Exhibitor:", exhibitor[0]);

    if (!visitor || !exhibitor[0]) return;

    const res = await syncVisitEvent(db, "a1b2c3d4-e5f6-7890-abcd-ef1234567890", exhibitor[0].id, visitor.id, new Date());
    console.log("Sync result:", res);
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}
run();
