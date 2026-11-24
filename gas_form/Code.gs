/**
 * 2027年度 春の無料体験講座の申込（Googleフォーム用）
 *
 * 置き場所: 申込用Googleフォームの Apps Script
 * ファイル名: Code.gs と Index
 *
 * 初回手順:
 * 1. prepareGoogleForm を実行する
 * 2. デプロイ > 新しいデプロイ > 種類「ウェブアプリ」
 *    実行ユーザー: 自分
 *    アクセスできるユーザー: 全員
 * 3. 発行されたウェブアプリのURLを申込者に案内する
 *
 * 講座・校舎のスケジュールは、デモLPと同じ schedule.json を参照する。
 * https://keigo-fujiwara.github.io/new_year_2027_demo/src/new_year_2027/data/schedule.json
 * スケジュールを変えたあとは、デモLP側の schedule.json を公開すれば両方の申込画面に反映される。
 * 校舎の追加・削除をしたときは、prepareGoogleForm を再実行する。
 * 回答シートの空欄列は、フォームとつながっているあいだは削除できない。
 * cleanupResponseColumns を実行すると、不要な列を外す。回答先のシートは変えない。
 * 回答シートの「申込講座」は、その位置で「講座名」「日時」の2列に分ける。
 * 列は末尾に追加しない。複数講座は、講座ごとに1行になる。
 * splitCourseColumns を実行すると、今の回答シートをその形に直す。
 * 以降の申込も、フォームの回答送信は使わず、同じ列へ講座ごとに1行ずつ直接入れる。
 * 確認メールは申込1件につき1通。
 * 確認メールの送信元は SENDER_EMAIL。
 * 空欄のときは、ウェブアプリを実行しているGoogleアカウントから送る。
 * 別アドレスにする場合は、そのアカウントのGmail「名前」で確認済みの送信元だけ指定できる。
 * 指定できるアドレスは listSenderAliases を実行すると確認できる。
 */
var PRIVACY_POLICY_URL = "https://be-engineer.tech/privacy_policy";
var SENDER_NAME = "BeEngineer";
var SENDER_EMAIL = "";
var CONSENT_CHOICE = "同意する";
var FORM_TITLE = "2027年度 春の無料体験講座の申込";
var WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
var GRADES = [
  "新中学１年生",
  "新中学２年生",
  "新中学３年生",
  "新高校１年生",
  "新高校２年生",
  "新高校３年生"
];
var QUESTIONS = [
  { title: "新学年", type: FormApp.ItemType.MULTIPLE_CHOICE },
  { title: "校舎", type: FormApp.ItemType.MULTIPLE_CHOICE },
  { title: "申込講座", type: FormApp.ItemType.PARAGRAPH_TEXT },
  { title: "参加者氏名", type: FormApp.ItemType.TEXT },
  { title: "学校名", type: FormApp.ItemType.TEXT },
  { title: "メールアドレス", type: FormApp.ItemType.TEXT },
  { title: "電話番号", type: FormApp.ItemType.TEXT }
];

var SCHEDULE_URL = "https://keigo-fujiwara.github.io/new_year_2027_demo/src/new_year_2027/data/schedule.json";
var LINE_URLS = {
  "京大本校": "https://page.line.me/942ydzjx?oat_content=url&openQrModal=true",
  "梅田校": "https://line.me/R/ti/p/@759lvtlr?openQrModal=true",
  "飯田橋校": "https://line.me/R/ti/p/@028tlecq?oat_content=url&ts=07221501&openQrModal=true",
  "首里校": "https://line.me/R/ti/p/@153tdlvg?ts=07221502&oat_content=url&openQrModal=true"
};

function doGet() {
  var template = HtmlService.createTemplateFromFile("Index");
  template.viewJson = JSON.stringify(getViewModel()).replace(/</g, "\\u003c");
  return template.evaluate()
    .setTitle("春の無料体験講座の申込")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function prepareGoogleForm() {
  var form = getForm();
  form.setTitle(FORM_TITLE);
  form.setDescription(formDescription());
  form.setConfirmationMessage("申込ありがとうございました。校舎からのご連絡をお待ちください。");
  trySet(function() { form.setCollectEmail(false); });
  trySet(function() { form.setLimitOneResponsePerUser(false); });
  trySet(function() { form.setPublishingSummary(false); });
  trySet(function() { form.setShowLinkToRespondAgain(false); });
  trySet(function() { form.setAllowResponseEdits(false); });

  removeUnknownItems(form);
  QUESTIONS.forEach(function(spec) {
    configureItem(ensureItem(form, spec));
  });
  arrangeFormPages(form);

  var message = "フォームの質問を整えました。個人情報の説明はフォーム冒頭の1か所だけです。ウェブアプリを新しいバージョンで更新してください。";
  Logger.log(message);
  return message;
}

function cleanupResponseColumns() {
  var form = getForm();
  var sheet = responseSheet(form);
  var sheetName = sheet.getName();
  var lastColumn = sheet.getLastColumn();
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var keepTitles = { "タイムスタンプ": true, "Timestamp": true };
  QUESTIONS.forEach(function(spec) { keepTitles[spec.title] = true; });
  keepTitles["講座名"] = true;
  keepTitles["日時"] = true;
  var bestColumn = {};
  for (var column = 1; column <= headers.length; column += 1) {
    var title = String(headers[column - 1] || "");
    if (!keepTitles[title]) continue;
    var filled = 0;
    if (lastRow > 1) {
      sheet.getRange(2, column, lastRow - 1, 1).getValues().forEach(function(row) {
        if (String(row[0]).trim()) filled += 1;
      });
    }
    if (!bestColumn[title] || filled >= bestColumn[title].filled) {
      bestColumn[title] = { column: column, filled: filled };
    }
  }
  var keepColumns = {};
  Object.keys(bestColumn).forEach(function(title) {
    keepColumns[bestColumn[title].column] = true;
  });
  for (var index = headers.length; index >= 1; index -= 1) {
    if (!keepColumns[index]) sheet.deleteColumn(index);
  }
  var message = "不要な列を「" + sheetName + "」から削除しました。シートはそのままです。";
  Logger.log(message);
  return message;
}

function findResponseSheet(spreadsheet, form) {
  var formId = form.getId();
  var sheets = spreadsheet.getSheets();
  for (var i = 0; i < sheets.length; i += 1) {
    var url = sheets[i].getFormUrl();
    if (url && url.indexOf(formId) !== -1) return sheets[i];
  }
  throw new Error("回答用のシートが見つかりません。");
}

function submitToGoogleForm(data) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    locked = lock.tryLock(15000);
    if (!locked) {
      return { ok: false, message: "送信が混み合っています。少し待ってから、もう一度お試しください。" };
    }
    var check = validateApplication(data);
    if (!check.ok) return check;
    var form = getForm();
    var sheet = responseSheet(form);
    appendCourseRows(sheet, check.value);
    var mailResult = deliverConfirmationMail(check.value);
    return { ok: true, mailSent: mailResult.ok, message: mailResult.message };
  } catch (error) {
    return { ok: false, message: friendlyError(error) };
  } finally {
    if (locked) {
      try {
        lock.releaseLock();
      } catch (ignore) {}
    }
  }
}

function splitCourseColumns() {
  var sheet = ensureSplitSheet(getForm());
  var message = "「" + sheet.getName() + "」の申込講座を、同じ位置で「講座名」と「日時」に分けました。";
  Logger.log(message);
  return message;
}

function ensureSplitSheet(form) {
  var sheet = responseSheet(form);
  rewriteCourseColumn(sheet);
  return sheet;
}

function destinationId(form) {
  try {
    return form.getDestinationId() || "";
  } catch (error) {
    return "";
  }
}

function responseSheet(form) {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = destinationId(form) || props.getProperty("RESPONSE_SPREADSHEET_ID") || "";
  var spreadsheet = spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : findSpreadsheetNearForm(form);
  if (!spreadsheet) {
    throw new Error("回答先のスプレッドシートがありません。フォームの「回答」から、スプレッドシートを指定してください。");
  }
  props.setProperty("RESPONSE_SPREADSHEET_ID", spreadsheet.getId());
  var savedName = props.getProperty("RESPONSE_SHEET_NAME");
  if (savedName && spreadsheet.getSheetByName(savedName)) {
    return spreadsheet.getSheetByName(savedName);
  }
  var sheet = null;
  try {
    sheet = findResponseSheet(spreadsheet, form);
  } catch (error) {
    sheet = null;
  }
  if (!sheet) {
    var sheets = spreadsheet.getSheets();
    for (var i = 0; i < sheets.length; i += 1) {
      var width = Math.max(sheets[i].getLastColumn(), 1);
      var headers = sheets[i].getRange(1, 1, 1, width).getValues()[0];
      for (var column = 0; column < headers.length; column += 1) {
        var title = String(headers[column] || "");
        if (title === "申込講座" || title === "講座名") {
          sheet = sheets[i];
          break;
        }
      }
      if (sheet) break;
    }
  }
  if (!sheet) throw new Error("回答用のシートが見つかりません。");
  props.setProperty("RESPONSE_SHEET_NAME", sheet.getName());
  return sheet;
}

function findSpreadsheetNearForm(form) {
  var formId = form.getId();
  var fromFolder = findSpreadsheetInParents(form, formId);
  if (fromFolder) return fromFolder;
  var title = String(form.getTitle() || "");
  var names = [];
  if (title) {
    names.push(title + " (回答)");
    names.push(title + "（回答）");
    names.push(title);
  }
  for (var i = 0; i < names.length; i += 1) {
    var files = DriveApp.getFilesByName(names[i]);
    while (files.hasNext()) {
      var spreadsheet = openSpreadsheet(files.next().getId());
      if (spreadsheet && spreadsheetHasApplication(spreadsheet, formId)) return spreadsheet;
    }
  }
  if (!title) return searchSpreadsheetByText(formId);
  var query = 'mimeType = "' + MimeType.GOOGLE_SHEETS + '" and title contains "' + title.replace(/"/g, "") + '"';
  var found = DriveApp.searchFiles(query);
  var checked = 0;
  while (found.hasNext() && checked < 20) {
    checked += 1;
    var match = openSpreadsheet(found.next().getId());
    if (match && spreadsheetHasApplication(match, formId)) return match;
  }
  return searchSpreadsheetByText(formId);
}

function searchSpreadsheetByText(formId) {
  var found = DriveApp.searchFiles('mimeType = "' + MimeType.GOOGLE_SHEETS + '" and fullText contains "\'申込講座\'"');
  var checked = 0;
  while (found.hasNext() && checked < 20) {
    checked += 1;
    var spreadsheet = openSpreadsheet(found.next().getId());
    if (spreadsheet && spreadsheetHasApplication(spreadsheet, formId)) return spreadsheet;
  }
  return null;
}

function findSpreadsheetInParents(form, formId) {
  var parents = DriveApp.getFileById(form.getId()).getParents();
  while (parents.hasNext()) {
    var files = parents.next().getFilesByType(MimeType.GOOGLE_SHEETS);
    while (files.hasNext()) {
      var spreadsheet = openSpreadsheet(files.next().getId());
      if (spreadsheet && spreadsheetHasApplication(spreadsheet, formId)) return spreadsheet;
    }
  }
  return null;
}

function openSpreadsheet(id) {
  try {
    return SpreadsheetApp.openById(id);
  } catch (error) {
    return null;
  }
}

function spreadsheetHasApplication(spreadsheet, formId) {
  var sheets = spreadsheet.getSheets();
  for (var i = 0; i < sheets.length; i += 1) {
    var url = "";
    try {
      url = sheets[i].getFormUrl() || "";
    } catch (error) {
      url = "";
    }
    if (url && url.indexOf(formId) !== -1) return true;
    var width = Math.max(sheets[i].getLastColumn(), 1);
    var headers = sheets[i].getRange(1, 1, 1, width).getValues()[0].map(function(value) {
      return String(value || "");
    });
    if (headers.indexOf("申込講座") !== -1) return true;
    if (headers.indexOf("メールアドレス") !== -1 && headers.indexOf("新学年") !== -1 && (headers.indexOf("講座名") !== -1 || headers.indexOf("参加者氏名") !== -1)) {
      return true;
    }
  }
  return false;
}

function rewriteCourseColumn(sheet) {
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  var headers = values[0].map(function(value) { return String(value || ""); });
  var courseIndex = -1;
  for (var i = 0; i < headers.length; i += 1) {
    if (headers[i] === "申込講座" || headers[i] === "講座名") {
      courseIndex = i;
      break;
    }
  }
  if (courseIndex === -1) throw new Error("「申込講座」の列が見つかりません。");
  var paired = headers[courseIndex] === "講座名" && headers[courseIndex + 1] === "日時";
  var skip = {};
  for (var column = 0; column < headers.length; column += 1) {
    if (column === courseIndex) continue;
    if (paired && column === courseIndex + 1) continue;
    if (headers[column] === "講座名" || headers[column] === "日時" || headers[column] === "申込講座") skip[column] = true;
  }
  var expanded = [];
  for (var rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    if (isBlankRow(values[rowIndex])) continue;
    var source = String(values[rowIndex][courseIndex] || "");
    var lines = [];
    source.split(/\n/).forEach(function(line) {
      var text = String(line || "").replace(/^\s+|\s+$/g, "");
      if (text) lines.push(text);
    });
    var existingTime = paired ? String(values[rowIndex][courseIndex + 1] || "").replace(/^\s+|\s+$/g, "") : "";
    if (lines.length === 0) {
      expanded.push(projectCourseRow(values[rowIndex], courseIndex, "", existingTime, skip, paired));
      continue;
    }
    if (paired && lines.length === 1 && source.indexOf("\n") === -1 && existingTime) {
      expanded.push(projectCourseRow(values[rowIndex], courseIndex, lines[0], existingTime, skip, paired));
      continue;
    }
    lines.forEach(function(line) {
      var parts = splitCourseLabel(line);
      expanded.push(projectCourseRow(values[rowIndex], courseIndex, parts.title, parts.datetime, skip, paired));
    });
  }
  var newHeaders = [];
  headers.forEach(function(header, index) {
    if (skip[index]) return;
    if (index === courseIndex) {
      newHeaders.push("講座名");
      if (!paired) newHeaders.push("日時");
      return;
    }
    newHeaders.push(header);
  });
  var width = newHeaders.length;
  var output = [newHeaders].concat(expanded);
  output.forEach(function(row) {
    while (row.length < width) row.push("");
    if (row.length > width) row.length = width;
  });
  sheet.clearContents();
  if (sheet.getMaxColumns() < width) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), width - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, output.length, width).setValues(output);
  if (sheet.getMaxColumns() > width) {
    sheet.deleteColumns(width + 1, sheet.getMaxColumns() - width);
  }
  layoutSplitColumns(sheet, newHeaders.indexOf("講座名"));
}

function projectCourseRow(source, courseIndex, title, datetime, skip, paired) {
  var row = [];
  for (var index = 0; index < source.length; index += 1) {
    if (skip[index]) continue;
    if (index === courseIndex) {
      row.push(title);
      if (!paired) row.push(datetime);
      continue;
    }
    if (paired && index === courseIndex + 1) {
      row.push(datetime);
      continue;
    }
    row.push(source[index]);
  }
  return row;
}

function appendCourseRows(sheet, data) {
  var width = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, width).getValues()[0].map(function(value) {
    return String(value || "");
  });
  var rows = data.courses.map(function(course) {
    return headers.map(function(header) {
      if (header === "タイムスタンプ" || header === "Timestamp") return new Date();
      if (header === "新学年") return data.grade;
      if (header === "校舎") return data.campus;
      if (header === "講座名") return course.title;
      if (header === "日時") return course.datetime;
      if (header === "申込講座") return course.title + (course.datetime ? " " + course.datetime : "");
      if (header === "参加者氏名") return data.name;
      if (header === "学校名") return data.school;
      if (header === "メールアドレス") return data.email;
      if (header === "電話番号") return data.phone;
      return "";
    });
  });
  if (rows.length === 0) return;
  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
  layoutSplitColumns(sheet, headers.indexOf("講座名"));
}

function layoutSplitColumns(sheet, courseIndex) {
  if (courseIndex < 0) return;
  var nameColumn = courseIndex + 1;
  var timeColumn = nameColumn + 1;
  if (sheet.getColumnWidth(nameColumn) < 280) sheet.setColumnWidth(nameColumn, 280);
  if (sheet.getColumnWidth(timeColumn) < 240) sheet.setColumnWidth(timeColumn, 240);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var range = sheet.getRange(2, nameColumn, lastRow - 1, 2);
  range.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  range.setVerticalAlignment("middle");
}

function isBlankRow(row) {
  for (var i = 0; i < row.length; i += 1) {
    if (String(row[i] || "").replace(/^\s+|\s+$/g, "")) return false;
  }
  return true;
}

function splitCourseLabel(line) {
  var text = String(line || "");
  var match = text.match(/^(.*)\s(\d{1,2}月\d{1,2}日（[^）]+）\d{1,2}:\d{2}-\d{1,2}:\d{2})$/);
  if (!match) return { title: text, datetime: "" };
  return { title: match[1], datetime: match[2] };
}

function getViewModel() {
  try {
    return {
      grades: GRADES,
      campuses: buildCampuses(),
      error: ""
    };
  } catch (error) {
    return {
      grades: GRADES,
      campuses: [],
      error: "講座情報を読み込めませんでした。"
    };
  }
}

function loadCatalog() {
  if (loadCatalog.cache) return loadCatalog.cache;
  var stored = CacheService.getScriptCache().get("courses-json");
  if (stored) {
    loadCatalog.cache = JSON.parse(stored);
    return loadCatalog.cache;
  }
    var response = UrlFetchApp.fetch(SCHEDULE_URL + "?t=" + new Date().getTime(), {
    muteHttpExceptions: true,
    followRedirects: true
  });
  if (response.getResponseCode() !== 200) {
    throw new Error("講座情報を読み込めませんでした。");
  }
  var catalog = JSON.parse(response.getContentText() || "{}");
  CacheService.getScriptCache().put("courses-json", JSON.stringify(catalog), 60);
  loadCatalog.cache = catalog;
  return catalog;
}

function formDescription() {
  return [
    "2027年度 春の無料体験講座のお申し込みです。",
    "",
    "【個人情報の利用について】",
    "お申し込みの際に、新学年・校舎・申込講座・参加者氏名・学校名・メールアドレス・電話番号を取得します。",
    "ご入力いただいた個人情報は、BeEngineer2027春の無料体験講座の受付、ご連絡および当日の運営にのみ使用します。法令に基づく場合を除き、ご本人の同意なく第三者へ提供することはありません。",
    "",
    "プライバシーポリシー",
    PRIVACY_POLICY_URL
  ].join("\n");
}

function getForm() {
  var active = null;
  try {
    active = FormApp.getActiveForm();
  } catch (error) {
    active = null;
  }
  if (active) return active;
  var id = PropertiesService.getScriptProperties().getProperty("FORM_ID");
  if (id) return FormApp.openById(id);
  throw new Error("Googleフォームに紐づいたスクリプトから実行してください。スタンドアロンの場合は、スクリプト プロパティ FORM_ID にフォームIDを設定してください。");
}

function clearPageNavigation(form) {
  var items = form.getItems(FormApp.ItemType.MULTIPLE_CHOICE);
  for (var i = 0; i < items.length; i += 1) {
    var choiceItem = items[i].asMultipleChoiceItem();
    var choices = choiceItem.getChoices();
    var plain = [];
    for (var j = 0; j < choices.length; j += 1) {
      plain.push(choiceItem.createChoice(choices[j].getValue()));
    }
    if (plain.length > 0) choiceItem.setChoices(plain);
  }
}

function removeUnknownItems(form) {
  clearPageNavigation(form);
  var allowed = {};
  QUESTIONS.forEach(function(spec) { allowed[spec.title] = true; });
  var seen = {};
  var items = form.getItems();
  var removing = [];
  for (var i = 0; i < items.length; i += 1) {
    var title = items[i].getTitle();
    if (!allowed[title] || seen[title]) removing.push(items[i].getId());
    else seen[title] = true;
  }
  removing.forEach(function(id) {
    var item = form.getItemById(id);
    if (item && item.getType() !== FormApp.ItemType.PAGE_BREAK) form.deleteItem(item);
  });
  removing.forEach(function(id) {
    var item = form.getItemById(id);
    if (item && item.getType() === FormApp.ItemType.PAGE_BREAK) form.deleteItem(item);
  });
}

function ensureItem(form, spec) {
  var item = findItemByTitle(form, spec.title);
  if (item && item.getType() !== spec.type) {
    form.deleteItem(item);
    item = null;
  }
  if (!item) {
    addItem(form, spec.type).setTitle(spec.title);
    item = findItemByTitle(form, spec.title);
  }
  if (!item || item.getType() !== spec.type) {
    throw new Error("「" + spec.title + "」を用意できませんでした。");
  }
  return item;
}

function arrangeFormPages(form) {
  QUESTIONS.forEach(function(spec, index) {
    placeItem(form, findItemByTitle(form, spec.title), index);
  });
}

function placeItem(form, item, index) {
  if (!item) return;
  var from = item.getIndex();
  if (from !== index) form.moveItem(from, index);
}

function addItem(form, type) {
  if (type === FormApp.ItemType.CHECKBOX) return form.addCheckboxItem();
  if (type === FormApp.ItemType.MULTIPLE_CHOICE) return form.addMultipleChoiceItem();
  if (type === FormApp.ItemType.PARAGRAPH_TEXT) return form.addParagraphTextItem();
  if (type === FormApp.ItemType.TEXT) return form.addTextItem();
  throw new Error("未対応の質問形式です。");
}

function configureItem(item) {
  var title = item.getTitle();
  if (title === "新学年") {
    item.asMultipleChoiceItem()
      .setChoiceValues(GRADES)
      .showOtherOption(false)
      .setRequired(true);
    return;
  }
  if (title === "校舎") {
    item.asMultipleChoiceItem()
      .setChoiceValues(campusNames())
      .showOtherOption(false)
      .setRequired(true);
    return;
  }
  if (title === "申込講座") {
    item.asParagraphTextItem()
      .setHelpText("複数の講座は1行ずつ保存されます。")
      .setRequired(true);
    return;
  }
  if (title === "メールアドレス") {
    item.asTextItem()
      .setHelpText("申込内容の確認メールを、このアドレスへ送信します。")
      .setRequired(true);
    return;
  }
  if (title === "電話番号") {
    item.asTextItem()
      .setHelpText("ハイフンあり・なし、どちらでも入力できます。")
      .setRequired(true);
    return;
  }
  item.asTextItem().setRequired(true);
}

function fillResponse(form, response, data, course) {
  var grade = requireItem(form, "新学年", FormApp.ItemType.MULTIPLE_CHOICE);
  response.withItemResponse(grade.asMultipleChoiceItem().createResponse(data.grade));

  var campus = requireItem(form, "校舎", FormApp.ItemType.MULTIPLE_CHOICE);
  response.withItemResponse(campus.asMultipleChoiceItem().createResponse(data.campus));

  var courses = requireItem(form, "申込講座", FormApp.ItemType.PARAGRAPH_TEXT);
  response.withItemResponse(courses.asParagraphTextItem().createResponse(course.title + " " + course.datetime));

  var name = requireItem(form, "参加者氏名", FormApp.ItemType.TEXT);
  response.withItemResponse(name.asTextItem().createResponse(data.name));

  var school = requireItem(form, "学校名", FormApp.ItemType.TEXT);
  response.withItemResponse(school.asTextItem().createResponse(data.school));

  var email = requireItem(form, "メールアドレス", FormApp.ItemType.TEXT);
  response.withItemResponse(email.asTextItem().createResponse(data.email));

  var phone = requireItem(form, "電話番号", FormApp.ItemType.TEXT);
  response.withItemResponse(phone.asTextItem().createResponse(data.phone));
}

function requireItem(form, title, type) {
  var item = findItemByTitle(form, title);
  if (!item) {
    throw new Error("フォームに「" + title + "」がありません。prepareGoogleForm を実行してください。");
  }
  if (item.getType() !== type) {
    throw new Error("「" + title + "」の回答形式が違います。prepareGoogleForm を実行してください。");
  }
  return item;
}

function findItemByTitle(form, title) {
  var items = form.getItems();
  for (var i = 0; i < items.length; i += 1) {
    if (items[i].getTitle() === title) return items[i];
  }
  return null;
}

function validateApplication(data) {
  var consent = cleanText(data && data.consent, 20);
  if (consent !== CONSENT_CHOICE) {
    return { ok: false, message: "個人情報の取り扱いに同意いただけない場合は、お申し込みできません。" };
  }

  var grade = cleanText(data.grade, 30);
  var campusName = cleanText(data.campus, 40);
  var name = cleanText(data.name, 50);
  var school = cleanText(data.school, 80);
  var email = normalizeEmail(data.email);
  var phone = cleanText(data.phone, 20);
  if (!grade || GRADES.indexOf(grade) === -1) {
    return { ok: false, message: "新学年を選び直してください。" };
  }
  if (!name) return { ok: false, message: "参加者氏名を入力してください。" };
  if (!school) return { ok: false, message: "学校名を入力してください。" };
  if (!isEmailValid(email)) {
    return { ok: false, message: "メールアドレスを確認してください。" };
  }
  if (!phone || !isPhoneValid(phone)) {
    return { ok: false, message: "電話番号は10桁または11桁で入力してください。" };
  }

  var campus = findOpenCampus(campusName);
  if (!campus) {
    return { ok: false, message: "この校舎は現在申し込みを受け付けていません。校舎を選び直してください。" };
  }

  var courses = uniqueCourses(data.courses, campus);
  if (courses.length === 0) {
    return { ok: false, message: "受講する無料体験講座を選び直してください。" };
  }

  return {
    ok: true,
    value: {
      consent: consent,
      grade: grade,
      campus: campus.name,
      courses: courses,
      name: name,
      school: school,
      email: email,
      phone: phone,
      postalCode: campus.postalCode,
      address: campus.address,
      access: campus.access,
      mapUrl: campus.mapUrl,
      lineUrl: campus.lineUrl
    }
  };
}

function listSenderAliases() {
  var account = Session.getEffectiveUser().getEmail();
  var aliases = GmailApp.getAliases();
  var lines = [
    "実行アカウント: " + account,
    "SENDER_EMAIL に指定できるアドレス:",
    account
  ];
  aliases.forEach(function(alias) {
    lines.push(alias);
  });
  if (aliases.length === 0) {
    lines.push("（追加の送信元はまだありません。Gmailの「名前」から追加してください）");
  }
  var message = lines.join("\n");
  Logger.log(message);
  return message;
}

function deliverConfirmationMail(data) {
  try {
    var sender = resolveSenderEmail();
    if (sender.error) return { ok: false, message: sender.error };
    var subject = "【BeEngineer】2027年度 春の無料体験講座の申込を受け付けました";
    var body = confirmationBody(data);
    var htmlBody = confirmationHtml(data);
    if (sender.email) {
      GmailApp.sendEmail(data.email, subject, body, {
        from: sender.email,
        name: SENDER_NAME,
        replyTo: sender.email,
        htmlBody: htmlBody
      });
    } else {
      MailApp.sendEmail({
        to: data.email,
        subject: subject,
        name: SENDER_NAME,
        body: body,
        htmlBody: htmlBody
      });
    }
    return { ok: true, message: "" };
  } catch (error) {
    Logger.log(error);
    return { ok: false, message: mailErrorMessage(error) };
  }
}

function sendTestConfirmationMail() {
  var result = deliverConfirmationMail({
    name: "テスト 太郎",
    grade: "新中学２年生",
    campus: "梅田校",
    school: "〇〇中学校",
    email: Session.getEffectiveUser().getEmail(),
    phone: "090-1234-5678",
    courses: [{ title: "テスト講座", datetime: "2月23日（火祝）10:00-11:00" }],
    postalCode: "〒000-0000",
    address: "テスト住所",
    access: "テストのアクセス",
    mapUrl: "https://www.google.com/maps",
    lineUrl: LINE_URLS["梅田校"] || ""
  });
  Logger.log(result.ok ? "テストメールを送信しました。" : result.message);
}

function resolveSenderEmail() {
  var requested = normalizeEmail(SENDER_EMAIL);
  if (!requested) return { email: "" };
  var account = "";
  try {
    account = normalizeEmail(Session.getEffectiveUser().getEmail());
  } catch (error) {
    account = "";
  }
  if (requested === account) return { email: "" };
  var aliases = GmailApp.getAliases();
  for (var i = 0; i < aliases.length; i += 1) {
    if (normalizeEmail(aliases[i]) === requested) return { email: aliases[i] };
  }
  return {
    error: "申込は保存しました。送信元「" + requested + "」は、このGoogleアカウントの送信元として追加されていません。"
  };
}

function confirmationBody(data) {
  var rule = "━━━━━━━━━━━━━━━━━━━━";
  var thin = "────────────────────";
  var lines = [
    data.name + " 様",
    "",
    "このたびは、BeEngineerの無料体験講座に",
    "お申し込みいただき、ありがとうございます。",
    "以下の内容で受け付けました。",
    "",
    rule,
    "【お申し込みを受け付けました】",
    "2027年度 春の無料体験講座",
    rule,
    "",
    "■ 申込講座",
    thin
  ];
  data.courses.forEach(function(course) {
    lines.push("・" + course.title);
    if (course.datetime) lines.push("　日時：" + course.datetime);
  });
  lines.push(
    "",
    "■ お申し込み内容",
    thin,
    "・新学年　　　　：" + data.grade,
    "・校舎　　　　　：" + data.campus,
    "・参加者氏名　　：" + data.name,
    "・学校名　　　　：" + data.school,
    "・メールアドレス：" + data.email,
    "・電話番号　　　：" + data.phone,
    ""
  );
  if (data.postalCode || data.address) {
    lines.push("■ 校舎のご案内", thin, "【" + data.campus + "】");
    if (data.postalCode) lines.push(data.postalCode);
    if (data.address) lines.push(data.address);
    if (data.access) lines.push(data.access);
    if (data.mapUrl) lines.push("", "▼ 地図を開く", data.mapUrl);
    lines.push("");
  }
  if (data.lineUrl) {
    lines.push(
      "■ 今後のご連絡について",
      thin,
      "今後のご連絡は、" + data.campus + "専用LINEで行うとスムーズです。",
      "友だち追加をお願いいたします。",
      "",
      "▼ " + data.campus + "専用LINEを友だち追加する",
      data.lineUrl,
      ""
    );
  }
  lines.push(
    data.campus + "からのご連絡をお待ちください。",
    "",
    rule,
    "BeEngineer",
    "※このメールは送信専用です。ご返信いただいてもお答えできません。",
    rule
  );
  return lines.join("\n");
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mailRow(label, value) {
  return '<tr>' +
    '<th style="width:110px;padding:10px 12px;border-bottom:1px solid #e6e6e6;text-align:left;font-weight:normal;color:#666666;font-size:13px;vertical-align:top;">' + escapeHtml(label) + '</th>' +
    '<td style="padding:10px 12px;border-bottom:1px solid #e6e6e6;color:#222222;font-size:15px;">' + escapeHtml(value) + '</td>' +
    '</tr>';
}

function mailSectionTitle(text) {
  return '<p style="margin:28px 0 10px;padding-left:10px;border-left:4px solid #06C755;font-size:15px;font-weight:bold;color:#222222;">' + escapeHtml(text) + '</p>';
}

function mailButton(url, label) {
  return '<a href="' + escapeHtml(url) + '" style="display:inline-block;margin-top:12px;padding:10px 20px;border-radius:6px;background:#06C755;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">' + escapeHtml(label) + '</a>';
}

function confirmationHtml(data) {
  var courses = data.courses.map(function(course) {
    return '<div style="margin:0 0 8px;padding:12px 14px;border-radius:6px;background:#f4fbf6;">' +
      '<div style="font-size:15px;font-weight:bold;color:#222222;">' + escapeHtml(course.title) + '</div>' +
      (course.datetime ? '<div style="margin-top:4px;font-size:14px;color:#444444;">' + escapeHtml(course.datetime) + '</div>' : '') +
      '</div>';
  }).join("");

  var guide = "";
  if (data.postalCode || data.address) {
    guide = mailSectionTitle("校舎のご案内") +
      '<p style="margin:0;font-size:14px;line-height:1.7;color:#222222;">' +
      '<strong>' + escapeHtml(data.campus) + '</strong><br>' +
      (data.postalCode ? escapeHtml(data.postalCode) + '<br>' : '') +
      escapeHtml(data.address || "") +
      (data.access ? '<br><span style="color:#666666;">' + escapeHtml(data.access) + '</span>' : '') +
      '</p>' +
      (data.mapUrl ? mailButton(data.mapUrl, "地図を開く") : "");
  }

  var line = "";
  if (data.lineUrl) {
    line = mailSectionTitle("今後のご連絡について") +
      '<p style="margin:0;font-size:14px;line-height:1.7;color:#222222;">今後のご連絡は、' + escapeHtml(data.campus) + '専用LINEで行うとスムーズです。<br>友だち追加をお願いいたします。</p>' +
      mailButton(data.lineUrl, data.campus + "専用LINEを友だち追加する");
  }

  return '<div style="margin:0;padding:24px 12px;background:#f5f5f5;font-family:\'Hiragino Sans\',\'Hiragino Kaku Gothic ProN\',Meiryo,sans-serif;">' +
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">' +
    '<div style="padding:24px 24px 16px;text-align:center;border-bottom:3px solid #06C755;">' +
    '<img src="https://beengineer-organization.github.io/trial-lesson/logo_color.png" alt="BeEngineer" width="180" style="display:inline-block;max-width:180px;height:auto;">' +
    '<p style="margin:14px 0 0;font-size:18px;font-weight:bold;color:#222222;">お申し込みを受け付けました</p>' +
    '<p style="margin:4px 0 0;font-size:13px;color:#666666;">2027年度 春の無料体験講座</p>' +
    '</div>' +
    '<div style="padding:24px;">' +
    '<p style="margin:0;font-size:15px;line-height:1.8;color:#222222;">' + escapeHtml(data.name) + ' 様<br><br>' +
    'このたびは、BeEngineerの無料体験講座にお申し込みいただき、ありがとうございます。<br>以下の内容で受け付けました。</p>' +
    mailSectionTitle("申込講座") + courses +
    mailSectionTitle("お申し込み内容") +
    '<table style="width:100%;border-collapse:collapse;border-top:1px solid #e6e6e6;">' +
    mailRow("新学年", data.grade) +
    mailRow("校舎", data.campus) +
    mailRow("参加者氏名", data.name) +
    mailRow("学校名", data.school) +
    mailRow("メールアドレス", data.email) +
    mailRow("電話番号", data.phone) +
    '</table>' +
    guide + line +
    '<p style="margin:28px 0 0;font-size:14px;line-height:1.8;color:#222222;">' + escapeHtml(data.campus) + 'からのご連絡をお待ちください。</p>' +
    '</div>' +
    '<div style="padding:14px 24px;background:#fafafa;font-size:12px;line-height:1.6;color:#888888;text-align:center;">このメールは送信専用です。ご返信いただいてもお答えできません。<br>BeEngineer</div>' +
    '</div></div>';
}

function mailErrorMessage(error) {
  var message = error && error.message ? String(error.message) : "";
  if (/permission|権限|auth|Authorization/i.test(message)) {
    return "申込は保存しました。確認メールの送信権限が未許可のため、メールは届いていません。";
  }
  if (/alias|from address|送信元/i.test(message)) {
    return "申込は保存しました。指定した送信元アドレスからメールを送れませんでした。";
  }
  return "申込は保存しましたが、確認メールを送信できませんでした。";
}

function normalizeEmail(value) {
  return String(value == null ? "" : value)
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(character) {
      return String.fromCharCode(character.charCodeAt(0) - 0xFEE0);
    })
    .replace(/＠/g, "@")
    .replace(/[．。]/g, ".")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function isEmailValid(value) {
  if (!value || value.length > 254) return false;
  return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(value);
}

function uniqueCourses(values, campus) {
  var allowed = {};
  campus.courses.forEach(function(course) {
    allowed[course.label] = course;
  });
  var seen = {};
  var courses = [];
  var list = Array.isArray(values) ? values : [];
  for (var i = 0; i < list.length && courses.length < 20; i += 1) {
    var label = cleanText(list[i], 120);
    var course = allowed[label];
    if (!label || seen[label] || !course) continue;
    seen[label] = true;
    courses.push({
      title: course.title,
      datetime: course.datetime,
      label: label
    });
  }
  if (Array.isArray(values) && values.length !== courses.length) return [];
  return courses;
}

function findOpenCampus(name) {
  var campuses = buildCampuses();
  for (var i = 0; i < campuses.length; i += 1) {
    if (campuses[i].name === name) return campuses[i];
  }
  return null;
}

function campusNames() {
  var catalog = loadCatalog();
  return (catalog.campuses || []).filter(function(campus) {
    return campus.name && !campus.hidden;
  }).map(function(campus) {
    return campus.name;
  });
}

function scheduleDate(year, value) {
  var parts = String(value || "").split("/");
  if (parts.length !== 2) return "";
  var month = Number(parts[0]);
  var day = Number(parts[1]);
  if (!month || !day) return "";
  return year + "-" + ("0" + month).slice(-2) + "-" + ("0" + day).slice(-2);
}

function buildCampuses() {
  var schedule = loadCatalog();
  var year = Number(schedule.year);
  var holidays = {};
  (schedule.holidays || []).forEach(function(value) { holidays[value] = true; });
  var items = Array.isArray(schedule.items) ? schedule.items : [];
  return (schedule.campuses || []).filter(function(campus) {
    return campus.name && !campus.hidden;
  }).map(function(campus) {
    var address = Array.isArray(campus.address) ? campus.address.filter(Boolean).join(" ") : "";
    var access = Array.isArray(campus.access) ? campus.access.filter(Boolean).join(" ") : "";
    var courses = [];
    items.forEach(function(item) {
      if (item.campus !== campus.key) return;
      var time = String(item.time || "").split("-");
      var date = scheduleDate(year, item.date);
      var title = (item.events || []).map(function(event) {
        return event.name;
      }).filter(Boolean).join("・");
      if (!title || !date || !time[0] || !time[1]) return;
      courses.push({
        title: title,
        date: date,
        start: time[0],
        end: time[1],
        holiday: !!holidays[item.date]
      });
    });
    courses.sort(compareCourses);
    var mapQuery = ((campus.zip || "") + " " + address).trim();
    return {
      name: campus.name,
      lineUrl: LINE_URLS[campus.name] || "",
      postalCode: campus.zip || "",
      address: address,
      access: access,
      mapUrl: address
        ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(mapQuery)
        : "",
      courses: courses.filter(function(course) {
        return isCourseOpen(course.date, 2);
      }).map(formatCourse)
    };
  }).filter(function(campus) {
    return campus.courses.length > 0;
  });
}

function compareCourses(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if ((a.start || "") !== (b.start || "")) return (a.start || "") < (b.start || "") ? -1 : 1;
  return String(a.title || "").localeCompare(String(b.title || ""), "ja");
}

function isCourseOpen(dateStr, closeDaysBefore) {
  return daysUntilCourse(dateStr) > closeDaysBefore;
}

function daysUntilCourse(dateStr) {
  var parts = String(dateStr || "").split("-");
  if (parts.length !== 3) return -1;
  var courseUtc = Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return (courseUtc - jstTodayUtc()) / 86400000;
}

function jstTodayUtc() {
  var formatted = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
  var parts = formatted.split("-");
  return Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function formatCourse(course) {
  var parts = String(course.date).split("-");
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  var day = Number(parts[2]);
  var weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  var isSaturday = weekday === "土";
  var isSunday = weekday === "日";
  var weekdayLabel = isSaturday || isSunday ? weekday : (course.holiday ? weekday + "祝" : weekday);
  var dateText = month + "月" + day + "日";
  var timeText = course.start + "-" + course.end;
  var datetime = dateText + "（" + weekdayLabel + "）" + timeText;
  var start = splitTime(course.start);
  var end = splitTime(course.end);
  return {
    title: course.title,
    dateText: dateText,
    weekdayLabel: weekdayLabel,
    weekdayClass: isSaturday ? "is-saturday" : (isSunday || course.holiday ? "is-sunday-or-holiday" : ""),
    timeText: timeText,
    datetime: datetime,
    durationMinutes: (end.hour * 60 + end.minute) - (start.hour * 60 + start.minute),
    label: course.title + " " + datetime
  };
}

function splitTime(value) {
  var parts = String(value || "").split(":");
  return {
    hour: Number(parts[0]) || 0,
    minute: Number(parts[1]) || 0
  };
}

function cleanText(value, maxLength) {
  var text = String(value == null ? "" : value).replace(/^\s+|\s+$/g, "");
  if (!text || text.length > maxLength) return "";
  return text;
}

function isPhoneValid(value) {
  var digits = String(value || "")
    .replace(/[０-９]/g, function(character) {
      return String.fromCharCode(character.charCodeAt(0) - 0xFEE0);
    })
    .replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
}

function friendlyError(error) {
  var message = error && error.message ? String(error.message) : "";
  if (/not accepting|no longer accepting|回答を受け付けていません/i.test(message)) {
    return "このフォームは現在、回答を受け付けていません。フォームの設定で回答の受付をオンにしてください。";
  }
  if (/Sign-in required|login required|ログイン/i.test(message)) {
    return "フォームがログイン必須になっています。回答の制限を解除してから、もう一度お試しください。";
  }
  if (/invalid choice|does not match/i.test(message)) {
    return "フォームの選択肢と申込内容が一致しません。prepareGoogleForm を実行してから、もう一度お試しください。";
  }
  if (/応答先がありません/.test(message)) {
    return "回答先のスプレッドシートが見つかりません。フォームの回答先を選び直し、splitCourseColumns を実行してください。";
  }
  return message || "送信できませんでした。もう一度お試しください。";
}

function trySet(callback) {
  try {
    callback();
  } catch (error) {
    Logger.log(error);
  }
}
