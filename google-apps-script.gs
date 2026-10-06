/**
 * ZoubirNasriShop — استقبال الطلبات من المتجر وتسجيلها في ورقة Orders.
 * يجب أن يكون اسم الورقة الأولى في الجدول: Orders
 */

var SECRET = "ZN"; // يجب أن يطابق التوكن المُرسَل من index.html

// ===== إشعار Telegram (يصل للهاتف بصوت حتى والتطبيق مغلق) =====
// التوكن الكامل = الرقم + نقطتان + الجزء الذي يبدأ بـ AAH
var TG_TOKEN   = "7287658813:AAHMwiDXiMdKK34flPlA1ZAHHAeUJwtC2p8";
// اتركه فارغاً: يكتشف السكربت رقم محادثتك تلقائياً بعد أن تضغط Start وترسل رسالة للبوت.
// أو ضع رقمك الخاص من @userinfobot هنا.
var TG_CHAT_ID = "";

var HEADERS = [
  "المرجع", "التاريخ", "الزبون", "الهاتف", "الهاتف 2",
  "رمز الولاية", "الولاية", "البلدية", "العنوان", "نوع التوصيل",
  "المنتج", "الكمية", "سعر الوحدة", "التوصيل", "المجموع",
  "الحالة", "ملاحظات"
];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.token !== SECRET) {
      return ContentService.createTextOutput("unauthorized");
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Orders");
    if (!sheet) {
      sheet = ss.insertSheet("Orders");
    }

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    }

    var rows = data.rows || [];
    rows.forEach(function (row) {
      sheet.appendRow(row);
      notifyTelegram(row);
    });

    return ContentService.createTextOutput("ok");
  } catch (err) {
    return ContentService.createTextOutput("error: " + err.message);
  }
}

/** يرسل رسالة Telegram لكل طلب جديد — فشلها لا يمنع تسجيل الطلب. */
function notifyTelegram(row) {
  var chatId = getChatId();
  if (!TG_TOKEN || !chatId) return;
  try {
    var text =
      "🛒 طلب جديد " + row[0] + "\n" +
      "👤 " + row[2] + "\n" +
      "📞 " + row[3] + (row[4] ? " / " + row[4] : "") + "\n" +
      "📍 " + row[6] + " - " + row[7] + "\n" +
      "📦 " + row[10] + " × " + row[11] + "\n" +
      "💰 " + row[14] + " دج";
    UrlFetchApp.fetch("https://api.telegram.org/bot" + TG_TOKEN + "/sendMessage", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ chat_id: chatId, text: text }),
      muteHttpExceptions: true
    });
  } catch (e) {}
}

/** اختبار سريع يدوي من محرر Apps Script (Run → testDoPost) */
function testDoPost() {
  var fake = {
    postData: {
      contents: JSON.stringify({
        token: SECRET,
        rows: [["ZNTEST01", new Date().toLocaleString(), "زبون تجريبي", "0500000000", "", "58", "سطيف", "عين ولمان", "عنوان تجريبي", "المنزل", "منتج تجريبي", 1, 1000, 600, 1600, "pending", ""]]
      })
    }
  };
  doPost(fake);
}

/** يعيد رقم المحادثة: من TG_CHAT_ID، وإلا من آخر رسالة أُرسلت للبوت (ويحفظه). */
function getChatId() {
  if (TG_CHAT_ID) return TG_CHAT_ID;
  var props = PropertiesService.getScriptProperties();
  var saved = props.getProperty("TG_CHAT_ID");
  if (saved) return saved;
  try {
    var res = UrlFetchApp.fetch("https://api.telegram.org/bot" + TG_TOKEN + "/getUpdates", { muteHttpExceptions: true });
    var json = JSON.parse(res.getContentText());
    var list = json.result || [];
    for (var i = list.length - 1; i >= 0; i--) {
      var m = list[i].message || list[i].my_chat_member;
      if (m && m.chat && m.chat.type === "private") {
        props.setProperty("TG_CHAT_ID", String(m.chat.id));
        return String(m.chat.id);
      }
    }
  } catch (e) {}
  return "";
}

/** اختبار Telegram: شغّله من المحرر (Run → testTelegram) ثم افتح Execution log. */
function testTelegram() {
  var me = UrlFetchApp.fetch("https://api.telegram.org/bot" + TG_TOKEN + "/getMe", { muteHttpExceptions: true });
  Logger.log("getMe: " + me.getContentText());
  var chatId = getChatId();
  Logger.log("chat id: " + (chatId || "غير موجود — افتح البوت واضغط Start وأرسل له رسالة ثم أعد التشغيل"));
  if (!chatId) return;
  var r = UrlFetchApp.fetch("https://api.telegram.org/bot" + TG_TOKEN + "/sendMessage", {
    method: "post", contentType: "application/json",
    payload: JSON.stringify({ chat_id: chatId, text: "✅ ZoubirNasriShop: الإشعارات تعمل" }),
    muteHttpExceptions: true
  });
  Logger.log("send: " + r.getContentText());
}
