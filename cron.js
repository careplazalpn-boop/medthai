import cron from "node-cron";
import fetch from "node-fetch";

// ตั้ง schedule ให้รันทุก 1 นาที
cron.schedule("* * * * *", async () => {
  try {
    const response = await fetch("http://localhost:3000/api/update-therapist-status");
    const data = await response.json();
    console.log(`[${new Date().toLocaleString()}] Updated:`, data);
  } catch (error) {
    console.error("Error calling API:", error);
  }
});

console.log("Cron job started. Running every 1 minute...");
