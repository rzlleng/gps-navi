/*
=========================================
GPS Navigator
app.js
=========================================
*/

const latInput = document.getElementById("lat");
const lonInput = document.getElementById("lon");
const navigateBtn = document.getElementById("navigateBtn");
const statusBox = document.getElementById("status");

/* -------------------------------
แสดงข้อความสถานะ
--------------------------------*/

function showStatus(message, color = "#1976d2") {

    statusBox.innerHTML = message;
    statusBox.style.color = color;

}

/* -------------------------------
ตรวจสอบ Latitude
--------------------------------*/

function isValidLatitude(lat) {

    return !isNaN(lat) &&
        lat >= -90 &&
        lat <= 90;

}

/* -------------------------------
ตรวจสอบ Longitude
--------------------------------*/

function isValidLongitude(lon) {

    return !isNaN(lon) &&
        lon >= -180 &&
        lon <= 180;

}

/* -------------------------------
เปิด Google Maps
--------------------------------*/

function openNavigation(lat, lon) {

    const url =
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;

    window.location.href = url;

}

/* -------------------------------
เมื่อกดปุ่ม
--------------------------------*/

navigateBtn.addEventListener("click", function () {

    const lat = parseFloat(latInput.value);

    const lon = parseFloat(lonInput.value);

    if (latInput.value.trim() === "") {

        showStatus("กรุณากรอก Latitude", "red");

        latInput.focus();

        return;

    }

    if (lonInput.value.trim() === "") {

        showStatus("กรุณากรอก Longitude", "red");

        lonInput.focus();

        return;

    }

    if (!isValidLatitude(lat)) {

        showStatus(
            "Latitude ต้องอยู่ระหว่าง -90 ถึง 90",
            "red"
        );

        latInput.focus();

        return;

    }

    if (!isValidLongitude(lon)) {

        showStatus(
            "Longitude ต้องอยู่ระหว่าง -180 ถึง 180",
            "red"
        );

        lonInput.focus();

        return;

    }

    showStatus("กำลังเปิด Google Maps...");

    openNavigation(lat, lon);

});

/* -------------------------------
กด Enter เพื่อเปิดนำทาง
--------------------------------*/

latInput.addEventListener("keypress", function (e) {

    if (e.key === "Enter") {

        lonInput.focus();

    }

});

lonInput.addEventListener("keypress", function (e) {

    if (e.key === "Enter") {

        navigateBtn.click();

    }

});

/* -------------------------------
โหลดเสร็จ
--------------------------------*/

window.addEventListener("load", function () {

    showStatus("พร้อมใช้งาน");

});