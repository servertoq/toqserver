import fs from "fs";

const path = "src/components/messages/MessagesInbox.tsx";
let c = fs.readFileSync(path, "utf8");
c = c.replace(/ "([a-z[-][^"]+)"/g, " $1");
fs.writeFileSync(path, c);
console.log("fixed");
