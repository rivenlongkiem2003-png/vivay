-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "cccd" TEXT NOT NULL,
    "hanThanhToan" TEXT NOT NULL,
    "tienCanThanhToan" TEXT NOT NULL,
    "tienGiaiNgan" TEXT NOT NULL,
    "ngayGiaiNgan" TEXT,
    "soTaiKhoan" TEXT,
    "nganHang" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "stkDoanhNghiep" TEXT NOT NULL,
    "nganHangChung" TEXT NOT NULL,
    "tenChuDoanhNghiep" TEXT NOT NULL,
    "linkQrCode" TEXT NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");
