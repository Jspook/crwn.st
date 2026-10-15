const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');

const dashboardPath = path.join(__dirname, '../views/customer/dashboard.ejs');
const roomModalPath = path.join(__dirname, '../views/partials/room-modal.ejs');
const appJsPath = path.join(__dirname, '../public/js/app.js');

describe('Phase 5 UI Verification — Room Scanner & Manual Code Input', () => {
  const dashboardSource = fs.readFileSync(dashboardPath, 'utf8');
  const roomModalSource = fs.readFileSync(roomModalPath, 'utf8');
  const appJsSource = fs.readFileSync(appJsPath, 'utf8');

  test('dashboard.ejs contains NO active-room-resume-banner per D8', () => {
    assert.ok(!dashboardSource.includes('active-room-resume-banner'));
    assert.ok(!dashboardSource.includes('คุณกำลังใช้งานห้องลองเสื้อ'));
  });

  test('room-modal.ejs contains NO room-simulation-grid buttons per D9', () => {
    assert.ok(!roomModalSource.includes('room-simulation-grid'));
    assert.ok(!roomModalSource.includes('กำลังโหลดสถานะห้องลอง'));
  });

  test('room-modal.ejs contains manual code input and submit button', () => {
    assert.ok(roomModalSource.includes('id="room-manual-code-input"'));
    assert.ok(roomModalSource.includes('submitManualRoomCode()'));
    assert.ok(roomModalSource.includes('กรอกรหัส QR Code'));
  });

  test('app.js defines submitManualRoomCode and has no hardcoded 4-room simulation map', () => {
    assert.ok(appJsSource.includes('function submitManualRoomCode()'));
    assert.ok(!appJsSource.includes('function fetchFittingRoomsStatus()'));
    assert.ok(!appJsSource.includes('function getCleanRoomDisplay('));
  });

  test('dashboard renders cleanly without activeRoom', () => {
    const html = ejs.render(
      dashboardSource,
      { user: { name: 'Customer Test', role: 'CUSTOMER' }, products: [] },
      { filename: dashboardPath }
    );
    assert.ok(html.includes('สวัสดี, Customer Test'));
    assert.ok(!html.includes('active-room-resume-banner'));
  });
});
