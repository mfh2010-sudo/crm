import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ⚠️ غيّر 'sales-crm' لاسم الـ repository بتاعك على GitHub
export default defineConfig({
  plugins: [react()],
  base: "/sales-crm/",
});
