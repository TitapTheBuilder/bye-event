import "dotenv/config";
import { db } from "./src/client";
import { exhibitors, visitors } from "./src/schema";
import { syncVisitEvent } from "./src/visits";

async function main() {
  const ex = await db.select().from(exhibitors).limit(1);
  const vis = await db.select().from(visitors).limit(1);
  
  if (!ex[0] || !vis[0]) {
    console.log("No exhibitor or visitor found in DB to test with.");
    return;
  }

  const localId = crypto.randomUUID();
  console.log("Testing syncVisitEvent with:", { 
    localId, 
    exId: ex[0].id, 
    visId: vis[0].id 
  });

  try {
    const res = await syncVisitEvent(db, localId, ex[0].id, vis[0].id, new Date());
    console.log("Success:", res);
  } catch (err) {
    console.error("DB Error:", err);
  }
  process.exit(0);
}
main();
