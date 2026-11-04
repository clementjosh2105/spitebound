import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'tests/browser',timeout:45000,workers:1,use:{baseURL:'http://127.0.0.1:5182',headless:true},webServer:{command:'npm run dev -- --host 127.0.0.1 --port 5182',env:{TROLL_DB_PATH:':memory:'},url:'http://127.0.0.1:5182',reuseExistingServer:false},reporter:'list'});
