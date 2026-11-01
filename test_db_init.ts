import "dotenv/config";
import { Database } from "./server/db/database";
(async () => {
    const d = new Database();
    await d.init();
    console.log("RootMobile env:", process.env.ROOT_OWNER_MOBILE);
    const root = d.users.find(u => u.roles.includes('super-admin') || u.id === 'usr-super');
    console.log("Root user:", root);
})();
