// // Ép hệ thống nạp các biến từ file .env vào process.env trước khi cấu hình chạy
// require('dotenv').config();

// const { defineConfig } = require('@prisma/config');

// module.exports = defineConfig({
//   datasource: {
//     url: process.env.DATABASE_URL,
//   },
// });


// Nạp biến môi trường từ file .env bằng CommonJS
require('dotenv').config();

const { defineConfig } = require('@prisma/config');

module.exports = defineConfig({
  earlyAccess: true, // Yêu cầu bắt buộc của cấu hình Prisma 7
  datasource: {
    url: process.env.DATABASE_URL,
  },
});